package repository

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"github.com/elastic/go-elasticsearch/v8"
)

// tracesTemplate is the index template for trace data.
var tracesTemplate = map[string]interface{}{
	"index_patterns": []string{"*-traces-*"},
	"template": map[string]interface{}{
		"settings": map[string]interface{}{
			"number_of_shards":   1,
			"number_of_replicas": 0,
		},
		"mappings": map[string]interface{}{
			"properties": map[string]interface{}{
				"trace_id":      map[string]string{"type": "keyword"},
				"root_span_id":  map[string]string{"type": "keyword"},
				"service_name":  map[string]string{"type": "keyword"},
				"route_id":      map[string]string{"type": "keyword"},
				"route_name":    map[string]string{"type": "keyword"},
				"method":        map[string]string{"type": "keyword"},
				"uri":           map[string]interface{}{"type": "text", "fields": map[string]interface{}{"keyword": map[string]string{"type": "keyword"}}},
				"status_code":   map[string]string{"type": "integer"},
				"duration_ns":   map[string]string{"type": "long"},
				"spans":         map[string]interface{}{"type": "object", "enabled": false},
				"attributes":    map[string]interface{}{"type": "object", "enabled": false},
				"created_at":    map[string]string{"type": "date"},
			},
		},
	},
}

// metricsTemplate is the index template for metrics data.
var metricsTemplate = map[string]interface{}{
	"index_patterns": []string{"*-metrics-*"},
	"template": map[string]interface{}{
		"settings": map[string]interface{}{
			"number_of_shards":   1,
			"number_of_replicas": 0,
		},
		"mappings": map[string]interface{}{
			"properties": map[string]interface{}{
				"ts":                map[string]string{"type": "date"},
				"resolution":        map[string]string{"type": "keyword"},
				"route_id":          map[string]string{"type": "keyword"},
				"route_name":        map[string]string{"type": "keyword"},
				"consumer_name":     map[string]string{"type": "keyword"},
				"requests_total":    map[string]string{"type": "integer"},
				"status_2xx":        map[string]string{"type": "integer"},
				"status_3xx":        map[string]string{"type": "integer"},
				"status_4xx":        map[string]string{"type": "integer"},
				"status_5xx":        map[string]string{"type": "integer"},
				"latency_sum":       map[string]string{"type": "double"},
				"latency_count":     map[string]string{"type": "integer"},
				"latency_p50":       map[string]string{"type": "double"},
				"latency_p95":       map[string]string{"type": "double"},
				"latency_p99":       map[string]string{"type": "double"},
				"bandwidth_ingress": map[string]string{"type": "long"},
				"bandwidth_egress":  map[string]string{"type": "long"},
			},
		},
	},
}

// EnsureElasticsearchSchema creates index templates for traces and metrics.
func EnsureElasticsearchSchema(_ context.Context, client *elasticsearch.Client, prefix string) error {
	templates := map[string]map[string]interface{}{
		prefix + "-traces-tpl":  tracesTemplate,
		prefix + "-metrics-tpl": metricsTemplate,
	}

	// Update index_patterns to use the actual prefix
	tracesTemplate["index_patterns"] = []string{prefix + "-traces-*"}
	metricsTemplate["index_patterns"] = []string{prefix + "-metrics-*"}

	for name, body := range templates {
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal template %s: %w", name, err)
		}

		res, err := client.Indices.PutIndexTemplate(name, bytes.NewReader(bodyBytes))
		if err != nil {
			return fmt.Errorf("put index template %s: %w", name, err)
		}
		defer res.Body.Close()
		if res.IsError() {
			return fmt.Errorf("put index template %s: %s", name, res.Status())
		}
	}
	return nil
}
