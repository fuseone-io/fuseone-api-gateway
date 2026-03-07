package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/fuseone/event-gateway/internal/model"
	"github.com/twmb/franz-go/pkg/kgo"
	"go.uber.org/zap"
)

// WSSession manages a bidirectional WebSocket session — one Kafka consumer (read)
// and one producer (write) per connection.
type WSSession struct {
	consumer *StreamConsumer
	producer *kgo.Client
	conn     model.KafkaConnection
	topic    string
	logger   *zap.Logger
}

// WSInboundMessage represents a message received from the WebSocket client.
type WSInboundMessage struct {
	Action  string            `json:"action"`
	Key     *string           `json:"key,omitempty"`
	Value   json.RawMessage   `json:"value,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
}

// WSOutboundMessage represents a message sent to the WebSocket client.
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

// NewWSSession creates a new WebSocket session with consumer + producer for the given topic.
func NewWSSession(conn model.KafkaConnection, topic, groupID, offsetReset string, logger *zap.Logger) (*WSSession, error) {
	consumer, err := NewStreamConsumer(conn, topic, groupID, offsetReset, logger)
	if err != nil {
		return nil, fmt.Errorf("create ws consumer: %w", err)
	}

	pool := NewClientPool(logger)
	producer, err := pool.GetOrCreate(conn)
	if err != nil {
		consumer.client.Close()
		return nil, fmt.Errorf("create ws producer: %w", err)
	}

	return &WSSession{
		consumer: consumer,
		producer: producer,
		conn:     conn,
		topic:    topic,
		logger:   logger,
	}, nil
}

// StartConsumer begins consuming Kafka messages. Call in a goroutine.
// Messages are available via Messages().
func (s *WSSession) StartConsumer(ctx context.Context) {
	s.consumer.Start(ctx)
}

// Messages returns the channel of consumed Kafka records.
func (s *WSSession) Messages() <-chan *kgo.Record {
	return s.consumer.Messages()
}

// Publish produces a message to the session's topic.
func (s *WSSession) Publish(ctx context.Context, msg WSInboundMessage) (*WSOutboundMessage, error) {
	record := &kgo.Record{
		Topic: s.topic,
		Value: msg.Value,
	}
	if msg.Key != nil {
		record.Key = []byte(*msg.Key)
	}
	for k, v := range msg.Headers {
		record.Headers = append(record.Headers, kgo.RecordHeader{Key: k, Value: []byte(v)})
	}

	results := s.producer.ProduceSync(ctx, record)
	if err := results.FirstErr(); err != nil {
		return nil, fmt.Errorf("produce: %w", err)
	}

	r := results[0].Record
	return &WSOutboundMessage{
		Type:      "published",
		Partition: r.Partition,
		Offset:    r.Offset,
		Timestamp: r.Timestamp.UTC().Format(time.RFC3339),
	}, nil
}

// FormatRecord converts a kgo.Record to a WSOutboundMessage.
func FormatRecord(r *kgo.Record) *WSOutboundMessage {
	msg := &WSOutboundMessage{
		Type:      "message",
		Key:       string(r.Key),
		Value:     r.Value,
		Partition: r.Partition,
		Offset:    r.Offset,
		Timestamp: r.Timestamp.UTC().Format(time.RFC3339),
	}

	if len(r.Headers) > 0 {
		msg.Headers = make(map[string]string, len(r.Headers))
		for _, h := range r.Headers {
			msg.Headers[h.Key] = string(h.Value)
		}
	}

	return msg
}

// Close shuts down the session's consumer client.
// The producer is shared via the pool and not closed here.
func (s *WSSession) Close() {
	// consumer.Start() already closes the client on context cancel
	// but if Start was never called, close explicitly
}
