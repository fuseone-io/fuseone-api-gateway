package kafka

import (
	"context"
	"fmt"

	"github.com/fuseone/event-gateway/internal/model"
	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/twmb/franz-go/pkg/sasl/plain"
	"github.com/twmb/franz-go/pkg/sasl/scram"
	"go.uber.org/zap"
)

// StreamConsumer is a long-lived Kafka consumer that pushes messages to a channel.
type StreamConsumer struct {
	client   *kgo.Client
	topic    string
	messages chan *kgo.Record
	logger   *zap.Logger
}

// NewStreamConsumer creates a consumer with its own dedicated client and consumer group.
func NewStreamConsumer(conn model.KafkaConnection, topic, groupID, offsetReset string, logger *zap.Logger) (*StreamConsumer, error) {
	offset := kgo.NewOffset().AtEnd()
	if offsetReset == "earliest" {
		offset = kgo.NewOffset().AtStart()
	}

	opts := []kgo.Opt{
		kgo.SeedBrokers(conn.Brokers...),
		kgo.ConsumerGroup(groupID),
		kgo.ConsumeTopics(topic),
		kgo.ConsumeResetOffset(offset),
		kgo.FetchMaxBytes(1 << 20), // 1MB
	}

	// SASL
	if conn.SASLMechanism != nil && conn.SASLUsername != nil && conn.SASLPassword != nil {
		switch *conn.SASLMechanism {
		case "PLAIN":
			opts = append(opts, kgo.SASL(plain.Auth{
				User: *conn.SASLUsername,
				Pass: *conn.SASLPassword,
			}.AsMechanism()))
		case "SCRAM-SHA-256":
			opts = append(opts, kgo.SASL(scram.Auth{
				User: *conn.SASLUsername,
				Pass: *conn.SASLPassword,
			}.AsSha256Mechanism()))
		case "SCRAM-SHA-512":
			opts = append(opts, kgo.SASL(scram.Auth{
				User: *conn.SASLUsername,
				Pass: *conn.SASLPassword,
			}.AsSha512Mechanism()))
		}
	}

	client, err := kgo.NewClient(opts...)
	if err != nil {
		return nil, fmt.Errorf("create stream consumer: %w", err)
	}

	return &StreamConsumer{
		client:   client,
		topic:    topic,
		messages: make(chan *kgo.Record, 64),
		logger:   logger,
	}, nil
}

// Start begins consuming and pushing records to the Messages channel.
// Blocks until context is cancelled.
func (sc *StreamConsumer) Start(ctx context.Context) {
	defer close(sc.messages)
	defer sc.client.Close()

	for {
		fetches := sc.client.PollFetches(ctx)
		if ctx.Err() != nil {
			return
		}

		errs := fetches.Errors()
		for _, e := range errs {
			sc.logger.Warn("fetch error",
				zap.String("topic", e.Topic),
				zap.Int32("partition", e.Partition),
				zap.Error(e.Err),
			)
		}

		fetches.EachRecord(func(r *kgo.Record) {
			select {
			case sc.messages <- r:
			case <-ctx.Done():
				return
			}
		})
	}
}

// Messages returns the channel of consumed records.
func (sc *StreamConsumer) Messages() <-chan *kgo.Record {
	return sc.messages
}
