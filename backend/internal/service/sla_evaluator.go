package service

import (
	"context"
	"time"

	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

// SLAEvaluator periodically evaluates SLA definitions against collected metrics.
type SLAEvaluator struct {
	slaRepo     repository.SLAQuerier
	metricsRepo repository.MetricsQuerier
	logger      *zap.Logger
	intervalSec int
}

// NewSLAEvaluator creates a new SLAEvaluator.
func NewSLAEvaluator(
	slaRepo repository.SLAQuerier,
	metricsRepo repository.MetricsQuerier,
	logger *zap.Logger,
	intervalSec int,
) *SLAEvaluator {
	if intervalSec <= 0 {
		intervalSec = 300 // default: evaluate every 5 minutes
	}
	return &SLAEvaluator{
		slaRepo:     slaRepo,
		metricsRepo: metricsRepo,
		logger:      logger,
		intervalSec: intervalSec,
	}
}

// Start runs the SLA evaluation loop until the context is cancelled.
func (e *SLAEvaluator) Start(ctx context.Context) {
	e.logger.Info("SLA evaluator started", zap.Int("interval_sec", e.intervalSec))
	ticker := time.NewTicker(time.Duration(e.intervalSec) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			e.logger.Info("SLA evaluator stopped")
			return
		case <-ticker.C:
			e.evaluateAll(ctx)
		}
	}
}

// evaluateAll iterates over all SLA definitions and evaluates each one.
func (e *SLAEvaluator) evaluateAll(ctx context.Context) {
	slas, err := e.slaRepo.List(ctx, nil)
	if err != nil {
		e.logger.Error("failed to list SLA definitions", zap.Error(err))
		return
	}

	for i := range slas {
		if err := e.evaluateSLA(ctx, &slas[i]); err != nil {
			e.logger.Warn("failed to evaluate SLA",
				zap.String("sla_id", slas[i].ID.String()),
				zap.String("sla_name", slas[i].Name),
				zap.Error(err),
			)
		}
	}
}

// evalWindowToFilter converts an SLA eval window (7d, 30d, 90d) to a MetricsFilter.
func evalWindowToFilter(evalWindow string, apiID *string) repository.MetricsFilter {
	now := time.Now().UTC()
	var from time.Time

	switch evalWindow {
	case "7d":
		from = now.AddDate(0, 0, -7)
	case "30d":
		from = now.AddDate(0, 0, -30)
	case "90d":
		from = now.AddDate(0, 0, -90)
	default:
		from = now.AddDate(0, 0, -30)
	}

	filter := repository.MetricsFilter{
		From: from,
		To:   now,
	}

	if apiID != nil && *apiID != "" {
		filter.RouteIDs = []string{*apiID}
	}

	return filter
}

// evaluateSLA computes current metrics for an SLA and updates its compliance status.
func (e *SLAEvaluator) evaluateSLA(ctx context.Context, sla *model.SLADefinition) error {
	filter := evalWindowToFilter(sla.EvalWindow, sla.ApiID)

	// Get aggregate metrics for the evaluation window
	summary, err := e.metricsRepo.Summary(ctx, filter)
	if err != nil {
		return err
	}
	if summary == nil {
		return nil
	}

	// Calculate current availability: (total - 5xx) / total * 100
	var currentAvail float64
	if summary.TotalRequests > 0 {
		successfulRequests := summary.TotalRequests - summary.Status5xx
		currentAvail = float64(successfulRequests) / float64(summary.TotalRequests) * 100.0
	}

	// Current latency (avg as approximation for p99 from summary)
	currentLatency := int(summary.AvgLatencyMs)

	// Current error rate as percentage
	var currentError float64
	if summary.TotalRequests > 0 {
		errorRequests := summary.Status4xx + summary.Status5xx
		currentError = float64(errorRequests) / float64(summary.TotalRequests) * 100.0
	}

	// Calculate error budget remaining
	// Error budget = (1 - target_availability/100) as a fraction of total requests
	// Budget remaining = ((target_error_budget - actual_error_budget) / target_error_budget) * 100
	budgetRemaining := e.calculateBudgetRemaining(sla.AvailabilityPct, currentAvail)

	// Determine compliance status
	compliance := e.determineCompliance(sla, currentAvail, currentLatency, currentError, budgetRemaining)

	// Update the SLA in the database
	if err := e.slaRepo.UpdateMetrics(ctx, sla.ID, currentAvail, currentLatency, currentError, budgetRemaining, compliance); err != nil {
		return err
	}

	e.logger.Debug("SLA evaluated",
		zap.String("sla_id", sla.ID.String()),
		zap.String("sla_name", sla.Name),
		zap.Float64("avail", currentAvail),
		zap.Int("latency_ms", currentLatency),
		zap.Float64("error_rate", currentError),
		zap.Float64("budget_remaining", budgetRemaining),
		zap.String("compliance", compliance),
	)

	return nil
}

// calculateBudgetRemaining computes the remaining error budget as a percentage.
// Error budget is based on the gap between target availability and 100%.
// For example, 99.9% target gives a 0.1% error budget.
// If actual availability is 99.95%, that uses 50% of the budget, leaving 50%.
func (e *SLAEvaluator) calculateBudgetRemaining(targetAvailPct, currentAvailPct float64) float64 {
	// Total error budget = 100 - target (as percentage points)
	totalBudget := 100.0 - targetAvailPct
	if totalBudget <= 0 {
		// Target is 100% availability — any error means budget is gone
		if currentAvailPct >= 100.0 {
			return 100.0
		}
		return 0.0
	}

	// Consumed budget = 100 - current
	consumedBudget := 100.0 - currentAvailPct

	// Remaining = (total - consumed) / total * 100
	remaining := (totalBudget - consumedBudget) / totalBudget * 100.0

	// Clamp to [0, 100]
	if remaining < 0 {
		return 0.0
	}
	if remaining > 100 {
		return 100.0
	}
	return remaining
}

// determineCompliance evaluates which compliance status applies based on SLA targets.
func (e *SLAEvaluator) determineCompliance(sla *model.SLADefinition, avail float64, latencyMs int, errorRate float64, budgetRemaining float64) string {
	// Breached: any target is clearly exceeded
	if avail < sla.AvailabilityPct {
		return "breached"
	}
	if sla.LatencyP99Ms > 0 && latencyMs > sla.LatencyP99Ms {
		return "breached"
	}
	if sla.ErrorRatePct > 0 && errorRate > sla.ErrorRatePct {
		return "breached"
	}

	// At risk: error budget is running low (below 20%)
	if budgetRemaining < 20.0 {
		return "at_risk"
	}

	// At risk: latency is within 10% of the target
	if sla.LatencyP99Ms > 0 {
		threshold := float64(sla.LatencyP99Ms) * 0.9
		if float64(latencyMs) > threshold {
			return "at_risk"
		}
	}

	// At risk: error rate is within 10% of the target
	if sla.ErrorRatePct > 0 {
		threshold := sla.ErrorRatePct * 0.9
		if errorRate > threshold {
			return "at_risk"
		}
	}

	return "compliant"
}
