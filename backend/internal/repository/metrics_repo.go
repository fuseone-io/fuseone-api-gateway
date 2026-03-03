package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

// MetricsFilter holds all parameters for a metrics query.
type MetricsFilter struct {
	RouteIDs      []string
	ConsumerNames []string
	RangeStr      string    // preset: "1h","6h","24h","7d","30d"
	From          time.Time // custom range (zero = not used)
	To            time.Time
}

// IsCustom returns true when the filter uses absolute from/to timestamps.
func (f MetricsFilter) IsCustom() bool {
	return !f.From.IsZero()
}

// MetricsQuerier is the interface for metrics data access, enabling mock injection in tests.
type MetricsQuerier interface {
	BatchUpsertMinute(ctx context.Context, rows []model.MetricsRow) error
	TimeSeries(ctx context.Context, filter MetricsFilter) ([]model.TimeSeriesPoint, error)
	Summary(ctx context.Context, filter MetricsFilter) (*model.MetricsSummary, error)
	TopRoutes(ctx context.Context, filter MetricsFilter, limit int) ([]model.TopRoute, error)
	TopConsumers(ctx context.Context, filter MetricsFilter, limit int) ([]model.TopConsumer, error)
	RollupToHour(ctx context.Context) (int64, error)
	RollupToDay(ctx context.Context) (int64, error)
	CleanupExpired(ctx context.Context, ttl1mDays, ttl1hDays int) (int64, error)
}

type MetricsRepository struct {
	pool *pgxpool.Pool
}

func NewMetricsRepository(pool *pgxpool.Pool) *MetricsRepository {
	return &MetricsRepository{pool: pool}
}

func (r *MetricsRepository) BatchUpsertMinute(ctx context.Context, rows []model.MetricsRow) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	for _, row := range rows {
		_, err := tx.Exec(ctx, `
			INSERT INTO metrics_1m (
				ts, route_id, route_name, consumer_name,
				requests_total, status_2xx, status_3xx, status_4xx, status_5xx,
				latency_sum, latency_count, latency_p50, latency_p95, latency_p99,
				bandwidth_ingress, bandwidth_egress
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
			ON CONFLICT (ts, route_id, consumer_name) DO UPDATE SET
				requests_total = metrics_1m.requests_total + EXCLUDED.requests_total,
				status_2xx = metrics_1m.status_2xx + EXCLUDED.status_2xx,
				status_3xx = metrics_1m.status_3xx + EXCLUDED.status_3xx,
				status_4xx = metrics_1m.status_4xx + EXCLUDED.status_4xx,
				status_5xx = metrics_1m.status_5xx + EXCLUDED.status_5xx,
				latency_sum = metrics_1m.latency_sum + EXCLUDED.latency_sum,
				latency_count = metrics_1m.latency_count + EXCLUDED.latency_count,
				latency_p50 = EXCLUDED.latency_p50,
				latency_p95 = EXCLUDED.latency_p95,
				latency_p99 = EXCLUDED.latency_p99,
				bandwidth_ingress = metrics_1m.bandwidth_ingress + EXCLUDED.bandwidth_ingress,
				bandwidth_egress = metrics_1m.bandwidth_egress + EXCLUDED.bandwidth_egress
		`,
			row.Ts, row.RouteID, row.RouteName, row.ConsumerName,
			row.RequestsTotal, row.Status2xx, row.Status3xx, row.Status4xx, row.Status5xx,
			row.LatencySum, row.LatencyCount, row.LatencyP50, row.LatencyP95, row.LatencyP99,
			row.BandwidthIngress, row.BandwidthEgress,
		)
		if err != nil {
			return fmt.Errorf("upsert row: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// rangeToTable returns the PostgreSQL interval string and which table to query for preset ranges.
func rangeToTable(rangeStr string) (table string, interval string) {
	switch rangeStr {
	case "1h":
		return "metrics_1m", "1 hour"
	case "6h":
		return "metrics_1m", "6 hours"
	case "24h":
		return "metrics_1m", "24 hours"
	case "7d":
		return "metrics_1h", "7 days"
	case "30d":
		return "metrics_1d", "30 days"
	default:
		return "metrics_1m", "1 hour"
	}
}

// tableForSpan picks the best resolution table based on how many hours the custom range spans.
func tableForSpan(span time.Duration) string {
	hours := span.Hours()
	switch {
	case hours <= 24:
		return "metrics_1m"
	case hours <= 7*24:
		return "metrics_1h"
	default:
		return "metrics_1d"
	}
}

// resolveFilter returns (table, whereClause, args) for either a preset or custom filter.
func resolveFilter(f MetricsFilter) (table string, whereClause string, args []interface{}) {
	if f.IsCustom() {
		table = tableForSpan(f.To.Sub(f.From))
		nextArg := 1
		whereClause = fmt.Sprintf("ts >= $%d AND ts <= $%d", nextArg, nextArg+1)
		args = []interface{}{f.From, f.To}
		nextArg = 3
		if len(f.RouteIDs) == 1 {
			whereClause += fmt.Sprintf(" AND route_id = $%d", nextArg)
			args = append(args, f.RouteIDs[0])
			nextArg++
		} else if len(f.RouteIDs) > 1 {
			whereClause += fmt.Sprintf(" AND route_id = ANY($%d)", nextArg)
			args = append(args, f.RouteIDs)
			nextArg++
		}
		if len(f.ConsumerNames) == 1 {
			whereClause += fmt.Sprintf(" AND consumer_name = $%d", nextArg)
			args = append(args, f.ConsumerNames[0])
		} else if len(f.ConsumerNames) > 1 {
			whereClause += fmt.Sprintf(" AND consumer_name = ANY($%d)", nextArg)
			args = append(args, f.ConsumerNames)
		}
	} else {
		var interval string
		table, interval = rangeToTable(f.RangeStr)
		nextArg := 1
		whereClause = fmt.Sprintf("ts >= NOW() - $%d::interval", nextArg)
		args = []interface{}{interval}
		nextArg = 2
		if len(f.RouteIDs) == 1 {
			whereClause += fmt.Sprintf(" AND route_id = $%d", nextArg)
			args = append(args, f.RouteIDs[0])
			nextArg++
		} else if len(f.RouteIDs) > 1 {
			whereClause += fmt.Sprintf(" AND route_id = ANY($%d)", nextArg)
			args = append(args, f.RouteIDs)
			nextArg++
		}
		if len(f.ConsumerNames) == 1 {
			whereClause += fmt.Sprintf(" AND consumer_name = $%d", nextArg)
			args = append(args, f.ConsumerNames[0])
		} else if len(f.ConsumerNames) > 1 {
			whereClause += fmt.Sprintf(" AND consumer_name = ANY($%d)", nextArg)
			args = append(args, f.ConsumerNames)
		}
	}
	return
}

func (r *MetricsRepository) TimeSeries(ctx context.Context, filter MetricsFilter) ([]model.TimeSeriesPoint, error) {
	table, where, args := resolveFilter(filter)

	// Always aggregate when there are multiple rows per timestamp
	// (multiple routes, consumers, or global view)
	needsAgg := len(filter.RouteIDs) != 1 || len(filter.ConsumerNames) != 1
	var query string
	if !needsAgg {
		query = fmt.Sprintf(`
			SELECT ts, requests_total, status_2xx, status_3xx, status_4xx, status_5xx,
				latency_p50, latency_p95, latency_p99, bandwidth_ingress, bandwidth_egress
			FROM %s
			WHERE %s
			ORDER BY ts
		`, table, where)
	} else {
		query = fmt.Sprintf(`
			SELECT ts,
				SUM(requests_total)::INT, SUM(status_2xx)::INT, SUM(status_3xx)::INT,
				SUM(status_4xx)::INT, SUM(status_5xx)::INT,
				CASE WHEN SUM(latency_count) > 0
					THEN SUM(latency_p50 * latency_count) / SUM(latency_count) ELSE 0 END,
				CASE WHEN SUM(latency_count) > 0
					THEN SUM(latency_p95 * latency_count) / SUM(latency_count) ELSE 0 END,
				CASE WHEN SUM(latency_count) > 0
					THEN SUM(latency_p99 * latency_count) / SUM(latency_count) ELSE 0 END,
				SUM(bandwidth_ingress)::BIGINT, SUM(bandwidth_egress)::BIGINT
			FROM %s
			WHERE %s
			GROUP BY ts
			ORDER BY ts
		`, table, where)
	}

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query timeseries: %w", err)
	}
	defer rows.Close()

	var points []model.TimeSeriesPoint
	for rows.Next() {
		var p model.TimeSeriesPoint
		if err := rows.Scan(
			&p.Ts, &p.RequestsTotal, &p.Status2xx, &p.Status3xx, &p.Status4xx, &p.Status5xx,
			&p.LatencyP50, &p.LatencyP95, &p.LatencyP99, &p.BandwidthIngress, &p.BandwidthEgress,
		); err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		points = append(points, p)
	}

	if points == nil {
		points = []model.TimeSeriesPoint{}
	}
	return points, nil
}

func (r *MetricsRepository) Summary(ctx context.Context, filter MetricsFilter) (*model.MetricsSummary, error) {
	table, where, args := resolveFilter(filter)

	query := fmt.Sprintf(`
		SELECT
			COALESCE(SUM(requests_total), 0),
			CASE WHEN SUM(latency_count) > 0
				THEN SUM(latency_sum) / SUM(latency_count) ELSE 0 END,
			COALESCE(SUM(status_2xx), 0),
			COALESCE(SUM(status_3xx), 0),
			COALESCE(SUM(status_4xx), 0),
			COALESCE(SUM(status_5xx), 0),
			COALESCE(SUM(bandwidth_ingress), 0),
			COALESCE(SUM(bandwidth_egress), 0)
		FROM %s
		WHERE %s
	`, table, where)

	var s model.MetricsSummary
	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&s.TotalRequests,
		&s.AvgLatencyMs,
		&s.Status2xx, &s.Status3xx, &s.Status4xx, &s.Status5xx,
		&s.TotalBandwidthIn, &s.TotalBandwidthOut,
	)
	if err != nil {
		return nil, fmt.Errorf("query summary: %w", err)
	}

	if s.TotalRequests > 0 {
		errors := s.Status4xx + s.Status5xx
		s.ErrorRate = float64(errors) / float64(s.TotalRequests)
	}

	return &s, nil
}

func (r *MetricsRepository) TopRoutes(ctx context.Context, filter MetricsFilter, limit int) ([]model.TopRoute, error) {
	table, where, args := resolveFilter(filter)

	// For global queries with no route filter, exclude empty route IDs
	if len(filter.RouteIDs) == 0 {
		where += " AND route_id != ''"
	}

	limitParam := fmt.Sprintf("$%d", len(args)+1)
	args = append(args, limit)

	query := fmt.Sprintf(`
		SELECT
			route_id,
			MAX(route_name),
			SUM(requests_total)::BIGINT,
			CASE WHEN SUM(latency_count) > 0
				THEN SUM(latency_sum) / SUM(latency_count) ELSE 0 END,
			CASE WHEN SUM(requests_total) > 0
				THEN (SUM(status_4xx) + SUM(status_5xx))::FLOAT / SUM(requests_total) ELSE 0 END,
			SUM(bandwidth_ingress)::BIGINT,
			SUM(bandwidth_egress)::BIGINT
		FROM %s
		WHERE %s
		GROUP BY route_id
		ORDER BY SUM(requests_total) DESC
		LIMIT %s
	`, table, where, limitParam)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query top routes: %w", err)
	}
	defer rows.Close()

	var routes []model.TopRoute
	for rows.Next() {
		var tr model.TopRoute
		if err := rows.Scan(
			&tr.RouteID, &tr.RouteName, &tr.RequestsTotal,
			&tr.AvgLatencyMs, &tr.ErrorRate,
			&tr.BandwidthIngress, &tr.BandwidthEgress,
		); err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		routes = append(routes, tr)
	}

	if routes == nil {
		routes = []model.TopRoute{}
	}
	return routes, nil
}

func (r *MetricsRepository) TopConsumers(ctx context.Context, filter MetricsFilter, limit int) ([]model.TopConsumer, error) {
	table, where, args := resolveFilter(filter)

	// Only include rows with a non-empty consumer (authenticated traffic)
	where += " AND consumer_name != ''"

	limitParam := fmt.Sprintf("$%d", len(args)+1)
	args = append(args, limit)

	query := fmt.Sprintf(`
		SELECT
			consumer_name,
			SUM(requests_total)::BIGINT,
			CASE WHEN SUM(latency_count) > 0
				THEN SUM(latency_sum) / SUM(latency_count) ELSE 0 END,
			CASE WHEN SUM(requests_total) > 0
				THEN (SUM(status_4xx) + SUM(status_5xx))::FLOAT / SUM(requests_total) ELSE 0 END,
			SUM(bandwidth_ingress)::BIGINT,
			SUM(bandwidth_egress)::BIGINT
		FROM %s
		WHERE %s
		GROUP BY consumer_name
		ORDER BY SUM(requests_total) DESC
		LIMIT %s
	`, table, where, limitParam)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query top consumers: %w", err)
	}
	defer rows.Close()

	var consumers []model.TopConsumer
	for rows.Next() {
		var tc model.TopConsumer
		if err := rows.Scan(
			&tc.ConsumerName, &tc.RequestsTotal,
			&tc.AvgLatencyMs, &tc.ErrorRate,
			&tc.BandwidthIngress, &tc.BandwidthEgress,
		); err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		consumers = append(consumers, tc)
	}

	if consumers == nil {
		consumers = []model.TopConsumer{}
	}
	return consumers, nil
}

func (r *MetricsRepository) RollupToHour(ctx context.Context) (int64, error) {
	result, err := r.pool.Exec(ctx, `
		INSERT INTO metrics_1h (
			ts, route_id, route_name, consumer_name,
			requests_total, status_2xx, status_3xx, status_4xx, status_5xx,
			latency_sum, latency_count, latency_p50, latency_p95, latency_p99,
			bandwidth_ingress, bandwidth_egress
		)
		SELECT
			date_trunc('hour', ts),
			route_id,
			MAX(route_name),
			consumer_name,
			SUM(requests_total),
			SUM(status_2xx), SUM(status_3xx), SUM(status_4xx), SUM(status_5xx),
			SUM(latency_sum), SUM(latency_count),
			CASE WHEN SUM(latency_count) > 0
				THEN SUM(latency_p50 * latency_count) / SUM(latency_count) ELSE 0 END,
			CASE WHEN SUM(latency_count) > 0
				THEN SUM(latency_p95 * latency_count) / SUM(latency_count) ELSE 0 END,
			CASE WHEN SUM(latency_count) > 0
				THEN SUM(latency_p99 * latency_count) / SUM(latency_count) ELSE 0 END,
			SUM(bandwidth_ingress), SUM(bandwidth_egress)
		FROM metrics_1m
		WHERE ts < date_trunc('hour', NOW())
		GROUP BY date_trunc('hour', ts), route_id, consumer_name
		ON CONFLICT (ts, route_id, consumer_name) DO UPDATE SET
			requests_total = EXCLUDED.requests_total,
			status_2xx = EXCLUDED.status_2xx,
			status_3xx = EXCLUDED.status_3xx,
			status_4xx = EXCLUDED.status_4xx,
			status_5xx = EXCLUDED.status_5xx,
			latency_sum = EXCLUDED.latency_sum,
			latency_count = EXCLUDED.latency_count,
			latency_p50 = EXCLUDED.latency_p50,
			latency_p95 = EXCLUDED.latency_p95,
			latency_p99 = EXCLUDED.latency_p99,
			bandwidth_ingress = EXCLUDED.bandwidth_ingress,
			bandwidth_egress = EXCLUDED.bandwidth_egress
	`)
	if err != nil {
		return 0, fmt.Errorf("rollup to hour: %w", err)
	}
	return result.RowsAffected(), nil
}

func (r *MetricsRepository) RollupToDay(ctx context.Context) (int64, error) {
	result, err := r.pool.Exec(ctx, `
		INSERT INTO metrics_1d (
			ts, route_id, route_name, consumer_name,
			requests_total, status_2xx, status_3xx, status_4xx, status_5xx,
			latency_sum, latency_count, latency_p50, latency_p95, latency_p99,
			bandwidth_ingress, bandwidth_egress
		)
		SELECT
			date_trunc('day', ts),
			route_id,
			MAX(route_name),
			consumer_name,
			SUM(requests_total),
			SUM(status_2xx), SUM(status_3xx), SUM(status_4xx), SUM(status_5xx),
			SUM(latency_sum), SUM(latency_count),
			CASE WHEN SUM(latency_count) > 0
				THEN SUM(latency_p50 * latency_count) / SUM(latency_count) ELSE 0 END,
			CASE WHEN SUM(latency_count) > 0
				THEN SUM(latency_p95 * latency_count) / SUM(latency_count) ELSE 0 END,
			CASE WHEN SUM(latency_count) > 0
				THEN SUM(latency_p99 * latency_count) / SUM(latency_count) ELSE 0 END,
			SUM(bandwidth_ingress), SUM(bandwidth_egress)
		FROM metrics_1h
		WHERE ts < date_trunc('day', NOW())
		GROUP BY date_trunc('day', ts), route_id, consumer_name
		ON CONFLICT (ts, route_id, consumer_name) DO UPDATE SET
			requests_total = EXCLUDED.requests_total,
			status_2xx = EXCLUDED.status_2xx,
			status_3xx = EXCLUDED.status_3xx,
			status_4xx = EXCLUDED.status_4xx,
			status_5xx = EXCLUDED.status_5xx,
			latency_sum = EXCLUDED.latency_sum,
			latency_count = EXCLUDED.latency_count,
			latency_p50 = EXCLUDED.latency_p50,
			latency_p95 = EXCLUDED.latency_p95,
			latency_p99 = EXCLUDED.latency_p99,
			bandwidth_ingress = EXCLUDED.bandwidth_ingress,
			bandwidth_egress = EXCLUDED.bandwidth_egress
	`)
	if err != nil {
		return 0, fmt.Errorf("rollup to day: %w", err)
	}
	return result.RowsAffected(), nil
}

func (r *MetricsRepository) CleanupExpired(ctx context.Context, ttl1mDays, ttl1hDays int) (int64, error) {
	var totalDeleted int64

	result1m, err := r.pool.Exec(ctx,
		`DELETE FROM metrics_1m WHERE ts < NOW() - make_interval(days => $1)`, ttl1mDays)
	if err != nil {
		return 0, fmt.Errorf("cleanup metrics_1m: %w", err)
	}
	totalDeleted += result1m.RowsAffected()

	result1h, err := r.pool.Exec(ctx,
		`DELETE FROM metrics_1h WHERE ts < NOW() - make_interval(days => $1)`, ttl1hDays)
	if err != nil {
		return totalDeleted, fmt.Errorf("cleanup metrics_1h: %w", err)
	}
	totalDeleted += result1h.RowsAffected()

	return totalDeleted, nil
}
