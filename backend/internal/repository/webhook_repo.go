package repository

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

// WebhookRepository handles database operations for webhook_subscriptions and webhook_deliveries.
type WebhookRepository struct {
	pool *pgxpool.Pool
}

func NewWebhookRepository(pool *pgxpool.Pool) *WebhookRepository {
	return &WebhookRepository{pool: pool}
}

const webhookCols = `id, event_api_id, url, secret, description, headers, retry_policy,
	is_active, filter_expression, circuit_breaker_threshold, circuit_status,
	circuit_opened_at, consecutive_failures, created_at, updated_at`

func scanWebhook(scan func(dest ...any) error) (model.WebhookSubscription, error) {
	var s model.WebhookSubscription
	err := scan(
		&s.ID, &s.EventApiID, &s.URL, &s.Secret, &s.Description,
		&s.Headers, &s.RetryPolicy,
		&s.IsActive, &s.FilterExpression, &s.CircuitBreakerThreshold, &s.CircuitStatus,
		&s.CircuitOpenedAt, &s.ConsecutiveFailures, &s.CreatedAt, &s.UpdatedAt,
	)
	return s, err
}

func (r *WebhookRepository) List(ctx context.Context, eventApiID uuid.UUID) ([]model.WebhookSubscription, error) {
	query := `SELECT ` + webhookCols + ` FROM webhook_subscriptions
		WHERE event_api_id = $1 ORDER BY created_at DESC`
	rows, err := r.pool.Query(ctx, query, eventApiID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.WebhookSubscription
	for rows.Next() {
		s, err := scanWebhook(rows.Scan)
		if err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	return items, nil
}

func (r *WebhookRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.WebhookSubscription, error) {
	query := `SELECT ` + webhookCols + ` FROM webhook_subscriptions WHERE id = $1`
	s, err := scanWebhook(func(dest ...any) error {
		return r.pool.QueryRow(ctx, query, id).Scan(dest...)
	})
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

func (r *WebhookRepository) Create(ctx context.Context, s *model.WebhookSubscription) error {
	headers := s.Headers
	if headers == nil {
		headers = json.RawMessage(`{}`)
	}
	retryPolicy := s.RetryPolicy
	if retryPolicy == nil {
		retryPolicy = json.RawMessage(`{"max_attempts":3,"backoff_seconds":[10,30,90]}`)
	}

	query := `INSERT INTO webhook_subscriptions
		(event_api_id, url, secret, description, headers, retry_policy, is_active,
		 filter_expression, circuit_breaker_threshold)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, circuit_status, consecutive_failures, created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		s.EventApiID, s.URL, s.Secret, s.Description, headers, retryPolicy, s.IsActive,
		s.FilterExpression, s.CircuitBreakerThreshold,
	).Scan(&s.ID, &s.CircuitStatus, &s.ConsecutiveFailures, &s.CreatedAt, &s.UpdatedAt)
}

func (r *WebhookRepository) Update(ctx context.Context, s *model.WebhookSubscription) error {
	query := `UPDATE webhook_subscriptions
		SET url=$1, secret=$2, description=$3, headers=$4, retry_policy=$5, is_active=$6,
		    filter_expression=$7, circuit_breaker_threshold=$8, updated_at=NOW()
		WHERE id=$9
		RETURNING updated_at`
	return r.pool.QueryRow(ctx, query,
		s.URL, s.Secret, s.Description, s.Headers, s.RetryPolicy, s.IsActive,
		s.FilterExpression, s.CircuitBreakerThreshold, s.ID,
	).Scan(&s.UpdatedAt)
}

func (r *WebhookRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM webhook_subscriptions WHERE id = $1`, id)
	return err
}

func (r *WebhookRepository) ResetCircuitBreaker(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE webhook_subscriptions
		SET circuit_status = 'closed', consecutive_failures = 0, circuit_opened_at = NULL
		WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}

func (r *WebhookRepository) RetryDelivery(ctx context.Context, deliveryID uuid.UUID) error {
	query := `UPDATE webhook_deliveries
		SET status = 'pending', next_retry_at = NOW()
		WHERE id = $1 AND status = 'failed'`
	_, err := r.pool.Exec(ctx, query, deliveryID)
	return err
}

func (r *WebhookRepository) ListDeliveries(ctx context.Context, subscriptionID uuid.UUID, limit int) ([]model.WebhookDelivery, error) {
	if limit <= 0 {
		limit = 50
	}
	query := `SELECT id, subscription_id, event_api_id, kafka_partition, kafka_offset,
		status, attempts, last_status_code, last_error, next_retry_at, completed_at, created_at
		FROM webhook_deliveries
		WHERE subscription_id = $1
		ORDER BY created_at DESC
		LIMIT $2`
	rows, err := r.pool.Query(ctx, query, subscriptionID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.WebhookDelivery
	for rows.Next() {
		var d model.WebhookDelivery
		if err := rows.Scan(
			&d.ID, &d.SubscriptionID, &d.EventApiID, &d.KafkaPartition, &d.KafkaOffset,
			&d.Status, &d.Attempts, &d.LastStatusCode, &d.LastError,
			&d.NextRetryAt, &d.CompletedAt, &d.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, d)
	}
	return items, nil
}
