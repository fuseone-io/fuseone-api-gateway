package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

// EventSchemaRepository handles database operations for event_schemas.
type EventSchemaRepository struct {
	pool *pgxpool.Pool
}

func NewEventSchemaRepository(pool *pgxpool.Pool) *EventSchemaRepository {
	return &EventSchemaRepository{pool: pool}
}

func (r *EventSchemaRepository) List(ctx context.Context, eventApiID uuid.UUID) ([]model.EventSchema, error) {
	query := `SELECT id, event_api_id, version, schema_type, schema_content, description, is_active, created_at
		FROM event_schemas WHERE event_api_id = $1 ORDER BY version DESC`
	rows, err := r.pool.Query(ctx, query, eventApiID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.EventSchema
	for rows.Next() {
		var s model.EventSchema
		if err := rows.Scan(
			&s.ID, &s.EventApiID, &s.Version, &s.SchemaType, &s.SchemaContent,
			&s.Description, &s.IsActive, &s.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	return items, nil
}

func (r *EventSchemaRepository) GetByVersion(ctx context.Context, eventApiID uuid.UUID, version int) (*model.EventSchema, error) {
	query := `SELECT id, event_api_id, version, schema_type, schema_content, description, is_active, created_at
		FROM event_schemas WHERE event_api_id = $1 AND version = $2`
	s := &model.EventSchema{}
	err := r.pool.QueryRow(ctx, query, eventApiID, version).Scan(
		&s.ID, &s.EventApiID, &s.Version, &s.SchemaType, &s.SchemaContent,
		&s.Description, &s.IsActive, &s.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return s, nil
}

func (r *EventSchemaRepository) GetActive(ctx context.Context, eventApiID uuid.UUID) (*model.EventSchema, error) {
	query := `SELECT id, event_api_id, version, schema_type, schema_content, description, is_active, created_at
		FROM event_schemas WHERE event_api_id = $1 AND is_active = true ORDER BY version DESC LIMIT 1`
	s := &model.EventSchema{}
	err := r.pool.QueryRow(ctx, query, eventApiID).Scan(
		&s.ID, &s.EventApiID, &s.Version, &s.SchemaType, &s.SchemaContent,
		&s.Description, &s.IsActive, &s.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return s, nil
}

// Create inserts a new schema version. Auto-increments version number.
func (r *EventSchemaRepository) Create(ctx context.Context, s *model.EventSchema) error {
	query := `INSERT INTO event_schemas (event_api_id, version, schema_type, schema_content, description, is_active)
		VALUES ($1, COALESCE((SELECT MAX(version) FROM event_schemas WHERE event_api_id=$1), 0) + 1, $2, $3, $4, $5)
		RETURNING id, version, created_at`
	return r.pool.QueryRow(ctx, query,
		s.EventApiID, s.SchemaType, s.SchemaContent, s.Description, s.IsActive,
	).Scan(&s.ID, &s.Version, &s.CreatedAt)
}

// Deactivate sets a schema version as inactive.
func (r *EventSchemaRepository) Deactivate(ctx context.Context, eventApiID uuid.UUID, version int) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE event_schemas SET is_active = false WHERE event_api_id = $1 AND version = $2`,
		eventApiID, version,
	)
	return err
}
