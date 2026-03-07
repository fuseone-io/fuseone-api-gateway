package repository

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

// EventApiRepository handles database operations for event_apis.
type EventApiRepository struct {
	pool *pgxpool.Pool
}

// NewEventApiRepository creates a new EventApiRepository.
func NewEventApiRepository(pool *pgxpool.Pool) *EventApiRepository {
	return &EventApiRepository{pool: pool}
}

func (r *EventApiRepository) Create(ctx context.Context, ea *model.EventApi) error {
	query := `INSERT INTO event_apis (name, description, slug, kafka_connection_id, topic_name,
		rest_produce, rest_consume, sse_enabled, websocket_enabled, webhook_enabled,
		context_path, apisix_plugins, consumer_group_prefix, auto_offset_reset, schema_validation, status, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		RETURNING id, apisix_route_ids, created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		ea.Name, ea.Description, ea.Slug, ea.KafkaConnectionID, ea.TopicName,
		ea.RestProduce, ea.RestConsume, ea.SSEEnabled, ea.WebsocketEnabled, ea.WebhookEnabled,
		ea.ContextPath, ea.APISIXPlugins, ea.ConsumerGroupPrefix, ea.AutoOffsetReset, ea.SchemaValidation, ea.Status, ea.CreatedBy,
	).Scan(&ea.ID, &ea.APISIXRouteIDs, &ea.CreatedAt, &ea.UpdatedAt)
}

func (r *EventApiRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.EventApi, error) {
	query := `SELECT id, name, description, slug, kafka_connection_id, topic_name,
		rest_produce, rest_consume, sse_enabled, websocket_enabled, webhook_enabled,
		context_path, apisix_route_ids, apisix_plugins, consumer_group_prefix, auto_offset_reset,
		schema_validation, status, deployed_at, deployed_by, created_by, created_at, updated_at
		FROM event_apis WHERE id = $1`
	ea := &model.EventApi{}
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&ea.ID, &ea.Name, &ea.Description, &ea.Slug, &ea.KafkaConnectionID, &ea.TopicName,
		&ea.RestProduce, &ea.RestConsume, &ea.SSEEnabled, &ea.WebsocketEnabled, &ea.WebhookEnabled,
		&ea.ContextPath, &ea.APISIXRouteIDs, &ea.APISIXPlugins, &ea.ConsumerGroupPrefix, &ea.AutoOffsetReset,
		&ea.SchemaValidation, &ea.Status, &ea.DeployedAt, &ea.DeployedBy, &ea.CreatedBy, &ea.CreatedAt, &ea.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return ea, nil
}

func (r *EventApiRepository) List(ctx context.Context) ([]model.EventApi, error) {
	query := `SELECT id, name, description, slug, kafka_connection_id, topic_name,
		rest_produce, rest_consume, sse_enabled, websocket_enabled, webhook_enabled,
		context_path, apisix_route_ids, apisix_plugins, consumer_group_prefix, auto_offset_reset,
		schema_validation, status, deployed_at, deployed_by, created_by, created_at, updated_at
		FROM event_apis ORDER BY created_at DESC`
	return r.scanEventApis(ctx, query)
}

func (r *EventApiRepository) Update(ctx context.Context, ea *model.EventApi) error {
	query := `UPDATE event_apis SET name=$1, description=$2, slug=$3, kafka_connection_id=$4, topic_name=$5,
		rest_produce=$6, rest_consume=$7, sse_enabled=$8, websocket_enabled=$9, webhook_enabled=$10,
		context_path=$11, apisix_plugins=$12, consumer_group_prefix=$13, auto_offset_reset=$14,
		schema_validation=$15, updated_at=NOW()
		WHERE id=$16
		RETURNING updated_at`
	return r.pool.QueryRow(ctx, query,
		ea.Name, ea.Description, ea.Slug, ea.KafkaConnectionID, ea.TopicName,
		ea.RestProduce, ea.RestConsume, ea.SSEEnabled, ea.WebsocketEnabled, ea.WebhookEnabled,
		ea.ContextPath, ea.APISIXPlugins, ea.ConsumerGroupPrefix, ea.AutoOffsetReset, ea.SchemaValidation, ea.ID,
	).Scan(&ea.UpdatedAt)
}

func (r *EventApiRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM event_apis WHERE id = $1`, id)
	return err
}

// UpdateDeployState updates the APISIX route IDs and deployment status.
func (r *EventApiRepository) UpdateDeployState(ctx context.Context, id uuid.UUID, routeIDs json.RawMessage, status string, deployedBy *uuid.UUID) error {
	query := `UPDATE event_apis SET apisix_route_ids=$1, status=$2, deployed_at=NOW(), deployed_by=$3, updated_at=NOW() WHERE id=$4`
	_, err := r.pool.Exec(ctx, query, routeIDs, status, deployedBy, id)
	return err
}

// ClearDeployState clears deployment data (undeploy).
func (r *EventApiRepository) ClearDeployState(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE event_apis SET apisix_route_ids='[]', status='draft', deployed_at=NULL, deployed_by=NULL, updated_at=NOW() WHERE id=$1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}

func (r *EventApiRepository) scanEventApis(ctx context.Context, query string, args ...any) ([]model.EventApi, error) {
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.EventApi
	for rows.Next() {
		var ea model.EventApi
		if err := rows.Scan(
			&ea.ID, &ea.Name, &ea.Description, &ea.Slug, &ea.KafkaConnectionID, &ea.TopicName,
			&ea.RestProduce, &ea.RestConsume, &ea.SSEEnabled, &ea.WebsocketEnabled, &ea.WebhookEnabled,
			&ea.ContextPath, &ea.APISIXRouteIDs, &ea.APISIXPlugins, &ea.ConsumerGroupPrefix, &ea.AutoOffsetReset,
			&ea.SchemaValidation, &ea.Status, &ea.DeployedAt, &ea.DeployedBy, &ea.CreatedBy, &ea.CreatedAt, &ea.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, ea)
	}
	return items, nil
}
