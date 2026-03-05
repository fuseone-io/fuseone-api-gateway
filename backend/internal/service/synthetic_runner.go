package service

import (
	"context"
	"fmt"
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
	contactRepo repository.NotificationContactQuerier
	executor    *TestExecutor
	notifier    *AlertNotifier
	logger      *zap.Logger
	intervalSec int
}

// NewSyntheticRunner creates a new SyntheticRunner.
func NewSyntheticRunner(
	monitorRepo repository.SyntheticMonitorQuerier,
	suiteRepo repository.TestSuiteQuerier,
	runRepo repository.TestRunQuerier,
	contactRepo repository.NotificationContactQuerier,
	executor *TestExecutor,
	notifier *AlertNotifier,
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
		contactRepo: contactRepo,
		executor:    executor,
		notifier:    notifier,
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
	prevStatus := monitor.LastStatus
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

	// Send notifications on status transitions
	if len(monitor.NotifyContactIDs) > 0 && prevStatus != newStatus {
		r.sendNotifications(ctx, monitor, prevStatus, newStatus)
	}
}

// sendNotifications sends notifications to all configured contacts when status changes.
func (r *SyntheticRunner) sendNotifications(ctx context.Context, monitor *model.SyntheticMonitor, prevStatus, newStatus string) {
	// Only notify on meaningful transitions
	shouldNotify := false
	var eventType, message string

	switch {
	case newStatus == model.MonitorStatusDown:
		shouldNotify = true
		eventType = "fired"
		message = fmt.Sprintf("Monitor \"%s\" is DOWN — %d consecutive failures", monitor.Name, monitor.ConsecutiveFail+1)
	case newStatus == model.MonitorStatusDegraded && prevStatus == model.MonitorStatusUp:
		shouldNotify = true
		eventType = "fired"
		message = fmt.Sprintf("Monitor \"%s\" is DEGRADED — test failed", monitor.Name)
	case newStatus == model.MonitorStatusUp && (prevStatus == model.MonitorStatusDown || prevStatus == model.MonitorStatusDegraded):
		shouldNotify = true
		eventType = "resolved"
		message = fmt.Sprintf("Monitor \"%s\" recovered — status is UP", monitor.Name)
	}

	if !shouldNotify {
		return
	}

	// Build alert channels from notification contact IDs
	var channels []model.AlertChannel
	for _, contactID := range monitor.NotifyContactIDs {
		contact, err := r.contactRepo.Get(ctx, contactID)
		if err != nil {
			r.logger.Warn("failed to get notification contact", zap.String("contact_id", contactID.String()), zap.Error(err))
			continue
		}
		if contact == nil || !contact.Enabled {
			continue
		}
		channels = append(channels, contact.ToAlertChannel())
	}

	if len(channels) == 0 {
		return
	}

	// Build a synthetic alert rule + event for the notifier
	rule := &model.AlertRule{
		Name:     fmt.Sprintf("Synthetic Monitor: %s", monitor.Name),
		RuleType: "synthetic_monitor",
		Channels: channels,
		State:    model.AlertStateFiring,
	}
	event := &model.AlertEvent{
		EventType: eventType,
		Message:   message,
	}

	r.notifier.Notify(ctx, rule, event)

	r.logger.Info("synthetic monitor notification sent",
		zap.String("monitor_id", monitor.ID.String()),
		zap.String("transition", fmt.Sprintf("%s → %s", prevStatus, newStatus)),
		zap.Int("channels", len(channels)),
	)
}

// calculateUptime computes a weighted uptime percentage.
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

	if currentUptime == 0 && newStatus == model.MonitorStatusUp {
		return 100.0
	}

	alpha := 0.01
	return currentUptime*(1-alpha) + sample*alpha
}
