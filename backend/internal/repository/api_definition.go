package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

const apiDefColumns = `id, name, description, definition, sync_status, apisix_service_id,
		apisix_route_ids, created_by, created_at, updated_at, deployed_at,
		version, api_group_id, cloned_from_id, lifecycle_status, sunset_date`

type ApiDefinitionRepository struct {
	pool *pgxpool.Pool
}

func NewApiDefinitionRepository(pool *pgxpool.Pool) *ApiDefinitionRepository {
	return &ApiDefinitionRepository{pool: pool}
}

func scanApiDef(row pgx.Row) (*model.ApiDefinition, error) {
	var d model.ApiDefinition
	err := row.Scan(&d.ID, &d.Name, &d.Description, &d.Definition, &d.SyncStatus,
		&d.APISIXServiceID, &d.APISIXRouteIDs, &d.CreatedBy, &d.CreatedAt,
		&d.UpdatedAt, &d.DeployedAt,
		&d.Version, &d.ApiGroupID, &d.ClonedFromID, &d.LifecycleStatus, &d.SunsetDate)
	return &d, err
}

func scanApiDefs(rows pgx.Rows) ([]model.ApiDefinition, error) {
	var defs []model.ApiDefinition
	for rows.Next() {
		var d model.ApiDefinition
		if err := rows.Scan(&d.ID, &d.Name, &d.Description, &d.Definition, &d.SyncStatus,
			&d.APISIXServiceID, &d.APISIXRouteIDs, &d.CreatedBy, &d.CreatedAt,
			&d.UpdatedAt, &d.DeployedAt,
			&d.Version, &d.ApiGroupID, &d.ClonedFromID, &d.LifecycleStatus, &d.SunsetDate); err != nil {
			return nil, fmt.Errorf("scanning api definition: %w", err)
		}
		defs = append(defs, d)
	}
	return defs, nil
}

func (r *ApiDefinitionRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.ApiDefinition, error) {
	d, err := scanApiDef(r.pool.QueryRow(ctx,
		`SELECT `+apiDefColumns+` FROM api_definitions WHERE id = $1`, id))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting api definition: %w", err)
	}
	return d, nil
}

func (r *ApiDefinitionRepository) List(ctx context.Context, page, pageSize int, search, syncStatus, lifecycleStatus, apiGroupID string) ([]model.ApiDefinition, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	// Build WHERE clause
	where := "WHERE 1=1"
	args := []any{}
	argIdx := 1

	if search != "" {
		where += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if syncStatus != "" {
		where += fmt.Sprintf(" AND sync_status = $%d", argIdx)
		args = append(args, syncStatus)
		argIdx++
	}
	if lifecycleStatus != "" {
		where += fmt.Sprintf(" AND lifecycle_status = $%d", argIdx)
		args = append(args, lifecycleStatus)
		argIdx++
	}
	if apiGroupID != "" {
		where += fmt.Sprintf(" AND api_group_id = $%d", argIdx)
		args = append(args, apiGroupID)
		argIdx++
	}

	// Count
	var total int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM api_definitions "+where, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("counting api definitions: %w", err)
	}

	// Fetch
	query := fmt.Sprintf(
		`SELECT `+apiDefColumns+`
		 FROM api_definitions %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, argIdx, argIdx+1)
	args = append(args, pageSize, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("listing api definitions: %w", err)
	}
	defer rows.Close()

	defs, err := scanApiDefs(rows)
	if err != nil {
		return nil, 0, err
	}

	return defs, total, nil
}

func (r *ApiDefinitionRepository) Create(ctx context.Context, d *model.ApiDefinition) error {
	return r.pool.QueryRow(ctx,
		`INSERT INTO api_definitions (name, description, definition, sync_status, created_by,
		 version, api_group_id, cloned_from_id, lifecycle_status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id, created_at, updated_at, api_group_id`,
		d.Name, d.Description, d.Definition, d.SyncStatus, d.CreatedBy,
		d.Version, d.ApiGroupID, d.ClonedFromID, d.LifecycleStatus,
	).Scan(&d.ID, &d.CreatedAt, &d.UpdatedAt, &d.ApiGroupID)
}

func (r *ApiDefinitionRepository) Update(ctx context.Context, id uuid.UUID, name, description string, definition json.RawMessage, syncStatus string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE api_definitions
		 SET name = $2, description = $3, definition = $4, sync_status = $5, updated_at = NOW()
		 WHERE id = $1`,
		id, name, description, definition, syncStatus)
	if err != nil {
		return fmt.Errorf("updating api definition: %w", err)
	}
	return nil
}

func (r *ApiDefinitionRepository) SetDeployed(ctx context.Context, id uuid.UUID, serviceID string, routeIDs []string) error {
	routeIDsJSON, _ := json.Marshal(routeIDs)
	_, err := r.pool.Exec(ctx,
		`UPDATE api_definitions
		 SET sync_status = 'synced', apisix_service_id = $2, apisix_route_ids = $3,
		     deployed_at = NOW(), updated_at = NOW()
		 WHERE id = $1`,
		id, serviceID, routeIDsJSON)
	if err != nil {
		return fmt.Errorf("setting api definition deployed: %w", err)
	}
	return nil
}

func (r *ApiDefinitionRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM api_definitions WHERE id = $1", id)
	return err
}

func (r *ApiDefinitionRepository) UpdateLifecycleStatus(ctx context.Context, id uuid.UUID, status string, sunsetDate *time.Time) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE api_definitions
		 SET lifecycle_status = $2, sunset_date = $3, updated_at = NOW()
		 WHERE id = $1`,
		id, status, sunsetDate)
	if err != nil {
		return fmt.Errorf("updating lifecycle status: %w", err)
	}
	return nil
}

func (r *ApiDefinitionRepository) ListByGroup(ctx context.Context, apiGroupID uuid.UUID) ([]model.ApiDefinition, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+apiDefColumns+`
		 FROM api_definitions WHERE api_group_id = $1
		 ORDER BY created_at DESC`, apiGroupID)
	if err != nil {
		return nil, fmt.Errorf("listing api definitions by group: %w", err)
	}
	defer rows.Close()
	return scanApiDefs(rows)
}

func (r *ApiDefinitionRepository) GetActiveVersionInGroup(ctx context.Context, apiGroupID uuid.UUID, excludeID uuid.UUID) (*model.ApiDefinition, error) {
	d, err := scanApiDef(r.pool.QueryRow(ctx,
		`SELECT `+apiDefColumns+`
		 FROM api_definitions
		 WHERE api_group_id = $1 AND id != $2 AND lifecycle_status = 'active'
		 ORDER BY created_at DESC LIMIT 1`, apiGroupID, excludeID))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting active version in group: %w", err)
	}
	return d, nil
}
