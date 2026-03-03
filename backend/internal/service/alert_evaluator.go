package service

import (
	"context"
	"fmt"
	"time"

	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

// AlertEvaluator periodically evaluates alert rules against metrics data.
type AlertEvaluator struct {
	alertRepo     repository.AlertQuerier
	metricsRepo   repository.MetricsQuerier
	aiMetricsRepo *repository.AIMetricsRepository
	notifier      *AlertNotifier
	logger        *zap.Logger
	intervalSec   int
}

func NewAlertEvaluator(
	alertRepo repository.AlertQuerier,
	metricsRepo repository.MetricsQuerier,
	aiMetricsRepo *repository.AIMetricsRepository,
	notifier *AlertNotifier,
	logger *zap.Logger,
	intervalSec int,
) *AlertEvaluator {
	if intervalSec <= 0 {
		intervalSec = 60
	}
	return &AlertEvaluator{
		alertRepo:     alertRepo,
		metricsRepo:   metricsRepo,
		aiMetricsRepo: aiMetricsRepo,
		notifier:      notifier,
		logger:        logger,
		intervalSec:   intervalSec,
	}
}

// Start runs the evaluation loop until the context is cancelled.
func (e *AlertEvaluator) Start(ctx context.Context) {
	e.logger.Info("alert evaluator started", zap.Int("interval_sec", e.intervalSec))
	ticker := time.NewTicker(time.Duration(e.intervalSec) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			e.logger.Info("alert evaluator stopped")
			return
		case <-ticker.C:
			e.evaluateAll(ctx)
		}
	}
}

func (e *AlertEvaluator) evaluateAll(ctx context.Context) {
	rules, err := e.alertRepo.ListRules(ctx, true)
	if err != nil {
		e.logger.Error("failed to list alert rules", zap.Error(err))
		return
	}

	for i := range rules {
		if err := e.evaluateRule(ctx, &rules[i]); err != nil {
			e.logger.Warn("failed to evaluate alert rule",
				zap.String("rule_id", rules[i].ID.String()),
				zap.String("rule_name", rules[i].Name),
				zap.Error(err),
			)
		}
	}
}

// evalWindowToRange converts eval_window like "5m" to a MetricsFilter range string.
var evalWindowToRange = map[string]string{
	"1m": "1h", "5m": "1h", "15m": "1h", "30m": "1h", "1h": "1h",
}

func (e *AlertEvaluator) evaluateRule(ctx context.Context, rule *model.AlertRule) error {
	value, err := e.computeMetricValue(ctx, rule)
	if err != nil {
		return fmt.Errorf("compute metric: %w", err)
	}

	firing := isThresholdExceeded(rule.RuleType, value, rule.Threshold)

	oldState := rule.State
	newState := oldState

	switch {
	case firing && (oldState == model.AlertStateOK || oldState == model.AlertStateAcknowledged):
		newState = model.AlertStateFiring
		now := time.Now().UTC().Format(time.RFC3339)
		if err := e.alertRepo.UpdateRuleState(ctx, rule.ID, newState, &now); err != nil {
			return err
		}
		event := &model.AlertEvent{
			RuleID:    rule.ID,
			EventType: "fired",
			Message:   fmt.Sprintf("%s exceeded threshold: %.4f > %.4f", rule.RuleType, value, rule.Threshold),
			Value:     &value,
			Threshold: &rule.Threshold,
		}
		if err := e.alertRepo.CreateEvent(ctx, event); err != nil {
			e.logger.Warn("failed to create alert event", zap.Error(err))
		}
		e.notifier.Notify(ctx, rule, event)

	case !firing && oldState == model.AlertStateFiring:
		newState = model.AlertStateOK
		if err := e.alertRepo.UpdateRuleState(ctx, rule.ID, newState, nil); err != nil {
			return err
		}
		event := &model.AlertEvent{
			RuleID:    rule.ID,
			EventType: "resolved",
			Message:   fmt.Sprintf("%s returned to normal: %.4f <= %.4f", rule.RuleType, value, rule.Threshold),
			Value:     &value,
			Threshold: &rule.Threshold,
		}
		if err := e.alertRepo.CreateEvent(ctx, event); err != nil {
			e.logger.Warn("failed to create alert event", zap.Error(err))
		}
		e.notifier.Notify(ctx, rule, event)

	default:
		// No state change — just update last_eval
		if err := e.alertRepo.UpdateRuleState(ctx, rule.ID, oldState, nil); err != nil {
			return err
		}
	}

	return nil
}

func (e *AlertEvaluator) computeMetricValue(ctx context.Context, rule *model.AlertRule) (float64, error) {
	rangeStr := evalWindowToRange[rule.EvalWindow]
	if rangeStr == "" {
		rangeStr = "1h"
	}

	filter := repository.MetricsFilter{RangeStr: rangeStr}
	switch rule.ScopeType {
	case "route":
		filter.RouteIDs = rule.ScopeIDs
	case "consumer":
		filter.ConsumerNames = rule.ScopeIDs
	}

	switch rule.RuleType {
	case model.RuleTypeErrorRate:
		sum, err := e.metricsRepo.Summary(ctx, filter)
		if err != nil {
			return 0, err
		}
		if sum == nil {
			return 0, nil
		}
		return sum.ErrorRate, nil

	case model.RuleTypeLatencyP99:
		sum, err := e.metricsRepo.Summary(ctx, filter)
		if err != nil {
			return 0, err
		}
		if sum == nil {
			return 0, nil
		}
		// We use avg_latency_ms as an approximation — the summary does not store p99 directly.
		// For more precise p99, we'd need to query time series and aggregate.
		return sum.AvgLatencyMs, nil

	case model.RuleTypeTrafficDrop:
		return e.computeTrafficDrop(ctx, filter, rule.EvalWindow)

	case model.RuleTypeTokenBudget:
		if e.aiMetricsRepo == nil {
			return 0, fmt.Errorf("AI metrics repository not configured")
		}
		aiSum, err := e.aiMetricsRepo.Summary(ctx, filter)
		if err != nil {
			return 0, err
		}
		if aiSum == nil {
			return 0, nil
		}
		return float64(aiSum.TotalTokens), nil

	case model.RuleTypeCostBudget:
		if e.aiMetricsRepo == nil {
			return 0, fmt.Errorf("AI metrics repository not configured")
		}
		aiSum, err := e.aiMetricsRepo.Summary(ctx, filter)
		if err != nil {
			return 0, err
		}
		if aiSum == nil {
			return 0, nil
		}
		return aiSum.TotalCostUSD, nil

	default:
		return 0, fmt.Errorf("unknown rule type: %s", rule.RuleType)
	}
}

// computeTrafficDrop compares current window requests against the previous window.
func (e *AlertEvaluator) computeTrafficDrop(ctx context.Context, baseFilter repository.MetricsFilter, evalWindow string) (float64, error) {
	// Current window summary
	currentSum, err := e.metricsRepo.Summary(ctx, baseFilter)
	if err != nil {
		return 0, err
	}
	if currentSum == nil || currentSum.TotalRequests == 0 {
		return 0, nil
	}

	// Previous window: shift the time range back
	now := time.Now().UTC()
	windowDur := evalWindowDuration(evalWindow)
	prevFilter := baseFilter
	prevFilter.RangeStr = "" // use explicit from/to
	prevFilter.From = now.Add(-2 * windowDur)
	prevFilter.To = now.Add(-windowDur)

	prevSum, err := e.metricsRepo.Summary(ctx, prevFilter)
	if err != nil {
		return 0, err
	}
	if prevSum == nil || prevSum.TotalRequests == 0 {
		return 0, nil // no previous data — can't compute drop
	}

	drop := float64(prevSum.TotalRequests-currentSum.TotalRequests) / float64(prevSum.TotalRequests)
	if drop < 0 {
		drop = 0
	}
	return drop, nil
}

func evalWindowDuration(window string) time.Duration {
	switch window {
	case "1m":
		return time.Minute
	case "5m":
		return 5 * time.Minute
	case "15m":
		return 15 * time.Minute
	case "30m":
		return 30 * time.Minute
	case "1h":
		return time.Hour
	default:
		return 5 * time.Minute
	}
}

func isThresholdExceeded(ruleType string, value, threshold float64) bool {
	// For all current rule types, "exceeds" means value > threshold
	return value > threshold
}
