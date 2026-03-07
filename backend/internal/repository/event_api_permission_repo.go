package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

type EventApiPermissionRepository struct {
	pool *pgxpool.Pool
}

func NewEventApiPermissionRepository(pool *pgxpool.Pool) *EventApiPermissionRepository {
	return &EventApiPermissionRepository{pool: pool}
}

const permCols = `id, event_api_id, consumer_name, can_produce, can_consume, can_stream,
	rate_limit, rate_window_sec, created_at, updated_at`

func scanPerm(scan func(dest ...any) error) (model.EventApiPermission, error) {
	var p model.EventApiPermission
	err := scan(
		&p.ID, &p.EventApiID, &p.ConsumerName, &p.CanProduce, &p.CanConsume, &p.CanStream,
		&p.RateLimit, &p.RateWindowSec, &p.CreatedAt, &p.UpdatedAt,
	)
	return p, err
}

func (r *EventApiPermissionRepository) List(ctx context.Context, eventApiID uuid.UUID) ([]model.EventApiPermission, error) {
	query := `SELECT ` + permCols + ` FROM event_api_permissions
		WHERE event_api_id = $1 ORDER BY consumer_name`
	rows, err := r.pool.Query(ctx, query, eventApiID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.EventApiPermission
	for rows.Next() {
		p, err := scanPerm(rows.Scan)
		if err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, nil
}

func (r *EventApiPermissionRepository) ListByConsumer(ctx context.Context, consumerName string) ([]model.EventApiPermission, error) {
	query := `SELECT ` + permCols + ` FROM event_api_permissions
		WHERE consumer_name = $1 ORDER BY event_api_id`
	rows, err := r.pool.Query(ctx, query, consumerName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.EventApiPermission
	for rows.Next() {
		p, err := scanPerm(rows.Scan)
		if err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, nil
}

func (r *EventApiPermissionRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.EventApiPermission, error) {
	query := `SELECT ` + permCols + ` FROM event_api_permissions WHERE id = $1`
	p, err := scanPerm(func(dest ...any) error {
		return r.pool.QueryRow(ctx, query, id).Scan(dest...)
	})
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (r *EventApiPermissionRepository) Upsert(ctx context.Context, p *model.EventApiPermission) error {
	query := `INSERT INTO event_api_permissions
		(event_api_id, consumer_name, can_produce, can_consume, can_stream, rate_limit, rate_window_sec)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (event_api_id, consumer_name) DO UPDATE SET
			can_produce = EXCLUDED.can_produce,
			can_consume = EXCLUDED.can_consume,
			can_stream = EXCLUDED.can_stream,
			rate_limit = EXCLUDED.rate_limit,
			rate_window_sec = EXCLUDED.rate_window_sec,
			updated_at = NOW()
		RETURNING id, created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		p.EventApiID, p.ConsumerName, p.CanProduce, p.CanConsume, p.CanStream,
		p.RateLimit, p.RateWindowSec,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

func (r *EventApiPermissionRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM event_api_permissions WHERE id = $1`, id)
	return err
}

// ListAll returns all permissions (used by Event Gateway for caching).
func (r *EventApiPermissionRepository) ListAll(ctx context.Context) ([]model.EventApiPermission, error) {
	query := `SELECT ` + permCols + ` FROM event_api_permissions ORDER BY event_api_id, consumer_name`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.EventApiPermission
	for rows.Next() {
		p, err := scanPerm(rows.Scan)
		if err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, nil
}
