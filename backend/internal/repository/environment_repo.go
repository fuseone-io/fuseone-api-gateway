package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

// EnvironmentQuerier defines the read interface used by the APISIX client registry.
type EnvironmentQuerier interface {
	GetByID(ctx context.Context, id uuid.UUID) (*model.Environment, error)
	GetDefault(ctx context.Context) (*model.Environment, error)
	List(ctx context.Context) ([]model.Environment, error)
}

type EnvironmentRepository struct {
	pool *pgxpool.Pool
}

func NewEnvironmentRepository(pool *pgxpool.Pool) *EnvironmentRepository {
	return &EnvironmentRepository{pool: pool}
}

func (r *EnvironmentRepository) List(ctx context.Context) ([]model.Environment, error) {
	query := `SELECT id, name, slug, description, color, sort_order, is_default,
		admin_url, api_key, control_url, metrics_url, created_by, created_at, updated_at
		FROM environments ORDER BY sort_order, name`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var envs []model.Environment
	for rows.Next() {
		var e model.Environment
		if err := rows.Scan(
			&e.ID, &e.Name, &e.Slug, &e.Description, &e.Color, &e.SortOrder, &e.IsDefault,
			&e.AdminURL, &e.APIKey, &e.ControlURL, &e.MetricsURL, &e.CreatedBy, &e.CreatedAt, &e.UpdatedAt,
		); err != nil {
			return nil, err
		}
		envs = append(envs, e)
	}
	return envs, nil
}

func (r *EnvironmentRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Environment, error) {
	query := `SELECT id, name, slug, description, color, sort_order, is_default,
		admin_url, api_key, control_url, metrics_url, created_by, created_at, updated_at
		FROM environments WHERE id = $1`

	var e model.Environment
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&e.ID, &e.Name, &e.Slug, &e.Description, &e.Color, &e.SortOrder, &e.IsDefault,
		&e.AdminURL, &e.APIKey, &e.ControlURL, &e.MetricsURL, &e.CreatedBy, &e.CreatedAt, &e.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &e, nil
}

func (r *EnvironmentRepository) GetDefault(ctx context.Context) (*model.Environment, error) {
	query := `SELECT id, name, slug, description, color, sort_order, is_default,
		admin_url, api_key, control_url, metrics_url, created_by, created_at, updated_at
		FROM environments WHERE is_default = TRUE LIMIT 1`

	var e model.Environment
	err := r.pool.QueryRow(ctx, query).Scan(
		&e.ID, &e.Name, &e.Slug, &e.Description, &e.Color, &e.SortOrder, &e.IsDefault,
		&e.AdminURL, &e.APIKey, &e.ControlURL, &e.MetricsURL, &e.CreatedBy, &e.CreatedAt, &e.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &e, nil
}

func (r *EnvironmentRepository) GetBySlug(ctx context.Context, slug string) (*model.Environment, error) {
	query := `SELECT id, name, slug, description, color, sort_order, is_default,
		admin_url, api_key, control_url, metrics_url, created_by, created_at, updated_at
		FROM environments WHERE slug = $1`

	var e model.Environment
	err := r.pool.QueryRow(ctx, query, slug).Scan(
		&e.ID, &e.Name, &e.Slug, &e.Description, &e.Color, &e.SortOrder, &e.IsDefault,
		&e.AdminURL, &e.APIKey, &e.ControlURL, &e.MetricsURL, &e.CreatedBy, &e.CreatedAt, &e.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &e, nil
}

func (r *EnvironmentRepository) Create(ctx context.Context, env *model.Environment) error {
	query := `INSERT INTO environments (name, slug, description, color, sort_order, is_default,
		admin_url, api_key, control_url, metrics_url, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at, updated_at`

	return r.pool.QueryRow(ctx, query,
		env.Name, env.Slug, env.Description, env.Color, env.SortOrder, env.IsDefault,
		env.AdminURL, env.APIKey, env.ControlURL, env.MetricsURL, env.CreatedBy,
	).Scan(&env.ID, &env.CreatedAt, &env.UpdatedAt)
}

func (r *EnvironmentRepository) Update(ctx context.Context, env *model.Environment) error {
	query := `UPDATE environments SET name=$1, slug=$2, description=$3, color=$4, sort_order=$5,
		admin_url=$6, api_key=$7, control_url=$8, metrics_url=$9, updated_at=NOW()
		WHERE id=$10`

	_, err := r.pool.Exec(ctx, query,
		env.Name, env.Slug, env.Description, env.Color, env.SortOrder,
		env.AdminURL, env.APIKey, env.ControlURL, env.MetricsURL, env.ID,
	)
	return err
}

func (r *EnvironmentRepository) Delete(ctx context.Context, id uuid.UUID) error {
	// Prevent deleting the default environment
	var isDefault bool
	err := r.pool.QueryRow(ctx, `SELECT is_default FROM environments WHERE id = $1`, id).Scan(&isDefault)
	if err != nil {
		return err
	}
	if isDefault {
		return fmt.Errorf("cannot delete the default environment")
	}

	_, err = r.pool.Exec(ctx, `DELETE FROM environments WHERE id = $1`, id)
	return err
}

func (r *EnvironmentRepository) SetDefault(ctx context.Context, id uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Unset current default
	if _, err := tx.Exec(ctx, `UPDATE environments SET is_default = FALSE WHERE is_default = TRUE`); err != nil {
		return err
	}

	// Set new default
	tag, err := tx.Exec(ctx, `UPDATE environments SET is_default = TRUE WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("environment not found")
	}

	return tx.Commit(ctx)
}
