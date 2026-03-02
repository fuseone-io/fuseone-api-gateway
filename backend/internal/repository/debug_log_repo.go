package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

type DebugLogQuerier interface {
	BatchInsert(ctx context.Context, logs []model.DebugLog) error
	List(ctx context.Context, filter model.DebugLogFilter) ([]model.DebugLog, int, error)
	GetByID(ctx context.Context, id int64) (*model.DebugLog, error)
	CleanupOlderThan(ctx context.Context, hours int) (int64, error)
	TrimToMaxRows(ctx context.Context, maxRows int) (int64, error)
}

type DebugLogRepository struct {
	pool *pgxpool.Pool
}

func NewDebugLogRepository(pool *pgxpool.Pool) *DebugLogRepository {
	return &DebugLogRepository{pool: pool}
}

func (r *DebugLogRepository) BatchInsert(ctx context.Context, logs []model.DebugLog) error {
	if len(logs) == 0 {
		return nil
	}

	var b strings.Builder
	b.WriteString(`INSERT INTO debug_logs (
		route_id, service_id, consumer_name,
		req_method, req_uri, req_headers, req_body, req_size, client_ip,
		resp_status, resp_headers, resp_body, resp_size,
		latency_total, latency_upstream, latency_gateway,
		upstream_addr, request_time
	) VALUES `)

	args := make([]interface{}, 0, len(logs)*18)
	for i, l := range logs {
		if i > 0 {
			b.WriteString(", ")
		}
		base := i * 18
		fmt.Fprintf(&b, "($%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d)",
			base+1, base+2, base+3, base+4, base+5, base+6, base+7, base+8, base+9,
			base+10, base+11, base+12, base+13, base+14, base+15, base+16, base+17, base+18)

		var clientIP interface{}
		if l.ClientIP != "" {
			clientIP = l.ClientIP
		}

		args = append(args,
			l.RouteID, nilIfEmpty(l.ServiceID), nilIfEmpty(l.ConsumerName),
			l.ReqMethod, l.ReqURI, l.ReqHeaders, l.ReqBody, l.ReqSize, clientIP,
			l.RespStatus, l.RespHeaders, l.RespBody, l.RespSize,
			l.LatencyTotal, l.LatencyUpstream, l.LatencyGateway,
			nilIfEmpty(l.UpstreamAddr), l.RequestTime,
		)
	}

	_, err := r.pool.Exec(ctx, b.String(), args...)
	return err
}

func (r *DebugLogRepository) List(ctx context.Context, filter model.DebugLogFilter) ([]model.DebugLog, int, error) {
	var conditions []string
	var args []interface{}
	argIdx := 1

	if len(filter.RouteIDs) > 0 {
		placeholders := make([]string, len(filter.RouteIDs))
		for i, rid := range filter.RouteIDs {
			placeholders[i] = fmt.Sprintf("$%d", argIdx)
			args = append(args, rid)
			argIdx++
		}
		conditions = append(conditions, fmt.Sprintf("route_id IN (%s)", strings.Join(placeholders, ",")))
	} else if filter.RouteID != "" {
		conditions = append(conditions, fmt.Sprintf("route_id = $%d", argIdx))
		args = append(args, filter.RouteID)
		argIdx++
	}
	if filter.StatusMin > 0 {
		conditions = append(conditions, fmt.Sprintf("resp_status >= $%d", argIdx))
		args = append(args, filter.StatusMin)
		argIdx++
	}
	if filter.StatusMax > 0 {
		conditions = append(conditions, fmt.Sprintf("resp_status <= $%d", argIdx))
		args = append(args, filter.StatusMax)
		argIdx++
	}
	if filter.Method != "" {
		conditions = append(conditions, fmt.Sprintf("req_method = $%d", argIdx))
		args = append(args, filter.Method)
		argIdx++
	}
	if filter.Search != "" {
		conditions = append(conditions, fmt.Sprintf("req_uri ILIKE $%d", argIdx))
		args = append(args, "%"+filter.Search+"%")
		argIdx++
	}
	if filter.ClientIP != "" {
		conditions = append(conditions, fmt.Sprintf("host(client_ip)::text ILIKE $%d", argIdx))
		args = append(args, filter.ClientIP+"%")
		argIdx++
	}
	if filter.ConsumerName != "" {
		conditions = append(conditions, fmt.Sprintf("consumer_name = $%d", argIdx))
		args = append(args, filter.ConsumerName)
		argIdx++
	}
	if filter.LatencyMin > 0 {
		conditions = append(conditions, fmt.Sprintf("latency_total >= $%d", argIdx))
		args = append(args, filter.LatencyMin)
		argIdx++
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Count total
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM debug_logs %s", where)
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Fetch rows
	limit := filter.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(`SELECT
		id, route_id, COALESCE(service_id,''), COALESCE(consumer_name,''),
		req_method, req_uri, req_headers, req_body, COALESCE(req_size,0),
		COALESCE(host(client_ip),''),
		resp_status, resp_headers, resp_body, COALESCE(resp_size,0),
		latency_total, latency_upstream, latency_gateway,
		COALESCE(upstream_addr,''), request_time, created_at
		FROM debug_logs %s ORDER BY request_time DESC LIMIT $%d OFFSET $%d`,
		where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []model.DebugLog
	for rows.Next() {
		var l model.DebugLog
		if err := rows.Scan(
			&l.ID, &l.RouteID, &l.ServiceID, &l.ConsumerName,
			&l.ReqMethod, &l.ReqURI, &l.ReqHeaders, &l.ReqBody, &l.ReqSize,
			&l.ClientIP,
			&l.RespStatus, &l.RespHeaders, &l.RespBody, &l.RespSize,
			&l.LatencyTotal, &l.LatencyUpstream, &l.LatencyGateway,
			&l.UpstreamAddr, &l.RequestTime, &l.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		logs = append(logs, l)
	}
	return logs, total, rows.Err()
}

func (r *DebugLogRepository) GetByID(ctx context.Context, id int64) (*model.DebugLog, error) {
	query := `SELECT
		id, route_id, COALESCE(service_id,''), COALESCE(consumer_name,''),
		req_method, req_uri, req_headers, req_body, COALESCE(req_size,0),
		COALESCE(host(client_ip),''),
		resp_status, resp_headers, resp_body, COALESCE(resp_size,0),
		latency_total, latency_upstream, latency_gateway,
		COALESCE(upstream_addr,''), request_time, created_at
		FROM debug_logs WHERE id = $1`

	var l model.DebugLog
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&l.ID, &l.RouteID, &l.ServiceID, &l.ConsumerName,
		&l.ReqMethod, &l.ReqURI, &l.ReqHeaders, &l.ReqBody, &l.ReqSize,
		&l.ClientIP,
		&l.RespStatus, &l.RespHeaders, &l.RespBody, &l.RespSize,
		&l.LatencyTotal, &l.LatencyUpstream, &l.LatencyGateway,
		&l.UpstreamAddr, &l.RequestTime, &l.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func (r *DebugLogRepository) CleanupOlderThan(ctx context.Context, hours int) (int64, error) {
	tag, err := r.pool.Exec(ctx,
		"DELETE FROM debug_logs WHERE created_at < NOW() - make_interval(hours => $1)", hours)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func (r *DebugLogRepository) TrimToMaxRows(ctx context.Context, maxRows int) (int64, error) {
	if maxRows <= 0 {
		return 0, nil
	}
	// Delete oldest rows that exceed the cap. Uses a subquery to find the cutoff ID.
	query := `DELETE FROM debug_logs WHERE id IN (
		SELECT id FROM debug_logs ORDER BY created_at ASC
		LIMIT GREATEST((SELECT COUNT(*) FROM debug_logs) - $1, 0)
	)`
	tag, err := r.pool.Exec(ctx, query, maxRows)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func nilIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
