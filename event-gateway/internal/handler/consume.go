package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/fuseone/event-gateway/internal/metrics"
	egmw "github.com/fuseone/event-gateway/internal/middleware"
	"github.com/fuseone/event-gateway/internal/stream"
)

type ConsumeHandler struct {
	collector *metrics.Collector
}

func NewConsumeHandler(collector *metrics.Collector) *ConsumeHandler {
	return &ConsumeHandler{collector: collector}
}

type consumeRequest struct {
	GroupID    string `json:"group_id"`
	MaxBytes  int    `json:"max_bytes,omitempty"`
	TimeoutMs int    `json:"timeout_ms,omitempty"`
}

type consumedMessage struct {
	Key       string            `json:"key"`
	Value     string            `json:"value"`
	Partition int32             `json:"partition"`
	Offset    int64             `json:"offset"`
	Timestamp string            `json:"timestamp"`
	Headers   map[string]string `json:"headers,omitempty"`
}

func (h *ConsumeHandler) Handle(w http.ResponseWriter, r *http.Request) {
	eventAPI := egmw.EventAPIFromContext(r.Context())
	if eventAPI == nil {
		http.Error(w, `{"error":"event api not resolved"}`, http.StatusInternalServerError)
		return
	}

	if !eventAPI.RestConsume {
		http.Error(w, `{"error":"REST consume is not enabled for this event API"}`, http.StatusForbidden)
		return
	}

	var req consumeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.GroupID == "" {
		http.Error(w, `{"error":"group_id is required"}`, http.StatusBadRequest)
		return
	}

	groupID := fmt.Sprintf("%s-rest-%s", eventAPI.ConsumerGroupPrefix, req.GroupID)

	timeoutMs := req.TimeoutMs
	if timeoutMs <= 0 {
		timeoutMs = 5000
	}

	msgs, err := eventAPI.Provider.FetchOnce(
		r.Context(),
		eventAPI.TopicName,
		groupID,
		eventAPI.AutoOffsetReset,
		100,
		time.Duration(timeoutMs)*time.Millisecond,
	)
	if err != nil {
		http.Error(w, `{"error":"consume failed: `+err.Error()+`"}`, http.StatusBadGateway)
		return
	}

	messages := make([]consumedMessage, len(msgs))
	for i, m := range msgs {
		messages[i] = streamMsgToConsumed(m)
	}

	ctr := h.collector.For(eventAPI.ID)
	ctr.ConsumeTotal.Add(1)
	ctr.ConsumeMessages.Add(int64(len(messages)))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": messages,
	})
}

func streamMsgToConsumed(m stream.Message) consumedMessage {
	return consumedMessage{
		Key:       string(m.Key),
		Value:     string(m.Value),
		Partition: m.Partition,
		Offset:    m.Offset,
		Timestamp: m.Timestamp.UTC().Format(time.RFC3339),
		Headers:   m.Headers,
	}
}
