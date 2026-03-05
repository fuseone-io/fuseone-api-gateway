package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

// TraceQuerier defines the interface for trace data access.
type TraceQuerier interface {
	InsertBatch(ctx context.Context, traces []model.RequestTrace) error
	List(ctx context.Context, params model.TraceListParams) ([]model.RequestTrace, int, error)
	GetByTraceID(ctx context.Context, traceID string) (*model.RequestTrace, error)
	DeleteOlderThan(ctx context.Context, before time.Time) (int64, error)
	EnsurePartition(ctx context.Context, month time.Time) error
}

type TraceRepository struct {
	pool *pgxpool.Pool
}

func NewTraceRepository(pool *pgxpool.Pool) *TraceRepository {
	return &TraceRepository{pool: pool}
}

func (r *TraceRepository) InsertBatch(ctx context.Context, traces []model.RequestTrace) error {
	if len(traces) == 0 {
		return nil
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	for _, t := range traces {
		spansJSON, err := json.Marshal(t.Spans)
		if err != nil {
			return fmt.Errorf("marshal spans: %w", err)
		}
		attrsJSON, err := json.Marshal(t.Attributes)
		if err != nil {
			attrsJSON = []byte("{}")
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO request_traces (trace_id, root_span_id, service_name, route_id, route_name,
				method, uri, status_code, duration_ns, spans, attributes, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
			t.TraceID, t.RootSpanID, t.ServiceName, t.RouteID, t.RouteName,
			t.Method, t.URI, t.StatusCode, t.DurationNs, spansJSON, attrsJSON, t.CreatedAt,
		)
		if err != nil {
			return fmt.Errorf("insert trace: %w", err)
		}
	}

	return tx.Commit(ctx)
}

func (r *TraceRepository) List(ctx context.Context, params model.TraceListParams) ([]model.RequestTrace, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if len(params.RouteIDs) > 0 {
		placeholders := make([]string, len(params.RouteIDs))
		for i, rid := range params.RouteIDs {
			placeholders[i] = fmt.Sprintf("$%d", argIdx)
			args = append(args, rid)
			argIdx++
		}
		where = append(where, fmt.Sprintf("route_id IN (%s)", strings.Join(placeholders, ",")))
	} else if params.RouteID != "" {
		where = append(where, fmt.Sprintf("route_id = $%d", argIdx))
		args = append(args, params.RouteID)
		argIdx++
	}
	if params.Method != "" {
		where = append(where, fmt.Sprintf("method = $%d", argIdx))
		args = append(args, params.Method)
		argIdx++
	}
	if params.StatusMin > 0 {
		where = append(where, fmt.Sprintf("status_code >= $%d", argIdx))
		args = append(args, params.StatusMin)
		argIdx++
	}
	if params.StatusMax > 0 {
		where = append(where, fmt.Sprintf("status_code <= $%d", argIdx))
		args = append(args, params.StatusMax)
		argIdx++
	}
	if params.MinDurationMs > 0 {
		where = append(where, fmt.Sprintf("duration_ns >= $%d", argIdx))
		args = append(args, params.MinDurationMs*1_000_000) // ms → ns
		argIdx++
	}
	if params.MaxDurationMs > 0 {
		where = append(where, fmt.Sprintf("duration_ns <= $%d", argIdx))
		args = append(args, params.MaxDurationMs*1_000_000)
		argIdx++
	}
	if params.Search != "" {
		where = append(where, fmt.Sprintf("uri ILIKE $%d", argIdx))
		args = append(args, "%"+params.Search+"%")
		argIdx++
	}
	if !params.From.IsZero() {
		where = append(where, fmt.Sprintf("created_at >= $%d", argIdx))
		args = append(args, params.From)
		argIdx++
	}
	if !params.To.IsZero() {
		where = append(where, fmt.Sprintf("created_at <= $%d", argIdx))
		args = append(args, params.To)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	// Count
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM request_traces WHERE %s", whereClause)
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count traces: %w", err)
	}

	// Limit / offset
	limit := params.Limit
	if limit <= 0 {
		limit = 50
	}
	offset := params.Offset
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(`
		SELECT id, trace_id, root_span_id, service_name, route_id, route_name,
			method, uri, status_code, duration_ns, spans, attributes, created_at
		FROM request_traces
		WHERE %s
		ORDER BY created_at DESC
		LIMIT %d OFFSET %d`, whereClause, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list traces: %w", err)
	}
	defer rows.Close()

	var traces []model.RequestTrace
	for rows.Next() {
		var t model.RequestTrace
		var spansJSON, attrsJSON []byte
		if err := rows.Scan(
			&t.ID, &t.TraceID, &t.RootSpanID, &t.ServiceName, &t.RouteID, &t.RouteName,
			&t.Method, &t.URI, &t.StatusCode, &t.DurationNs, &spansJSON, &attrsJSON, &t.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan trace: %w", err)
		}
		json.Unmarshal(spansJSON, &t.Spans)
		json.Unmarshal(attrsJSON, &t.Attributes)
		if t.Spans == nil {
			t.Spans = []model.TraceSpan{}
		}
		traces = append(traces, t)
	}

	if traces == nil {
		traces = []model.RequestTrace{}
	}

	return traces, total, nil
}

func (r *TraceRepository) GetByTraceID(ctx context.Context, traceID string) (*model.RequestTrace, error) {
	query := `
		SELECT id, trace_id, root_span_id, service_name, route_id, route_name,
			method, uri, status_code, duration_ns, spans, attributes, created_at
		FROM request_traces
		WHERE trace_id = $1
		ORDER BY created_at DESC
		LIMIT 1`

	var t model.RequestTrace
	var spansJSON, attrsJSON []byte
	err := r.pool.QueryRow(ctx, query, traceID).Scan(
		&t.ID, &t.TraceID, &t.RootSpanID, &t.ServiceName, &t.RouteID, &t.RouteName,
		&t.Method, &t.URI, &t.StatusCode, &t.DurationNs, &spansJSON, &attrsJSON, &t.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	json.Unmarshal(spansJSON, &t.Spans)
	json.Unmarshal(attrsJSON, &t.Attributes)
	if t.Spans == nil {
		t.Spans = []model.TraceSpan{}
	}
	return &t, nil
}

func (r *TraceRepository) DeleteOlderThan(ctx context.Context, before time.Time) (int64, error) {
	tag, err := r.pool.Exec(ctx, "DELETE FROM request_traces WHERE created_at < $1", before)
	if err != nil {
		return 0, fmt.Errorf("delete old traces: %w", err)
	}
	return tag.RowsAffected(), nil
}

func (r *TraceRepository) EnsurePartition(ctx context.Context, month time.Time) error {
	start := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 1, 0)
	partName := fmt.Sprintf("request_traces_%d_%02d", start.Year(), start.Month())

	query := fmt.Sprintf(`
		DO $$ BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM pg_class WHERE relname = '%s'
			) THEN
				CREATE TABLE %s PARTITION OF request_traces
				FOR VALUES FROM ('%s') TO ('%s');
			END IF;
		END $$;`,
		partName, partName,
		start.Format("2006-01-02"),
		end.Format("2006-01-02"),
	)

	_, err := r.pool.Exec(ctx, query)
	return err
}
