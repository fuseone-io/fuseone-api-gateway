package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	dto "github.com/prometheus/client_model/go"
	"github.com/prometheus/common/expfmt"
	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/config"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

// routeAccumulator holds running counters for a single route+consumer within one minute window.
type routeAccumulator struct {
	routeName      string
	consumerName   string
	statusCounts   map[int]int       // status_code -> delta count
	latencyBuckets map[float64]int   // le_boundary -> delta cumulative count
	latencySum     float64
	latencyCount   int
	bandwidthIn    int64
	bandwidthOut   int64
}

// RouteNameResolver resolves APISIX route names to their object IDs.
// APISIX Prometheus metrics use the route *name* as the "route" label,
// but api_definitions stores the route *object ID* in apisix_route_ids.
// This resolver maintains a cached name→id mapping updated from the Admin API.
type RouteNameResolver struct {
	apisix *APISIXClient
	logger *zap.Logger

	mu      sync.RWMutex
	nameMap map[string]string // route name → route ID
}

func NewRouteNameResolver(apisix *APISIXClient, logger *zap.Logger) *RouteNameResolver {
	return &RouteNameResolver{
		apisix:  apisix,
		logger:  logger,
		nameMap: make(map[string]string),
	}
}

// Refresh fetches all routes from APISIX Admin API and rebuilds the name→id mapping.
func (r *RouteNameResolver) Refresh(ctx context.Context) {
	if r.apisix == nil {
		return
	}
	list, err := r.apisix.List(ctx, "routes")
	if err != nil {
		r.logger.Warn("failed to refresh route name map", zap.Error(err))
		return
	}

	newMap := make(map[string]string, len(list.List))
	for _, node := range list.List {
		var val struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		}
		if err := json.Unmarshal(node.Value, &val); err != nil {
			continue
		}
		if val.Name != "" && val.ID != "" {
			newMap[val.Name] = val.ID
		}
	}

	r.mu.Lock()
	r.nameMap = newMap
	r.mu.Unlock()

	r.logger.Debug("route name map refreshed", zap.Int("routes", len(newMap)))
}

// Resolve returns the APISIX route object ID for a given route name.
// If no mapping exists, returns the name itself as fallback.
func (r *RouteNameResolver) Resolve(name string) string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if id, ok := r.nameMap[name]; ok {
		return id
	}
	return name
}

// MetricsScraper periodically scrapes APISIX Prometheus metrics and flushes to DB.
type MetricsScraper struct {
	cfg           *config.MetricsConfig
	repo          repository.MetricsQuerier
	logger        *zap.Logger
	httpClient    *http.Client
	routeResolver *RouteNameResolver

	mu           sync.Mutex
	currentMin   time.Time
	accumulators map[string]*routeAccumulator
	prevCounters map[string]float64
	firstScrape  bool
}

func NewMetricsScraper(cfg *config.MetricsConfig, repo repository.MetricsQuerier, apisix *APISIXClient, logger *zap.Logger) *MetricsScraper {
	return &MetricsScraper{
		cfg:           cfg,
		repo:          repo,
		logger:        logger,
		httpClient:    &http.Client{Timeout: 10 * time.Second},
		routeResolver: NewRouteNameResolver(apisix, logger),
		accumulators:  make(map[string]*routeAccumulator),
		prevCounters:  make(map[string]float64),
		firstScrape:   true,
		currentMin:    time.Now().Truncate(time.Minute),
	}
}

// Start launches the scraper loop. Blocks until ctx is cancelled.
func (s *MetricsScraper) Start(ctx context.Context) {
	scrapeInterval := time.Duration(s.cfg.ScrapeIntervalSec) * time.Second
	flushInterval := time.Duration(s.cfg.FlushIntervalSec) * time.Second

	scrapeTicker := time.NewTicker(scrapeInterval)
	flushTicker := time.NewTicker(flushInterval)
	defer scrapeTicker.Stop()
	defer flushTicker.Stop()

	// Initial route name→ID map refresh
	s.routeResolver.Refresh(ctx)

	s.logger.Info("metrics scraper started",
		zap.String("url", s.cfg.ScrapeURL),
		zap.Duration("scrape_interval", scrapeInterval),
		zap.Duration("flush_interval", flushInterval))

	for {
		select {
		case <-ctx.Done():
			s.flush(context.Background())
			s.logger.Info("metrics scraper stopped")
			return
		case <-scrapeTicker.C:
			if err := s.scrapeOnce(ctx); err != nil {
				s.logger.Warn("metrics scrape failed", zap.Error(err))
			}
		case <-flushTicker.C:
			// Refresh route name→ID mapping before flushing so new routes are resolved
			s.routeResolver.Refresh(ctx)
			s.flush(ctx)
		}
	}
}

func (s *MetricsScraper) scrapeOnce(ctx context.Context) error {
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

	s.processMetrics(families)
	return nil
}

// parseFamilies parses Prometheus exposition text into metric families.
func parseFamilies(r io.Reader) (map[string]*dto.MetricFamily, error) {
	var parser expfmt.TextParser
	families, err := parser.TextToMetricFamilies(r)
	if err != nil {
		return nil, err
	}
	return families, nil
}

// processMetrics extracts route-level data from metric families and accumulates deltas.
func (s *MetricsScraper) processMetrics(families map[string]*dto.MetricFamily) {
	newCounters := make(map[string]float64)

	// Process apisix_http_status (counter)
	if fam, ok := families["apisix_http_status"]; ok {
		for _, m := range fam.Metric {
			route := getLabelValue(m.Label, "route")
			code := getLabelValue(m.Label, "code")
			node := getLabelValue(m.Label, "node")
			consumer := getLabelValue(m.Label, "consumer")
			if route == "" || m.Counter == nil {
				continue
			}

			key := fmt.Sprintf("http_status|%s|%s|%s|%s", route, code, node, consumer)
			val := m.Counter.GetValue()
			newCounters[key] = val

			if s.firstScrape {
				continue
			}

			delta := s.computeDelta(key, val)
			if delta <= 0 {
				continue
			}

			acc := s.getOrCreateAccumulator(route, consumer)
			codeInt, _ := strconv.Atoi(code)
			acc.statusCounts[codeInt] += int(delta)
		}
	}

	// Process apisix_bandwidth (counter)
	if fam, ok := families["apisix_bandwidth"]; ok {
		for _, m := range fam.Metric {
			route := getLabelValue(m.Label, "route")
			bwType := getLabelValue(m.Label, "type")
			node := getLabelValue(m.Label, "node")
			consumer := getLabelValue(m.Label, "consumer")
			if route == "" || m.Counter == nil {
				continue
			}

			key := fmt.Sprintf("bandwidth|%s|%s|%s|%s", route, bwType, node, consumer)
			val := m.Counter.GetValue()
			newCounters[key] = val

			if s.firstScrape {
				continue
			}

			delta := s.computeDelta(key, val)
			if delta <= 0 {
				continue
			}

			acc := s.getOrCreateAccumulator(route, consumer)
			switch bwType {
			case "ingress":
				acc.bandwidthIn += int64(delta)
			case "egress":
				acc.bandwidthOut += int64(delta)
			}
		}
	}

	// Process apisix_http_latency (histogram)
	if fam, ok := families["apisix_http_latency"]; ok {
		for _, m := range fam.Metric {
			route := getLabelValue(m.Label, "route")
			latType := getLabelValue(m.Label, "type")
			if route == "" || latType != "apisix" || m.Histogram == nil {
				continue
			}

			node := getLabelValue(m.Label, "node")
			consumer := getLabelValue(m.Label, "consumer")

			// Process buckets
			for _, b := range m.Histogram.Bucket {
				le := b.GetUpperBound()
				count := float64(b.GetCumulativeCount())
				key := fmt.Sprintf("latency_bucket|%s|%s|%s|%v", route, node, consumer, le)
				newCounters[key] = count

				if s.firstScrape {
					continue
				}

				delta := s.computeDelta(key, count)
				if delta <= 0 {
					continue
				}

				acc := s.getOrCreateAccumulator(route, consumer)
				if acc.latencyBuckets == nil {
					acc.latencyBuckets = make(map[float64]int)
				}
				acc.latencyBuckets[le] += int(delta)
			}

			// Process sum and count
			sumVal := m.Histogram.GetSampleSum()
			countVal := float64(m.Histogram.GetSampleCount())

			sumKey := fmt.Sprintf("latency_sum|%s|%s|%s", route, node, consumer)
			countKey := fmt.Sprintf("latency_count|%s|%s|%s", route, node, consumer)
			newCounters[sumKey] = sumVal
			newCounters[countKey] = countVal

			if !s.firstScrape {
				sumDelta := s.computeDelta(sumKey, sumVal)
				countDelta := s.computeDelta(countKey, countVal)
				if sumDelta > 0 && countDelta > 0 {
					acc := s.getOrCreateAccumulator(route, consumer)
					acc.latencySum += sumDelta
					acc.latencyCount += int(countDelta)
				}
			}
		}
	}

	// Update prevCounters with new values
	for k, v := range newCounters {
		s.prevCounters[k] = v
	}

	if s.firstScrape {
		s.firstScrape = false
	}
}

// computeDelta calculates delta between current value and previous, handling counter resets.
func (s *MetricsScraper) computeDelta(key string, currentVal float64) float64 {
	prev, ok := s.prevCounters[key]
	if !ok {
		return currentVal
	}
	delta := currentVal - prev
	if delta < 0 {
		// Counter reset (e.g., APISIX restart)
		return currentVal
	}
	return delta
}

// accumulatorKey builds the map key for route+consumer combination.
func accumulatorKey(route, consumer string) string {
	return route + "|" + consumer
}

func (s *MetricsScraper) getOrCreateAccumulator(route, consumer string) *routeAccumulator {
	key := accumulatorKey(route, consumer)
	acc, ok := s.accumulators[key]
	if !ok {
		acc = &routeAccumulator{
			routeName:      route,
			consumerName:   consumer,
			statusCounts:   make(map[int]int),
			latencyBuckets: make(map[float64]int),
		}
		s.accumulators[key] = acc
	}
	return acc
}

func (s *MetricsScraper) flush(ctx context.Context) {
	s.mu.Lock()
	rows := s.buildRows()
	s.accumulators = make(map[string]*routeAccumulator)
	s.mu.Unlock()

	if len(rows) == 0 {
		return
	}

	if err := s.repo.BatchUpsertMinute(ctx, rows); err != nil {
		s.logger.Warn("metrics flush failed", zap.Error(err), zap.Int("rows", len(rows)))
		return
	}

	s.logger.Debug("metrics flushed", zap.Int("rows", len(rows)))
}

// buildRows converts accumulators into MetricsRow slice for DB insertion.
func (s *MetricsScraper) buildRows() []model.MetricsRow {
	now := time.Now().Truncate(time.Minute)
	rows := make([]model.MetricsRow, 0, len(s.accumulators))

	for _, acc := range s.accumulators {
		var s2xx, s3xx, s4xx, s5xx, total int
		for code, count := range acc.statusCounts {
			total += count
			switch {
			case code >= 200 && code < 300:
				s2xx += count
			case code >= 300 && code < 400:
				s3xx += count
			case code >= 400 && code < 500:
				s4xx += count
			case code >= 500 && code < 600:
				s5xx += count
			}
		}

		p50 := computePercentile(acc.latencyBuckets, 0.50)
		p95 := computePercentile(acc.latencyBuckets, 0.95)
		p99 := computePercentile(acc.latencyBuckets, 0.99)

		// Resolve Prometheus route name to APISIX route object ID.
		// APISIX exports the route *name* in Prometheus labels, but
		// api_definitions stores the route *object ID* in apisix_route_ids.
		resolvedID := s.routeResolver.Resolve(acc.routeName)

		rows = append(rows, model.MetricsRow{
			Ts:               now,
			RouteID:          resolvedID,
			RouteName:        acc.routeName,
			ConsumerName:     acc.consumerName,
			RequestsTotal:    total,
			Status2xx:        s2xx,
			Status3xx:        s3xx,
			Status4xx:        s4xx,
			Status5xx:        s5xx,
			LatencySum:       acc.latencySum,
			LatencyCount:     acc.latencyCount,
			LatencyP50:       p50,
			LatencyP95:       p95,
			LatencyP99:       p99,
			BandwidthIngress: acc.bandwidthIn,
			BandwidthEgress:  acc.bandwidthOut,
		})
	}

	return rows
}

// computePercentile implements Prometheus-compatible histogram_quantile using linear interpolation.
func computePercentile(buckets map[float64]int, q float64) float64 {
	if len(buckets) == 0 {
		return 0
	}

	// Sort bucket boundaries
	boundaries := make([]float64, 0, len(buckets))
	for b := range buckets {
		boundaries = append(boundaries, b)
	}
	sort.Float64s(boundaries)

	// Total count from +Inf bucket
	total := 0
	for _, b := range boundaries {
		if math.IsInf(b, 1) {
			total = buckets[b]
			break
		}
	}
	if total == 0 {
		return 0
	}

	rank := q * float64(total)

	// Walk sorted buckets to find the one containing our rank
	prevBound := 0.0
	prevCount := 0
	for _, bound := range boundaries {
		if math.IsInf(bound, 1) {
			break
		}
		count := buckets[bound]
		if float64(count) >= rank {
			// Linear interpolation within this bucket
			fraction := (rank - float64(prevCount)) / float64(count-prevCount)
			if count == prevCount {
				return prevBound
			}
			return prevBound + (bound-prevBound)*fraction
		}
		prevBound = bound
		prevCount = count
	}

	// If we get here, return the last finite boundary
	for i := len(boundaries) - 1; i >= 0; i-- {
		if !math.IsInf(boundaries[i], 1) {
			return boundaries[i]
		}
	}
	return 0
}

func getLabelValue(labels []*dto.LabelPair, name string) string {
	for _, lp := range labels {
		if lp.GetName() == name {
			return lp.GetValue()
		}
	}
	return ""
}

// counterKey builds a unique key for delta computation.
func counterKey(parts ...string) string {
	return strings.Join(parts, "|")
}
