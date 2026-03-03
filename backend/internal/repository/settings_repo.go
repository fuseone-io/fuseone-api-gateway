package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SettingsRepository struct {
	pool *pgxpool.Pool
}

func NewSettingsRepository(pool *pgxpool.Pool) *SettingsRepository {
	return &SettingsRepository{pool: pool}
}

// Get returns the JSON value for a setting key.
func (r *SettingsRepository) Get(ctx context.Context, key string) (json.RawMessage, error) {
	var value json.RawMessage
	err := r.pool.QueryRow(ctx, "SELECT value FROM system_settings WHERE key = $1", key).Scan(&value)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting setting %s: %w", key, err)
	}
	return value, nil
}

// Upsert inserts or updates a setting.
func (r *SettingsRepository) Upsert(ctx context.Context, key string, value json.RawMessage, updatedBy uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO system_settings (key, value, updated_by, updated_at)
		 VALUES ($1, $2, $3, NOW())
		 ON CONFLICT (key) DO UPDATE
		 SET value = $2, updated_by = $3, updated_at = NOW()`,
		key, value, updatedBy)
	if err != nil {
		return fmt.Errorf("upserting setting %s: %w", key, err)
	}
	return nil
}
