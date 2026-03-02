package service

import (
	"context"
	"time"

	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/config"
	"github.com/fuseone/api-gateway/internal/repository"
)

// MetricsRollup manages periodic rollup (1m→1h, 1h→1d) and TTL cleanup.
type MetricsRollup struct {
	repo   repository.MetricsQuerier
	cfg    *config.MetricsConfig
	logger *zap.Logger
}

func NewMetricsRollup(repo repository.MetricsQuerier, cfg *config.MetricsConfig, logger *zap.Logger) *MetricsRollup {
	return &MetricsRollup{repo: repo, cfg: cfg, logger: logger}
}

// Start launches the rollup and cleanup loop. Blocks until ctx is cancelled.
func (r *MetricsRollup) Start(ctx context.Context) {
	hourlyTicker := time.NewTicker(5 * time.Minute)
	dailyTicker := time.NewTicker(1 * time.Hour)
	cleanupTicker := time.NewTicker(1 * time.Hour)
	defer hourlyTicker.Stop()
	defer dailyTicker.Stop()
	defer cleanupTicker.Stop()

	r.logger.Info("metrics rollup started",
		zap.Int("ttl_1m_days", r.cfg.TTL1mDays),
		zap.Int("ttl_1h_days", r.cfg.TTL1hDays))

	for {
		select {
		case <-ctx.Done():
			r.logger.Info("metrics rollup stopped")
			return
		case <-hourlyTicker.C:
			rows, err := r.repo.RollupToHour(ctx)
			if err != nil {
				r.logger.Warn("rollup to hour failed", zap.Error(err))
			} else if rows > 0 {
				r.logger.Debug("rollup to hour completed", zap.Int64("rows", rows))
			}
		case <-dailyTicker.C:
			rows, err := r.repo.RollupToDay(ctx)
			if err != nil {
				r.logger.Warn("rollup to day failed", zap.Error(err))
			} else if rows > 0 {
				r.logger.Debug("rollup to day completed", zap.Int64("rows", rows))
			}
		case <-cleanupTicker.C:
			rows, err := r.repo.CleanupExpired(ctx, r.cfg.TTL1mDays, r.cfg.TTL1hDays)
			if err != nil {
				r.logger.Warn("metrics cleanup failed", zap.Error(err))
			} else if rows > 0 {
				r.logger.Info("metrics cleanup completed", zap.Int64("deleted", rows))
			}
		}
	}
}
