package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

const subscriptionColumns = `id, consumer_username, api_definition_id, plan_id,
	status, requested_by, approved_by, requested_at, approved_at,
	revoked_at, notes, created_at, updated_at`

type SubscriptionRepository struct {
	pool *pgxpool.Pool
}

func NewSubscriptionRepository(pool *pgxpool.Pool) *SubscriptionRepository {
	return &SubscriptionRepository{pool: pool}
}

func scanSubscription(row pgx.Row) (*model.Subscription, error) {
	var s model.Subscription
	err := row.Scan(&s.ID, &s.ConsumerUsername, &s.ApiDefinitionID, &s.PlanID,
		&s.Status, &s.RequestedBy, &s.ApprovedBy, &s.RequestedAt, &s.ApprovedAt,
		&s.RevokedAt, &s.Notes, &s.CreatedAt, &s.UpdatedAt)
	return &s, err
}

func scanSubscriptions(rows pgx.Rows) ([]model.Subscription, error) {
	var result []model.Subscription
	for rows.Next() {
		var s model.Subscription
		if err := rows.Scan(&s.ID, &s.ConsumerUsername, &s.ApiDefinitionID, &s.PlanID,
			&s.Status, &s.RequestedBy, &s.ApprovedBy, &s.RequestedAt, &s.ApprovedAt,
			&s.RevokedAt, &s.Notes, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning subscription: %w", err)
		}
		result = append(result, s)
	}
	return result, nil
}

// Create inserts a new subscription.
func (r *SubscriptionRepository) Create(ctx context.Context, s *model.Subscription) error {
	err := r.pool.QueryRow(ctx,
		`INSERT INTO subscriptions (consumer_username, api_definition_id, plan_id, status, requested_by, notes)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING `+subscriptionColumns,
		s.ConsumerUsername, s.ApiDefinitionID, s.PlanID, s.Status, s.RequestedBy, s.Notes,
	).Scan(&s.ID, &s.ConsumerUsername, &s.ApiDefinitionID, &s.PlanID,
		&s.Status, &s.RequestedBy, &s.ApprovedBy, &s.RequestedAt, &s.ApprovedAt,
		&s.RevokedAt, &s.Notes, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return fmt.Errorf("creating subscription: %w", err)
	}
	return nil
}

// GetByID returns a single subscription.
func (r *SubscriptionRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Subscription, error) {
	s, err := scanSubscription(r.pool.QueryRow(ctx,
		`SELECT `+subscriptionColumns+` FROM subscriptions WHERE id = $1`, id))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting subscription: %w", err)
	}
	return s, nil
}

// List returns subscriptions with optional filters.
func (r *SubscriptionRepository) List(ctx context.Context, consumerUsername string, apiDefID *uuid.UUID, status string) ([]model.Subscription, error) {
	query := `SELECT ` + subscriptionColumns + ` FROM subscriptions WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if consumerUsername != "" {
		query += fmt.Sprintf(` AND consumer_username = $%d`, argIdx)
		args = append(args, consumerUsername)
		argIdx++
	}
	if apiDefID != nil {
		query += fmt.Sprintf(` AND api_definition_id = $%d`, argIdx)
		args = append(args, *apiDefID)
		argIdx++
	}
	if status != "" {
		query += fmt.Sprintf(` AND status = $%d`, argIdx)
		args = append(args, status)
		argIdx++
	}

	query += ` ORDER BY created_at DESC`

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing subscriptions: %w", err)
	}
	defer rows.Close()
	return scanSubscriptions(rows)
}

// SetApproved marks a subscription as active with approval info.
func (r *SubscriptionRepository) SetApproved(ctx context.Context, id uuid.UUID, approvedBy uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE subscriptions SET status = 'active', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2`,
		approvedBy, id)
	return err
}

// SetRevoked marks a subscription as revoked.
func (r *SubscriptionRepository) SetRevoked(ctx context.Context, id uuid.UUID, notes string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE subscriptions SET status = 'revoked', revoked_at = NOW(), notes = CASE WHEN $1 = '' THEN notes ELSE $1 END, updated_at = NOW() WHERE id = $2`,
		notes, id)
	return err
}

// SetSuspended marks a subscription as suspended.
func (r *SubscriptionRepository) SetSuspended(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE subscriptions SET status = 'suspended', updated_at = NOW() WHERE id = $1`, id)
	return err
}

// CountActiveByConsumerAndPlan counts active subscriptions for a consumer+plan pair (excluding a given ID).
func (r *SubscriptionRepository) CountActiveByConsumerAndPlan(ctx context.Context, consumerUsername, planID string, excludeID uuid.UUID) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM subscriptions WHERE consumer_username = $1 AND plan_id = $2 AND status = 'active' AND id != $3`,
		consumerUsername, planID, excludeID).Scan(&count)
	return count, err
}
