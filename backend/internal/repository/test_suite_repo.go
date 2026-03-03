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

// TestSuiteQuerier defines the interface for test suite database operations.
type TestSuiteQuerier interface {
	Create(ctx context.Context, suite *model.TestSuite) error
	Get(ctx context.Context, id uuid.UUID) (*model.TestSuite, error)
	Update(ctx context.Context, suite *model.TestSuite) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, apiID *string, tag string) ([]model.TestSuite, error)
	Count(ctx context.Context) (int, error)
}

// TestSuiteRepository implements TestSuiteQuerier with PostgreSQL.
type TestSuiteRepository struct {
	pool *pgxpool.Pool
}

// NewTestSuiteRepository creates a new TestSuiteRepository.
func NewTestSuiteRepository(pool *pgxpool.Pool) *TestSuiteRepository {
	return &TestSuiteRepository{pool: pool}
}

// Create inserts a new test suite. Steps is stored as JSONB, tags as text[].
func (r *TestSuiteRepository) Create(ctx context.Context, suite *model.TestSuite) error {
	stepsJSON, err := json.Marshal(suite.Steps)
	if err != nil {
		return fmt.Errorf("marshal steps: %w", err)
	}

	tags := suite.Tags
	if tags == nil {
		tags = []string{}
	}

	query := `INSERT INTO test_suites (name, description, api_id, steps, tags, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		suite.Name, suite.Description, suite.ApiID, stepsJSON, tags, suite.CreatedBy,
	).Scan(&suite.ID, &suite.CreatedAt, &suite.UpdatedAt)
}

// Get retrieves a single test suite by ID.
func (r *TestSuiteRepository) Get(ctx context.Context, id uuid.UUID) (*model.TestSuite, error) {
	query := `SELECT id, name, description, api_id, steps, tags, created_by, created_at, updated_at
		FROM test_suites WHERE id = $1`
	suite := &model.TestSuite{}
	var stepsJSON []byte
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&suite.ID, &suite.Name, &suite.Description, &suite.ApiID,
		&stepsJSON, &suite.Tags, &suite.CreatedBy,
		&suite.CreatedAt, &suite.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("getting test suite: %w", err)
	}
	if err := json.Unmarshal(stepsJSON, &suite.Steps); err != nil {
		return nil, fmt.Errorf("unmarshal steps: %w", err)
	}
	if suite.Steps == nil {
		suite.Steps = []model.TestStep{}
	}
	if suite.Tags == nil {
		suite.Tags = []string{}
	}
	return suite, nil
}

// Update modifies an existing test suite.
func (r *TestSuiteRepository) Update(ctx context.Context, suite *model.TestSuite) error {
	stepsJSON, err := json.Marshal(suite.Steps)
	if err != nil {
		return fmt.Errorf("marshal steps: %w", err)
	}

	tags := suite.Tags
	if tags == nil {
		tags = []string{}
	}

	query := `UPDATE test_suites SET name=$1, description=$2, api_id=$3, steps=$4, tags=$5, updated_at=NOW()
		WHERE id=$6`
	_, err = r.pool.Exec(ctx, query,
		suite.Name, suite.Description, suite.ApiID, stepsJSON, tags, suite.ID,
	)
	return err
}

// Delete removes a test suite by ID.
func (r *TestSuiteRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM test_suites WHERE id = $1`, id)
	return err
}

// List returns test suites with optional filters by api_id and tag.
func (r *TestSuiteRepository) List(ctx context.Context, apiID *string, tag string) ([]model.TestSuite, error) {
	query := `SELECT id, name, description, api_id, steps, tags, created_by, created_at, updated_at
		FROM test_suites WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if apiID != nil {
		query += fmt.Sprintf(` AND api_id = $%d`, argIdx)
		args = append(args, *apiID)
		argIdx++
	}
	if tag != "" {
		query += fmt.Sprintf(` AND $%d = ANY(tags)`, argIdx)
		args = append(args, tag)
		argIdx++
	}

	query += ` ORDER BY created_at DESC`

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing test suites: %w", err)
	}
	defer rows.Close()

	var suites []model.TestSuite
	for rows.Next() {
		var suite model.TestSuite
		var stepsJSON []byte
		if err := rows.Scan(
			&suite.ID, &suite.Name, &suite.Description, &suite.ApiID,
			&stepsJSON, &suite.Tags, &suite.CreatedBy,
			&suite.CreatedAt, &suite.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning test suite: %w", err)
		}
		if err := json.Unmarshal(stepsJSON, &suite.Steps); err != nil {
			return nil, fmt.Errorf("unmarshal steps: %w", err)
		}
		if suite.Steps == nil {
			suite.Steps = []model.TestStep{}
		}
		if suite.Tags == nil {
			suite.Tags = []string{}
		}
		suites = append(suites, suite)
	}
	return suites, nil
}

// Count returns the total number of test suites.
func (r *TestSuiteRepository) Count(ctx context.Context) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM test_suites`).Scan(&count)
	return count, err
}
