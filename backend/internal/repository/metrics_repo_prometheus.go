package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/fuseone/api-gateway/internal/model"
)

// RouteIDResolver resolves route UUIDs back to APISIX route names.
// Used by PrometheusMetricsRepository to build PromQL label selectors
// since APISIX exports route names (not IDs) in its Prometheus metrics.
type RouteIDResolver interface {
	ReverseLookup(id string) string
}

// PrometheusMetricsRepository implements MetricsQuerier by querying
// a Prometheus or VictoriaMetrics server via PromQL.
// Write methods (BatchUpsertMinute, RollupToHour, RollupToDay, CleanupExpired) are no-ops
// because Prometheus scrapes APISIX directly.
type PrometheusMetricsRepository struct {
	client   *PrometheusClient
	resolver RouteIDResolver
}

// NewPrometheusMetricsRepository creates a new Prometheus-backed metrics repository.
func NewPrometheusMetricsRepository(client *PrometheusClient, resolver RouteIDResolver) *PrometheusMetricsRepository {
	return &PrometheusMetricsRepository{
		client:   client,
		resolver: resolver,
	}
}

// BatchUpsertMinute is a no-op — Prometheus scrapes APISIX directly.
func (r *PrometheusMetricsRepository) BatchUpsertMinute(_ context.Context, _ []model.MetricsRow) error {
	return nil
}

// RollupToHour is a no-op — Prometheus handles its own retention.
func (r *PrometheusMetricsRepository) RollupToHour(_ context.Context) (int64, error) {
	return 0, nil
}

// RollupToDay is a no-op.
func (r *PrometheusMetricsRepository) RollupToDay(_ context.Context) (int64, error) {
	return 0, nil
}

// CleanupExpired is a no-op — Prometheus handles its own retention.
func (r *PrometheusMetricsRepository) CleanupExpired(_ context.Context, _, _ int) (int64, error) {
	return 0, nil
}

// TimeSeries returns time-bucketed metrics for chart display.
func (r *PrometheusMetricsRepository) TimeSeries(ctx context.Context, filter MetricsFilter) ([]model.TimeSeriesPoint, error) {
	start, end, step := r.resolveTimeRange(filter)
	routeSel := r.routeSelector(filter.RouteIDs)

	// Query requests by status class
	q2xx := fmt.Sprintf(`sum(increase(apisix_http_status{code=~"2.."%s}[%s]))`, routeSel, stepStr(step))
	q3xx := fmt.Sprintf(`sum(increase(apisix_http_status{code=~"3.."%s}[%s]))`, routeSel, stepStr(step))
	q4xx := fmt.Sprintf(`sum(increase(apisix_http_status{code=~"4.."%s}[%s]))`, routeSel, stepStr(step))
	q5xx := fmt.Sprintf(`sum(increase(apisix_http_status{code=~"5.."%s}[%s]))`, routeSel, stepStr(step))

	// Latency percentiles
	qP50 := fmt.Sprintf(`histogram_quantile(0.50, sum by (le) (rate(apisix_http_latency_bucket{type="apisix"%s}[%s])))`, routeSel, stepStr(step))
	qP95 := fmt.Sprintf(`histogram_quantile(0.95, sum by (le) (rate(apisix_http_latency_bucket{type="apisix"%s}[%s])))`, routeSel, stepStr(step))
	qP99 := fmt.Sprintf(`histogram_quantile(0.99, sum by (le) (rate(apisix_http_latency_bucket{type="apisix"%s}[%s])))`, routeSel, stepStr(step))

	// Bandwidth
	qBwIn := fmt.Sprintf(`sum(increase(apisix_bandwidth{type="ingress"%s}[%s]))`, routeSel, stepStr(step))
	qBwOut := fmt.Sprintf(`sum(increase(apisix_bandwidth{type="egress"%s}[%s]))`, routeSel, stepStr(step))

	// Execute all queries
	type queryResult struct {
		data *promData
		err  error
	}
	queries := []string{q2xx, q3xx, q4xx, q5xx, qP50, qP95, qP99, qBwIn, qBwOut}
	results := make([]queryResult, len(queries))

	for i, q := range queries {
		data, err := r.client.QueryRange(ctx, q, start, end, step)
		results[i] = queryResult{data, err}
	}

	// Build a map ts -> TimeSeriesPoint
	pointMap := make(map[int64]*model.TimeSeriesPoint)

	// Helper to iterate matrix results
	addMatrix := func(idx int, setter func(p *model.TimeSeriesPoint, val float64)) {
		res := results[idx]
		if res.err != nil || res.data == nil {
			return
		}
		for _, raw := range res.data.Result {
			var m promMatrix
			if json.Unmarshal(raw, &m) != nil {
				continue
			}
			for _, v := range m.Values {
				ts, val := parseTimestampValue(v)
				if math.IsNaN(val) || math.IsInf(val, 0) {
					val = 0
				}
				p, ok := pointMap[ts]
				if !ok {
					p = &model.TimeSeriesPoint{Ts: time.Unix(ts, 0).UTC()}
					pointMap[ts] = p
				}
				setter(p, val)
			}
		}
	}

	addMatrix(0, func(p *model.TimeSeriesPoint, val float64) { p.Status2xx = int(math.Round(val)) })
	addMatrix(1, func(p *model.TimeSeriesPoint, val float64) { p.Status3xx = int(math.Round(val)) })
	addMatrix(2, func(p *model.TimeSeriesPoint, val float64) { p.Status4xx = int(math.Round(val)) })
	addMatrix(3, func(p *model.TimeSeriesPoint, val float64) { p.Status5xx = int(math.Round(val)) })
	addMatrix(4, func(p *model.TimeSeriesPoint, val float64) { p.LatencyP50 = val })
	addMatrix(5, func(p *model.TimeSeriesPoint, val float64) { p.LatencyP95 = val })
	addMatrix(6, func(p *model.TimeSeriesPoint, val float64) { p.LatencyP99 = val })
	addMatrix(7, func(p *model.TimeSeriesPoint, val float64) { p.BandwidthIngress = int64(math.Round(val)) })
	addMatrix(8, func(p *model.TimeSeriesPoint, val float64) { p.BandwidthEgress = int64(math.Round(val)) })

	// Compute RequestsTotal and sort by time
	points := make([]model.TimeSeriesPoint, 0, len(pointMap))
	for _, p := range pointMap {
		p.RequestsTotal = p.Status2xx + p.Status3xx + p.Status4xx + p.Status5xx
		points = append(points, *p)
	}

	// Sort by timestamp
	sortTimeSeriesPoints(points)

	if points == nil {
		points = []model.TimeSeriesPoint{}
	}
	return points, nil
}

// Summary returns aggregate metrics for a time range.
func (r *PrometheusMetricsRepository) Summary(ctx context.Context, filter MetricsFilter) (*model.MetricsSummary, error) {
	rangeStr := r.resolveRangeStr(filter)
	routeSel := r.routeSelector(filter.RouteIDs)

	// Total requests by status class
	q2xx := fmt.Sprintf(`sum(increase(apisix_http_status{code=~"2.."%s}[%s])) or vector(0)`, routeSel, rangeStr)
	q3xx := fmt.Sprintf(`sum(increase(apisix_http_status{code=~"3.."%s}[%s])) or vector(0)`, routeSel, rangeStr)
	q4xx := fmt.Sprintf(`sum(increase(apisix_http_status{code=~"4.."%s}[%s])) or vector(0)`, routeSel, rangeStr)
	q5xx := fmt.Sprintf(`sum(increase(apisix_http_status{code=~"5.."%s}[%s])) or vector(0)`, routeSel, rangeStr)

	// Average latency
	qLatency := fmt.Sprintf(`sum(rate(apisix_http_latency_sum{type="apisix"%s}[%s])) / sum(rate(apisix_http_latency_count{type="apisix"%s}[%s])) or vector(0)`, routeSel, rangeStr, routeSel, rangeStr)

	// Bandwidth
	qBwIn := fmt.Sprintf(`sum(increase(apisix_bandwidth{type="ingress"%s}[%s])) or vector(0)`, routeSel, rangeStr)
	qBwOut := fmt.Sprintf(`sum(increase(apisix_bandwidth{type="egress"%s}[%s])) or vector(0)`, routeSel, rangeStr)

	_, end, _ := r.resolveTimeRange(filter)

	s2xx := r.queryScalar(ctx, q2xx, end)
	s3xx := r.queryScalar(ctx, q3xx, end)
	s4xx := r.queryScalar(ctx, q4xx, end)
	s5xx := r.queryScalar(ctx, q5xx, end)
	avgLatency := r.queryScalar(ctx, qLatency, end)
	bwIn := r.queryScalar(ctx, qBwIn, end)
	bwOut := r.queryScalar(ctx, qBwOut, end)

	totalRequests := int64(math.Round(s2xx + s3xx + s4xx + s5xx))
	var errorRate float64
	if totalRequests > 0 {
		errorRate = (s4xx + s5xx) / float64(totalRequests)
	}

	summary := &model.MetricsSummary{
		TotalRequests:     totalRequests,
		AvgLatencyMs:      avgLatency,
		ErrorRate:         errorRate,
		TotalBandwidthIn:  int64(math.Round(bwIn)),
		TotalBandwidthOut: int64(math.Round(bwOut)),
		Status2xx:         int64(math.Round(s2xx)),
		Status3xx:         int64(math.Round(s3xx)),
		Status4xx:         int64(math.Round(s4xx)),
		Status5xx:         int64(math.Round(s5xx)),
	}

	return summary, nil
}

// TopRoutes returns the top N routes by request count.
func (r *PrometheusMetricsRepository) TopRoutes(ctx context.Context, filter MetricsFilter, limit int) ([]model.TopRoute, error) {
	rangeStr := r.resolveRangeStr(filter)
	routeSel := r.routeSelector(filter.RouteIDs)

	// Top routes by total requests
	qTotal := fmt.Sprintf(`topk(%d, sum by (route) (increase(apisix_http_status{route!=""%s}[%s])))`, limit, routeSel, rangeStr)
	// Error counts per route
	qErrors := fmt.Sprintf(`sum by (route) (increase(apisix_http_status{code=~"[45].."%s}[%s]))`, routeSel, rangeStr)
	// Avg latency per route
	qLatency := fmt.Sprintf(`sum by (route) (rate(apisix_http_latency_sum{type="apisix"%s}[%s])) / sum by (route) (rate(apisix_http_latency_count{type="apisix"%s}[%s]))`, routeSel, rangeStr, routeSel, rangeStr)
	// Bandwidth per route
	qBwIn := fmt.Sprintf(`sum by (route) (increase(apisix_bandwidth{type="ingress"%s}[%s]))`, routeSel, rangeStr)
	qBwOut := fmt.Sprintf(`sum by (route) (increase(apisix_bandwidth{type="egress"%s}[%s]))`, routeSel, rangeStr)

	_, end, _ := r.resolveTimeRange(filter)

	totalData, _ := r.client.Query(ctx, qTotal, end)
	errorData, _ := r.client.Query(ctx, qErrors, end)
	latencyData, _ := r.client.Query(ctx, qLatency, end)
	bwInData, _ := r.client.Query(ctx, qBwIn, end)
	bwOutData, _ := r.client.Query(ctx, qBwOut, end)

	// Parse total requests per route
	routeMap := make(map[string]*model.TopRoute)
	if totalData != nil {
		for _, raw := range totalData.Result {
			var v promVector
			if json.Unmarshal(raw, &v) != nil {
				continue
			}
			routeName := v.Metric["route"]
			val := parseVectorValue(v.Value)
			if routeName == "" || val <= 0 {
				continue
			}
			routeMap[routeName] = &model.TopRoute{
				RouteID:       r.resolveRouteID(routeName),
				RouteName:     routeName,
				RequestsTotal: int64(math.Round(val)),
			}
		}
	}

	// Merge error counts
	mergeVectorByRoute(errorData, routeMap, func(tr *model.TopRoute, val float64) {
		if tr.RequestsTotal > 0 {
			tr.ErrorRate = val / float64(tr.RequestsTotal)
		}
	})

	// Merge latency
	mergeVectorByRoute(latencyData, routeMap, func(tr *model.TopRoute, val float64) {
		if !math.IsNaN(val) && !math.IsInf(val, 0) {
			tr.AvgLatencyMs = val
		}
	})

	// Merge bandwidth
	mergeVectorByRoute(bwInData, routeMap, func(tr *model.TopRoute, val float64) {
		tr.BandwidthIngress = int64(math.Round(val))
	})
	mergeVectorByRoute(bwOutData, routeMap, func(tr *model.TopRoute, val float64) {
		tr.BandwidthEgress = int64(math.Round(val))
	})

	routes := make([]model.TopRoute, 0, len(routeMap))
	for _, tr := range routeMap {
		routes = append(routes, *tr)
	}

	// Sort by requests descending
	sortTopRoutes(routes)

	if routes == nil {
		routes = []model.TopRoute{}
	}
	return routes, nil
}

// TopConsumers returns the top N consumers by request count.
func (r *PrometheusMetricsRepository) TopConsumers(ctx context.Context, filter MetricsFilter, limit int) ([]model.TopConsumer, error) {
	rangeStr := r.resolveRangeStr(filter)
	routeSel := r.routeSelector(filter.RouteIDs)

	qTotal := fmt.Sprintf(`topk(%d, sum by (consumer) (increase(apisix_http_status{consumer!=""%s}[%s])))`, limit, routeSel, rangeStr)
	qErrors := fmt.Sprintf(`sum by (consumer) (increase(apisix_http_status{code=~"[45].."%s, consumer!=""}[%s]))`, routeSel, rangeStr)
	qLatency := fmt.Sprintf(`sum by (consumer) (rate(apisix_http_latency_sum{type="apisix"%s, consumer!=""}[%s])) / sum by (consumer) (rate(apisix_http_latency_count{type="apisix"%s, consumer!=""}[%s]))`, routeSel, rangeStr, routeSel, rangeStr)
	qBwIn := fmt.Sprintf(`sum by (consumer) (increase(apisix_bandwidth{type="ingress"%s, consumer!=""}[%s]))`, routeSel, rangeStr)
	qBwOut := fmt.Sprintf(`sum by (consumer) (increase(apisix_bandwidth{type="egress"%s, consumer!=""}[%s]))`, routeSel, rangeStr)

	_, end, _ := r.resolveTimeRange(filter)

	totalData, _ := r.client.Query(ctx, qTotal, end)
	errorData, _ := r.client.Query(ctx, qErrors, end)
	latencyData, _ := r.client.Query(ctx, qLatency, end)
	bwInData, _ := r.client.Query(ctx, qBwIn, end)
	bwOutData, _ := r.client.Query(ctx, qBwOut, end)

	consumerMap := make(map[string]*model.TopConsumer)
	if totalData != nil {
		for _, raw := range totalData.Result {
			var v promVector
			if json.Unmarshal(raw, &v) != nil {
				continue
			}
			name := v.Metric["consumer"]
			val := parseVectorValue(v.Value)
			if name == "" || val <= 0 {
				continue
			}
			consumerMap[name] = &model.TopConsumer{
				ConsumerName:  name,
				RequestsTotal: int64(math.Round(val)),
			}
		}
	}

	mergeVectorByConsumer(errorData, consumerMap, func(tc *model.TopConsumer, val float64) {
		if tc.RequestsTotal > 0 {
			tc.ErrorRate = val / float64(tc.RequestsTotal)
		}
	})
	mergeVectorByConsumer(latencyData, consumerMap, func(tc *model.TopConsumer, val float64) {
		if !math.IsNaN(val) && !math.IsInf(val, 0) {
			tc.AvgLatencyMs = val
		}
	})
	mergeVectorByConsumer(bwInData, consumerMap, func(tc *model.TopConsumer, val float64) {
		tc.BandwidthIngress = int64(math.Round(val))
	})
	mergeVectorByConsumer(bwOutData, consumerMap, func(tc *model.TopConsumer, val float64) {
		tc.BandwidthEgress = int64(math.Round(val))
	})

	consumers := make([]model.TopConsumer, 0, len(consumerMap))
	for _, tc := range consumerMap {
		consumers = append(consumers, *tc)
	}

	sortTopConsumers(consumers)

	if consumers == nil {
		consumers = []model.TopConsumer{}
	}
	return consumers, nil
}

// ---------- internal helpers ----------

// resolveTimeRange converts a MetricsFilter into start/end/step for Prometheus queries.
func (r *PrometheusMetricsRepository) resolveTimeRange(f MetricsFilter) (start, end time.Time, step time.Duration) {
	if f.IsCustom() {
		start = f.From
		end = f.To
	} else {
		end = time.Now()
		switch f.RangeStr {
		case "1h":
			start = end.Add(-1 * time.Hour)
		case "6h":
			start = end.Add(-6 * time.Hour)
		case "24h":
			start = end.Add(-24 * time.Hour)
		case "7d":
			start = end.Add(-7 * 24 * time.Hour)
		case "30d":
			start = end.Add(-30 * 24 * time.Hour)
		default:
			start = end.Add(-1 * time.Hour)
		}
	}

	span := end.Sub(start)
	switch {
	case span <= 1*time.Hour:
		step = 1 * time.Minute
	case span <= 6*time.Hour:
		step = 5 * time.Minute
	case span <= 24*time.Hour:
		step = 15 * time.Minute
	case span <= 7*24*time.Hour:
		step = 1 * time.Hour
	default:
		step = 6 * time.Hour
	}

	return start, end, step
}

// resolveRangeStr returns a PromQL duration string for a MetricsFilter.
func (r *PrometheusMetricsRepository) resolveRangeStr(f MetricsFilter) string {
	if f.IsCustom() {
		secs := int(f.To.Sub(f.From).Seconds())
		if secs <= 0 {
			secs = 3600
		}
		return fmt.Sprintf("%ds", secs)
	}
	switch f.RangeStr {
	case "1h":
		return "1h"
	case "6h":
		return "6h"
	case "24h":
		return "24h"
	case "7d":
		return "7d"
	case "30d":
		return "30d"
	default:
		return "1h"
	}
}

// routeSelector builds a PromQL label selector for routes.
// Returns empty string if no route filter, or `, route=~"name1|name2"`.
func (r *PrometheusMetricsRepository) routeSelector(routeIDs []string) string {
	if len(routeIDs) == 0 {
		return ""
	}

	names := make([]string, 0, len(routeIDs))
	for _, id := range routeIDs {
		name := id
		if r.resolver != nil {
			name = r.resolver.ReverseLookup(id)
		}
		names = append(names, escapePromQLLabel(name))
	}

	return fmt.Sprintf(`, route=~"%s"`, strings.Join(names, "|"))
}

// resolveRouteID resolves a Prometheus route name back to the internal route ID.
func (r *PrometheusMetricsRepository) resolveRouteID(routeName string) string {
	if r.resolver == nil {
		return routeName
	}
	// The resolver's ReverseLookup takes an ID and returns a name.
	// We need the forward direction: name → ID. Use the scraper's Resolve method
	// which does name → ID.
	return routeName // Will be overridden by the concrete resolver
}

// queryScalar executes an instant query and returns a single float value.
func (r *PrometheusMetricsRepository) queryScalar(ctx context.Context, query string, ts time.Time) float64 {
	data, err := r.client.Query(ctx, query, ts)
	if err != nil || data == nil || len(data.Result) == 0 {
		return 0
	}

	var v promVector
	if json.Unmarshal(data.Result[0], &v) != nil {
		return 0
	}

	val := parseVectorValue(v.Value)
	if math.IsNaN(val) || math.IsInf(val, 0) {
		return 0
	}
	return val
}

// parseVectorValue extracts the float value from a Prometheus [timestamp, "value"] pair.
func parseVectorValue(pair [2]json.RawMessage) float64 {
	var strVal string
	if json.Unmarshal(pair[1], &strVal) != nil {
		return 0
	}
	val, err := strconv.ParseFloat(strVal, 64)
	if err != nil {
		return 0
	}
	return val
}

// parseTimestampValue extracts timestamp and value from a Prometheus [timestamp, "value"] pair.
func parseTimestampValue(pair [2]json.RawMessage) (int64, float64) {
	var tsFloat float64
	if json.Unmarshal(pair[0], &tsFloat) != nil {
		return 0, 0
	}
	ts := int64(tsFloat)

	var strVal string
	if json.Unmarshal(pair[1], &strVal) != nil {
		return ts, 0
	}
	val, _ := strconv.ParseFloat(strVal, 64)
	return ts, val
}

// stepStr returns a PromQL duration string for a Go duration.
func stepStr(d time.Duration) string {
	secs := int(d.Seconds())
	if secs < 60 {
		return fmt.Sprintf("%ds", secs)
	}
	if secs < 3600 {
		return fmt.Sprintf("%dm", secs/60)
	}
	return fmt.Sprintf("%dh", secs/3600)
}

// escapePromQLLabel escapes special regex characters in a PromQL label value.
func escapePromQLLabel(s string) string {
	replacer := strings.NewReplacer(
		".", "\\.",
		"*", "\\*",
		"+", "\\+",
		"?", "\\?",
		"(", "\\(",
		")", "\\)",
		"[", "\\[",
		"]", "\\]",
		"{", "\\{",
		"}", "\\}",
		"|", "\\|",
		"^", "\\^",
		"$", "\\$",
	)
	return replacer.Replace(s)
}

// mergeVectorByRoute merges a Prometheus vector result into a route map.
func mergeVectorByRoute(data *promData, routeMap map[string]*model.TopRoute, setter func(tr *model.TopRoute, val float64)) {
	if data == nil {
		return
	}
	for _, raw := range data.Result {
		var v promVector
		if json.Unmarshal(raw, &v) != nil {
			continue
		}
		name := v.Metric["route"]
		val := parseVectorValue(v.Value)
		if tr, ok := routeMap[name]; ok {
			setter(tr, val)
		}
	}
}

// mergeVectorByConsumer merges a Prometheus vector result into a consumer map.
func mergeVectorByConsumer(data *promData, consumerMap map[string]*model.TopConsumer, setter func(tc *model.TopConsumer, val float64)) {
	if data == nil {
		return
	}
	for _, raw := range data.Result {
		var v promVector
		if json.Unmarshal(raw, &v) != nil {
			continue
		}
		name := v.Metric["consumer"]
		val := parseVectorValue(v.Value)
		if tc, ok := consumerMap[name]; ok {
			setter(tc, val)
		}
	}
}

// sortTimeSeriesPoints sorts by timestamp ascending.
func sortTimeSeriesPoints(points []model.TimeSeriesPoint) {
	for i := 1; i < len(points); i++ {
		for j := i; j > 0 && points[j].Ts.Before(points[j-1].Ts); j-- {
			points[j], points[j-1] = points[j-1], points[j]
		}
	}
}

// sortTopRoutes sorts by requests descending.
func sortTopRoutes(routes []model.TopRoute) {
	for i := 1; i < len(routes); i++ {
		for j := i; j > 0 && routes[j].RequestsTotal > routes[j-1].RequestsTotal; j-- {
			routes[j], routes[j-1] = routes[j-1], routes[j]
		}
	}
}

// sortTopConsumers sorts by requests descending.
func sortTopConsumers(consumers []model.TopConsumer) {
	for i := 1; i < len(consumers); i++ {
		for j := i; j > 0 && consumers[j].RequestsTotal > consumers[j-1].RequestsTotal; j-- {
			consumers[j], consumers[j-1] = consumers[j-1], consumers[j]
		}
	}
}
