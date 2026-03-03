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

// AlertQuerier defines the interface for alert-related database operations.
type AlertQuerier interface {
	CreateRule(ctx context.Context, rule *model.AlertRule) error
	GetRule(ctx context.Context, id uuid.UUID) (*model.AlertRule, error)
	UpdateRule(ctx context.Context, rule *model.AlertRule) error
	DeleteRule(ctx context.Context, id uuid.UUID) error
	ListRules(ctx context.Context, enabledOnly bool) ([]model.AlertRule, error)
	UpdateRuleState(ctx context.Context, id uuid.UUID, state string, firedAt *string) error

	CreateEvent(ctx context.Context, event *model.AlertEvent) error
	ListEvents(ctx context.Context, ruleID *uuid.UUID, limit int) ([]model.AlertEvent, error)

	CountFiring(ctx context.Context) (int, error)
}

type AlertRepository struct {
	pool *pgxpool.Pool
}

func NewAlertRepository(pool *pgxpool.Pool) *AlertRepository {
	return &AlertRepository{pool: pool}
}

func (r *AlertRepository) CreateRule(ctx context.Context, rule *model.AlertRule) error {
	channelsJSON, err := json.Marshal(rule.Channels)
	if err != nil {
		return fmt.Errorf("marshal channels: %w", err)
	}

	query := `INSERT INTO alert_rules (name, description, enabled, rule_type, scope_type, scope_ids, threshold, eval_window, channels, state, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		rule.Name, rule.Description, rule.Enabled, rule.RuleType,
		rule.ScopeType, rule.ScopeIDs, rule.Threshold, rule.EvalWindow,
		channelsJSON, rule.State, rule.CreatedBy,
	).Scan(&rule.ID, &rule.CreatedAt, &rule.UpdatedAt)
}

func (r *AlertRepository) GetRule(ctx context.Context, id uuid.UUID) (*model.AlertRule, error) {
	query := `SELECT id, name, description, enabled, rule_type, scope_type, scope_ids,
		threshold, eval_window, channels, state, last_eval, fired_at, created_by, created_at, updated_at
		FROM alert_rules WHERE id = $1`
	rule := &model.AlertRule{}
	var channelsJSON []byte
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&rule.ID, &rule.Name, &rule.Description, &rule.Enabled, &rule.RuleType,
		&rule.ScopeType, &rule.ScopeIDs, &rule.Threshold, &rule.EvalWindow,
		&channelsJSON, &rule.State, &rule.LastEval, &rule.FiredAt,
		&rule.CreatedBy, &rule.CreatedAt, &rule.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	if err := json.Unmarshal(channelsJSON, &rule.Channels); err != nil {
		return nil, fmt.Errorf("unmarshal channels: %w", err)
	}
	return rule, nil
}

func (r *AlertRepository) UpdateRule(ctx context.Context, rule *model.AlertRule) error {
	channelsJSON, err := json.Marshal(rule.Channels)
	if err != nil {
		return fmt.Errorf("marshal channels: %w", err)
	}

	query := `UPDATE alert_rules SET name=$1, description=$2, enabled=$3, rule_type=$4,
		scope_type=$5, scope_ids=$6, threshold=$7, eval_window=$8, channels=$9,
		updated_at=NOW()
		WHERE id=$10`
	_, err = r.pool.Exec(ctx, query,
		rule.Name, rule.Description, rule.Enabled, rule.RuleType,
		rule.ScopeType, rule.ScopeIDs, rule.Threshold, rule.EvalWindow,
		channelsJSON, rule.ID,
	)
	return err
}

func (r *AlertRepository) DeleteRule(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM alert_rules WHERE id = $1`, id)
	return err
}

func (r *AlertRepository) ListRules(ctx context.Context, enabledOnly bool) ([]model.AlertRule, error) {
	where := ""
	if enabledOnly {
		where = " WHERE enabled = true"
	}
	query := `SELECT id, name, description, enabled, rule_type, scope_type, scope_ids,
		threshold, eval_window, channels, state, last_eval, fired_at, created_by, created_at, updated_at
		FROM alert_rules` + where + ` ORDER BY created_at DESC`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []model.AlertRule
	for rows.Next() {
		var rule model.AlertRule
		var channelsJSON []byte
		if err := rows.Scan(
			&rule.ID, &rule.Name, &rule.Description, &rule.Enabled, &rule.RuleType,
			&rule.ScopeType, &rule.ScopeIDs, &rule.Threshold, &rule.EvalWindow,
			&channelsJSON, &rule.State, &rule.LastEval, &rule.FiredAt,
			&rule.CreatedBy, &rule.CreatedAt, &rule.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(channelsJSON, &rule.Channels); err != nil {
			return nil, fmt.Errorf("unmarshal channels: %w", err)
		}
		rules = append(rules, rule)
	}
	return rules, nil
}

func (r *AlertRepository) UpdateRuleState(ctx context.Context, id uuid.UUID, state string, firedAt *string) error {
	if firedAt != nil {
		_, err := r.pool.Exec(ctx,
			`UPDATE alert_rules SET state=$1, fired_at=$2, last_eval=NOW(), updated_at=NOW() WHERE id=$3`,
			state, *firedAt, id,
		)
		return err
	}
	_, err := r.pool.Exec(ctx,
		`UPDATE alert_rules SET state=$1, last_eval=NOW(), updated_at=NOW() WHERE id=$2`,
		state, id,
	)
	return err
}

func (r *AlertRepository) CreateEvent(ctx context.Context, event *model.AlertEvent) error {
	query := `INSERT INTO alert_events (rule_id, event_type, message, value, threshold, acked_by)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`
	return r.pool.QueryRow(ctx, query,
		event.RuleID, event.EventType, event.Message, event.Value, event.Threshold, event.AckedBy,
	).Scan(&event.ID, &event.CreatedAt)
}

func (r *AlertRepository) ListEvents(ctx context.Context, ruleID *uuid.UUID, limit int) ([]model.AlertEvent, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	where := ""
	args := []any{limit}
	if ruleID != nil {
		where = " WHERE rule_id = $2"
		args = append(args, *ruleID)
	}

	query := `SELECT id, rule_id, event_type, message, value, threshold, acked_by, created_at
		FROM alert_events` + where + ` ORDER BY created_at DESC LIMIT $1`

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []model.AlertEvent
	for rows.Next() {
		var ev model.AlertEvent
		if err := rows.Scan(&ev.ID, &ev.RuleID, &ev.EventType, &ev.Message, &ev.Value, &ev.Threshold, &ev.AckedBy, &ev.CreatedAt); err != nil {
			return nil, err
		}
		events = append(events, ev)
	}
	return events, nil
}

func (r *AlertRepository) CountFiring(ctx context.Context) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM alert_rules WHERE state = 'firing' AND enabled = true`).Scan(&count)
	return count, err
}
