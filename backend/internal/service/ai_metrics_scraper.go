package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	dto "github.com/prometheus/client_model/go"
	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/config"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

// aiTokenAccumulator holds running token counters for a route+consumer+provider+model.
type aiTokenAccumulator struct {
	routeName        string
	consumerName     string
	provider         string
	modelName        string
	promptTokens     int
	completionTokens int
	requests         int
}

// AIMetricsScraper scrapes APISIX Prometheus AI token metrics and flushes to DB.
type AIMetricsScraper struct {
	cfg           *config.MetricsConfig
	repo          *repository.AIMetricsRepository
	settingsRepo  *repository.SettingsRepository
	logger        *zap.Logger
	httpClient    *http.Client
	routeResolver *RouteNameResolver

	mu           sync.Mutex
	accumulators map[string]*aiTokenAccumulator
	prevCounters map[string]float64
	firstScrape  bool
	costModels   model.CostModels
}

func NewAIMetricsScraper(
	cfg *config.MetricsConfig,
	repo *repository.AIMetricsRepository,
	settingsRepo *repository.SettingsRepository,
	routeResolver *RouteNameResolver,
	logger *zap.Logger,
) *AIMetricsScraper {
	return &AIMetricsScraper{
		cfg:           cfg,
		repo:          repo,
		settingsRepo:  settingsRepo,
		logger:        logger,
		httpClient:    &http.Client{Timeout: 10 * time.Second},
		routeResolver: routeResolver,
		accumulators:  make(map[string]*aiTokenAccumulator),
		prevCounters:  make(map[string]float64),
		firstScrape:   true,
	}
}

// Start launches the AI scraper loop. Blocks until ctx is cancelled.
func (s *AIMetricsScraper) Start(ctx context.Context) {
	scrapeInterval := time.Duration(s.cfg.ScrapeIntervalSec) * time.Second
	flushInterval := time.Duration(s.cfg.FlushIntervalSec) * time.Second

	scrapeTicker := time.NewTicker(scrapeInterval)
	flushTicker := time.NewTicker(flushInterval)
	defer scrapeTicker.Stop()
	defer flushTicker.Stop()

	// Load cost models initially
	s.refreshCostModels(ctx)

	s.logger.Info("AI metrics scraper started",
		zap.String("url", s.cfg.ScrapeURL),
		zap.Duration("scrape_interval", scrapeInterval),
		zap.Duration("flush_interval", flushInterval))

	for {
		select {
		case <-ctx.Done():
			s.flush(context.Background())
			s.logger.Info("AI metrics scraper stopped")
			return
		case <-scrapeTicker.C:
			if err := s.scrapeOnce(ctx); err != nil {
				s.logger.Warn("AI metrics scrape failed", zap.Error(err))
			}
		case <-flushTicker.C:
			s.refreshCostModels(ctx)
			s.flush(ctx)
		}
	}
}

func (s *AIMetricsScraper) refreshCostModels(ctx context.Context) {
	data, err := s.settingsRepo.Get(ctx, "ai_cost_models")
	if err != nil || data == nil {
		return
	}
	var cm model.CostModels
	if err := json.Unmarshal(data, &cm); err != nil {
		s.logger.Warn("failed to parse ai_cost_models setting", zap.Error(err))
		return
	}
	s.mu.Lock()
	s.costModels = cm
	s.mu.Unlock()
	s.logger.Debug("AI cost models refreshed", zap.Int("providers", len(cm)))
}

func (s *AIMetricsScraper) scrapeOnce(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.cfg.ScrapeURL, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("fetch metrics: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	families, err := parseFamilies(resp.Body)
	if err != nil {
		return fmt.Errorf("parse metrics: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.processAIMetrics(families)
	return nil
}

func (s *AIMetricsScraper) processAIMetrics(families map[string]*dto.MetricFamily) {
	newCounters := make(map[string]float64)

	// Process apisix_ai_llm_prompt_tokens_total (counter per route/provider/model)
	if fam, ok := families["apisix_ai_llm_prompt_tokens_total"]; ok {
		for _, m := range fam.Metric {
			route := getLabelValue(m.Label, "route")
			provider := getLabelValue(m.Label, "ai_provider")
			modelName := getLabelValue(m.Label, "ai_model")
			consumer := getLabelValue(m.Label, "consumer")
			if route == "" || m.Counter == nil {
				continue
			}

			key := fmt.Sprintf("ai_prompt|%s|%s|%s|%s", route, provider, modelName, consumer)
			val := m.Counter.GetValue()
			newCounters[key] = val

			if s.firstScrape {
				continue
			}

			delta := s.computeDelta(key, val)
			if delta <= 0 {
				continue
			}

			acc := s.getOrCreateAccumulator(route, consumer, provider, modelName)
			acc.promptTokens += int(delta)
		}
	}

	// Process apisix_ai_llm_completion_tokens_total (counter per route/provider/model)
	if fam, ok := families["apisix_ai_llm_completion_tokens_total"]; ok {
		for _, m := range fam.Metric {
			route := getLabelValue(m.Label, "route")
			provider := getLabelValue(m.Label, "ai_provider")
			modelName := getLabelValue(m.Label, "ai_model")
			consumer := getLabelValue(m.Label, "consumer")
			if route == "" || m.Counter == nil {
				continue
			}

			key := fmt.Sprintf("ai_completion|%s|%s|%s|%s", route, provider, modelName, consumer)
			val := m.Counter.GetValue()
			newCounters[key] = val

			if s.firstScrape {
				continue
			}

			delta := s.computeDelta(key, val)
			if delta <= 0 {
				continue
			}

			acc := s.getOrCreateAccumulator(route, consumer, provider, modelName)
			acc.completionTokens += int(delta)
		}
	}

	// Process apisix_ai_llm_requests_total (counter per route/provider/model) — if available
	if fam, ok := families["apisix_ai_llm_requests_total"]; ok {
		for _, m := range fam.Metric {
			route := getLabelValue(m.Label, "route")
			provider := getLabelValue(m.Label, "ai_provider")
			modelName := getLabelValue(m.Label, "ai_model")
			consumer := getLabelValue(m.Label, "consumer")
			if route == "" || m.Counter == nil {
				continue
			}

			key := fmt.Sprintf("ai_requests|%s|%s|%s|%s", route, provider, modelName, consumer)
			val := m.Counter.GetValue()
			newCounters[key] = val

			if s.firstScrape {
				continue
			}

			delta := s.computeDelta(key, val)
			if delta <= 0 {
				continue
			}

			acc := s.getOrCreateAccumulator(route, consumer, provider, modelName)
			acc.requests += int(delta)
		}
	}

	for k, v := range newCounters {
		s.prevCounters[k] = v
	}

	if s.firstScrape {
		s.firstScrape = false
	}
}

func (s *AIMetricsScraper) computeDelta(key string, currentVal float64) float64 {
	prev, ok := s.prevCounters[key]
	if !ok {
		return currentVal
	}
	delta := currentVal - prev
	if delta < 0 {
		return currentVal
	}
	return delta
}

func (s *AIMetricsScraper) getOrCreateAccumulator(route, consumer, provider, modelName string) *aiTokenAccumulator {
	key := fmt.Sprintf("%s|%s|%s|%s", route, consumer, provider, modelName)
	acc, ok := s.accumulators[key]
	if !ok {
		acc = &aiTokenAccumulator{
			routeName:    route,
			consumerName: consumer,
			provider:     provider,
			modelName:    modelName,
		}
		s.accumulators[key] = acc
	}
	return acc
}

func (s *AIMetricsScraper) flush(ctx context.Context) {
	s.mu.Lock()
	rows := s.buildRows()
	s.accumulators = make(map[string]*aiTokenAccumulator)
	s.mu.Unlock()

	if len(rows) == 0 {
		return
	}

	if err := s.repo.BatchUpsertMinute(ctx, rows); err != nil {
		s.logger.Warn("AI metrics flush failed", zap.Error(err), zap.Int("rows", len(rows)))
		return
	}

	s.logger.Debug("AI metrics flushed", zap.Int("rows", len(rows)))
}

func (s *AIMetricsScraper) buildRows() []model.AITokenRow {
	now := time.Now().Truncate(time.Minute)
	rows := make([]model.AITokenRow, 0, len(s.accumulators))

	for _, acc := range s.accumulators {
		totalTokens := acc.promptTokens + acc.completionTokens
		if totalTokens == 0 && acc.requests == 0 {
			continue
		}

		resolvedID := s.routeResolver.Resolve(acc.routeName)

		cost := 0.0
		if s.costModels != nil {
			cost = s.costModels.LookupCost(acc.provider, acc.modelName, acc.promptTokens, acc.completionTokens)
		}

		rows = append(rows, model.AITokenRow{
			Ts:               now,
			RouteID:          resolvedID,
			RouteName:        acc.routeName,
			ConsumerName:     acc.consumerName,
			Provider:         acc.provider,
			Model:            acc.modelName,
			Requests:         acc.requests,
			PromptTokens:     acc.promptTokens,
			CompletionTokens: acc.completionTokens,
			TotalTokens:      totalTokens,
			EstimatedCostUSD: cost,
		})
	}

	return rows
}

// StartRollup launches periodic rollup jobs for AI token metrics.
func (s *AIMetricsScraper) StartRollup(ctx context.Context) {
	hourTicker := time.NewTicker(10 * time.Minute)
	dayTicker := time.NewTicker(1 * time.Hour)
	cleanTicker := time.NewTicker(6 * time.Hour)
	defer hourTicker.Stop()
	defer dayTicker.Stop()
	defer cleanTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-hourTicker.C:
			if n, err := s.repo.RollupToHour(ctx); err != nil {
				s.logger.Warn("AI rollup to hour failed", zap.Error(err))
			} else if n > 0 {
				s.logger.Debug("AI rolled up to hour", zap.Int64("rows", n))
			}
		case <-dayTicker.C:
			if n, err := s.repo.RollupToDay(ctx); err != nil {
				s.logger.Warn("AI rollup to day failed", zap.Error(err))
			} else if n > 0 {
				s.logger.Debug("AI rolled up to day", zap.Int64("rows", n))
			}
		case <-cleanTicker.C:
			ttl1m := s.cfg.TTL1mDays
			ttl1h := s.cfg.TTL1hDays
			if ttl1m == 0 {
				ttl1m = 3
			}
			if ttl1h == 0 {
				ttl1h = 30
			}
			if n, err := s.repo.CleanupExpired(ctx, ttl1m, ttl1h); err != nil {
				s.logger.Warn("AI cleanup failed", zap.Error(err))
			} else if n > 0 {
				s.logger.Debug("AI expired rows cleaned", zap.Int64("rows", n))
			}
		}
	}
}
