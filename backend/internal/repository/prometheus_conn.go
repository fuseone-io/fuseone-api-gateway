package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// PrometheusClient wraps the Prometheus HTTP API for PromQL queries.
type PrometheusClient struct {
	baseURL    string
	httpClient *http.Client
	username   string
	password   string
}

// NewPrometheusClient creates a client for the given Prometheus/VictoriaMetrics base URL.
func NewPrometheusClient(baseURL, username, password string) *PrometheusClient {
	return &PrometheusClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		username: username,
		password: password,
	}
}

// promResult is the outer envelope of a Prometheus API response.
type promResult struct {
	Status    string          `json:"status"`
	Data      json.RawMessage `json:"data"`
	ErrorType string          `json:"errorType,omitempty"`
	Error     string          `json:"error,omitempty"`
}

// promData is the inner data payload.
type promData struct {
	ResultType string            `json:"resultType"`
	Result     []json.RawMessage `json:"result"`
}

// promVector represents a single instant-vector result.
type promVector struct {
	Metric map[string]string `json:"metric"`
	Value  [2]json.RawMessage `json:"value"` // [timestamp, "value"]
}

// promMatrix represents a single range-vector result.
type promMatrix struct {
	Metric map[string]string    `json:"metric"`
	Values [][2]json.RawMessage `json:"values"` // [[timestamp, "value"], ...]
}

// Query executes an instant query and returns the raw result.
func (c *PrometheusClient) Query(ctx context.Context, query string, ts time.Time) (*promData, error) {
	params := url.Values{
		"query": {query},
	}
	if !ts.IsZero() {
		params.Set("time", fmt.Sprintf("%d", ts.Unix()))
	}

	return c.doGet(ctx, "/api/v1/query", params)
}

// QueryRange executes a range query and returns the raw result.
func (c *PrometheusClient) QueryRange(ctx context.Context, query string, start, end time.Time, step time.Duration) (*promData, error) {
	params := url.Values{
		"query": {query},
		"start": {fmt.Sprintf("%d", start.Unix())},
		"end":   {fmt.Sprintf("%d", end.Unix())},
		"step":  {fmt.Sprintf("%ds", int(step.Seconds()))},
	}

	return c.doGet(ctx, "/api/v1/query_range", params)
}

// TestConnection verifies the Prometheus endpoint is reachable by querying buildinfo.
func (c *PrometheusClient) TestConnection(ctx context.Context) error {
	reqCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Try /api/v1/status/buildinfo (Prometheus) or a simple query (VictoriaMetrics)
	_, err := c.doGet(reqCtx, "/api/v1/status/buildinfo", nil)
	if err != nil {
		// VictoriaMetrics may not have buildinfo, try a simple query
		_, err2 := c.doGet(reqCtx, "/api/v1/query", url.Values{"query": {"1+1"}})
		if err2 != nil {
			return fmt.Errorf("cannot reach Prometheus API at %s: %w", c.baseURL, err)
		}
	}
	return nil
}

// doGet performs a GET request against the Prometheus API.
func (c *PrometheusClient) doGet(ctx context.Context, path string, params url.Values) (*promData, error) {
	u := c.baseURL + path
	if params != nil {
		u += "?" + params.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	if c.username != "" {
		req.SetBasicAuth(c.username, c.password)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	var result promResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if result.Status != "success" {
		return nil, fmt.Errorf("prometheus error (%s): %s", result.ErrorType, result.Error)
	}

	var data promData
	if err := json.Unmarshal(result.Data, &data); err != nil {
		return nil, fmt.Errorf("decode data: %w", err)
	}

	return &data, nil
}

// TestPrometheusConnection is a convenience function for the handler.
func TestPrometheusConnection(ctx context.Context, baseURL, username, password string) error {
	client := NewPrometheusClient(baseURL, username, password)
	return client.TestConnection(ctx)
}
