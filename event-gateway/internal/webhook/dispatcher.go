package webhook

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/fuseone/event-gateway/internal/metrics"
	"github.com/fuseone/event-gateway/internal/model"
	"github.com/fuseone/event-gateway/internal/repository"
	"github.com/google/uuid"
	"github.com/twmb/franz-go/pkg/kgo"
	"go.uber.org/zap"
)

const circuitBreakerCooldown = 5 * time.Minute

// WebhookPayload is the JSON body POSTed to webhook URLs.
type WebhookPayload struct {
	Key       string            `json:"key"`
	Value     json.RawMessage   `json:"value"`
	Partition int32             `json:"partition"`
	Offset    int64             `json:"offset"`
	Timestamp string            `json:"timestamp"`
	Headers   map[string]string `json:"headers,omitempty"`
	Topic     string            `json:"topic"`
	Slug      string            `json:"slug"`
}

// Dispatcher handles HTTP delivery of webhook payloads with HMAC signing and retry.
type Dispatcher struct {
	client    *http.Client
	repo      *repository.WebhookRepository
	collector *metrics.Collector
	logger    *zap.Logger
}

func NewDispatcher(repo *repository.WebhookRepository, collector *metrics.Collector, logger *zap.Logger) *Dispatcher {
	return &Dispatcher{
		client:    &http.Client{Timeout: 30 * time.Second},
		repo:      repo,
		collector: collector,
		logger:    logger,
	}
}

// Deliver sends a Kafka record to a webhook subscription, handling retries inline.
func (d *Dispatcher) Deliver(ctx context.Context, sub model.WebhookSubscription, record *kgo.Record, slug string) {
	// Circuit breaker check
	if sub.CircuitStatus == "open" {
		if sub.CircuitOpenedAt == nil || time.Since(*sub.CircuitOpenedAt) < circuitBreakerCooldown {
			d.logger.Debug("circuit breaker open, skipping delivery",
				zap.String("url", sub.URL),
				zap.String("subscription_id", sub.ID.String()),
			)
			return
		}
		// Cooldown elapsed — transition to half-open for a test delivery
		sub.CircuitStatus = "half-open"
		d.repo.UpdateCircuitBreaker(ctx, sub.ID, "half-open", sub.ConsecutiveFailures, sub.CircuitOpenedAt)
		d.logger.Info("circuit breaker half-open, allowing test delivery",
			zap.String("url", sub.URL),
		)
	}

	ctr := d.collector.For(sub.EventApiID)
	ctr.WebhookTotal.Add(1)
	payload := WebhookPayload{
		Key:       string(record.Key),
		Value:     record.Value,
		Partition: record.Partition,
		Offset:    record.Offset,
		Timestamp: record.Timestamp.UTC().Format(time.RFC3339),
		Topic:     record.Topic,
		Slug:      slug,
	}
	if len(record.Headers) > 0 {
		payload.Headers = make(map[string]string, len(record.Headers))
		for _, h := range record.Headers {
			payload.Headers[h.Key] = string(h.Value)
		}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		d.logger.Error("marshal webhook payload", zap.Error(err))
		return
	}

	deliveryID := uuid.New()
	delivery := &model.WebhookDelivery{
		ID:             deliveryID,
		SubscriptionID: sub.ID,
		EventApiID:     sub.EventApiID,
		KafkaPartition: record.Partition,
		KafkaOffset:    record.Offset,
		Status:         "pending",
		Attempts:       0,
	}
	if err := d.repo.CreateDelivery(ctx, delivery); err != nil {
		d.logger.Error("create delivery record", zap.Error(err))
	}

	policy := sub.RetryPolicy
	if policy.MaxAttempts <= 0 {
		policy.MaxAttempts = 3
	}
	if len(policy.BackoffSeconds) == 0 {
		policy.BackoffSeconds = []int{10, 30, 90}
	}

	for attempt := 0; attempt < policy.MaxAttempts; attempt++ {
		if ctx.Err() != nil {
			return
		}

		statusCode, err := d.doPost(ctx, sub, body, deliveryID.String())
		if err == nil && statusCode >= 200 && statusCode < 300 {
			ctr.WebhookSuccess.Add(1)
			d.repo.UpdateDeliverySuccess(ctx, deliveryID, statusCode)
			// Circuit breaker: reset on success
			if sub.ConsecutiveFailures > 0 || sub.CircuitStatus != "closed" {
				d.repo.UpdateCircuitBreaker(ctx, sub.ID, "closed", 0, nil)
			}
			d.logger.Debug("webhook delivered",
				zap.String("url", sub.URL),
				zap.Int("status", statusCode),
				zap.Int("attempt", attempt+1),
			)
			return
		}

		errMsg := ""
		if err != nil {
			errMsg = err.Error()
		} else {
			errMsg = fmt.Sprintf("HTTP %d", statusCode)
		}

		isLastAttempt := attempt >= policy.MaxAttempts-1
		if isLastAttempt {
			ctr.WebhookFailed.Add(1)
			d.repo.UpdateDeliveryFailed(ctx, deliveryID, intPtr(statusCode), errMsg)
			// Circuit breaker: track consecutive failures
			sub.ConsecutiveFailures++
			threshold := sub.CircuitBreakerThreshold
			if threshold <= 0 {
				threshold = 5
			}
			if sub.ConsecutiveFailures >= threshold {
				now := time.Now().UTC()
				d.repo.UpdateCircuitBreaker(ctx, sub.ID, "open", sub.ConsecutiveFailures, &now)
				d.logger.Warn("circuit breaker opened",
					zap.String("url", sub.URL),
					zap.Int("failures", sub.ConsecutiveFailures),
				)
			} else {
				d.repo.UpdateCircuitBreaker(ctx, sub.ID, sub.CircuitStatus, sub.ConsecutiveFailures, sub.CircuitOpenedAt)
			}
			d.logger.Warn("webhook delivery failed permanently",
				zap.String("url", sub.URL),
				zap.String("error", errMsg),
				zap.Int("attempts", attempt+1),
			)
			return
		}

		// Schedule retry
		backoffIdx := attempt
		if backoffIdx >= len(policy.BackoffSeconds) {
			backoffIdx = len(policy.BackoffSeconds) - 1
		}
		backoff := time.Duration(policy.BackoffSeconds[backoffIdx]) * time.Second
		nextRetry := time.Now().UTC().Add(backoff)

		d.repo.UpdateDeliveryRetry(ctx, deliveryID, intPtr(statusCode), errMsg, nextRetry)

		d.logger.Debug("webhook delivery retry scheduled",
			zap.String("url", sub.URL),
			zap.String("error", errMsg),
			zap.Int("attempt", attempt+1),
			zap.Duration("backoff", backoff),
		)

		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
	}
}

// doPost performs a single POST request to the webhook URL.
func (d *Dispatcher) doPost(ctx context.Context, sub model.WebhookSubscription, body []byte, deliveryID string) (int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sub.URL, bytes.NewReader(body))
	if err != nil {
		return 0, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "FuseOne-Event-Gateway/1.0")
	req.Header.Set("X-Delivery-ID", deliveryID)
	req.Header.Set("X-Event-API-ID", sub.EventApiID.String())

	// Custom headers from subscription
	for k, v := range sub.Headers {
		req.Header.Set(k, v)
	}

	// HMAC-SHA256 signature
	if sub.Secret != "" {
		mac := hmac.New(sha256.New, []byte(sub.Secret))
		mac.Write(body)
		sig := hex.EncodeToString(mac.Sum(nil))
		req.Header.Set("X-Webhook-Signature-256", "sha256="+sig)
	}

	resp, err := d.client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)

	return resp.StatusCode, nil
}

func intPtr(v int) *int {
	if v == 0 {
		return nil
	}
	return &v
}
