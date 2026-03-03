package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

// SLAQuerier defines the interface for SLA definition database operations.
type SLAQuerier interface {
	Create(ctx context.Context, sla *model.SLADefinition) error
	Get(ctx context.Context, id uuid.UUID) (*model.SLADefinition, error)
	Update(ctx context.Context, sla *model.SLADefinition) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, apiID *string) ([]model.SLADefinition, error)
	UpdateMetrics(ctx context.Context, id uuid.UUID, avail float64, latency int, errorRate float64, budgetRemaining float64, compliance string) error
}

// SLARepository implements SLAQuerier with PostgreSQL.
type SLARepository struct {
	pool *pgxpool.Pool
}

// NewSLARepository creates a new SLARepository.
func NewSLARepository(pool *pgxpool.Pool) *SLARepository {
	return &SLARepository{pool: pool}
}

const slaColumns = `id, name, description, api_id, availability_pct, latency_p99_ms, error_rate_pct,
	eval_window, current_avail, current_latency, current_error, budget_remaining,
	compliance_status, last_eval_at, created_by, created_at, updated_at`

func scanSLA(row pgx.Row) (*model.SLADefinition, error) {
	var sla model.SLADefinition
	err := row.Scan(
		&sla.ID, &sla.Name, &sla.Description, &sla.ApiID,
		&sla.AvailabilityPct, &sla.LatencyP99Ms, &sla.ErrorRatePct,
		&sla.EvalWindow, &sla.CurrentAvail, &sla.CurrentLatency, &sla.CurrentError,
		&sla.BudgetRemaining, &sla.ComplianceStatus, &sla.LastEvalAt,
		&sla.CreatedBy, &sla.CreatedAt, &sla.UpdatedAt,
	)
	return &sla, err
}

// Create inserts a new SLA definition.
func (r *SLARepository) Create(ctx context.Context, sla *model.SLADefinition) error {
	query := `INSERT INTO sla_definitions (name, description, api_id, availability_pct, latency_p99_ms,
		error_rate_pct, eval_window, current_avail, current_latency, current_error,
		budget_remaining, compliance_status, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		sla.Name, sla.Description, sla.ApiID, sla.AvailabilityPct, sla.LatencyP99Ms,
		sla.ErrorRatePct, sla.EvalWindow, sla.CurrentAvail, sla.CurrentLatency,
		sla.CurrentError, sla.BudgetRemaining, sla.ComplianceStatus, sla.CreatedBy,
	).Scan(&sla.ID, &sla.CreatedAt, &sla.UpdatedAt)
}

// Get retrieves a single SLA definition by ID.
func (r *SLARepository) Get(ctx context.Context, id uuid.UUID) (*model.SLADefinition, error) {
	query := `SELECT ` + slaColumns + ` FROM sla_definitions WHERE id = $1`
	sla, err := scanSLA(r.pool.QueryRow(ctx, query, id))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("getting SLA definition: %w", err)
	}
	return sla, nil
}

// Update modifies an existing SLA definition's configuration fields.
func (r *SLARepository) Update(ctx context.Context, sla *model.SLADefinition) error {
	query := `UPDATE sla_definitions SET name=$1, description=$2, api_id=$3, availability_pct=$4,
		latency_p99_ms=$5, error_rate_pct=$6, eval_window=$7, updated_at=NOW()
		WHERE id=$8`
	_, err := r.pool.Exec(ctx, query,
		sla.Name, sla.Description, sla.ApiID, sla.AvailabilityPct,
		sla.LatencyP99Ms, sla.ErrorRatePct, sla.EvalWindow, sla.ID,
	)
	return err
}

// Delete removes an SLA definition by ID.
func (r *SLARepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM sla_definitions WHERE id = $1`, id)
	return err
}

// List returns SLA definitions with optional api_id filter.
func (r *SLARepository) List(ctx context.Context, apiID *string) ([]model.SLADefinition, error) {
	query := `SELECT ` + slaColumns + ` FROM sla_definitions WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if apiID != nil {
		query += fmt.Sprintf(` AND api_id = $%d`, argIdx)
		args = append(args, *apiID)
		argIdx++
	}

	query += ` ORDER BY created_at DESC`

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing SLA definitions: %w", err)
	}
	defer rows.Close()

	var slas []model.SLADefinition
	for rows.Next() {
		var sla model.SLADefinition
		if err := rows.Scan(
			&sla.ID, &sla.Name, &sla.Description, &sla.ApiID,
			&sla.AvailabilityPct, &sla.LatencyP99Ms, &sla.ErrorRatePct,
			&sla.EvalWindow, &sla.CurrentAvail, &sla.CurrentLatency, &sla.CurrentError,
			&sla.BudgetRemaining, &sla.ComplianceStatus, &sla.LastEvalAt,
			&sla.CreatedBy, &sla.CreatedAt, &sla.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning SLA definition: %w", err)
		}
		slas = append(slas, sla)
	}
	return slas, nil
}

// UpdateMetrics updates the runtime metrics and compliance status for an SLA definition.
func (r *SLARepository) UpdateMetrics(ctx context.Context, id uuid.UUID, avail float64, latency int, errorRate float64, budgetRemaining float64, compliance string) error {
	query := `UPDATE sla_definitions SET current_avail=$1, current_latency=$2, current_error=$3,
		budget_remaining=$4, compliance_status=$5, last_eval_at=NOW(), updated_at=NOW()
		WHERE id=$6`
	_, err := r.pool.Exec(ctx, query, avail, latency, errorRate, budgetRemaining, compliance, id)
	return err
}
