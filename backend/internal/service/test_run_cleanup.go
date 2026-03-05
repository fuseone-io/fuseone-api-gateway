package service

import (
	"context"
	"time"

	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/repository"
)

// TestRunCleanup periodically removes test runs older than a configured retention period.
type TestRunCleanup struct {
	repo          repository.TestRunQuerier
	retentionDays int
	logger        *zap.Logger
}

func NewTestRunCleanup(repo repository.TestRunQuerier, retentionDays int, logger *zap.Logger) *TestRunCleanup {
	return &TestRunCleanup{repo: repo, retentionDays: retentionDays, logger: logger}
}

func (c *TestRunCleanup) Start(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	c.logger.Info("test run cleanup started", zap.Int("retention_days", c.retentionDays))

	// Run once immediately on startup
	c.runCleanup(ctx)

	for {
		select {
		case <-ctx.Done():
			c.logger.Info("test run cleanup stopped")
			return
		case <-ticker.C:
			c.runCleanup(ctx)
		}
	}
}

func (c *TestRunCleanup) runCleanup(ctx context.Context) {
	deleted, err := c.repo.CleanupOlderThan(ctx, c.retentionDays)
	if err != nil {
		c.logger.Warn("test run cleanup failed", zap.Error(err))
	} else if deleted > 0 {
		c.logger.Info("test run cleanup completed", zap.Int64("deleted", deleted))
	}
}
