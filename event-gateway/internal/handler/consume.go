package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/fuseone/event-gateway/internal/kafka"
	"github.com/fuseone/event-gateway/internal/metrics"
	egmw "github.com/fuseone/event-gateway/internal/middleware"
	"github.com/twmb/franz-go/pkg/kgo"
	"go.uber.org/zap"
)

type ConsumeHandler struct {
	kafkaPool *kafka.ClientPool
	collector *metrics.Collector
	logger    *zap.Logger
}

func NewConsumeHandler(kafkaPool *kafka.ClientPool, collector *metrics.Collector, logger *zap.Logger) *ConsumeHandler {
	return &ConsumeHandler{kafkaPool: kafkaPool, collector: collector, logger: logger}
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

	// Create a short-lived consumer
	consumer, err := kafka.NewStreamConsumer(
		eventAPI.Connection,
		eventAPI.TopicName,
		groupID,
		eventAPI.AutoOffsetReset,
		h.logger,
	)
	if err != nil {
		http.Error(w, `{"error":"create consumer: `+err.Error()+`"}`, http.StatusBadGateway)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), time.Duration(timeoutMs)*time.Millisecond)
	defer cancel()

	go consumer.Start(ctx)

	var messages []consumedMessage
	deadline := time.After(time.Duration(timeoutMs) * time.Millisecond)

loop:
	for {
		select {
		case msg, ok := <-consumer.Messages():
			if !ok {
				break loop
			}
			cm := recordToMessage(msg)
			messages = append(messages, cm)
			if len(messages) >= 100 {
				break loop
			}
		case <-deadline:
			break loop
		}
	}

	if messages == nil {
		messages = []consumedMessage{}
	}

	ctr := h.collector.For(eventAPI.ID)
	ctr.ConsumeTotal.Add(1)
	ctr.ConsumeMessages.Add(int64(len(messages)))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": messages,
	})
}

func recordToMessage(r *kgo.Record) consumedMessage {
	headers := make(map[string]string)
	for _, h := range r.Headers {
		headers[h.Key] = string(h.Value)
	}

	return consumedMessage{
		Key:       string(r.Key),
		Value:     string(r.Value),
		Partition: r.Partition,
		Offset:    r.Offset,
		Timestamp: r.Timestamp.UTC().Format(time.RFC3339),
		Headers:   headers,
	}
}
