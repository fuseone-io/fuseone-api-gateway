package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

// SyntheticMonitorQuerier defines the interface for synthetic monitor database operations.
type SyntheticMonitorQuerier interface {
	Create(ctx context.Context, monitor *model.SyntheticMonitor) error
	Get(ctx context.Context, id uuid.UUID) (*model.SyntheticMonitor, error)
	Update(ctx context.Context, monitor *model.SyntheticMonitor) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context) ([]model.SyntheticMonitor, error)
	ListEnabled(ctx context.Context) ([]model.SyntheticMonitor, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status string, runID *uuid.UUID, consecutiveFail int, uptimePct float64) error
}

// SyntheticMonitorRepository implements SyntheticMonitorQuerier with PostgreSQL.
type SyntheticMonitorRepository struct {
	pool *pgxpool.Pool
}

// NewSyntheticMonitorRepository creates a new SyntheticMonitorRepository.
func NewSyntheticMonitorRepository(pool *pgxpool.Pool) *SyntheticMonitorRepository {
	return &SyntheticMonitorRepository{pool: pool}
}

const syntheticMonitorColumns = `id, name, description, enabled, suite_id, interval_sec, locations,
	notify_contact_ids, uptime_pct, last_status, last_run_at, last_run_id, consecutive_fail,
	created_by, created_at, updated_at`

func scanSyntheticMonitor(row pgx.Row) (*model.SyntheticMonitor, error) {
	var m model.SyntheticMonitor
	err := row.Scan(
		&m.ID, &m.Name, &m.Description, &m.Enabled, &m.SuiteID, &m.IntervalSec,
		&m.Locations, &m.NotifyContactIDs, &m.UptimePct, &m.LastStatus, &m.LastRunAt, &m.LastRunID,
		&m.ConsecutiveFail, &m.CreatedBy, &m.CreatedAt, &m.UpdatedAt,
	)
	if m.Locations == nil {
		m.Locations = []string{}
	}
	if m.NotifyContactIDs == nil {
		m.NotifyContactIDs = []uuid.UUID{}
	}
	return &m, err
}

func scanSyntheticMonitors(rows pgx.Rows) ([]model.SyntheticMonitor, error) {
	var result []model.SyntheticMonitor
	for rows.Next() {
		var m model.SyntheticMonitor
		if err := rows.Scan(
			&m.ID, &m.Name, &m.Description, &m.Enabled, &m.SuiteID, &m.IntervalSec,
			&m.Locations, &m.NotifyContactIDs, &m.UptimePct, &m.LastStatus, &m.LastRunAt, &m.LastRunID,
			&m.ConsecutiveFail, &m.CreatedBy, &m.CreatedAt, &m.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning synthetic monitor: %w", err)
		}
		if m.Locations == nil {
			m.Locations = []string{}
		}
		if m.NotifyContactIDs == nil {
			m.NotifyContactIDs = []uuid.UUID{}
		}
		result = append(result, m)
	}
	return result, nil
}

// Create inserts a new synthetic monitor. Locations is stored as text[].
func (r *SyntheticMonitorRepository) Create(ctx context.Context, monitor *model.SyntheticMonitor) error {
	locations := monitor.Locations
	if locations == nil {
		locations = []string{}
	}
	contactIDs := monitor.NotifyContactIDs
	if contactIDs == nil {
		contactIDs = []uuid.UUID{}
	}

	query := `INSERT INTO synthetic_monitors (name, description, enabled, suite_id, interval_sec, locations, notify_contact_ids, uptime_pct, last_status, consecutive_fail, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		monitor.Name, monitor.Description, monitor.Enabled, monitor.SuiteID,
		monitor.IntervalSec, locations, contactIDs, monitor.UptimePct, monitor.LastStatus,
		monitor.ConsecutiveFail, monitor.CreatedBy,
	).Scan(&monitor.ID, &monitor.CreatedAt, &monitor.UpdatedAt)
}

// Get retrieves a single synthetic monitor by ID.
func (r *SyntheticMonitorRepository) Get(ctx context.Context, id uuid.UUID) (*model.SyntheticMonitor, error) {
	query := `SELECT ` + syntheticMonitorColumns + ` FROM synthetic_monitors WHERE id = $1`
	m, err := scanSyntheticMonitor(r.pool.QueryRow(ctx, query, id))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("getting synthetic monitor: %w", err)
	}
	return m, nil
}

// Update modifies an existing synthetic monitor.
func (r *SyntheticMonitorRepository) Update(ctx context.Context, monitor *model.SyntheticMonitor) error {
	locations := monitor.Locations
	if locations == nil {
		locations = []string{}
	}
	contactIDs := monitor.NotifyContactIDs
	if contactIDs == nil {
		contactIDs = []uuid.UUID{}
	}

	query := `UPDATE synthetic_monitors SET name=$1, description=$2, enabled=$3, suite_id=$4,
		interval_sec=$5, locations=$6, notify_contact_ids=$7, updated_at=NOW()
		WHERE id=$8`
	_, err := r.pool.Exec(ctx, query,
		monitor.Name, monitor.Description, monitor.Enabled, monitor.SuiteID,
		monitor.IntervalSec, locations, contactIDs, monitor.ID,
	)
	return err
}

// Delete removes a synthetic monitor by ID.
func (r *SyntheticMonitorRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM synthetic_monitors WHERE id = $1`, id)
	return err
}

// List returns all synthetic monitors ordered by creation time.
func (r *SyntheticMonitorRepository) List(ctx context.Context) ([]model.SyntheticMonitor, error) {
	query := `SELECT ` + syntheticMonitorColumns + ` FROM synthetic_monitors ORDER BY created_at DESC`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("listing synthetic monitors: %w", err)
	}
	defer rows.Close()
	return scanSyntheticMonitors(rows)
}

// ListEnabled returns only enabled synthetic monitors.
func (r *SyntheticMonitorRepository) ListEnabled(ctx context.Context) ([]model.SyntheticMonitor, error) {
	query := `SELECT ` + syntheticMonitorColumns + ` FROM synthetic_monitors WHERE enabled = true ORDER BY created_at DESC`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("listing enabled synthetic monitors: %w", err)
	}
	defer rows.Close()
	return scanSyntheticMonitors(rows)
}

// UpdateStatus updates the monitor's runtime status after a test run completes.
func (r *SyntheticMonitorRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string, runID *uuid.UUID, consecutiveFail int, uptimePct float64) error {
	query := `UPDATE synthetic_monitors SET last_status=$1, last_run_at=NOW(), last_run_id=$2,
		consecutive_fail=$3, uptime_pct=$4, updated_at=NOW()
		WHERE id=$5`
	_, err := r.pool.Exec(ctx, query, status, runID, consecutiveFail, uptimePct, id)
	return err
}
