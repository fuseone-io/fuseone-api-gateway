package service

import (
	"context"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

// noopMetricsQuerier implements repository.MetricsQuerier with no-op methods for testing.
type noopMetricsQuerier struct{}

func (n *noopMetricsQuerier) BatchUpsertMinute(_ context.Context, _ []model.MetricsRow) error {
	return nil
}
func (n *noopMetricsQuerier) TimeSeries(_ context.Context, _ repository.MetricsFilter) ([]model.TimeSeriesPoint, error) {
	return nil, nil
}
func (n *noopMetricsQuerier) Summary(_ context.Context, _ repository.MetricsFilter) (*model.MetricsSummary, error) {
	return &model.MetricsSummary{}, nil
}
func (n *noopMetricsQuerier) TopRoutes(_ context.Context, _ repository.MetricsFilter, _ int) ([]model.TopRoute, error) {
	return nil, nil
}
func (n *noopMetricsQuerier) RollupToHour(_ context.Context) (int64, error)         { return 0, nil }
func (n *noopMetricsQuerier) RollupToDay(_ context.Context) (int64, error)          { return 0, nil }
func (n *noopMetricsQuerier) CleanupExpired(_ context.Context, _, _ int) (int64, error) { return 0, nil }
