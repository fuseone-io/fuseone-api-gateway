package service

import (
	"context"
	"time"

	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

// SyntheticRunner periodically executes test suites for enabled synthetic monitors.
type SyntheticRunner struct {
	monitorRepo repository.SyntheticMonitorQuerier
	suiteRepo   repository.TestSuiteQuerier
	runRepo     repository.TestRunQuerier
	executor    *TestExecutor
	logger      *zap.Logger
	intervalSec int
}

// NewSyntheticRunner creates a new SyntheticRunner.
func NewSyntheticRunner(
	monitorRepo repository.SyntheticMonitorQuerier,
	suiteRepo repository.TestSuiteQuerier,
	runRepo repository.TestRunQuerier,
	executor *TestExecutor,
	logger *zap.Logger,
	intervalSec int,
) *SyntheticRunner {
	if intervalSec <= 0 {
		intervalSec = 60
	}
	return &SyntheticRunner{
		monitorRepo: monitorRepo,
		suiteRepo:   suiteRepo,
		runRepo:     runRepo,
		executor:    executor,
		logger:      logger,
		intervalSec: intervalSec,
	}
}

// Start runs the synthetic monitoring loop until the context is cancelled.
func (r *SyntheticRunner) Start(ctx context.Context) {
	r.logger.Info("synthetic runner started", zap.Int("interval_sec", r.intervalSec))
	ticker := time.NewTicker(time.Duration(r.intervalSec) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			r.logger.Info("synthetic runner stopped")
			return
		case <-ticker.C:
			r.runAllDue(ctx)
		}
	}
}

// runAllDue lists all enabled monitors and executes those whose interval has elapsed.
func (r *SyntheticRunner) runAllDue(ctx context.Context) {
	monitors, err := r.monitorRepo.ListEnabled(ctx)
	if err != nil {
		r.logger.Error("failed to list enabled monitors", zap.Error(err))
		return
	}

	now := time.Now().UTC()
	for i := range monitors {
		monitor := &monitors[i]

		// Check if enough time has elapsed since the last run
		if monitor.LastRunAt != nil {
			elapsed := now.Sub(*monitor.LastRunAt)
			if elapsed < time.Duration(monitor.IntervalSec)*time.Second {
				continue
			}
		}

		r.runMonitor(ctx, monitor)
	}
}

// runMonitor executes the test suite associated with a monitor and updates its status.
func (r *SyntheticRunner) runMonitor(ctx context.Context, monitor *model.SyntheticMonitor) {
	suite, err := r.suiteRepo.Get(ctx, monitor.SuiteID)
	if err != nil {
		r.logger.Error("failed to get test suite for monitor",
			zap.String("monitor_id", monitor.ID.String()),
			zap.String("suite_id", monitor.SuiteID.String()),
			zap.Error(err),
		)
		return
	}
	if suite == nil {
		r.logger.Warn("test suite not found for monitor",
			zap.String("monitor_id", monitor.ID.String()),
			zap.String("suite_id", monitor.SuiteID.String()),
		)
		return
	}

	// Execute the test suite
	run := r.executor.Execute(ctx, suite, model.TriggerSynthetic)

	// Persist the test run
	if err := r.runRepo.Create(ctx, run); err != nil {
		r.logger.Error("failed to save test run",
			zap.String("monitor_id", monitor.ID.String()),
			zap.Error(err),
		)
		return
	}

	// Determine new monitor status
	var newStatus string
	consecutiveFail := monitor.ConsecutiveFail

	switch run.Status {
	case model.RunStatusPassed:
		newStatus = model.MonitorStatusUp
		consecutiveFail = 0
	case model.RunStatusFailed:
		consecutiveFail++
		if consecutiveFail >= 3 {
			newStatus = model.MonitorStatusDown
		} else {
			newStatus = model.MonitorStatusDegraded
		}
	case model.RunStatusError:
		consecutiveFail++
		if consecutiveFail >= 3 {
			newStatus = model.MonitorStatusDown
		} else {
			newStatus = model.MonitorStatusDegraded
		}
	default:
		newStatus = model.MonitorStatusUnknown
	}

	// Calculate uptime percentage using exponential moving average
	uptimePct := r.calculateUptime(monitor.UptimePct, newStatus)

	// Update monitor status in database
	if err := r.monitorRepo.UpdateStatus(ctx, monitor.ID, newStatus, &run.ID, consecutiveFail, uptimePct); err != nil {
		r.logger.Error("failed to update monitor status",
			zap.String("monitor_id", monitor.ID.String()),
			zap.Error(err),
		)
		return
	}

	r.logger.Debug("synthetic monitor executed",
		zap.String("monitor_id", monitor.ID.String()),
		zap.String("monitor_name", monitor.Name),
		zap.String("run_status", run.Status),
		zap.String("monitor_status", newStatus),
		zap.Int("consecutive_fail", consecutiveFail),
		zap.Float64("uptime_pct", uptimePct),
	)
}

// calculateUptime computes a weighted uptime percentage.
// Uses an exponential moving average: new = old * 0.99 + current * 0.01
// where current is 100 for "up" and 0 for "down"/"degraded".
func (r *SyntheticRunner) calculateUptime(currentUptime float64, newStatus string) float64 {
	var sample float64
	switch newStatus {
	case model.MonitorStatusUp:
		sample = 100.0
	case model.MonitorStatusDegraded:
		sample = 50.0
	default:
		sample = 0.0
	}

	// If this is the first run (uptime is 0), seed with the current sample
	if currentUptime == 0 && newStatus == model.MonitorStatusUp {
		return 100.0
	}

	// Exponential moving average with alpha=0.01 (99% weight on history)
	alpha := 0.01
	return currentUptime*(1-alpha) + sample*alpha
}
