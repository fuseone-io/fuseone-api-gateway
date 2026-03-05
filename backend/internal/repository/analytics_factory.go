package repository

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/model"
)

// AnalyticsBackendType identifies the active storage engine.
type AnalyticsBackendType string

const (
	BackendPostgreSQL      AnalyticsBackendType = "postgresql"
	BackendClickHouse      AnalyticsBackendType = "clickhouse"
	BackendElasticsearch   AnalyticsBackendType = "elasticsearch"
	BackendPrometheus      AnalyticsBackendType = "prometheus"
	BackendVictoriaMetrics AnalyticsBackendType = "victoriametrics"
)

// TraceBackendInfo holds the active trace querier.
type TraceBackendInfo struct {
	Type    AnalyticsBackendType
	Querier TraceQuerier
	closeFn func()
}

// MetricsBackendInfo holds the active metrics querier.
type MetricsBackendInfo struct {
	Type    AnalyticsBackendType
	Querier MetricsQuerier
	closeFn func()
}

// AnalyticsProxy implements both TraceQuerier and MetricsQuerier,
// delegating to independently switchable backends. Thread-safe via atomic.Value.
type AnalyticsProxy struct {
	traceBackend   atomic.Value // *TraceBackendInfo
	metricsBackend atomic.Value // *MetricsBackendInfo
	pgPool         *pgxpool.Pool
	mu             sync.Mutex
	logger         *zap.Logger
}

// NewAnalyticsProxy creates a proxy defaulting to PostgreSQL for both trace and metrics.
func NewAnalyticsProxy(pgPool *pgxpool.Pool, logger *zap.Logger) *AnalyticsProxy {
	p := &AnalyticsProxy{
		pgPool: pgPool,
		logger: logger,
	}
	p.traceBackend.Store(&TraceBackendInfo{
		Type:    BackendPostgreSQL,
		Querier: NewTraceRepository(pgPool),
		closeFn: func() {},
	})
	p.metricsBackend.Store(&MetricsBackendInfo{
		Type:    BackendPostgreSQL,
		Querier: NewMetricsRepository(pgPool),
		closeFn: func() {},
	})
	return p
}

// traceInfo returns the current trace backend.
func (p *AnalyticsProxy) traceInfo() *TraceBackendInfo {
	return p.traceBackend.Load().(*TraceBackendInfo)
}

// metricsInfo returns the current metrics backend.
func (p *AnalyticsProxy) metricsInfo() *MetricsBackendInfo {
	return p.metricsBackend.Load().(*MetricsBackendInfo)
}

// CurrentTraceType returns the active trace backend type.
func (p *AnalyticsProxy) CurrentTraceType() AnalyticsBackendType {
	return p.traceInfo().Type
}

// CurrentMetricsType returns the active metrics backend type.
func (p *AnalyticsProxy) CurrentMetricsType() AnalyticsBackendType {
	return p.metricsInfo().Type
}

// CurrentType returns the trace backend type (backward compat).
func (p *AnalyticsProxy) CurrentType() AnalyticsBackendType {
	return p.CurrentTraceType()
}

// IsExternalMetrics returns true if the metrics backend is Prometheus or VictoriaMetrics.
func (p *AnalyticsProxy) IsExternalMetrics() bool {
	t := p.CurrentMetricsType()
	return t == BackendPrometheus || t == BackendVictoriaMetrics
}

// ---------- Switch BOTH (backward compat) ----------

// SwitchToPostgreSQL reverts both backends to the built-in PostgreSQL.
func (p *AnalyticsProxy) SwitchToPostgreSQL() {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.switchTraceLocked(BackendPostgreSQL, NewTraceRepository(p.pgPool), func() {})
	p.switchMetricsLocked(BackendPostgreSQL, NewMetricsRepository(p.pgPool), func() {})
	p.logger.Info("analytics backend switched to PostgreSQL (both)")
}

// SwitchToClickHouse connects to ClickHouse and swaps both backends.
func (p *AnalyticsProxy) SwitchToClickHouse(ctx context.Context, addr, database, user, password string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	conn, err := NewClickHouseConn(addr, database, user, password)
	if err != nil {
		return fmt.Errorf("clickhouse connect: %w", err)
	}
	if err := conn.Ping(ctx); err != nil {
		conn.Close()
		return fmt.Errorf("clickhouse ping: %w", err)
	}
	if err := EnsureClickHouseSchema(ctx, conn); err != nil {
		conn.Close()
		return fmt.Errorf("clickhouse schema: %w", err)
	}

	// closeFn is shared — only close once when both are replaced
	closed := false
	closeFn := func() {
		if !closed {
			closed = true
			conn.Close()
		}
	}

	p.switchTraceLocked(BackendClickHouse, NewClickHouseTraceRepository(conn), closeFn)
	p.switchMetricsLocked(BackendClickHouse, NewClickHouseMetricsRepository(conn), func() {})
	p.logger.Info("analytics backend switched to ClickHouse (both)", zap.String("addr", addr))
	return nil
}

// SwitchToElasticsearch connects to ES and swaps both backends.
func (p *AnalyticsProxy) SwitchToElasticsearch(ctx context.Context, addresses []string, username, password, apiKey, indexPrefix string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	client, err := NewElasticsearchClient(addresses, username, password, apiKey)
	if err != nil {
		return fmt.Errorf("elasticsearch connect: %w", err)
	}
	if err := PingElasticsearch(client); err != nil {
		return fmt.Errorf("elasticsearch ping: %w", err)
	}
	if indexPrefix == "" {
		indexPrefix = "fuseone"
	}
	if err := EnsureElasticsearchSchema(ctx, client, indexPrefix); err != nil {
		return fmt.Errorf("elasticsearch schema: %w", err)
	}

	p.switchTraceLocked(BackendElasticsearch, NewESTraceRepository(client, indexPrefix), func() {})
	p.switchMetricsLocked(BackendElasticsearch, NewESMetricsRepository(client, indexPrefix), func() {})
	p.logger.Info("analytics backend switched to Elasticsearch (both)", zap.Strings("addresses", addresses))
	return nil
}

// ---------- Switch Trace only ----------

// SwitchTraceToPostgreSQL switches only the trace backend to PostgreSQL.
func (p *AnalyticsProxy) SwitchTraceToPostgreSQL() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.switchTraceLocked(BackendPostgreSQL, NewTraceRepository(p.pgPool), func() {})
	p.logger.Info("trace backend switched to PostgreSQL")
}

// SwitchTraceToClickHouse switches only the trace backend to ClickHouse.
func (p *AnalyticsProxy) SwitchTraceToClickHouse(ctx context.Context, addr, database, user, password string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	conn, err := NewClickHouseConn(addr, database, user, password)
	if err != nil {
		return fmt.Errorf("clickhouse connect: %w", err)
	}
	if err := conn.Ping(ctx); err != nil {
		conn.Close()
		return fmt.Errorf("clickhouse ping: %w", err)
	}
	if err := EnsureClickHouseSchema(ctx, conn); err != nil {
		conn.Close()
		return fmt.Errorf("clickhouse schema: %w", err)
	}

	p.switchTraceLocked(BackendClickHouse, NewClickHouseTraceRepository(conn), func() { conn.Close() })
	p.logger.Info("trace backend switched to ClickHouse", zap.String("addr", addr))
	return nil
}

// SwitchTraceToElasticsearch switches only the trace backend to Elasticsearch.
func (p *AnalyticsProxy) SwitchTraceToElasticsearch(ctx context.Context, addresses []string, username, password, apiKey, indexPrefix string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	client, err := NewElasticsearchClient(addresses, username, password, apiKey)
	if err != nil {
		return fmt.Errorf("elasticsearch connect: %w", err)
	}
	if err := PingElasticsearch(client); err != nil {
		return fmt.Errorf("elasticsearch ping: %w", err)
	}
	if indexPrefix == "" {
		indexPrefix = "fuseone"
	}
	if err := EnsureElasticsearchSchema(ctx, client, indexPrefix); err != nil {
		return fmt.Errorf("elasticsearch schema: %w", err)
	}

	p.switchTraceLocked(BackendElasticsearch, NewESTraceRepository(client, indexPrefix), func() {})
	p.logger.Info("trace backend switched to Elasticsearch", zap.Strings("addresses", addresses))
	return nil
}

// ---------- Switch Metrics only ----------

// SwitchMetricsToPostgreSQL switches only the metrics backend to PostgreSQL.
func (p *AnalyticsProxy) SwitchMetricsToPostgreSQL() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.switchMetricsLocked(BackendPostgreSQL, NewMetricsRepository(p.pgPool), func() {})
	p.logger.Info("metrics backend switched to PostgreSQL")
}

// SwitchMetricsToClickHouse switches only the metrics backend to ClickHouse.
func (p *AnalyticsProxy) SwitchMetricsToClickHouse(ctx context.Context, addr, database, user, password string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	conn, err := NewClickHouseConn(addr, database, user, password)
	if err != nil {
		return fmt.Errorf("clickhouse connect: %w", err)
	}
	if err := conn.Ping(ctx); err != nil {
		conn.Close()
		return fmt.Errorf("clickhouse ping: %w", err)
	}
	if err := EnsureClickHouseSchema(ctx, conn); err != nil {
		conn.Close()
		return fmt.Errorf("clickhouse schema: %w", err)
	}

	p.switchMetricsLocked(BackendClickHouse, NewClickHouseMetricsRepository(conn), func() { conn.Close() })
	p.logger.Info("metrics backend switched to ClickHouse", zap.String("addr", addr))
	return nil
}

// SwitchMetricsToElasticsearch switches only the metrics backend to Elasticsearch.
func (p *AnalyticsProxy) SwitchMetricsToElasticsearch(ctx context.Context, addresses []string, username, password, apiKey, indexPrefix string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	client, err := NewElasticsearchClient(addresses, username, password, apiKey)
	if err != nil {
		return fmt.Errorf("elasticsearch connect: %w", err)
	}
	if err := PingElasticsearch(client); err != nil {
		return fmt.Errorf("elasticsearch ping: %w", err)
	}
	if indexPrefix == "" {
		indexPrefix = "fuseone"
	}
	if err := EnsureElasticsearchSchema(ctx, client, indexPrefix); err != nil {
		return fmt.Errorf("elasticsearch schema: %w", err)
	}

	p.switchMetricsLocked(BackendElasticsearch, NewESMetricsRepository(client, indexPrefix), func() {})
	p.logger.Info("metrics backend switched to Elasticsearch", zap.Strings("addresses", addresses))
	return nil
}

// SwitchMetricsToPrometheus switches metrics to an external Prometheus/VictoriaMetrics.
func (p *AnalyticsProxy) SwitchMetricsToPrometheus(ctx context.Context, backendType AnalyticsBackendType, baseURL, username, password string, resolver RouteIDResolver) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	client := NewPrometheusClient(baseURL, username, password)
	if err := client.TestConnection(ctx); err != nil {
		return fmt.Errorf("prometheus connect: %w", err)
	}

	repo := NewPrometheusMetricsRepository(client, resolver)
	p.switchMetricsLocked(backendType, repo, func() {})
	p.logger.Info("metrics backend switched to external", zap.String("type", string(backendType)), zap.String("url", baseURL))
	return nil
}

// ---------- Internal swap helpers ----------

func (p *AnalyticsProxy) switchTraceLocked(t AnalyticsBackendType, q TraceQuerier, closeFn func()) {
	old := p.traceInfo()
	p.traceBackend.Store(&TraceBackendInfo{Type: t, Querier: q, closeFn: closeFn})
	if old.Type != BackendPostgreSQL && old.closeFn != nil {
		go func() {
			time.Sleep(30 * time.Second)
			old.closeFn()
		}()
	}
}

func (p *AnalyticsProxy) switchMetricsLocked(t AnalyticsBackendType, q MetricsQuerier, closeFn func()) {
	old := p.metricsInfo()
	p.metricsBackend.Store(&MetricsBackendInfo{Type: t, Querier: q, closeFn: closeFn})
	if old.Type != BackendPostgreSQL && old.closeFn != nil {
		go func() {
			time.Sleep(30 * time.Second)
			old.closeFn()
		}()
	}
}

// --- TraceQuerier delegation ---

func (p *AnalyticsProxy) InsertBatch(ctx context.Context, traces []model.RequestTrace) error {
	return p.traceInfo().Querier.InsertBatch(ctx, traces)
}

func (p *AnalyticsProxy) List(ctx context.Context, params model.TraceListParams) ([]model.RequestTrace, int, error) {
	return p.traceInfo().Querier.List(ctx, params)
}

func (p *AnalyticsProxy) GetByTraceID(ctx context.Context, traceID string) (*model.RequestTrace, error) {
	return p.traceInfo().Querier.GetByTraceID(ctx, traceID)
}

func (p *AnalyticsProxy) DeleteOlderThan(ctx context.Context, before time.Time) (int64, error) {
	return p.traceInfo().Querier.DeleteOlderThan(ctx, before)
}

func (p *AnalyticsProxy) EnsurePartition(ctx context.Context, month time.Time) error {
	return p.traceInfo().Querier.EnsurePartition(ctx, month)
}

// --- MetricsQuerier delegation ---

func (p *AnalyticsProxy) BatchUpsertMinute(ctx context.Context, rows []model.MetricsRow) error {
	return p.metricsInfo().Querier.BatchUpsertMinute(ctx, rows)
}

func (p *AnalyticsProxy) TimeSeries(ctx context.Context, filter MetricsFilter) ([]model.TimeSeriesPoint, error) {
	return p.metricsInfo().Querier.TimeSeries(ctx, filter)
}

func (p *AnalyticsProxy) Summary(ctx context.Context, filter MetricsFilter) (*model.MetricsSummary, error) {
	return p.metricsInfo().Querier.Summary(ctx, filter)
}

func (p *AnalyticsProxy) TopRoutes(ctx context.Context, filter MetricsFilter, limit int) ([]model.TopRoute, error) {
	return p.metricsInfo().Querier.TopRoutes(ctx, filter, limit)
}

func (p *AnalyticsProxy) TopConsumers(ctx context.Context, filter MetricsFilter, limit int) ([]model.TopConsumer, error) {
	return p.metricsInfo().Querier.TopConsumers(ctx, filter, limit)
}

func (p *AnalyticsProxy) RollupToHour(ctx context.Context) (int64, error) {
	return p.metricsInfo().Querier.RollupToHour(ctx)
}

func (p *AnalyticsProxy) RollupToDay(ctx context.Context) (int64, error) {
	return p.metricsInfo().Querier.RollupToDay(ctx)
}

func (p *AnalyticsProxy) CleanupExpired(ctx context.Context, ttl1mDays, ttl1hDays int) (int64, error) {
	return p.metricsInfo().Querier.CleanupExpired(ctx, ttl1mDays, ttl1hDays)
}
