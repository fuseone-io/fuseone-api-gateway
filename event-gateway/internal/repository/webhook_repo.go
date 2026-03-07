package repository

import (
	"context"
	"encoding/json"
	"time"

	"github.com/fuseone/event-gateway/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

type WebhookRepository struct {
	pool   *pgxpool.Pool
	logger *zap.Logger
}

func NewWebhookRepository(pool *pgxpool.Pool, logger *zap.Logger) *WebhookRepository {
	return &WebhookRepository{pool: pool, logger: logger}
}

const webhookSubCols = `id, event_api_id, url, secret, description, headers, retry_policy,
	is_active, filter_expression, circuit_breaker_threshold, circuit_status,
	circuit_opened_at, consecutive_failures, created_at, updated_at`

func scanWebhookSub(scan func(dest ...any) error) (model.WebhookSubscription, error) {
	var sub model.WebhookSubscription
	var headersJSON, retryJSON []byte
	err := scan(
		&sub.ID, &sub.EventApiID, &sub.URL, &sub.Secret, &sub.Description,
		&headersJSON, &retryJSON,
		&sub.IsActive, &sub.FilterExpression, &sub.CircuitBreakerThreshold, &sub.CircuitStatus,
		&sub.CircuitOpenedAt, &sub.ConsecutiveFailures, &sub.CreatedAt, &sub.UpdatedAt,
	)
	if err != nil {
		return sub, err
	}
	if headersJSON != nil {
		json.Unmarshal(headersJSON, &sub.Headers)
	}
	if retryJSON != nil {
		json.Unmarshal(retryJSON, &sub.RetryPolicy)
	}
	if sub.Headers == nil {
		sub.Headers = make(map[string]string)
	}
	if sub.RetryPolicy.BackoffSeconds == nil {
		sub.RetryPolicy = model.RetryPolicy{MaxAttempts: 3, BackoffSeconds: []int{10, 30, 90}}
	}
	if sub.CircuitStatus == "" {
		sub.CircuitStatus = "closed"
	}
	if sub.CircuitBreakerThreshold <= 0 {
		sub.CircuitBreakerThreshold = 5
	}
	return sub, nil
}

// ListActiveByEventApiID returns all active webhook subscriptions for a given Event API.
func (r *WebhookRepository) ListActiveByEventApiID(ctx context.Context, eventApiID uuid.UUID) ([]model.WebhookSubscription, error) {
	query := `SELECT ` + webhookSubCols + ` FROM webhook_subscriptions
		WHERE event_api_id = $1 AND is_active = true ORDER BY created_at`
	rows, err := r.pool.Query(ctx, query, eventApiID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []model.WebhookSubscription
	for rows.Next() {
		sub, err := scanWebhookSub(rows.Scan)
		if err != nil {
			return nil, err
		}
		subs = append(subs, sub)
	}
	return subs, rows.Err()
}

// CreateDelivery inserts a new delivery record.
func (r *WebhookRepository) CreateDelivery(ctx context.Context, d *model.WebhookDelivery) error {
	query := `INSERT INTO webhook_deliveries
		(id, subscription_id, event_api_id, kafka_partition, kafka_offset, status, attempts)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.pool.Exec(ctx, query,
		d.ID, d.SubscriptionID, d.EventApiID, d.Partition, d.Offset, d.Status, d.Attempts,
	)
	return err
}

// UpdateDeliverySuccess marks a delivery as successful.
func (r *WebhookRepository) UpdateDeliverySuccess(ctx context.Context, id uuid.UUID, statusCode int) error {
	now := time.Now().UTC()
	query := `UPDATE webhook_deliveries
		SET status = 'success', last_status_code = $2, attempts = attempts + 1,
		    completed_at = $3, next_retry_at = NULL
		WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id, statusCode, now)
	return err
}

// UpdateDeliveryRetry marks a delivery for retry.
func (r *WebhookRepository) UpdateDeliveryRetry(ctx context.Context, id uuid.UUID, statusCode *int, errMsg string, nextRetry time.Time) error {
	query := `UPDATE webhook_deliveries
		SET attempts = attempts + 1, last_status_code = $2, last_error = $3, next_retry_at = $4
		WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id, statusCode, errMsg, nextRetry)
	return err
}

// UpdateDeliveryFailed marks a delivery as permanently failed.
func (r *WebhookRepository) UpdateDeliveryFailed(ctx context.Context, id uuid.UUID, statusCode *int, errMsg string) error {
	now := time.Now().UTC()
	query := `UPDATE webhook_deliveries
		SET status = 'failed', last_status_code = $2, last_error = $3,
		    attempts = attempts + 1, completed_at = $4, next_retry_at = NULL
		WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id, statusCode, errMsg, now)
	return err
}

// UpdateCircuitBreaker updates the circuit breaker state for a subscription.
func (r *WebhookRepository) UpdateCircuitBreaker(ctx context.Context, subID uuid.UUID, status string, failures int, openedAt *time.Time) error {
	query := `UPDATE webhook_subscriptions
		SET circuit_status = $2, consecutive_failures = $3, circuit_opened_at = $4
		WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, subID, status, failures, openedAt)
	return err
}

// ListPendingRetries returns deliveries ready for retry.
func (r *WebhookRepository) ListPendingRetries(ctx context.Context, limit int) ([]model.WebhookDelivery, error) {
	query := `SELECT id, subscription_id, event_api_id, kafka_partition, kafka_offset,
		status, attempts, last_status_code, last_error, next_retry_at, completed_at, created_at
		FROM webhook_deliveries
		WHERE status = 'pending' AND next_retry_at <= NOW()
		ORDER BY next_retry_at LIMIT $1`
	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var deliveries []model.WebhookDelivery
	for rows.Next() {
		var d model.WebhookDelivery
		err := rows.Scan(
			&d.ID, &d.SubscriptionID, &d.EventApiID, &d.Partition, &d.Offset,
			&d.Status, &d.Attempts, &d.LastStatusCode, &d.LastError,
			&d.NextRetryAt, &d.CompletedAt, &d.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		deliveries = append(deliveries, d)
	}
	return deliveries, rows.Err()
}

// GetSubscriptionByID returns a single subscription by ID.
func (r *WebhookRepository) GetSubscriptionByID(ctx context.Context, id uuid.UUID) (*model.WebhookSubscription, error) {
	query := `SELECT ` + webhookSubCols + ` FROM webhook_subscriptions WHERE id = $1`
	sub, err := scanWebhookSub(func(dest ...any) error {
		return r.pool.QueryRow(ctx, query, id).Scan(dest...)
	})
	if err != nil {
		return nil, err
	}
	return &sub, nil
}
