package service

import (
	"context"
	"time"

	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/config"
	"github.com/fuseone/api-gateway/internal/repository"
)

// TraceCleanup periodically deletes old traces and manages partitions.
type TraceCleanup struct {
	repo   repository.TraceQuerier
	cfg    *config.TracingConfig
	logger *zap.Logger
}

func NewTraceCleanup(repo repository.TraceQuerier, cfg *config.TracingConfig, logger *zap.Logger) *TraceCleanup {
	return &TraceCleanup{repo: repo, cfg: cfg, logger: logger}
}

func (c *TraceCleanup) Start(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	c.logger.Info("trace cleanup started", zap.Int("retention_days", c.cfg.RetentionDays))

	// Ensure current and next month partitions on startup
	c.ensurePartitions(ctx)

	for {
		select {
		case <-ctx.Done():
			c.logger.Info("trace cleanup stopped")
			return
		case <-ticker.C:
			c.runCleanup(ctx)
			c.ensurePartitions(ctx)
		}
	}
}

func (c *TraceCleanup) runCleanup(ctx context.Context) {
	retention := c.cfg.RetentionDays
	if retention <= 0 {
		retention = 7
	}
	before := time.Now().AddDate(0, 0, -retention)

	rows, err := c.repo.DeleteOlderThan(ctx, before)
	if err != nil {
		c.logger.Warn("trace cleanup failed", zap.Error(err))
	} else if rows > 0 {
		c.logger.Info("trace cleanup completed", zap.Int64("deleted", rows))
	}
}

func (c *TraceCleanup) ensurePartitions(ctx context.Context) {
	now := time.Now()
	// Ensure current month
	if err := c.repo.EnsurePartition(ctx, now); err != nil {
		c.logger.Warn("failed to ensure current month partition", zap.Error(err))
	}
	// Ensure next month
	next := now.AddDate(0, 1, 0)
	if err := c.repo.EnsurePartition(ctx, next); err != nil {
		c.logger.Warn("failed to ensure next month partition", zap.Error(err))
	}
}
