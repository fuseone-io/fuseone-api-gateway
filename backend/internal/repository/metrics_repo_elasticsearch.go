package repository

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/elastic/go-elasticsearch/v8"

	"github.com/fuseone/api-gateway/internal/model"
)

// ESMetricsRepository implements MetricsQuerier for Elasticsearch.
type ESMetricsRepository struct {
	client *elasticsearch.Client
	prefix string
}

func NewESMetricsRepository(client *elasticsearch.Client, prefix string) *ESMetricsRepository {
	return &ESMetricsRepository{client: client, prefix: prefix}
}

func (r *ESMetricsRepository) metricsIndex(t time.Time) string {
	return fmt.Sprintf("%s-metrics-%s", r.prefix, t.Format("2006.01.02"))
}

func (r *ESMetricsRepository) metricsPattern() string {
	return r.prefix + "-metrics-*"
}

func (r *ESMetricsRepository) BatchUpsertMinute(ctx context.Context, rows []model.MetricsRow) error {
	if len(rows) == 0 {
		return nil
	}

	var buf bytes.Buffer
	for _, row := range rows {
		docID := fmt.Sprintf("%s|%s|%s|1m", row.Ts.Format(time.RFC3339), row.RouteID, row.ConsumerName)
		meta := map[string]interface{}{
			"index": map[string]interface{}{
				"_index": r.metricsIndex(row.Ts),
				"_id":    docID,
			},
		}
		metaBytes, _ := json.Marshal(meta)
		buf.Write(metaBytes)
		buf.WriteByte('\n')

		doc := map[string]interface{}{
			"ts":                row.Ts,
			"resolution":        "1m",
			"route_id":          row.RouteID,
			"route_name":        row.RouteName,
			"consumer_name":     row.ConsumerName,
			"requests_total":    row.RequestsTotal,
			"status_2xx":        row.Status2xx,
			"status_3xx":        row.Status3xx,
			"status_4xx":        row.Status4xx,
			"status_5xx":        row.Status5xx,
			"latency_sum":       row.LatencySum,
			"latency_count":     row.LatencyCount,
			"latency_p50":       row.LatencyP50,
			"latency_p95":       row.LatencyP95,
			"latency_p99":       row.LatencyP99,
			"bandwidth_ingress": row.BandwidthIngress,
			"bandwidth_egress":  row.BandwidthEgress,
		}
		docBytes, _ := json.Marshal(doc)
		buf.Write(docBytes)
		buf.WriteByte('\n')
	}

	res, err := r.client.Bulk(bytes.NewReader(buf.Bytes()),
		r.client.Bulk.WithContext(ctx),
		r.client.Bulk.WithRefresh("false"),
	)
	if err != nil {
		return fmt.Errorf("bulk insert metrics: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("bulk insert metrics: %s", res.Status())
	}
	return nil
}

// esResolveFilter builds an ES query filter from MetricsFilter.
func esResolveFilter(f MetricsFilter) (resolution string, must []map[string]interface{}) {
	if f.IsCustom() {
		span := f.To.Sub(f.From)
		switch {
		case span.Hours() <= 24:
			resolution = "1m"
		case span.Hours() <= 7*24:
			resolution = "1h"
		default:
			resolution = "1d"
		}
		must = append(must, map[string]interface{}{
			"range": map[string]interface{}{
				"ts": map[string]interface{}{
					"gte": f.From.Format(time.RFC3339),
					"lte": f.To.Format(time.RFC3339),
				},
			},
		})
	} else {
		dur := pgIntervalToDuration(func() string {
			_, interval := rangeToTable(f.RangeStr)
			return interval
		}())
		switch f.RangeStr {
		case "7d":
			resolution = "1h"
		case "30d":
			resolution = "1d"
		default:
			resolution = "1m"
		}
		cutoff := time.Now().UTC().Add(-dur)
		must = append(must, map[string]interface{}{
			"range": map[string]interface{}{
				"ts": map[string]interface{}{"gte": cutoff.Format(time.RFC3339)},
			},
		})
	}

	must = append(must, map[string]interface{}{
		"term": map[string]interface{}{"resolution": resolution},
	})

	if len(f.RouteIDs) == 1 {
		must = append(must, map[string]interface{}{"term": map[string]interface{}{"route_id": f.RouteIDs[0]}})
	} else if len(f.RouteIDs) > 1 {
		must = append(must, map[string]interface{}{"terms": map[string]interface{}{"route_id": f.RouteIDs}})
	}
	if len(f.ConsumerNames) == 1 {
		must = append(must, map[string]interface{}{"term": map[string]interface{}{"consumer_name": f.ConsumerNames[0]}})
	} else if len(f.ConsumerNames) > 1 {
		must = append(must, map[string]interface{}{"terms": map[string]interface{}{"consumer_name": f.ConsumerNames}})
	}
	return
}

func (r *ESMetricsRepository) TimeSeries(ctx context.Context, filter MetricsFilter) ([]model.TimeSeriesPoint, error) {
	_, must := esResolveFilter(filter)

	query := map[string]interface{}{
		"size": 0,
		"query": map[string]interface{}{
			"bool": map[string]interface{}{"must": must},
		},
		"aggs": map[string]interface{}{
			"by_ts": map[string]interface{}{
				"date_histogram": map[string]interface{}{
					"field":    "ts",
					"calendar_interval": "1m",
					"order":    map[string]string{"_key": "asc"},
				},
				"aggs": map[string]interface{}{
					"requests":  map[string]interface{}{"sum": map[string]string{"field": "requests_total"}},
					"s2xx":      map[string]interface{}{"sum": map[string]string{"field": "status_2xx"}},
					"s3xx":      map[string]interface{}{"sum": map[string]string{"field": "status_3xx"}},
					"s4xx":      map[string]interface{}{"sum": map[string]string{"field": "status_4xx"}},
					"s5xx":      map[string]interface{}{"sum": map[string]string{"field": "status_5xx"}},
					"lat_p50":   map[string]interface{}{"avg": map[string]string{"field": "latency_p50"}},
					"lat_p95":   map[string]interface{}{"avg": map[string]string{"field": "latency_p95"}},
					"lat_p99":   map[string]interface{}{"avg": map[string]string{"field": "latency_p99"}},
					"bw_in":     map[string]interface{}{"sum": map[string]string{"field": "bandwidth_ingress"}},
					"bw_out":    map[string]interface{}{"sum": map[string]string{"field": "bandwidth_egress"}},
				},
			},
		},
	}

	body, _ := json.Marshal(query)
	res, err := r.client.Search(
		r.client.Search.WithContext(ctx),
		r.client.Search.WithIndex(r.metricsPattern()),
		r.client.Search.WithBody(bytes.NewReader(body)),
	)
	if err != nil {
		return nil, fmt.Errorf("es timeseries: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("es timeseries: %s", res.Status())
	}

	var result struct {
		Aggregations struct {
			ByTs struct {
				Buckets []struct {
					KeyAsString string  `json:"key_as_string"`
					Requests    aggVal  `json:"requests"`
					S2xx        aggVal  `json:"s2xx"`
					S3xx        aggVal  `json:"s3xx"`
					S4xx        aggVal  `json:"s4xx"`
					S5xx        aggVal  `json:"s5xx"`
					LatP50      aggVal  `json:"lat_p50"`
					LatP95      aggVal  `json:"lat_p95"`
					LatP99      aggVal  `json:"lat_p99"`
					BwIn        aggVal  `json:"bw_in"`
					BwOut       aggVal  `json:"bw_out"`
				} `json:"buckets"`
			} `json:"by_ts"`
		} `json:"aggregations"`
	}
	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}

	points := make([]model.TimeSeriesPoint, 0, len(result.Aggregations.ByTs.Buckets))
	for _, b := range result.Aggregations.ByTs.Buckets {
		ts, _ := time.Parse(time.RFC3339Nano, b.KeyAsString)
		points = append(points, model.TimeSeriesPoint{
			Ts:               ts,
			RequestsTotal:    int(b.Requests.Value),
			Status2xx:        int(b.S2xx.Value),
			Status3xx:        int(b.S3xx.Value),
			Status4xx:        int(b.S4xx.Value),
			Status5xx:        int(b.S5xx.Value),
			LatencyP50:       b.LatP50.Value,
			LatencyP95:       b.LatP95.Value,
			LatencyP99:       b.LatP99.Value,
			BandwidthIngress: int64(b.BwIn.Value),
			BandwidthEgress:  int64(b.BwOut.Value),
		})
	}
	return points, nil
}

type aggVal struct {
	Value float64 `json:"value"`
}

func (r *ESMetricsRepository) Summary(ctx context.Context, filter MetricsFilter) (*model.MetricsSummary, error) {
	_, must := esResolveFilter(filter)

	query := map[string]interface{}{
		"size": 0,
		"query": map[string]interface{}{
			"bool": map[string]interface{}{"must": must},
		},
		"aggs": map[string]interface{}{
			"requests":    map[string]interface{}{"sum": map[string]string{"field": "requests_total"}},
			"lat_sum":     map[string]interface{}{"sum": map[string]string{"field": "latency_sum"}},
			"lat_count":   map[string]interface{}{"sum": map[string]string{"field": "latency_count"}},
			"s2xx":        map[string]interface{}{"sum": map[string]string{"field": "status_2xx"}},
			"s3xx":        map[string]interface{}{"sum": map[string]string{"field": "status_3xx"}},
			"s4xx":        map[string]interface{}{"sum": map[string]string{"field": "status_4xx"}},
			"s5xx":        map[string]interface{}{"sum": map[string]string{"field": "status_5xx"}},
			"bw_in":       map[string]interface{}{"sum": map[string]string{"field": "bandwidth_ingress"}},
			"bw_out":      map[string]interface{}{"sum": map[string]string{"field": "bandwidth_egress"}},
		},
	}

	body, _ := json.Marshal(query)
	res, err := r.client.Search(
		r.client.Search.WithContext(ctx),
		r.client.Search.WithIndex(r.metricsPattern()),
		r.client.Search.WithBody(bytes.NewReader(body)),
	)
	if err != nil {
		return nil, fmt.Errorf("es summary: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("es summary: %s", res.Status())
	}

	var result struct {
		Aggregations struct {
			Requests aggVal `json:"requests"`
			LatSum   aggVal `json:"lat_sum"`
			LatCount aggVal `json:"lat_count"`
			S2xx     aggVal `json:"s2xx"`
			S3xx     aggVal `json:"s3xx"`
			S4xx     aggVal `json:"s4xx"`
			S5xx     aggVal `json:"s5xx"`
			BwIn     aggVal `json:"bw_in"`
			BwOut    aggVal `json:"bw_out"`
		} `json:"aggregations"`
	}
	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}

	a := result.Aggregations
	s := &model.MetricsSummary{
		TotalRequests:   int64(a.Requests.Value),
		Status2xx:       int64(a.S2xx.Value),
		Status3xx:       int64(a.S3xx.Value),
		Status4xx:       int64(a.S4xx.Value),
		Status5xx:       int64(a.S5xx.Value),
		TotalBandwidthIn:  int64(a.BwIn.Value),
		TotalBandwidthOut: int64(a.BwOut.Value),
	}

	if a.LatCount.Value > 0 {
		s.AvgLatencyMs = a.LatSum.Value / a.LatCount.Value
	}
	if s.TotalRequests > 0 {
		s.ErrorRate = float64(s.Status4xx+s.Status5xx) / float64(s.TotalRequests)
	}
	return s, nil
}

func (r *ESMetricsRepository) TopRoutes(ctx context.Context, filter MetricsFilter, limit int) ([]model.TopRoute, error) {
	_, must := esResolveFilter(filter)

	if len(filter.RouteIDs) == 0 {
		must = append(must, map[string]interface{}{
			"bool": map[string]interface{}{
				"must_not": []map[string]interface{}{
					{"term": map[string]interface{}{"route_id": ""}},
				},
			},
		})
	}

	query := map[string]interface{}{
		"size": 0,
		"query": map[string]interface{}{
			"bool": map[string]interface{}{"must": must},
		},
		"aggs": map[string]interface{}{
			"by_route": map[string]interface{}{
				"terms": map[string]interface{}{
					"field": "route_id",
					"size":  limit,
					"order": map[string]string{"requests": "desc"},
				},
				"aggs": map[string]interface{}{
					"requests":  map[string]interface{}{"sum": map[string]string{"field": "requests_total"}},
					"route_name": map[string]interface{}{"terms": map[string]interface{}{"field": "route_name", "size": 1}},
					"lat_sum":   map[string]interface{}{"sum": map[string]string{"field": "latency_sum"}},
					"lat_count": map[string]interface{}{"sum": map[string]string{"field": "latency_count"}},
					"s4xx":      map[string]interface{}{"sum": map[string]string{"field": "status_4xx"}},
					"s5xx":      map[string]interface{}{"sum": map[string]string{"field": "status_5xx"}},
					"bw_in":     map[string]interface{}{"sum": map[string]string{"field": "bandwidth_ingress"}},
					"bw_out":    map[string]interface{}{"sum": map[string]string{"field": "bandwidth_egress"}},
				},
			},
		},
	}

	body, _ := json.Marshal(query)
	res, err := r.client.Search(
		r.client.Search.WithContext(ctx),
		r.client.Search.WithIndex(r.metricsPattern()),
		r.client.Search.WithBody(bytes.NewReader(body)),
	)
	if err != nil {
		return nil, fmt.Errorf("es top routes: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("es top routes: %s", res.Status())
	}

	var result struct {
		Aggregations struct {
			ByRoute struct {
				Buckets []struct {
					Key       string `json:"key"`
					Requests  aggVal `json:"requests"`
					RouteName struct {
						Buckets []struct {
							Key string `json:"key"`
						} `json:"buckets"`
					} `json:"route_name"`
					LatSum   aggVal `json:"lat_sum"`
					LatCount aggVal `json:"lat_count"`
					S4xx     aggVal `json:"s4xx"`
					S5xx     aggVal `json:"s5xx"`
					BwIn     aggVal `json:"bw_in"`
					BwOut    aggVal `json:"bw_out"`
				} `json:"buckets"`
			} `json:"by_route"`
		} `json:"aggregations"`
	}
	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}

	routes := make([]model.TopRoute, 0, len(result.Aggregations.ByRoute.Buckets))
	for _, b := range result.Aggregations.ByRoute.Buckets {
		routeName := ""
		if len(b.RouteName.Buckets) > 0 {
			routeName = b.RouteName.Buckets[0].Key
		}
		var avgLat float64
		if b.LatCount.Value > 0 {
			avgLat = b.LatSum.Value / b.LatCount.Value
		}
		var errRate float64
		if b.Requests.Value > 0 {
			errRate = (b.S4xx.Value + b.S5xx.Value) / b.Requests.Value
		}
		routes = append(routes, model.TopRoute{
			RouteID:          b.Key,
			RouteName:        routeName,
			RequestsTotal:    int64(b.Requests.Value),
			AvgLatencyMs:     avgLat,
			ErrorRate:        errRate,
			BandwidthIngress: int64(b.BwIn.Value),
			BandwidthEgress:  int64(b.BwOut.Value),
		})
	}
	return routes, nil
}

func (r *ESMetricsRepository) TopConsumers(ctx context.Context, filter MetricsFilter, limit int) ([]model.TopConsumer, error) {
	_, must := esResolveFilter(filter)

	must = append(must, map[string]interface{}{
		"bool": map[string]interface{}{
			"must_not": []map[string]interface{}{
				{"term": map[string]interface{}{"consumer_name": ""}},
			},
		},
	})

	query := map[string]interface{}{
		"size": 0,
		"query": map[string]interface{}{
			"bool": map[string]interface{}{"must": must},
		},
		"aggs": map[string]interface{}{
			"by_consumer": map[string]interface{}{
				"terms": map[string]interface{}{
					"field": "consumer_name",
					"size":  limit,
					"order": map[string]string{"requests": "desc"},
				},
				"aggs": map[string]interface{}{
					"requests":  map[string]interface{}{"sum": map[string]string{"field": "requests_total"}},
					"lat_sum":   map[string]interface{}{"sum": map[string]string{"field": "latency_sum"}},
					"lat_count": map[string]interface{}{"sum": map[string]string{"field": "latency_count"}},
					"s4xx":      map[string]interface{}{"sum": map[string]string{"field": "status_4xx"}},
					"s5xx":      map[string]interface{}{"sum": map[string]string{"field": "status_5xx"}},
					"bw_in":     map[string]interface{}{"sum": map[string]string{"field": "bandwidth_ingress"}},
					"bw_out":    map[string]interface{}{"sum": map[string]string{"field": "bandwidth_egress"}},
				},
			},
		},
	}

	body, _ := json.Marshal(query)
	res, err := r.client.Search(
		r.client.Search.WithContext(ctx),
		r.client.Search.WithIndex(r.metricsPattern()),
		r.client.Search.WithBody(bytes.NewReader(body)),
	)
	if err != nil {
		return nil, fmt.Errorf("es top consumers: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("es top consumers: %s", res.Status())
	}

	var result struct {
		Aggregations struct {
			ByConsumer struct {
				Buckets []struct {
					Key      string `json:"key"`
					Requests aggVal `json:"requests"`
					LatSum   aggVal `json:"lat_sum"`
					LatCount aggVal `json:"lat_count"`
					S4xx     aggVal `json:"s4xx"`
					S5xx     aggVal `json:"s5xx"`
					BwIn     aggVal `json:"bw_in"`
					BwOut    aggVal `json:"bw_out"`
				} `json:"buckets"`
			} `json:"by_consumer"`
		} `json:"aggregations"`
	}
	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}

	consumers := make([]model.TopConsumer, 0, len(result.Aggregations.ByConsumer.Buckets))
	for _, b := range result.Aggregations.ByConsumer.Buckets {
		var avgLat float64
		if b.LatCount.Value > 0 {
			avgLat = b.LatSum.Value / b.LatCount.Value
		}
		var errRate float64
		if b.Requests.Value > 0 {
			errRate = (b.S4xx.Value + b.S5xx.Value) / b.Requests.Value
		}
		consumers = append(consumers, model.TopConsumer{
			ConsumerName:     b.Key,
			RequestsTotal:    int64(b.Requests.Value),
			AvgLatencyMs:     avgLat,
			ErrorRate:        errRate,
			BandwidthIngress: int64(b.BwIn.Value),
			BandwidthEgress:  int64(b.BwOut.Value),
		})
	}
	return consumers, nil
}

func (r *ESMetricsRepository) RollupToHour(ctx context.Context) (int64, error) {
	// For ES, rollup is handled by writing metrics with the correct resolution during insert.
	// This is a no-op since we use a single index with a resolution field.
	return 0, nil
}

func (r *ESMetricsRepository) RollupToDay(ctx context.Context) (int64, error) {
	return 0, nil
}

func (r *ESMetricsRepository) CleanupExpired(ctx context.Context, ttl1mDays, ttl1hDays int) (int64, error) {
	// Delete old metrics by resolution
	var totalDeleted int64

	for resolution, ttlDays := range map[string]int{"1m": ttl1mDays, "1h": ttl1hDays} {
		cutoff := time.Now().UTC().AddDate(0, 0, -ttlDays)
		query := map[string]interface{}{
			"query": map[string]interface{}{
				"bool": map[string]interface{}{
					"must": []map[string]interface{}{
						{"term": map[string]interface{}{"resolution": resolution}},
						{"range": map[string]interface{}{"ts": map[string]interface{}{"lt": cutoff.Format(time.RFC3339)}}},
					},
				},
			},
		}

		body, _ := json.Marshal(query)
		res, err := r.client.DeleteByQuery(
			[]string{r.metricsPattern()},
			bytes.NewReader(body),
			r.client.DeleteByQuery.WithContext(ctx),
		)
		if err != nil {
			return totalDeleted, fmt.Errorf("cleanup %s metrics: %w", resolution, err)
		}
		defer res.Body.Close()

		var result struct {
			Deleted int64 `json:"deleted"`
		}
		json.NewDecoder(res.Body).Decode(&result)
		totalDeleted += result.Deleted
	}
	return totalDeleted, nil
}
