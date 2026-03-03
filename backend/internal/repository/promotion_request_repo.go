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

const promotionRequestColumns = `id, api_definition_id, source_env_id, target_env_id,
	status, definition_snapshot, diff_summary, requested_by,
	reviewed_by, review_comment, requested_at, reviewed_at, deployed_at`

type PromotionRequestRepository struct {
	pool *pgxpool.Pool
}

func NewPromotionRequestRepository(pool *pgxpool.Pool) *PromotionRequestRepository {
	return &PromotionRequestRepository{pool: pool}
}

func scanPromotionRequest(row pgx.Row) (*model.PromotionRequest, error) {
	var p model.PromotionRequest
	err := row.Scan(&p.ID, &p.ApiDefinitionID, &p.SourceEnvID, &p.TargetEnvID,
		&p.Status, &p.DefinitionSnapshot, &p.DiffSummary, &p.RequestedBy,
		&p.ReviewedBy, &p.ReviewComment, &p.RequestedAt, &p.ReviewedAt, &p.DeployedAt)
	return &p, err
}

func scanPromotionRequests(rows pgx.Rows) ([]model.PromotionRequest, error) {
	var result []model.PromotionRequest
	for rows.Next() {
		var p model.PromotionRequest
		if err := rows.Scan(&p.ID, &p.ApiDefinitionID, &p.SourceEnvID, &p.TargetEnvID,
			&p.Status, &p.DefinitionSnapshot, &p.DiffSummary, &p.RequestedBy,
			&p.ReviewedBy, &p.ReviewComment, &p.RequestedAt, &p.ReviewedAt, &p.DeployedAt); err != nil {
			return nil, fmt.Errorf("scanning promotion request: %w", err)
		}
		result = append(result, p)
	}
	return result, nil
}

// Create inserts a new promotion request.
func (r *PromotionRequestRepository) Create(ctx context.Context, p *model.PromotionRequest) error {
	snapshotJSON, _ := json.Marshal(json.RawMessage(p.DefinitionSnapshot))
	var diffJSON []byte
	if p.DiffSummary != nil {
		diffJSON = p.DiffSummary
	}

	err := r.pool.QueryRow(ctx,
		`INSERT INTO promotion_requests (api_definition_id, source_env_id, target_env_id, status, definition_snapshot, diff_summary, requested_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING `+promotionRequestColumns,
		p.ApiDefinitionID, p.SourceEnvID, p.TargetEnvID, p.Status, snapshotJSON, diffJSON, p.RequestedBy,
	).Scan(&p.ID, &p.ApiDefinitionID, &p.SourceEnvID, &p.TargetEnvID,
		&p.Status, &p.DefinitionSnapshot, &p.DiffSummary, &p.RequestedBy,
		&p.ReviewedBy, &p.ReviewComment, &p.RequestedAt, &p.ReviewedAt, &p.DeployedAt)
	if err != nil {
		return fmt.Errorf("creating promotion request: %w", err)
	}
	return nil
}

// GetByID returns a single promotion request.
func (r *PromotionRequestRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.PromotionRequest, error) {
	p, err := scanPromotionRequest(r.pool.QueryRow(ctx,
		`SELECT `+promotionRequestColumns+` FROM promotion_requests WHERE id = $1`, id))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("getting promotion request: %w", err)
	}
	return p, nil
}

// List returns promotion requests with optional filters.
func (r *PromotionRequestRepository) List(ctx context.Context, status string, apiDefID *uuid.UUID) ([]model.PromotionRequest, error) {
	query := `SELECT ` + promotionRequestColumns + ` FROM promotion_requests WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if status != "" {
		query += fmt.Sprintf(` AND status = $%d`, argIdx)
		args = append(args, status)
		argIdx++
	}
	if apiDefID != nil {
		query += fmt.Sprintf(` AND api_definition_id = $%d`, argIdx)
		args = append(args, *apiDefID)
		argIdx++
	}

	query += ` ORDER BY requested_at DESC`

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing promotion requests: %w", err)
	}
	defer rows.Close()
	return scanPromotionRequests(rows)
}

// UpdateStatus updates the status of a promotion request.
func (r *PromotionRequestRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE promotion_requests SET status = $1 WHERE id = $2`, status, id)
	return err
}

// SetReviewed updates the review fields.
func (r *PromotionRequestRepository) SetReviewed(ctx context.Context, id uuid.UUID, status string, reviewedBy uuid.UUID, comment string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE promotion_requests SET status = $1, reviewed_by = $2, review_comment = $3, reviewed_at = NOW() WHERE id = $4`,
		status, reviewedBy, comment, id)
	return err
}

// SetDeployed marks a promotion as deployed.
func (r *PromotionRequestRepository) SetDeployed(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE promotion_requests SET status = 'deployed', deployed_at = NOW() WHERE id = $1`, id)
	return err
}

// SetFailed marks a promotion as failed.
func (r *PromotionRequestRepository) SetFailed(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE promotion_requests SET status = 'failed' WHERE id = $1`, id)
	return err
}
