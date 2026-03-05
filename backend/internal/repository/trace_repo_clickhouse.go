package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/fuseone/api-gateway/internal/model"
)

// ClickHouseTraceRepository implements TraceQuerier for ClickHouse.
type ClickHouseTraceRepository struct {
	conn ClickHouseConn
}

func NewClickHouseTraceRepository(conn ClickHouseConn) *ClickHouseTraceRepository {
	return &ClickHouseTraceRepository{conn: conn}
}

func (r *ClickHouseTraceRepository) InsertBatch(ctx context.Context, traces []model.RequestTrace) error {
	if len(traces) == 0 {
		return nil
	}

	batch, err := r.conn.PrepareBatch(ctx, `INSERT INTO request_traces
		(id, trace_id, root_span_id, service_name, route_id, route_name,
		 method, uri, status_code, duration_ns, spans, attributes, created_at)`)
	if err != nil {
		return fmt.Errorf("prepare batch: %w", err)
	}

	for _, t := range traces {
		spansJSON, _ := json.Marshal(t.Spans)
		attrsJSON, err := json.Marshal(t.Attributes)
		if err != nil {
			attrsJSON = []byte("{}")
		}

		if err := batch.Append(
			uint64(t.ID), t.TraceID, t.RootSpanID, t.ServiceName, t.RouteID, t.RouteName,
			t.Method, t.URI, uint16(t.StatusCode), t.DurationNs,
			string(spansJSON), string(attrsJSON), t.CreatedAt,
		); err != nil {
			return fmt.Errorf("append to batch: %w", err)
		}
	}

	return batch.Send()
}

func (r *ClickHouseTraceRepository) List(ctx context.Context, params model.TraceListParams) ([]model.RequestTrace, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}

	if len(params.RouteIDs) > 0 {
		where = append(where, "route_id IN (?)")
		args = append(args, params.RouteIDs)
	} else if params.RouteID != "" {
		where = append(where, "route_id = ?")
		args = append(args, params.RouteID)
	}
	if params.Method != "" {
		where = append(where, "method = ?")
		args = append(args, params.Method)
	}
	if params.StatusMin > 0 {
		where = append(where, "status_code >= ?")
		args = append(args, uint16(params.StatusMin))
	}
	if params.StatusMax > 0 {
		where = append(where, "status_code <= ?")
		args = append(args, uint16(params.StatusMax))
	}
	if params.MinDurationMs > 0 {
		where = append(where, "duration_ns >= ?")
		args = append(args, params.MinDurationMs*1_000_000)
	}
	if params.MaxDurationMs > 0 {
		where = append(where, "duration_ns <= ?")
		args = append(args, params.MaxDurationMs*1_000_000)
	}
	if params.Search != "" {
		where = append(where, "uri ILIKE ?")
		args = append(args, "%"+params.Search+"%")
	}
	if !params.From.IsZero() {
		where = append(where, "created_at >= ?")
		args = append(args, params.From)
	}
	if !params.To.IsZero() {
		where = append(where, "created_at <= ?")
		args = append(args, params.To)
	}

	whereClause := strings.Join(where, " AND ")

	// Count
	var total uint64
	countQuery := fmt.Sprintf("SELECT count() FROM request_traces WHERE %s", whereClause)
	if err := r.conn.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count traces: %w", err)
	}

	// Pagination
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

	rows, err := r.conn.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list traces: %w", err)
	}
	defer rows.Close()

	var traces []model.RequestTrace
	for rows.Next() {
		var t model.RequestTrace
		var id uint64
		var statusCode uint16
		var spansStr, attrsStr string
		if err := rows.Scan(
			&id, &t.TraceID, &t.RootSpanID, &t.ServiceName, &t.RouteID, &t.RouteName,
			&t.Method, &t.URI, &statusCode, &t.DurationNs, &spansStr, &attrsStr, &t.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan trace: %w", err)
		}
		t.ID = int64(id)
		t.StatusCode = int(statusCode)
		json.Unmarshal([]byte(spansStr), &t.Spans)
		json.Unmarshal([]byte(attrsStr), &t.Attributes)
		if t.Spans == nil {
			t.Spans = []model.TraceSpan{}
		}
		traces = append(traces, t)
	}

	if traces == nil {
		traces = []model.RequestTrace{}
	}
	return traces, int(total), nil
}

func (r *ClickHouseTraceRepository) GetByTraceID(ctx context.Context, traceID string) (*model.RequestTrace, error) {
	query := `
		SELECT id, trace_id, root_span_id, service_name, route_id, route_name,
			method, uri, status_code, duration_ns, spans, attributes, created_at
		FROM request_traces
		WHERE trace_id = ?
		ORDER BY created_at DESC
		LIMIT 1`

	var t model.RequestTrace
	var id uint64
	var statusCode uint16
	var spansStr, attrsStr string
	err := r.conn.QueryRow(ctx, query, traceID).Scan(
		&id, &t.TraceID, &t.RootSpanID, &t.ServiceName, &t.RouteID, &t.RouteName,
		&t.Method, &t.URI, &statusCode, &t.DurationNs, &spansStr, &attrsStr, &t.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	t.ID = int64(id)
	t.StatusCode = int(statusCode)
	json.Unmarshal([]byte(spansStr), &t.Spans)
	json.Unmarshal([]byte(attrsStr), &t.Attributes)
	if t.Spans == nil {
		t.Spans = []model.TraceSpan{}
	}
	return &t, nil
}

func (r *ClickHouseTraceRepository) DeleteOlderThan(ctx context.Context, before time.Time) (int64, error) {
	// ClickHouse uses TTL for automatic cleanup; lightweight deletes for manual cleanup.
	err := r.conn.Exec(ctx, "ALTER TABLE request_traces DELETE WHERE created_at < ?", before)
	if err != nil {
		return 0, fmt.Errorf("delete old traces: %w", err)
	}
	// ClickHouse lightweight deletes are async; return 0 as exact count is not available immediately.
	return 0, nil
}

func (r *ClickHouseTraceRepository) EnsurePartition(_ context.Context, _ time.Time) error {
	// ClickHouse handles partitioning automatically via PARTITION BY.
	return nil
}
