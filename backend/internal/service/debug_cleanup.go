package service

import (
	"context"
	"time"

	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/config"
	"github.com/fuseone/api-gateway/internal/repository"
)

type DebugCleanup struct {
	repo   repository.DebugLogQuerier
	cfg    *config.DebugConfig
	logger *zap.Logger
}

func NewDebugCleanup(repo repository.DebugLogQuerier, cfg *config.DebugConfig, logger *zap.Logger) *DebugCleanup {
	return &DebugCleanup{repo: repo, cfg: cfg, logger: logger}
}

func (c *DebugCleanup) Start(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	c.logger.Info("debug log cleanup started",
		zap.Int("retention_hours", c.cfg.RetentionH),
		zap.Int("max_rows", c.cfg.MaxRows),
	)

	for {
		select {
		case <-ctx.Done():
			c.logger.Info("debug log cleanup stopped")
			return
		case <-ticker.C:
			c.runCleanup(ctx)
		}
	}
}

func (c *DebugCleanup) runCleanup(ctx context.Context) {
	// 1. Delete logs older than retention period
	rows, err := c.repo.CleanupOlderThan(ctx, c.cfg.RetentionH)
	if err != nil {
		c.logger.Warn("debug log time cleanup failed", zap.Error(err))
	} else if rows > 0 {
		c.logger.Info("debug log time cleanup completed", zap.Int64("deleted", rows))
	}

	// 2. Enforce max row cap (if configured)
	if c.cfg.MaxRows > 0 {
		trimmed, err := c.repo.TrimToMaxRows(ctx, c.cfg.MaxRows)
		if err != nil {
			c.logger.Warn("debug log row trim failed", zap.Error(err))
		} else if trimmed > 0 {
			c.logger.Info("debug log row trim completed", zap.Int64("trimmed", trimmed))
		}
	}
}
