package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/fuseone/event-gateway/internal/kafka"
	"github.com/fuseone/event-gateway/internal/metrics"
	egmw "github.com/fuseone/event-gateway/internal/middleware"
	"go.uber.org/zap"
	"nhooyr.io/websocket"
	"nhooyr.io/websocket/wsjson"
)

type WebSocketHandler struct {
	kafkaPool *kafka.ClientPool
	collector *metrics.Collector
	logger    *zap.Logger
}

func NewWebSocketHandler(kafkaPool *kafka.ClientPool, collector *metrics.Collector, logger *zap.Logger) *WebSocketHandler {
	return &WebSocketHandler{
		kafkaPool: kafkaPool,
		collector: collector,
		logger:    logger,
	}
}

func (h *WebSocketHandler) Handle(w http.ResponseWriter, r *http.Request) {
	eventAPI := egmw.EventAPIFromContext(r.Context())
	if eventAPI == nil {
		http.Error(w, `{"error":"event api not resolved"}`, http.StatusInternalServerError)
		return
	}

	if !eventAPI.WebsocketEnabled {
		http.Error(w, `{"error":"WebSocket is not enabled for this event API"}`, http.StatusForbidden)
		return
	}

	// Accept WebSocket upgrade
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true, // APISIX handles CORS/origin checks
	})
	if err != nil {
		h.logger.Error("websocket accept", zap.Error(err))
		return
	}
	defer conn.CloseNow()

	// Consumer group
	group := r.URL.Query().Get("group")
	sessionID := kafka.GenerateSessionID()
	groupID := fmt.Sprintf("%s-ws-%s", eventAPI.ConsumerGroupPrefix, sessionID)
	if group != "" {
		groupID = fmt.Sprintf("%s-ws-%s", eventAPI.ConsumerGroupPrefix, group)
	}

	offsetReset := r.URL.Query().Get("offset")
	if offsetReset == "" {
		offsetReset = eventAPI.AutoOffsetReset
	}

	session, err := kafka.NewWSSession(
		eventAPI.Connection,
		eventAPI.TopicName,
		groupID,
		offsetReset,
		h.logger,
	)
	if err != nil {
		msg := kafka.WSOutboundMessage{
			Type:    "error",
			Message: "failed to create Kafka session: " + err.Error(),
		}
		wsjson.Write(r.Context(), conn, msg)
		conn.Close(websocket.StatusInternalError, "kafka session error")
		return
	}

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	// Start Kafka consumer in background
	go session.StartConsumer(ctx)

	ctr := h.collector.For(eventAPI.ID)
	ctr.WSActive.Add(1)
	defer ctr.WSActive.Add(-1)

	h.logger.Info("WebSocket session started",
		zap.String("slug", eventAPI.Slug),
		zap.String("topic", eventAPI.TopicName),
		zap.String("group_id", groupID),
	)

	// Send welcome message
	wsjson.Write(ctx, conn, kafka.WSOutboundMessage{
		Type:    "connected",
		Message: "WebSocket session established",
		Group:   groupID,
		Topic:   eventAPI.TopicName,
	})

	var wg sync.WaitGroup

	// Writer goroutine — sends Kafka messages to WebSocket client
	wg.Add(1)
	go func() {
		defer wg.Done()
		h.writeLoop(ctx, cancel, conn, session, ctr)
	}()

	// Reader goroutine — reads WebSocket messages from client
	h.readLoop(ctx, cancel, conn, session, ctr)

	// Wait for writer to finish
	wg.Wait()

	h.logger.Info("WebSocket session closed",
		zap.String("slug", eventAPI.Slug),
		zap.String("group_id", groupID),
	)

	conn.Close(websocket.StatusNormalClosure, "session ended")
}

// readLoop processes inbound messages from the WebSocket client.
func (h *WebSocketHandler) readLoop(ctx context.Context, cancel context.CancelFunc, conn *websocket.Conn, session *kafka.WSSession, ctr *metrics.Counters) {
	defer cancel()

	for {
		var msg kafka.WSInboundMessage
		if err := wsjson.Read(ctx, conn, &msg); err != nil {
			if ctx.Err() != nil {
				return // Normal shutdown
			}
			h.logger.Debug("websocket read error", zap.Error(err))
			return
		}

		switch msg.Action {
		case "publish":
			ctr.WSMessagesIn.Add(1)
			resp, err := session.Publish(ctx, msg)
			if err != nil {
				wsjson.Write(ctx, conn, kafka.WSOutboundMessage{
					Type:    "error",
					Message: "publish failed: " + err.Error(),
				})
				continue
			}
			wsjson.Write(ctx, conn, resp)

		case "ping":
			wsjson.Write(ctx, conn, kafka.WSOutboundMessage{
				Type:      "pong",
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			})

		default:
			wsjson.Write(ctx, conn, kafka.WSOutboundMessage{
				Type:    "error",
				Message: fmt.Sprintf("unknown action: %q (supported: publish, ping)", msg.Action),
			})
		}
	}
}

// writeLoop forwards Kafka records to the WebSocket client.
func (h *WebSocketHandler) writeLoop(ctx context.Context, cancel context.CancelFunc, conn *websocket.Conn, session *kafka.WSSession, ctr *metrics.Counters) {
	defer cancel()

	keepAlive := time.NewTicker(30 * time.Second)
	defer keepAlive.Stop()

	for {
		select {
		case <-ctx.Done():
			return

		case record, ok := <-session.Messages():
			if !ok {
				return
			}
			msg := kafka.FormatRecord(record)
			data, err := json.Marshal(msg)
			if err != nil {
				continue
			}
			ctr.WSMessagesOut.Add(1)
			if err := conn.Write(ctx, websocket.MessageText, data); err != nil {
				h.logger.Debug("websocket write error", zap.Error(err))
				return
			}

		case <-keepAlive.C:
			// Send keepalive ping
			if err := conn.Ping(ctx); err != nil {
				h.logger.Debug("websocket ping error", zap.Error(err))
				return
			}
		}
	}
}
