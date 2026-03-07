package model

import (
	"time"

	"github.com/google/uuid"
)

type RetryPolicy struct {
	MaxAttempts    int   `json:"max_attempts"`
	BackoffSeconds []int `json:"backoff_seconds"`
}

type WebhookSubscription struct {
	ID          uuid.UUID         `json:"id"`
	EventApiID  uuid.UUID         `json:"event_api_id"`
	URL         string            `json:"url"`
	Secret      string            `json:"-"`
	Description string            `json:"description"`
	Headers     map[string]string `json:"headers"`
	RetryPolicy RetryPolicy       `json:"retry_policy"`
	IsActive    bool              `json:"is_active"`
	// Advanced features
	FilterExpression       string     `json:"filter_expression"`
	CircuitBreakerThreshold int       `json:"circuit_breaker_threshold"`
	CircuitStatus          string     `json:"circuit_status"` // closed, open, half-open
	CircuitOpenedAt        *time.Time `json:"circuit_opened_at,omitempty"`
	ConsecutiveFailures    int        `json:"consecutive_failures"`
	CreatedAt              time.Time  `json:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at"`
}

type WebhookDelivery struct {
	ID             uuid.UUID  `json:"id"`
	SubscriptionID uuid.UUID  `json:"subscription_id"`
	EventApiID     uuid.UUID  `json:"event_api_id"`
	Partition int32 `json:"partition"`
	Offset    int64 `json:"offset"`
	Status         string     `json:"status"` // pending, success, failed
	Attempts       int        `json:"attempts"`
	LastStatusCode *int       `json:"last_status_code,omitempty"`
	LastError      *string    `json:"last_error,omitempty"`
	NextRetryAt    *time.Time `json:"next_retry_at,omitempty"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}
