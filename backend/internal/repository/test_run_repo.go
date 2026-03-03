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

// TestRunQuerier defines the interface for test run database operations.
type TestRunQuerier interface {
	Create(ctx context.Context, run *model.TestRun) error
	Get(ctx context.Context, id uuid.UUID) (*model.TestRun, error)
	ListBySuite(ctx context.Context, suiteID uuid.UUID, limit int) ([]model.TestRun, error)
	UpdateStatus(ctx context.Context, run *model.TestRun) error
}

// TestRunRepository implements TestRunQuerier with PostgreSQL.
type TestRunRepository struct {
	pool *pgxpool.Pool
}

// NewTestRunRepository creates a new TestRunRepository.
func NewTestRunRepository(pool *pgxpool.Pool) *TestRunRepository {
	return &TestRunRepository{pool: pool}
}

// Create inserts a new test run. Results is stored as JSONB.
func (r *TestRunRepository) Create(ctx context.Context, run *model.TestRun) error {
	resultsJSON, err := json.Marshal(run.Results)
	if err != nil {
		return fmt.Errorf("marshal results: %w", err)
	}

	query := `INSERT INTO test_runs (suite_id, status, trigger_type, results, total_steps, passed_steps, failed_steps, duration_ms, started_at, finished_at, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at`
	return r.pool.QueryRow(ctx, query,
		run.SuiteID, run.Status, run.TriggerType, resultsJSON,
		run.TotalSteps, run.PassedSteps, run.FailedSteps, run.DurationMs,
		run.StartedAt, run.FinishedAt, run.CreatedBy,
	).Scan(&run.ID, &run.CreatedAt)
}

// Get retrieves a single test run by ID.
func (r *TestRunRepository) Get(ctx context.Context, id uuid.UUID) (*model.TestRun, error) {
	query := `SELECT id, suite_id, status, trigger_type, results, total_steps, passed_steps, failed_steps,
		duration_ms, started_at, finished_at, created_by, created_at
		FROM test_runs WHERE id = $1`
	run := &model.TestRun{}
	var resultsJSON []byte
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&run.ID, &run.SuiteID, &run.Status, &run.TriggerType, &resultsJSON,
		&run.TotalSteps, &run.PassedSteps, &run.FailedSteps, &run.DurationMs,
		&run.StartedAt, &run.FinishedAt, &run.CreatedBy, &run.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("getting test run: %w", err)
	}
	if err := json.Unmarshal(resultsJSON, &run.Results); err != nil {
		return nil, fmt.Errorf("unmarshal results: %w", err)
	}
	if run.Results == nil {
		run.Results = []model.StepResult{}
	}
	return run, nil
}

// ListBySuite returns test runs for a given suite, ordered by creation time descending.
func (r *TestRunRepository) ListBySuite(ctx context.Context, suiteID uuid.UUID, limit int) ([]model.TestRun, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	query := `SELECT id, suite_id, status, trigger_type, results, total_steps, passed_steps, failed_steps,
		duration_ms, started_at, finished_at, created_by, created_at
		FROM test_runs WHERE suite_id = $1 ORDER BY created_at DESC LIMIT $2`

	rows, err := r.pool.Query(ctx, query, suiteID, limit)
	if err != nil {
		return nil, fmt.Errorf("listing test runs: %w", err)
	}
	defer rows.Close()

	var runs []model.TestRun
	for rows.Next() {
		var run model.TestRun
		var resultsJSON []byte
		if err := rows.Scan(
			&run.ID, &run.SuiteID, &run.Status, &run.TriggerType, &resultsJSON,
			&run.TotalSteps, &run.PassedSteps, &run.FailedSteps, &run.DurationMs,
			&run.StartedAt, &run.FinishedAt, &run.CreatedBy, &run.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning test run: %w", err)
		}
		if err := json.Unmarshal(resultsJSON, &run.Results); err != nil {
			return nil, fmt.Errorf("unmarshal results: %w", err)
		}
		if run.Results == nil {
			run.Results = []model.StepResult{}
		}
		runs = append(runs, run)
	}
	return runs, nil
}

// UpdateStatus updates the status, results, and counters of a test run.
func (r *TestRunRepository) UpdateStatus(ctx context.Context, run *model.TestRun) error {
	resultsJSON, err := json.Marshal(run.Results)
	if err != nil {
		return fmt.Errorf("marshal results: %w", err)
	}

	query := `UPDATE test_runs SET status=$1, results=$2, total_steps=$3, passed_steps=$4,
		failed_steps=$5, duration_ms=$6, started_at=$7, finished_at=$8
		WHERE id=$9`
	_, err = r.pool.Exec(ctx, query,
		run.Status, resultsJSON, run.TotalSteps, run.PassedSteps,
		run.FailedSteps, run.DurationMs, run.StartedAt, run.FinishedAt,
		run.ID,
	)
	return err
}
