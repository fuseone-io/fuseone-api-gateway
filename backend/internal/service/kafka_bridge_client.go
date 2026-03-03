package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"
)

// TopicDetail represents detailed information about a Kafka topic.
type TopicDetail struct {
	Name       string            `json:"name"`
	Partitions []PartitionInfo   `json:"partitions"`
	Configs    map[string]string `json:"configs"`
}

// PartitionInfo represents a single partition within a topic.
type PartitionInfo struct {
	Partition int   `json:"partition"`
	Leader    int   `json:"leader"`
	Replicas  []int `json:"replicas"`
}

// ProduceRequest represents a message to produce to a Kafka topic.
type ProduceRequest struct {
	Key     *string           `json:"key,omitempty"`
	Value   interface{}       `json:"value"`
	Headers map[string]string `json:"headers,omitempty"`
}

// ProduceResponse represents the result of producing a message.
type ProduceResponse struct {
	Offsets []ProduceOffset `json:"offsets"`
}

// ProduceOffset represents the partition and offset of a produced message.
type ProduceOffset struct {
	Partition int   `json:"partition"`
	Offset    int64 `json:"offset"`
}

// ConsumedMessage represents a message consumed from a Kafka topic.
type ConsumedMessage struct {
	Topic     string            `json:"topic"`
	Key       string            `json:"key"`
	Value     string            `json:"value"`
	Partition int               `json:"partition"`
	Offset    int64             `json:"offset"`
	Headers   map[string]string `json:"headers,omitempty"`
}

// ConsumerGroupInfo represents basic information about a Kafka consumer group.
type ConsumerGroupInfo struct {
	GroupID string `json:"group_id"`
	State   string `json:"state"`
	Members int    `json:"members"`
}

// KafkaBridgeClient is an HTTP client wrapper for the Strimzi Kafka Bridge REST API.
type KafkaBridgeClient struct {
	baseURL    string
	httpClient *http.Client
	logger     *zap.Logger
}

// NewKafkaBridgeClient creates a new KafkaBridgeClient for the given bridge URL.
func NewKafkaBridgeClient(bridgeURL string, logger *zap.Logger) *KafkaBridgeClient {
	return &KafkaBridgeClient{
		baseURL: strings.TrimRight(bridgeURL, "/"),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		logger: logger,
	}
}

// ListTopics returns a list of all topic names from the Kafka cluster.
func (c *KafkaBridgeClient) ListTopics(ctx context.Context) ([]string, error) {
	url := c.baseURL + "/topics"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("list topics: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, c.readError(resp)
	}

	var topics []string
	if err := json.NewDecoder(resp.Body).Decode(&topics); err != nil {
		return nil, fmt.Errorf("decode topics response: %w", err)
	}
	return topics, nil
}

// GetTopic returns detailed information about a specific topic.
func (c *KafkaBridgeClient) GetTopic(ctx context.Context, topicName string) (*TopicDetail, error) {
	url := c.baseURL + "/topics/" + topicName

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("get topic %s: %w", topicName, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, c.readError(resp)
	}

	var detail TopicDetail
	if err := json.NewDecoder(resp.Body).Decode(&detail); err != nil {
		return nil, fmt.Errorf("decode topic response: %w", err)
	}
	return &detail, nil
}

// ProduceMessage produces a message to the specified topic via the Kafka Bridge.
func (c *KafkaBridgeClient) ProduceMessage(ctx context.Context, topic string, msg ProduceRequest) (*ProduceResponse, error) {
	url := c.baseURL + "/topics/" + topic

	// Build the bridge request body
	record := map[string]interface{}{
		"value": msg.Value,
	}
	if msg.Key != nil {
		record["key"] = *msg.Key
	}
	if len(msg.Headers) > 0 {
		var hdrs []map[string]string
		for k, v := range msg.Headers {
			hdrs = append(hdrs, map[string]string{"key": k, "value": v})
		}
		record["headers"] = hdrs
	}
	body := map[string]interface{}{
		"records": []interface{}{record},
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal produce request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/vnd.kafka.json.v2+json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("produce message to %s: %w", topic, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, c.readError(resp)
	}

	var bridgeResp struct {
		Offsets []ProduceOffset `json:"offsets"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&bridgeResp); err != nil {
		return nil, fmt.Errorf("decode produce response: %w", err)
	}

	return &ProduceResponse{Offsets: bridgeResp.Offsets}, nil
}

// ConsumeMessages creates a consumer, subscribes to a topic, fetches records, then cleans up.
// This follows the 3-step Strimzi Kafka Bridge consumer lifecycle:
//  1. POST /consumers/{groupID} — create consumer instance
//  2. POST /consumers/{groupID}/instances/{instanceID}/subscription — subscribe to topic
//  3. GET  /consumers/{groupID}/instances/{instanceID}/records — fetch messages
//  4. DELETE /consumers/{groupID}/instances/{instanceID} — cleanup
func (c *KafkaBridgeClient) ConsumeMessages(ctx context.Context, groupID, instanceID, topic string, maxBytes int) ([]ConsumedMessage, error) {
	// Step 1: Create consumer instance
	consumerURL := fmt.Sprintf("%s/consumers/%s", c.baseURL, groupID)
	createBody := map[string]interface{}{
		"name":                      instanceID,
		"format":                    "json",
		"auto.offset.reset":        "earliest",
		"enable.auto.commit":       true,
		"fetch.min.bytes":          1,
		"consumer.request.timeout.ms": 5000,
	}
	createPayload, err := json.Marshal(createBody)
	if err != nil {
		return nil, fmt.Errorf("marshal consumer create: %w", err)
	}

	createReq, err := http.NewRequestWithContext(ctx, http.MethodPost, consumerURL, bytes.NewReader(createPayload))
	if err != nil {
		return nil, fmt.Errorf("create consumer request: %w", err)
	}
	createReq.Header.Set("Content-Type", "application/vnd.kafka.v2+json")

	createResp, err := c.httpClient.Do(createReq)
	if err != nil {
		return nil, fmt.Errorf("create consumer: %w", err)
	}
	defer createResp.Body.Close()

	if createResp.StatusCode != http.StatusOK && createResp.StatusCode != http.StatusConflict {
		return nil, c.readError(createResp)
	}

	var created struct {
		InstanceID string `json:"instance_id"`
		BaseURI    string `json:"base_uri"`
	}
	if createResp.StatusCode == http.StatusOK {
		if err := json.NewDecoder(createResp.Body).Decode(&created); err != nil {
			return nil, fmt.Errorf("decode consumer create response: %w", err)
		}
	}

	// Determine base URI for subsequent calls
	instanceBase := fmt.Sprintf("%s/consumers/%s/instances/%s", c.baseURL, groupID, instanceID)
	if created.BaseURI != "" {
		instanceBase = created.BaseURI
	}

	// Ensure cleanup of the consumer instance
	defer func() {
		delReq, delErr := http.NewRequestWithContext(ctx, http.MethodDelete, instanceBase, nil)
		if delErr != nil {
			c.logger.Warn("failed to create consumer delete request", zap.Error(delErr))
			return
		}
		delReq.Header.Set("Content-Type", "application/vnd.kafka.v2+json")
		delResp, delErr := c.httpClient.Do(delReq)
		if delErr != nil {
			c.logger.Warn("failed to delete consumer instance", zap.Error(delErr))
			return
		}
		delResp.Body.Close()
	}()

	// Step 2: Subscribe to topic
	subURL := instanceBase + "/subscription"
	subBody := map[string]interface{}{
		"topics": []string{topic},
	}
	subPayload, err := json.Marshal(subBody)
	if err != nil {
		return nil, fmt.Errorf("marshal subscription: %w", err)
	}

	subReq, err := http.NewRequestWithContext(ctx, http.MethodPost, subURL, bytes.NewReader(subPayload))
	if err != nil {
		return nil, fmt.Errorf("create subscription request: %w", err)
	}
	subReq.Header.Set("Content-Type", "application/vnd.kafka.v2+json")

	subResp, err := c.httpClient.Do(subReq)
	if err != nil {
		return nil, fmt.Errorf("subscribe to topic: %w", err)
	}
	defer subResp.Body.Close()

	if subResp.StatusCode != http.StatusNoContent && subResp.StatusCode != http.StatusOK {
		return nil, c.readError(subResp)
	}

	// Step 3: Get records
	recordsURL := instanceBase + "/records"
	if maxBytes > 0 {
		recordsURL = fmt.Sprintf("%s?max_bytes=%d", recordsURL, maxBytes)
	}

	recordsReq, err := http.NewRequestWithContext(ctx, http.MethodGet, recordsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create records request: %w", err)
	}
	recordsReq.Header.Set("Accept", "application/vnd.kafka.json.v2+json")

	recordsResp, err := c.httpClient.Do(recordsReq)
	if err != nil {
		return nil, fmt.Errorf("fetch records: %w", err)
	}
	defer recordsResp.Body.Close()

	if recordsResp.StatusCode != http.StatusOK {
		return nil, c.readError(recordsResp)
	}

	var records []struct {
		Topic     string            `json:"topic"`
		Key       interface{}       `json:"key"`
		Value     interface{}       `json:"value"`
		Partition int               `json:"partition"`
		Offset    int64             `json:"offset"`
		Headers   map[string]string `json:"headers,omitempty"`
	}
	if err := json.NewDecoder(recordsResp.Body).Decode(&records); err != nil {
		return nil, fmt.Errorf("decode records response: %w", err)
	}

	messages := make([]ConsumedMessage, 0, len(records))
	for _, r := range records {
		msg := ConsumedMessage{
			Topic:     r.Topic,
			Key:       toJSONString(r.Key),
			Value:     toJSONString(r.Value),
			Partition: r.Partition,
			Offset:    r.Offset,
			Headers:   r.Headers,
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

// ListConsumerGroups attempts to list consumer groups via the bridge (best-effort).
func (c *KafkaBridgeClient) ListConsumerGroups(ctx context.Context) ([]ConsumerGroupInfo, error) {
	url := c.baseURL + "/consumers"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("list consumer groups: %w", err)
	}
	defer resp.Body.Close()

	// The /consumers endpoint may not be available on all bridge versions
	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusMethodNotAllowed {
		return []ConsumerGroupInfo{}, nil
	}

	if resp.StatusCode != http.StatusOK {
		return nil, c.readError(resp)
	}

	var groups []ConsumerGroupInfo
	if err := json.NewDecoder(resp.Body).Decode(&groups); err != nil {
		return nil, fmt.Errorf("decode consumer groups response: %w", err)
	}
	return groups, nil
}

// readError reads the response body and returns a descriptive error.
func (c *KafkaBridgeClient) readError(resp *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	return fmt.Errorf("kafka bridge returned %d: %s", resp.StatusCode, string(body))
}

// toJSONString converts an interface{} value to its JSON string representation.
func toJSONString(v interface{}) string {
	if v == nil {
		return ""
	}
	switch val := v.(type) {
	case string:
		return val
	default:
		b, err := json.Marshal(val)
		if err != nil {
			return fmt.Sprintf("%v", val)
		}
		return string(b)
	}
}
