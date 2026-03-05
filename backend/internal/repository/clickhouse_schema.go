package repository

import (
	"context"
	"fmt"
)

// clickhouseDDL contains the DDL statements to create ClickHouse tables.
var clickhouseDDL = []string{
	// Request traces
	`CREATE TABLE IF NOT EXISTS request_traces (
		id              UInt64,
		trace_id        String,
		root_span_id    String,
		service_name    LowCardinality(String),
		route_id        LowCardinality(String),
		route_name      LowCardinality(String),
		method          LowCardinality(String),
		uri             String,
		status_code     UInt16,
		duration_ns     Int64,
		spans           String,
		attributes      String,
		created_at      DateTime64(3, 'UTC')
	) ENGINE = MergeTree()
	PARTITION BY toYYYYMM(created_at)
	ORDER BY (created_at, trace_id)
	TTL toDateTime(created_at) + INTERVAL 30 DAY
	SETTINGS index_granularity = 8192`,

	// Bloom filter indexes for fast lookups
	`ALTER TABLE request_traces ADD INDEX IF NOT EXISTS idx_trace_id trace_id TYPE bloom_filter(0.01) GRANULARITY 4`,
	`ALTER TABLE request_traces ADD INDEX IF NOT EXISTS idx_route_id route_id TYPE bloom_filter(0.01) GRANULARITY 4`,

	// Per-minute metrics
	`CREATE TABLE IF NOT EXISTS metrics_1m (
		ts                DateTime('UTC'),
		route_id          LowCardinality(String),
		route_name        LowCardinality(String),
		consumer_name     LowCardinality(String),
		requests_total    UInt32,
		status_2xx        UInt32,
		status_3xx        UInt32,
		status_4xx        UInt32,
		status_5xx        UInt32,
		latency_sum       Float64,
		latency_count     UInt32,
		latency_p50       Float64,
		latency_p95       Float64,
		latency_p99       Float64,
		bandwidth_ingress UInt64,
		bandwidth_egress  UInt64
	) ENGINE = SummingMergeTree((requests_total, status_2xx, status_3xx, status_4xx, status_5xx,
		latency_sum, latency_count, bandwidth_ingress, bandwidth_egress))
	PARTITION BY toYYYYMM(ts)
	ORDER BY (ts, route_id, consumer_name)
	TTL ts + INTERVAL 7 DAY
	SETTINGS index_granularity = 8192`,

	// Hourly metrics
	`CREATE TABLE IF NOT EXISTS metrics_1h (
		ts                DateTime('UTC'),
		route_id          LowCardinality(String),
		route_name        LowCardinality(String),
		consumer_name     LowCardinality(String),
		requests_total    UInt32,
		status_2xx        UInt32,
		status_3xx        UInt32,
		status_4xx        UInt32,
		status_5xx        UInt32,
		latency_sum       Float64,
		latency_count     UInt32,
		latency_p50       Float64,
		latency_p95       Float64,
		latency_p99       Float64,
		bandwidth_ingress UInt64,
		bandwidth_egress  UInt64
	) ENGINE = SummingMergeTree((requests_total, status_2xx, status_3xx, status_4xx, status_5xx,
		latency_sum, latency_count, bandwidth_ingress, bandwidth_egress))
	PARTITION BY toYYYYMM(ts)
	ORDER BY (ts, route_id, consumer_name)
	TTL ts + INTERVAL 90 DAY
	SETTINGS index_granularity = 8192`,

	// Daily metrics
	`CREATE TABLE IF NOT EXISTS metrics_1d (
		ts                DateTime('UTC'),
		route_id          LowCardinality(String),
		route_name        LowCardinality(String),
		consumer_name     LowCardinality(String),
		requests_total    UInt32,
		status_2xx        UInt32,
		status_3xx        UInt32,
		status_4xx        UInt32,
		status_5xx        UInt32,
		latency_sum       Float64,
		latency_count     UInt32,
		latency_p50       Float64,
		latency_p95       Float64,
		latency_p99       Float64,
		bandwidth_ingress UInt64,
		bandwidth_egress  UInt64
	) ENGINE = SummingMergeTree((requests_total, status_2xx, status_3xx, status_4xx, status_5xx,
		latency_sum, latency_count, bandwidth_ingress, bandwidth_egress))
	PARTITION BY toYYYYMM(ts)
	ORDER BY (ts, route_id, consumer_name)
	SETTINGS index_granularity = 8192`,
}

// EnsureClickHouseSchema runs DDL to create required tables.
func EnsureClickHouseSchema(ctx context.Context, conn ClickHouseConn) error {
	for _, ddl := range clickhouseDDL {
		if err := conn.Exec(ctx, ddl); err != nil {
			return fmt.Errorf("exec ddl: %w", err)
		}
	}
	return nil
}
