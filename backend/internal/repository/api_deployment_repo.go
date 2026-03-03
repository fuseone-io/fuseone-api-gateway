package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

const apiDeployColumns = `id, api_definition_id, environment_id, apisix_service_id,
	apisix_route_ids, sync_status, deployed_at, deployed_by,
	definition_snapshot, created_at, updated_at`

type ApiDeploymentRepository struct {
	pool *pgxpool.Pool
}

func NewApiDeploymentRepository(pool *pgxpool.Pool) *ApiDeploymentRepository {
	return &ApiDeploymentRepository{pool: pool}
}

func scanApiDeployment(row pgx.Row) (*model.ApiDeployment, error) {
	var d model.ApiDeployment
	err := row.Scan(&d.ID, &d.ApiDefinitionID, &d.EnvironmentID, &d.APISIXServiceID,
		&d.APISIXRouteIDs, &d.SyncStatus, &d.DeployedAt, &d.DeployedBy,
		&d.DefinitionSnapshot, &d.CreatedAt, &d.UpdatedAt)
	return &d, err
}

func scanApiDeployments(rows pgx.Rows) ([]model.ApiDeployment, error) {
	var deployments []model.ApiDeployment
	for rows.Next() {
		var d model.ApiDeployment
		if err := rows.Scan(&d.ID, &d.ApiDefinitionID, &d.EnvironmentID, &d.APISIXServiceID,
			&d.APISIXRouteIDs, &d.SyncStatus, &d.DeployedAt, &d.DeployedBy,
			&d.DefinitionSnapshot, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning api deployment: %w", err)
		}
		deployments = append(deployments, d)
	}
	return deployments, nil
}

// Upsert creates or updates a deployment record for an API in an environment.
func (r *ApiDeploymentRepository) Upsert(ctx context.Context, apiDefID, envID uuid.UUID, serviceID string, routeIDs []string, snapshot json.RawMessage, deployedBy *uuid.UUID) (*model.ApiDeployment, error) {
	routeIDsJSON, _ := json.Marshal(routeIDs)

	d, err := scanApiDeployment(r.pool.QueryRow(ctx,
		`INSERT INTO api_deployments (api_definition_id, environment_id, apisix_service_id, apisix_route_ids, sync_status, deployed_at, deployed_by, definition_snapshot)
		 VALUES ($1, $2, $3, $4, 'synced', NOW(), $5, $6)
		 ON CONFLICT (api_definition_id, environment_id) DO UPDATE SET
			apisix_service_id = EXCLUDED.apisix_service_id,
			apisix_route_ids = EXCLUDED.apisix_route_ids,
			sync_status = EXCLUDED.sync_status,
			deployed_at = EXCLUDED.deployed_at,
			deployed_by = EXCLUDED.deployed_by,
			definition_snapshot = EXCLUDED.definition_snapshot,
			updated_at = NOW()
		 RETURNING `+apiDeployColumns,
		apiDefID, envID, serviceID, routeIDsJSON, deployedBy, snapshot))
	if err != nil {
		return nil, fmt.Errorf("upserting api deployment: %w", err)
	}
	return d, nil
}

// GetByAPIAndEnv returns the deployment for a specific API in a specific environment.
func (r *ApiDeploymentRepository) GetByAPIAndEnv(ctx context.Context, apiDefID, envID uuid.UUID) (*model.ApiDeployment, error) {
	d, err := scanApiDeployment(r.pool.QueryRow(ctx,
		`SELECT `+apiDeployColumns+` FROM api_deployments
		 WHERE api_definition_id = $1 AND environment_id = $2`, apiDefID, envID))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting api deployment: %w", err)
	}
	return d, nil
}

// ListByAPI returns all deployments for a given API (one per environment).
func (r *ApiDeploymentRepository) ListByAPI(ctx context.Context, apiDefID uuid.UUID) ([]model.ApiDeployment, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+apiDeployColumns+` FROM api_deployments
		 WHERE api_definition_id = $1 ORDER BY deployed_at DESC`, apiDefID)
	if err != nil {
		return nil, fmt.Errorf("listing api deployments: %w", err)
	}
	defer rows.Close()
	return scanApiDeployments(rows)
}

// DeleteByAPIAndEnv removes a deployment record.
func (r *ApiDeploymentRepository) DeleteByAPIAndEnv(ctx context.Context, apiDefID, envID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM api_deployments WHERE api_definition_id = $1 AND environment_id = $2`,
		apiDefID, envID)
	return err
}

// DeleteByAPI removes all deployment records for an API.
func (r *ApiDeploymentRepository) DeleteByAPI(ctx context.Context, apiDefID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM api_deployments WHERE api_definition_id = $1`, apiDefID)
	return err
}
