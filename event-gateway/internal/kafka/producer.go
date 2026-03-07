package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/fuseone/event-gateway/internal/model"
	"github.com/google/uuid"
	"github.com/twmb/franz-go/pkg/kgo"
)

type Producer struct {
	pool *ClientPool
}

func NewProducer(pool *ClientPool) *Producer {
	return &Producer{pool: pool}
}

type ProduceRequest struct {
	Key     *string            `json:"key,omitempty"`
	Value   json.RawMessage    `json:"value"`
	Headers map[string]string  `json:"headers,omitempty"`
}

type ProduceResponse struct {
	Partition int32  `json:"partition"`
	Offset    int64  `json:"offset"`
	Timestamp string `json:"timestamp"`
}

func (p *Producer) Produce(ctx context.Context, conn model.KafkaConnection, topic string, req ProduceRequest) (*ProduceResponse, error) {
	client, err := p.pool.GetOrCreate(conn)
	if err != nil {
		return nil, fmt.Errorf("get kafka client: %w", err)
	}

	record := &kgo.Record{
		Topic: topic,
		Value: req.Value,
	}

	if req.Key != nil {
		record.Key = []byte(*req.Key)
	}

	for k, v := range req.Headers {
		record.Headers = append(record.Headers, kgo.RecordHeader{Key: k, Value: []byte(v)})
	}

	// Synchronous produce with ack
	results := client.ProduceSync(ctx, record)
	if err := results.FirstErr(); err != nil {
		return nil, fmt.Errorf("produce: %w", err)
	}

	r := results[0].Record
	return &ProduceResponse{
		Partition: r.Partition,
		Offset:    r.Offset,
		Timestamp: r.Timestamp.UTC().Format(time.RFC3339),
	}, nil
}

// NewProducerClient creates a dedicated producer client for a connection (used by long-lived consumers).
func NewProducerClient(conn model.KafkaConnection) (*kgo.Client, error) {
	pool := NewClientPool(nil)
	return pool.GetOrCreate(conn)
}

// GenerateSessionID creates a unique short session identifier.
func GenerateSessionID() string {
	return uuid.New().String()[:8]
}
