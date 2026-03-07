package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/fuseone/event-gateway/internal/metrics"
	egmw "github.com/fuseone/event-gateway/internal/middleware"
	"github.com/fuseone/event-gateway/internal/stream"
	"go.uber.org/zap"
)

type StreamHandler struct {
	collector *metrics.Collector
	logger    *zap.Logger
	keepAlive time.Duration
}

func NewStreamHandler(keepAliveMs int, collector *metrics.Collector, logger *zap.Logger) *StreamHandler {
	if keepAliveMs <= 0 {
		keepAliveMs = 15000
	}
	return &StreamHandler{
		collector: collector,
		logger:    logger,
		keepAlive: time.Duration(keepAliveMs) * time.Millisecond,
	}
}

func (h *StreamHandler) Handle(w http.ResponseWriter, r *http.Request) {
	eventAPI := egmw.EventAPIFromContext(r.Context())
	if eventAPI == nil {
		http.Error(w, `{"error":"event api not resolved"}`, http.StatusInternalServerError)
		return
	}

	if !eventAPI.SSEEnabled {
		http.Error(w, `{"error":"SSE is not enabled for this event API"}`, http.StatusForbidden)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, `{"error":"streaming not supported"}`, http.StatusInternalServerError)
		return
	}

	// Determine consumer group
	group := r.URL.Query().Get("group")
	sessionID := stream.GenerateSessionID()
	groupID := fmt.Sprintf("%s-sse-%s", eventAPI.ConsumerGroupPrefix, sessionID)
	if group != "" {
		groupID = fmt.Sprintf("%s-sse-%s", eventAPI.ConsumerGroupPrefix, group)
	}

	offsetReset := r.URL.Query().Get("offset")
	if offsetReset == "" {
		offsetReset = eventAPI.AutoOffsetReset
	}

	msgCh, closer, err := eventAPI.Provider.Subscribe(r.Context(), eventAPI.TopicName, groupID, offsetReset)
	if err != nil {
		http.Error(w, `{"error":"create consumer: `+err.Error()+`"}`, http.StatusBadGateway)
		return
	}
	defer closer.Close()

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering
	flusher.Flush()

	ctr := h.collector.For(eventAPI.ID)
	ctr.SSEActive.Add(1)
	defer ctr.SSEActive.Add(-1)

	h.logger.Info("SSE stream started",
		zap.String("slug", eventAPI.Slug),
		zap.String("topic", eventAPI.TopicName),
		zap.String("group_id", groupID),
	)

	keepAlive := time.NewTicker(h.keepAlive)
	defer keepAlive.Stop()

	for {
		select {
		case <-r.Context().Done():
			h.logger.Info("SSE stream closed",
				zap.String("slug", eventAPI.Slug),
				zap.String("group_id", groupID),
			)
			return

		case msg, ok := <-msgCh:
			if !ok {
				return
			}
			data := formatSSEMessage(msg)
			fmt.Fprintf(w, "id: %d-%d\nevent: message\ndata: %s\n\n", msg.Partition, msg.Offset, data)
			flusher.Flush()
			ctr.SSEMessagesSent.Add(1)

		case <-keepAlive.C:
			fmt.Fprintf(w, ": keepalive\n\n")
			flusher.Flush()
		}
	}
}

func formatSSEMessage(m stream.Message) string {
	msg := map[string]interface{}{
		"key":       string(m.Key),
		"value":     json.RawMessage(m.Value),
		"partition": m.Partition,
		"offset":    m.Offset,
		"timestamp": m.Timestamp.UTC().Format(time.RFC3339),
	}

	if len(m.Headers) > 0 {
		msg["headers"] = m.Headers
	}

	data, _ := json.Marshal(msg)
	return string(data)
}
