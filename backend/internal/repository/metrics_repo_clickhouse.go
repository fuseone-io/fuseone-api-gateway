package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/fuseone/api-gateway/internal/model"
)

// ClickHouseMetricsRepository implements MetricsQuerier for ClickHouse.
type ClickHouseMetricsRepository struct {
	conn ClickHouseConn
}

func NewClickHouseMetricsRepository(conn ClickHouseConn) *ClickHouseMetricsRepository {
	return &ClickHouseMetricsRepository{conn: conn}
}

func (r *ClickHouseMetricsRepository) BatchUpsertMinute(ctx context.Context, rows []model.MetricsRow) error {
	if len(rows) == 0 {
		return nil
	}

	// SummingMergeTree automatically sums on merge for duplicate ORDER BY keys.
	batch, err := r.conn.PrepareBatch(ctx, `INSERT INTO metrics_1m (
		ts, route_id, route_name, consumer_name,
		requests_total, status_2xx, status_3xx, status_4xx, status_5xx,
		latency_sum, latency_count, latency_p50, latency_p95, latency_p99,
		bandwidth_ingress, bandwidth_egress)`)
	if err != nil {
		return fmt.Errorf("prepare batch: %w", err)
	}

	for _, row := range rows {
		if err := batch.Append(
			row.Ts, row.RouteID, row.RouteName, row.ConsumerName,
			uint32(row.RequestsTotal), uint32(row.Status2xx), uint32(row.Status3xx), uint32(row.Status4xx), uint32(row.Status5xx),
			row.LatencySum, uint32(row.LatencyCount), row.LatencyP50, row.LatencyP95, row.LatencyP99,
			uint64(row.BandwidthIngress), uint64(row.BandwidthEgress),
		); err != nil {
			return fmt.Errorf("append row: %w", err)
		}
	}

	return batch.Send()
}

// chResolveFilter returns the table name, WHERE clause with ClickHouse syntax, and args.
func chResolveFilter(f MetricsFilter) (table string, whereClause string, args []interface{}) {
	if f.IsCustom() {
		table = tableForSpan(f.To.Sub(f.From))
		whereClause = "ts >= ? AND ts <= ?"
		args = []interface{}{f.From, f.To}

		if len(f.RouteIDs) == 1 {
			whereClause += " AND route_id = ?"
			args = append(args, f.RouteIDs[0])
		} else if len(f.RouteIDs) > 1 {
			whereClause += " AND route_id IN (?)"
			args = append(args, f.RouteIDs)
		}
		if len(f.ConsumerNames) == 1 {
			whereClause += " AND consumer_name = ?"
			args = append(args, f.ConsumerNames[0])
		} else if len(f.ConsumerNames) > 1 {
			whereClause += " AND consumer_name IN (?)"
			args = append(args, f.ConsumerNames)
		}
	} else {
		var interval string
		table, interval = rangeToTable(f.RangeStr)

		// Convert PG interval string to ClickHouse syntax
		dur := pgIntervalToDuration(interval)
		cutoff := time.Now().UTC().Add(-dur)
		whereClause = "ts >= ?"
		args = []interface{}{cutoff}

		if len(f.RouteIDs) == 1 {
			whereClause += " AND route_id = ?"
			args = append(args, f.RouteIDs[0])
		} else if len(f.RouteIDs) > 1 {
			whereClause += " AND route_id IN (?)"
			args = append(args, f.RouteIDs)
		}
		if len(f.ConsumerNames) == 1 {
			whereClause += " AND consumer_name = ?"
			args = append(args, f.ConsumerNames[0])
		} else if len(f.ConsumerNames) > 1 {
			whereClause += " AND consumer_name IN (?)"
			args = append(args, f.ConsumerNames)
		}
	}
	return
}

// pgIntervalToDuration converts a PostgreSQL interval string to a Go duration.
func pgIntervalToDuration(interval string) time.Duration {
	switch interval {
	case "1 hour":
		return time.Hour
	case "6 hours":
		return 6 * time.Hour
	case "24 hours":
		return 24 * time.Hour
	case "7 days":
		return 7 * 24 * time.Hour
	case "30 days":
		return 30 * 24 * time.Hour
	default:
		return time.Hour
	}
}

func (r *ClickHouseMetricsRepository) TimeSeries(ctx context.Context, filter MetricsFilter) ([]model.TimeSeriesPoint, error) {
	table, where, args := chResolveFilter(filter)

	needsAgg := len(filter.RouteIDs) != 1 || len(filter.ConsumerNames) != 1
	var query string
	if !needsAgg {
		query = fmt.Sprintf(`
			SELECT ts, requests_total, status_2xx, status_3xx, status_4xx, status_5xx,
				latency_p50, latency_p95, latency_p99, bandwidth_ingress, bandwidth_egress
			FROM %s FINAL
			WHERE %s
			ORDER BY ts
		`, table, where)
	} else {
		query = fmt.Sprintf(`
			SELECT ts,
				toInt32(sum(requests_total)), toInt32(sum(status_2xx)), toInt32(sum(status_3xx)),
				toInt32(sum(status_4xx)), toInt32(sum(status_5xx)),
				if(sum(latency_count) > 0,
					sum(latency_p50 * latency_count) / sum(latency_count), 0),
				if(sum(latency_count) > 0,
					sum(latency_p95 * latency_count) / sum(latency_count), 0),
				if(sum(latency_count) > 0,
					sum(latency_p99 * latency_count) / sum(latency_count), 0),
				sum(bandwidth_ingress), sum(bandwidth_egress)
			FROM %s
			WHERE %s
			GROUP BY ts
			ORDER BY ts
		`, table, where)
	}

	rows, err := r.conn.Query(ctx, query, args...)
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

func (r *ClickHouseMetricsRepository) Summary(ctx context.Context, filter MetricsFilter) (*model.MetricsSummary, error) {
	table, where, args := chResolveFilter(filter)

	query := fmt.Sprintf(`
		SELECT
			sum(requests_total),
			if(sum(latency_count) > 0, sum(latency_sum) / sum(latency_count), 0),
			sum(status_2xx),
			sum(status_3xx),
			sum(status_4xx),
			sum(status_5xx),
			sum(bandwidth_ingress),
			sum(bandwidth_egress)
		FROM %s
		WHERE %s
	`, table, where)

	var s model.MetricsSummary
	err := r.conn.QueryRow(ctx, query, args...).Scan(
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

func (r *ClickHouseMetricsRepository) TopRoutes(ctx context.Context, filter MetricsFilter, limit int) ([]model.TopRoute, error) {
	table, where, args := chResolveFilter(filter)

	if len(filter.RouteIDs) == 0 {
		where += " AND route_id != ''"
	}

	args = append(args, uint32(limit))

	query := fmt.Sprintf(`
		SELECT
			route_id,
			max(route_name),
			sum(requests_total),
			if(sum(latency_count) > 0, sum(latency_sum) / sum(latency_count), 0),
			if(sum(requests_total) > 0,
				(sum(status_4xx) + sum(status_5xx)) / sum(requests_total), 0),
			sum(bandwidth_ingress),
			sum(bandwidth_egress)
		FROM %s
		WHERE %s
		GROUP BY route_id
		ORDER BY sum(requests_total) DESC
		LIMIT ?
	`, table, where)

	rows, err := r.conn.Query(ctx, query, args...)
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

func (r *ClickHouseMetricsRepository) TopConsumers(ctx context.Context, filter MetricsFilter, limit int) ([]model.TopConsumer, error) {
	table, where, args := chResolveFilter(filter)
	where += " AND consumer_name != ''"
	args = append(args, uint32(limit))

	query := fmt.Sprintf(`
		SELECT
			consumer_name,
			sum(requests_total),
			if(sum(latency_count) > 0, sum(latency_sum) / sum(latency_count), 0),
			if(sum(requests_total) > 0,
				(sum(status_4xx) + sum(status_5xx)) / sum(requests_total), 0),
			sum(bandwidth_ingress),
			sum(bandwidth_egress)
		FROM %s
		WHERE %s
		GROUP BY consumer_name
		ORDER BY sum(requests_total) DESC
		LIMIT ?
	`, table, where)

	rows, err := r.conn.Query(ctx, query, args...)
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

func (r *ClickHouseMetricsRepository) RollupToHour(ctx context.Context) (int64, error) {
	err := r.conn.Exec(ctx, `
		INSERT INTO metrics_1h
		SELECT
			toStartOfHour(ts) AS ts,
			route_id,
			max(route_name),
			consumer_name,
			sum(requests_total),
			sum(status_2xx), sum(status_3xx), sum(status_4xx), sum(status_5xx),
			sum(latency_sum), sum(latency_count),
			if(sum(latency_count) > 0,
				sum(latency_p50 * latency_count) / sum(latency_count), 0),
			if(sum(latency_count) > 0,
				sum(latency_p95 * latency_count) / sum(latency_count), 0),
			if(sum(latency_count) > 0,
				sum(latency_p99 * latency_count) / sum(latency_count), 0),
			sum(bandwidth_ingress), sum(bandwidth_egress)
		FROM metrics_1m
		WHERE ts < toStartOfHour(now())
		GROUP BY toStartOfHour(ts), route_id, consumer_name
	`)
	if err != nil {
		return 0, fmt.Errorf("rollup to hour: %w", err)
	}
	return 0, nil
}

func (r *ClickHouseMetricsRepository) RollupToDay(ctx context.Context) (int64, error) {
	err := r.conn.Exec(ctx, `
		INSERT INTO metrics_1d
		SELECT
			toStartOfDay(ts) AS ts,
			route_id,
			max(route_name),
			consumer_name,
			sum(requests_total),
			sum(status_2xx), sum(status_3xx), sum(status_4xx), sum(status_5xx),
			sum(latency_sum), sum(latency_count),
			if(sum(latency_count) > 0,
				sum(latency_p50 * latency_count) / sum(latency_count), 0),
			if(sum(latency_count) > 0,
				sum(latency_p95 * latency_count) / sum(latency_count), 0),
			if(sum(latency_count) > 0,
				sum(latency_p99 * latency_count) / sum(latency_count), 0),
			sum(bandwidth_ingress), sum(bandwidth_egress)
		FROM metrics_1h
		WHERE ts < toStartOfDay(now())
		GROUP BY toStartOfDay(ts), route_id, consumer_name
	`)
	if err != nil {
		return 0, fmt.Errorf("rollup to day: %w", err)
	}
	return 0, nil
}

func (r *ClickHouseMetricsRepository) CleanupExpired(_ context.Context, _, _ int) (int64, error) {
	// ClickHouse TTL handles cleanup automatically.
	return 0, nil
}
