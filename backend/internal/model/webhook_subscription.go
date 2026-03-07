package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// WebhookSubscription represents a URL endpoint that receives Kafka messages via HTTP POST.
type WebhookSubscription struct {
	ID          uuid.UUID       `json:"id"`
	EventApiID  uuid.UUID       `json:"event_api_id"`
	URL         string          `json:"url"`
	Secret      string          `json:"secret,omitempty"`
	Description string          `json:"description"`
	Headers     json.RawMessage `json:"headers"`
	RetryPolicy json.RawMessage `json:"retry_policy"`
	IsActive    bool            `json:"is_active"`
	// Advanced features
	FilterExpression        string     `json:"filter_expression"`
	CircuitBreakerThreshold int        `json:"circuit_breaker_threshold"`
	CircuitStatus           string     `json:"circuit_status"`
	CircuitOpenedAt         *time.Time `json:"circuit_opened_at,omitempty"`
	ConsecutiveFailures     int        `json:"consecutive_failures"`
	CreatedAt               time.Time  `json:"created_at"`
	UpdatedAt               time.Time  `json:"updated_at"`
}

// WebhookDelivery represents a single delivery attempt log entry.
type WebhookDelivery struct {
	ID             uuid.UUID  `json:"id"`
	SubscriptionID uuid.UUID  `json:"subscription_id"`
	EventApiID     uuid.UUID  `json:"event_api_id"`
	KafkaPartition int32      `json:"kafka_partition"`
	KafkaOffset    int64      `json:"kafka_offset"`
	Status         string     `json:"status"`
	Attempts       int        `json:"attempts"`
	LastStatusCode *int       `json:"last_status_code,omitempty"`
	LastError      *string    `json:"last_error,omitempty"`
	NextRetryAt    *time.Time `json:"next_retry_at,omitempty"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}
