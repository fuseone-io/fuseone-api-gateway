package repository

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/elastic/go-elasticsearch/v8"

	"github.com/fuseone/api-gateway/internal/model"
)

// ESTraceRepository implements TraceQuerier for Elasticsearch.
type ESTraceRepository struct {
	client *elasticsearch.Client
	prefix string
}

func NewESTraceRepository(client *elasticsearch.Client, prefix string) *ESTraceRepository {
	return &ESTraceRepository{client: client, prefix: prefix}
}

func (r *ESTraceRepository) indexName(t time.Time) string {
	return fmt.Sprintf("%s-traces-%s", r.prefix, t.Format("2006.01.02"))
}

func (r *ESTraceRepository) indexPattern() string {
	return r.prefix + "-traces-*"
}

func (r *ESTraceRepository) InsertBatch(ctx context.Context, traces []model.RequestTrace) error {
	if len(traces) == 0 {
		return nil
	}

	var buf bytes.Buffer
	for _, t := range traces {
		meta := map[string]interface{}{
			"index": map[string]interface{}{
				"_index": r.indexName(t.CreatedAt),
			},
		}
		metaBytes, _ := json.Marshal(meta)
		buf.Write(metaBytes)
		buf.WriteByte('\n')

		doc := map[string]interface{}{
			"trace_id":     t.TraceID,
			"root_span_id": t.RootSpanID,
			"service_name": t.ServiceName,
			"route_id":     t.RouteID,
			"route_name":   t.RouteName,
			"method":       t.Method,
			"uri":          t.URI,
			"status_code":  t.StatusCode,
			"duration_ns":  t.DurationNs,
			"spans":        t.Spans,
			"attributes":   t.Attributes,
			"created_at":   t.CreatedAt,
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
		return fmt.Errorf("bulk insert: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("bulk insert: %s", res.Status())
	}
	return nil
}

func (r *ESTraceRepository) List(ctx context.Context, params model.TraceListParams) ([]model.RequestTrace, int, error) {
	must := []map[string]interface{}{}

	if len(params.RouteIDs) > 0 {
		must = append(must, map[string]interface{}{"terms": map[string]interface{}{"route_id": params.RouteIDs}})
	} else if params.RouteID != "" {
		must = append(must, map[string]interface{}{"term": map[string]interface{}{"route_id": params.RouteID}})
	}
	if params.Method != "" {
		must = append(must, map[string]interface{}{"term": map[string]interface{}{"method": params.Method}})
	}
	if params.StatusMin > 0 || params.StatusMax > 0 {
		rangeFilter := map[string]interface{}{}
		if params.StatusMin > 0 {
			rangeFilter["gte"] = params.StatusMin
		}
		if params.StatusMax > 0 {
			rangeFilter["lte"] = params.StatusMax
		}
		must = append(must, map[string]interface{}{"range": map[string]interface{}{"status_code": rangeFilter}})
	}
	if params.MinDurationMs > 0 || params.MaxDurationMs > 0 {
		rangeFilter := map[string]interface{}{}
		if params.MinDurationMs > 0 {
			rangeFilter["gte"] = params.MinDurationMs * 1_000_000
		}
		if params.MaxDurationMs > 0 {
			rangeFilter["lte"] = params.MaxDurationMs * 1_000_000
		}
		must = append(must, map[string]interface{}{"range": map[string]interface{}{"duration_ns": rangeFilter}})
	}
	if params.Search != "" {
		must = append(must, map[string]interface{}{"wildcard": map[string]interface{}{"uri.keyword": map[string]interface{}{"value": "*" + strings.ToLower(params.Search) + "*", "case_insensitive": true}}})
	}
	if !params.From.IsZero() || !params.To.IsZero() {
		rangeFilter := map[string]interface{}{}
		if !params.From.IsZero() {
			rangeFilter["gte"] = params.From.Format(time.RFC3339Nano)
		}
		if !params.To.IsZero() {
			rangeFilter["lte"] = params.To.Format(time.RFC3339Nano)
		}
		must = append(must, map[string]interface{}{"range": map[string]interface{}{"created_at": rangeFilter}})
	}

	query := map[string]interface{}{
		"query": map[string]interface{}{
			"bool": map[string]interface{}{"must": must},
		},
		"sort":             []map[string]interface{}{{"created_at": "desc"}},
		"track_total_hits": true,
	}

	limit := params.Limit
	if limit <= 0 {
		limit = 50
	}
	offset := params.Offset
	if offset < 0 {
		offset = 0
	}
	query["size"] = limit
	query["from"] = offset

	body, _ := json.Marshal(query)

	res, err := r.client.Search(
		r.client.Search.WithContext(ctx),
		r.client.Search.WithIndex(r.indexPattern()),
		r.client.Search.WithBody(bytes.NewReader(body)),
	)
	if err != nil {
		return nil, 0, fmt.Errorf("es search: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, 0, fmt.Errorf("es search: %s", res.Status())
	}

	var result struct {
		Hits struct {
			Total struct {
				Value int `json:"value"`
			} `json:"total"`
			Hits []struct {
				Source json.RawMessage `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return nil, 0, fmt.Errorf("decode response: %w", err)
	}

	traces := make([]model.RequestTrace, 0, len(result.Hits.Hits))
	for _, hit := range result.Hits.Hits {
		var t model.RequestTrace
		if err := json.Unmarshal(hit.Source, &t); err != nil {
			continue
		}
		if t.Spans == nil {
			t.Spans = []model.TraceSpan{}
		}
		traces = append(traces, t)
	}

	return traces, result.Hits.Total.Value, nil
}

func (r *ESTraceRepository) GetByTraceID(ctx context.Context, traceID string) (*model.RequestTrace, error) {
	query := map[string]interface{}{
		"query": map[string]interface{}{
			"term": map[string]interface{}{"trace_id": traceID},
		},
		"size": 1,
		"sort": []map[string]interface{}{{"created_at": "desc"}},
	}

	body, _ := json.Marshal(query)

	res, err := r.client.Search(
		r.client.Search.WithContext(ctx),
		r.client.Search.WithIndex(r.indexPattern()),
		r.client.Search.WithBody(bytes.NewReader(body)),
	)
	if err != nil {
		return nil, fmt.Errorf("es search: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("es search: %s", res.Status())
	}

	var result struct {
		Hits struct {
			Hits []struct {
				Source json.RawMessage `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	if len(result.Hits.Hits) == 0 {
		return nil, fmt.Errorf("trace not found")
	}

	var t model.RequestTrace
	if err := json.Unmarshal(result.Hits.Hits[0].Source, &t); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}
	if t.Spans == nil {
		t.Spans = []model.TraceSpan{}
	}
	return &t, nil
}

func (r *ESTraceRepository) DeleteOlderThan(ctx context.Context, before time.Time) (int64, error) {
	query := map[string]interface{}{
		"query": map[string]interface{}{
			"range": map[string]interface{}{
				"created_at": map[string]interface{}{
					"lt": before.Format(time.RFC3339Nano),
				},
			},
		},
	}
	body, _ := json.Marshal(query)

	res, err := r.client.DeleteByQuery(
		[]string{r.indexPattern()},
		bytes.NewReader(body),
		r.client.DeleteByQuery.WithContext(ctx),
	)
	if err != nil {
		return 0, fmt.Errorf("delete by query: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		return 0, fmt.Errorf("delete by query: %s", res.Status())
	}

	var result struct {
		Deleted int64 `json:"deleted"`
	}
	json.NewDecoder(res.Body).Decode(&result)
	return result.Deleted, nil
}

func (r *ESTraceRepository) EnsurePartition(_ context.Context, _ time.Time) error {
	// Elasticsearch creates indices on write via index templates.
	return nil
}
