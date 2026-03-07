package repository

import (
	"context"

	"github.com/fuseone/event-gateway/internal/model"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

type PermissionRepository struct {
	pool   *pgxpool.Pool
	logger *zap.Logger
}

func NewPermissionRepository(pool *pgxpool.Pool, logger *zap.Logger) *PermissionRepository {
	return &PermissionRepository{pool: pool, logger: logger}
}

// ListAll returns all event API permissions for caching.
func (r *PermissionRepository) ListAll(ctx context.Context) ([]model.EventApiPermission, error) {
	query := `SELECT id, event_api_id, consumer_name, can_produce, can_consume, can_stream,
		rate_limit, rate_window_sec, created_at, updated_at
		FROM event_api_permissions ORDER BY event_api_id, consumer_name`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.EventApiPermission
	for rows.Next() {
		var p model.EventApiPermission
		if err := rows.Scan(
			&p.ID, &p.EventApiID, &p.ConsumerName, &p.CanProduce, &p.CanConsume, &p.CanStream,
			&p.RateLimit, &p.RateWindowSec, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, nil
}
