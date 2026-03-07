package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/fuseone/event-gateway/internal/metrics"
	egmw "github.com/fuseone/event-gateway/internal/middleware"
	"github.com/fuseone/event-gateway/internal/stream"
	"go.uber.org/zap"
	"nhooyr.io/websocket"
	"nhooyr.io/websocket/wsjson"
)

// WSInboundMessage is a message received from the WebSocket client.
type WSInboundMessage struct {
	Action  string            `json:"action"`
	Key     *string           `json:"key,omitempty"`
	Value   json.RawMessage   `json:"value,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
}

// WSOutboundMessage is a message sent to the WebSocket client.
type WSOutboundMessage struct {
	Type      string            `json:"type"`
	Key       string            `json:"key,omitempty"`
	Value     json.RawMessage   `json:"value,omitempty"`
	Partition int32             `json:"partition,omitempty"`
	Offset    int64             `json:"offset,omitempty"`
	Timestamp string            `json:"timestamp,omitempty"`
	Headers   map[string]string `json:"headers,omitempty"`
	Message   string            `json:"message,omitempty"`
	Group     string            `json:"group,omitempty"`
	Topic     string            `json:"topic,omitempty"`
}

type WebSocketHandler struct {
	collector *metrics.Collector
	logger    *zap.Logger
}

func NewWebSocketHandler(collector *metrics.Collector, logger *zap.Logger) *WebSocketHandler {
	return &WebSocketHandler{
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
	sessionID := stream.GenerateSessionID()
	groupID := fmt.Sprintf("%s-ws-%s", eventAPI.ConsumerGroupPrefix, sessionID)
	if group != "" {
		groupID = fmt.Sprintf("%s-ws-%s", eventAPI.ConsumerGroupPrefix, group)
	}

	offsetReset := r.URL.Query().Get("offset")
	if offsetReset == "" {
		offsetReset = eventAPI.AutoOffsetReset
	}

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	msgCh, closer, err := eventAPI.Provider.Subscribe(ctx, eventAPI.TopicName, groupID, offsetReset)
	if err != nil {
		wsjson.Write(r.Context(), conn, WSOutboundMessage{
			Type:    "error",
			Message: "failed to create stream session: " + err.Error(),
		})
		conn.Close(websocket.StatusInternalError, "stream session error")
		return
	}
	defer closer.Close()

	ctr := h.collector.For(eventAPI.ID)
	ctr.WSActive.Add(1)
	defer ctr.WSActive.Add(-1)

	h.logger.Info("WebSocket session started",
		zap.String("slug", eventAPI.Slug),
		zap.String("topic", eventAPI.TopicName),
		zap.String("group_id", groupID),
	)

	// Send welcome message
	wsjson.Write(ctx, conn, WSOutboundMessage{
		Type:    "connected",
		Message: "WebSocket session established",
		Group:   groupID,
		Topic:   eventAPI.TopicName,
	})

	var wg sync.WaitGroup

	// Writer goroutine — sends stream messages to WebSocket client
	wg.Add(1)
	go func() {
		defer wg.Done()
		h.writeLoop(ctx, cancel, conn, msgCh, ctr)
	}()

	// Reader goroutine — reads WebSocket messages from client (publish + ping)
	h.readLoop(ctx, cancel, conn, eventAPI.TopicName, eventAPI.Provider, ctr)

	// Wait for writer to finish
	wg.Wait()

	h.logger.Info("WebSocket session closed",
		zap.String("slug", eventAPI.Slug),
		zap.String("group_id", groupID),
	)

	conn.Close(websocket.StatusNormalClosure, "session ended")
}

// readLoop processes inbound messages from the WebSocket client.
func (h *WebSocketHandler) readLoop(ctx context.Context, cancel context.CancelFunc, conn *websocket.Conn, topic string, provider stream.StreamProvider, ctr *metrics.Counters) {
	defer cancel()

	for {
		var msg WSInboundMessage
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
			var key *string
			if msg.Key != nil {
				k := *msg.Key
				key = &k
			}
			resp, err := provider.Publish(ctx, topic, stream.PublishRequest{
				Key:     key,
				Value:   msg.Value,
				Headers: msg.Headers,
			})
			if err != nil {
				wsjson.Write(ctx, conn, WSOutboundMessage{
					Type:    "error",
					Message: "publish failed: " + err.Error(),
				})
				continue
			}
			wsjson.Write(ctx, conn, WSOutboundMessage{
				Type:      "published",
				Partition: resp.Partition,
				Offset:    resp.Offset,
				Timestamp: resp.Timestamp.UTC().Format(time.RFC3339),
			})

		case "ping":
			wsjson.Write(ctx, conn, WSOutboundMessage{
				Type:      "pong",
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			})

		default:
			wsjson.Write(ctx, conn, WSOutboundMessage{
				Type:    "error",
				Message: fmt.Sprintf("unknown action: %q (supported: publish, ping)", msg.Action),
			})
		}
	}
}

// writeLoop forwards stream messages to the WebSocket client.
func (h *WebSocketHandler) writeLoop(ctx context.Context, cancel context.CancelFunc, conn *websocket.Conn, msgCh <-chan stream.Message, ctr *metrics.Counters) {
	defer cancel()

	keepAlive := time.NewTicker(30 * time.Second)
	defer keepAlive.Stop()

	for {
		select {
		case <-ctx.Done():
			return

		case m, ok := <-msgCh:
			if !ok {
				return
			}
			out := WSOutboundMessage{
				Type:      "message",
				Key:       string(m.Key),
				Value:     m.Value,
				Partition: m.Partition,
				Offset:    m.Offset,
				Timestamp: m.Timestamp.UTC().Format(time.RFC3339),
				Headers:   m.Headers,
			}
			data, err := json.Marshal(out)
			if err != nil {
				continue
			}
			ctr.WSMessagesOut.Add(1)
			if err := conn.Write(ctx, websocket.MessageText, data); err != nil {
				h.logger.Debug("websocket write error", zap.Error(err))
				return
			}

		case <-keepAlive.C:
			if err := conn.Ping(ctx); err != nil {
				h.logger.Debug("websocket ping error", zap.Error(err))
				return
			}
		}
	}
}
