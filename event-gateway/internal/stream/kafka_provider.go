package stream

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/fuseone/event-gateway/internal/kafka"
	"github.com/fuseone/event-gateway/internal/model"
	"github.com/twmb/franz-go/pkg/kgo"
	"go.uber.org/zap"
)

type kafkaProvider struct {
	conn   model.StreamConnection
	pool   *kafka.ClientPool
	logger *zap.Logger
}

func newKafkaProvider(conn model.StreamConnection, logger *zap.Logger) (*kafkaProvider, error) {
	// Build a KafkaConnection view for the existing kafka package
	kconn := model.KafkaConnectionFrom(conn)

	pool := kafka.NewClientPool(logger)
	if _, err := pool.GetOrCreate(kconn); err != nil {
		return nil, fmt.Errorf("connect to kafka: %w", err)
	}
	pool.Release(conn.ID)

	return &kafkaProvider{conn: conn, pool: pool, logger: logger}, nil
}

func (p *kafkaProvider) Type() string { return "kafka" }

func (p *kafkaProvider) Publish(ctx context.Context, topic string, req PublishRequest) (*PublishResponse, error) {
	kconn := model.KafkaConnectionFrom(p.conn)
	producer := kafka.NewProducer(p.pool)
	resp, err := producer.Produce(ctx, kconn, topic, kafka.ProduceRequest{
		Key:     req.Key,
		Value:   req.Value,
		Headers: req.Headers,
	})
	if err != nil {
		return nil, err
	}
	ts, _ := time.Parse(time.RFC3339, resp.Timestamp)
	return &PublishResponse{
		Partition: resp.Partition,
		Offset:    resp.Offset,
		Timestamp: ts,
	}, nil
}

func (p *kafkaProvider) FetchOnce(ctx context.Context, topic, groupID, offsetReset string, maxMessages int, timeout time.Duration) ([]Message, error) {
	kconn := model.KafkaConnectionFrom(p.conn)

	tctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	consumer, err := kafka.NewStreamConsumer(kconn, topic, groupID, offsetReset, p.logger)
	if err != nil {
		return nil, fmt.Errorf("create kafka consumer: %w", err)
	}

	go consumer.Start(tctx)

	var msgs []Message
	for {
		select {
		case rec, ok := <-consumer.Messages():
			if !ok {
				return msgs, nil
			}
			msgs = append(msgs, kgoRecordToMessage(rec, topic))
			if len(msgs) >= maxMessages {
				return msgs, nil
			}
		case <-tctx.Done():
			return msgs, nil
		}
	}
}

func (p *kafkaProvider) Subscribe(ctx context.Context, topic, groupID, offsetReset string) (<-chan Message, io.Closer, error) {
	kconn := model.KafkaConnectionFrom(p.conn)

	consumer, err := kafka.NewStreamConsumer(kconn, topic, groupID, offsetReset, p.logger)
	if err != nil {
		return nil, nil, fmt.Errorf("create kafka consumer: %w", err)
	}

	subCtx, cancel := context.WithCancel(ctx)
	go consumer.Start(subCtx)

	outCh := make(chan Message, 64)
	go func() {
		defer close(outCh)
		for rec := range consumer.Messages() {
			select {
			case outCh <- kgoRecordToMessage(rec, topic):
			case <-subCtx.Done():
				return
			}
		}
	}()

	return outCh, NewCloser(cancel), nil
}

func (p *kafkaProvider) ListGroups(ctx context.Context, topic, prefix string) ([]GroupInfo, error) {
	kconn := model.KafkaConnectionFrom(p.conn)
	admin := kafka.NewAdminClient(p.pool)
	kafkaGroups, err := admin.ListConsumerGroups(ctx, kconn, prefix)
	if err != nil {
		return nil, err
	}
	return kafkaGroupsToStream(kafkaGroups), nil
}

func (p *kafkaProvider) DescribeGroup(ctx context.Context, topic, groupID string) (*GroupInfo, error) {
	kconn := model.KafkaConnectionFrom(p.conn)
	admin := kafka.NewAdminClient(p.pool)
	info, err := admin.DescribeConsumerGroup(ctx, kconn, topic, groupID)
	if err != nil {
		return nil, err
	}
	g := kafkaGroupToStream(*info)
	return &g, nil
}

func (p *kafkaProvider) ResetGroup(ctx context.Context, topic, groupID, strategy string) error {
	kconn := model.KafkaConnectionFrom(p.conn)
	admin := kafka.NewAdminClient(p.pool)
	return admin.ResetOffsets(ctx, kconn, topic, groupID, strategy)
}

func (p *kafkaProvider) Close() error {
	p.pool.Close()
	return nil
}

// --- helpers ---

func kgoRecordToMessage(r *kgo.Record, topic string) Message {
	h := make(map[string]string, len(r.Headers))
	for _, kh := range r.Headers {
		h[kh.Key] = string(kh.Value)
	}
	return Message{
		Key:       r.Key,
		Value:     r.Value,
		Headers:   h,
		Partition: r.Partition,
		Offset:    r.Offset,
		Timestamp: r.Timestamp,
		Topic:     topic,
	}
}

func kafkaGroupToStream(g kafka.ConsumerGroupInfo) GroupInfo {
	parts := make([]PartitionInfo, len(g.Partitions))
	for i, p := range g.Partitions {
		parts[i] = PartitionInfo{
			Partition:     p.Partition,
			CurrentOffset: p.Offset,
			LogEndOffset:  p.LogEnd,
			Lag:           p.Lag,
		}
	}
	return GroupInfo{
		GroupID:    g.GroupID,
		State:      g.State,
		Members:    g.Members,
		TotalLag:   g.TotalLag,
		Partitions: parts,
	}
}

func kafkaGroupsToStream(gs []kafka.ConsumerGroupInfo) []GroupInfo {
	out := make([]GroupInfo, len(gs))
	for i, g := range gs {
		out[i] = kafkaGroupToStream(g)
	}
	return out
}
