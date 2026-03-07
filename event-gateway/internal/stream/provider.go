// Package stream defines the StreamProvider interface — a protocol-agnostic
// abstraction over messaging backends (Kafka, NATS, …).
package stream

import (
	"context"
	"errors"
	"io"
	"time"

	"github.com/google/uuid"
)

// ErrNotSupported is returned when a provider does not implement an optional operation.
var ErrNotSupported = errors.New("operation not supported by this provider")

// Message is the unified message envelope shared across all backends.
type Message struct {
	Key       []byte
	Value     []byte
	Headers   map[string]string
	Partition int32  // Kafka: real partition; NATS: 0
	Offset    int64  // Kafka: real offset; NATS: JetStream sequence; -1 if unknown
	Timestamp time.Time
	Topic     string // Kafka topic / NATS subject
}

// PublishRequest carries input for a Publish call.
type PublishRequest struct {
	Key     *string
	Value   []byte
	Headers map[string]string
}

// PublishResponse is returned by a successful Publish.
type PublishResponse struct {
	Partition int32
	Offset    int64
	Timestamp time.Time
}

// PartitionInfo holds per-partition / per-subject metadata.
type PartitionInfo struct {
	Partition     int32 `json:"partition"`
	CurrentOffset int64 `json:"current_offset"`
	LogEndOffset  int64 `json:"log_end_offset"`
	Lag           int64 `json:"lag"`
}

// GroupInfo describes a consumer group (Kafka) or durable consumer (NATS JetStream).
type GroupInfo struct {
	GroupID    string          `json:"group_id"`
	State      string          `json:"state"`
	Members    int             `json:"members"`
	TotalLag   int64           `json:"total_lag"`
	Partitions []PartitionInfo `json:"partitions"`
}

// StreamProvider is the unified interface for all streaming backends.
type StreamProvider interface {
	// Type returns the backend identifier: "kafka" or "nats".
	Type() string

	// Publish sends a single message synchronously and returns placement metadata.
	Publish(ctx context.Context, topic string, req PublishRequest) (*PublishResponse, error)

	// FetchOnce pulls up to maxMessages within timeout (used by REST /consume endpoint).
	FetchOnce(ctx context.Context, topic, groupID, offsetReset string, maxMessages int, timeout time.Duration) ([]Message, error)

	// Subscribe opens a continuous stream of messages (used by SSE and WebSocket).
	// The returned io.Closer unsubscribes and releases resources.
	Subscribe(ctx context.Context, topic, groupID, offsetReset string) (<-chan Message, io.Closer, error)

	// ListGroups returns consumer groups matching the given prefix for the topic.
	ListGroups(ctx context.Context, topic, prefix string) ([]GroupInfo, error)

	// DescribeGroup returns detailed information about a single group.
	DescribeGroup(ctx context.Context, topic, groupID string) (*GroupInfo, error)

	// ResetGroup repositions a group's offsets to "earliest" or "latest".
	// Returns ErrNotSupported for backends that do not implement this.
	ResetGroup(ctx context.Context, topic, groupID, strategy string) error

	// Close releases all resources held by this provider.
	Close() error
}

// GenerateSessionID creates a unique short identifier for SSE/WS sessions.
func GenerateSessionID() string {
	return uuid.New().String()[:8]
}

// funcCloser implements io.Closer via a cancel function.
type funcCloser struct{ fn func() }

func (c *funcCloser) Close() error { c.fn(); return nil }

// NewCloser wraps a cancel func as an io.Closer.
func NewCloser(fn func()) io.Closer { return &funcCloser{fn: fn} }
