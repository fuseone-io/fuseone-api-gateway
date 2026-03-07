package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/twmb/franz-go/pkg/kadm"
	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/twmb/franz-go/pkg/sasl/plain"
	"github.com/twmb/franz-go/pkg/sasl/scram"
	"go.uber.org/zap"
)

// TopicDetail holds partition and config details for a Kafka topic.
type TopicDetail struct {
	Name       string            `json:"name"`
	Partitions []PartitionInfo   `json:"partitions"`
	Configs    map[string]string `json:"configs,omitempty"`
}

// PartitionInfo holds info about a single Kafka partition.
type PartitionInfo struct {
	Partition int   `json:"partition"`
	Leader    int   `json:"leader"`
	Replicas  []int `json:"replicas"`
}

// ProduceRequest is the input for producing a message.
type ProduceRequest struct {
	Key     *string           `json:"key,omitempty"`
	Value   interface{}       `json:"value"`
	Headers map[string]string `json:"headers,omitempty"`
}

// ProduceResponse is the result of a produce call.
type ProduceResponse struct {
	Offsets []ProduceOffset `json:"offsets"`
}

// ProduceOffset is the offset of a produced record.
type ProduceOffset struct {
	Partition int   `json:"partition"`
	Offset    int64 `json:"offset"`
}

// ConsumedMessage is a single Kafka message returned by ConsumeMessages.
type ConsumedMessage struct {
	Topic     string            `json:"topic"`
	Key       string            `json:"key,omitempty"`
	Value     string            `json:"value"`
	Partition int               `json:"partition"`
	Offset    int64             `json:"offset"`
	Headers   map[string]string `json:"headers,omitempty"`
}

// KafkaDirectClient connects directly to a Kafka cluster via franz-go (no bridge).
type KafkaDirectClient struct {
	conn   *model.KafkaConnection
	logger *zap.Logger
}

// NewKafkaDirectClient creates a new direct Kafka client for the given connection.
func NewKafkaDirectClient(conn *model.KafkaConnection, logger *zap.Logger) *KafkaDirectClient {
	return &KafkaDirectClient{conn: conn, logger: logger}
}

// buildClient creates a transient kgo.Client from the connection config.
func (c *KafkaDirectClient) buildClient(extra ...kgo.Opt) (*kgo.Client, error) {
	opts := []kgo.Opt{
		kgo.SeedBrokers(c.conn.Brokers...),
	}

	if c.conn.SASLMechanism != nil && c.conn.SASLUsername != nil && c.conn.SASLPassword != nil {
		switch *c.conn.SASLMechanism {
		case "PLAIN":
			opts = append(opts, kgo.SASL(plain.Auth{
				User: *c.conn.SASLUsername,
				Pass: *c.conn.SASLPassword,
			}.AsMechanism()))
		case "SCRAM-SHA-256":
			opts = append(opts, kgo.SASL(scram.Auth{
				User: *c.conn.SASLUsername,
				Pass: *c.conn.SASLPassword,
			}.AsSha256Mechanism()))
		case "SCRAM-SHA-512":
			opts = append(opts, kgo.SASL(scram.Auth{
				User: *c.conn.SASLUsername,
				Pass: *c.conn.SASLPassword,
			}.AsSha512Mechanism()))
		default:
			return nil, fmt.Errorf("unsupported SASL mechanism: %s", *c.conn.SASLMechanism)
		}
	}

	opts = append(opts, extra...)
	return kgo.NewClient(opts...)
}

// ListTopics returns all topic names in the cluster.
func (c *KafkaDirectClient) ListTopics(ctx context.Context) ([]string, error) {
	client, err := c.buildClient()
	if err != nil {
		return nil, fmt.Errorf("create kafka client: %w", err)
	}
	defer client.Close()

	adm := kadm.NewClient(client)
	details, err := adm.ListTopics(ctx)
	if err != nil {
		return nil, fmt.Errorf("list topics: %w", err)
	}

	topics := make([]string, 0, len(details))
	for _, t := range details.Sorted() {
		if t.Err != nil {
			continue
		}
		topics = append(topics, t.Topic)
	}
	return topics, nil
}

// GetTopic returns partition and config details for a specific topic.
func (c *KafkaDirectClient) GetTopic(ctx context.Context, topicName string) (*TopicDetail, error) {
	client, err := c.buildClient()
	if err != nil {
		return nil, fmt.Errorf("create kafka client: %w", err)
	}
	defer client.Close()

	adm := kadm.NewClient(client)

	details, err := adm.ListTopics(ctx, topicName)
	if err != nil {
		return nil, fmt.Errorf("describe topic %q: %w", topicName, err)
	}

	t, ok := details[topicName]
	if !ok || t.Err != nil {
		errMsg := "topic not found"
		if ok && t.Err != nil {
			errMsg = t.Err.Error()
		}
		return nil, fmt.Errorf("topic %q: %s", topicName, errMsg)
	}

	// Fetch topic configs
	configs := make(map[string]string)
	cfgResults, cfgErr := adm.DescribeTopicConfigs(ctx, topicName)
	if cfgErr == nil {
		for _, rc := range cfgResults {
			for _, cfg := range rc.Configs {
				if cfg.Value != nil {
					configs[cfg.Key] = *cfg.Value
				}
			}
		}
	}

	partitions := make([]PartitionInfo, 0, len(t.Partitions))
	for _, p := range t.Partitions.Sorted() {
		replicas := make([]int, len(p.Replicas))
		for i, r := range p.Replicas {
			replicas[i] = int(r)
		}
		partitions = append(partitions, PartitionInfo{
			Partition: int(p.Partition),
			Leader:    int(p.Leader),
			Replicas:  replicas,
		})
	}

	return &TopicDetail{
		Name:       topicName,
		Partitions: partitions,
		Configs:    configs,
	}, nil
}

// ProduceMessage produces a single message to a topic.
func (c *KafkaDirectClient) ProduceMessage(ctx context.Context, topic string, msg ProduceRequest) (*ProduceResponse, error) {
	client, err := c.buildClient()
	if err != nil {
		return nil, fmt.Errorf("create kafka client: %w", err)
	}
	defer client.Close()

	// Encode value as JSON bytes
	var valueBytes []byte
	switch v := msg.Value.(type) {
	case string:
		valueBytes = []byte(v)
	case []byte:
		valueBytes = v
	default:
		valueBytes, err = json.Marshal(msg.Value)
		if err != nil {
			return nil, fmt.Errorf("marshal value: %w", err)
		}
	}

	record := &kgo.Record{
		Topic: topic,
		Value: valueBytes,
	}
	if msg.Key != nil {
		record.Key = []byte(*msg.Key)
	}
	for k, v := range msg.Headers {
		record.Headers = append(record.Headers, kgo.RecordHeader{Key: k, Value: []byte(v)})
	}

	results := client.ProduceSync(ctx, record)
	if err := results.FirstErr(); err != nil {
		return nil, fmt.Errorf("produce to %q: %w", topic, err)
	}

	produced := results[0].Record
	return &ProduceResponse{
		Offsets: []ProduceOffset{{
			Partition: int(produced.Partition),
			Offset:    produced.Offset,
		}},
	}, nil
}

// ConsumeMessages fetches up to maxMessages recent messages from a topic.
func (c *KafkaDirectClient) ConsumeMessages(ctx context.Context, topic string, maxMessages int) ([]ConsumedMessage, error) {
	if maxMessages <= 0 {
		maxMessages = 50
	}

	// Use a short-lived admin client to get end offsets, then start from max(0, end-maxMessages)
	adminClient, err := c.buildClient()
	if err != nil {
		return nil, fmt.Errorf("create admin client: %w", err)
	}
	adm := kadm.NewClient(adminClient)

	endOffsets, err := adm.ListEndOffsets(ctx, topic)
	adminClient.Close()
	if err != nil {
		return nil, fmt.Errorf("list end offsets: %w", err)
	}

	startOffsets, err := adm.ListStartOffsets(ctx, topic)
	if err != nil {
		// Fall back to earliest
		startOffsets = kadm.ListedOffsets{}
	}

	// Build per-partition start offsets targeting last maxMessages messages
	offsetMap := make(map[int32]kgo.Offset)
	partitionCount := 0
	endOffsets.Each(func(o kadm.ListedOffset) {
		if o.Topic != topic || o.Err != nil {
			return
		}
		partitionCount++
		startOffset := int64(0)
		if so, ok := startOffsets.Lookup(topic, o.Partition); ok && so.Err == nil {
			startOffset = so.Offset
		}
		perPartition := int64(maxMessages)
		targetOffset := o.Offset - perPartition
		if targetOffset < startOffset {
			targetOffset = startOffset
		}
		offsetMap[o.Partition] = kgo.NewOffset().At(targetOffset)
	})

	if partitionCount == 0 {
		return []ConsumedMessage{}, nil
	}

	// Create consumer client
	consumer, err := c.buildClient(
		kgo.ConsumeTopics(topic),
		kgo.ConsumeResetOffset(kgo.NewOffset().AtStart()),
	)
	if err != nil {
		return nil, fmt.Errorf("create consumer client: %w", err)
	}
	defer consumer.Close()

	// Override per-partition offsets
	consumer.AddConsumePartitions(map[string]map[int32]kgo.Offset{
		topic: offsetMap,
	})

	// Poll with a 5-second deadline
	pollCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var messages []ConsumedMessage
	for len(messages) < maxMessages {
		fetches := consumer.PollFetches(pollCtx)
		if fetches.IsClientClosed() || pollCtx.Err() != nil {
			break
		}
		fetches.EachRecord(func(r *kgo.Record) {
			if len(messages) >= maxMessages {
				return
			}
			msg := ConsumedMessage{
				Topic:     r.Topic,
				Key:       string(r.Key),
				Value:     string(r.Value),
				Partition: int(r.Partition),
				Offset:    r.Offset,
			}
			if len(r.Headers) > 0 {
				msg.Headers = make(map[string]string, len(r.Headers))
				for _, h := range r.Headers {
					msg.Headers[h.Key] = string(h.Value)
				}
			}
			messages = append(messages, msg)
		})
	}

	if messages == nil {
		messages = []ConsumedMessage{}
	}
	return messages, nil
}
