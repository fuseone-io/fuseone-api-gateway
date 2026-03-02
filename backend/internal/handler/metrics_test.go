package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

// mockMetricsQuerier implements repository.MetricsQuerier for testing.
type mockMetricsQuerier struct {
	timeSeriesResult []model.TimeSeriesPoint
	summaryResult    *model.MetricsSummary
	topRoutesResult  []model.TopRoute
	lastFilter       repository.MetricsFilter
	lastLimit        int
}

func (m *mockMetricsQuerier) BatchUpsertMinute(_ context.Context, _ []model.MetricsRow) error {
	return nil
}
func (m *mockMetricsQuerier) TimeSeries(_ context.Context, filter repository.MetricsFilter) ([]model.TimeSeriesPoint, error) {
	m.lastFilter = filter
	return m.timeSeriesResult, nil
}
func (m *mockMetricsQuerier) Summary(_ context.Context, filter repository.MetricsFilter) (*model.MetricsSummary, error) {
	m.lastFilter = filter
	return m.summaryResult, nil
}
func (m *mockMetricsQuerier) TopRoutes(_ context.Context, filter repository.MetricsFilter, limit int) ([]model.TopRoute, error) {
	m.lastFilter = filter
	m.lastLimit = limit
	return m.topRoutesResult, nil
}
func (m *mockMetricsQuerier) RollupToHour(_ context.Context) (int64, error) { return 0, nil }
func (m *mockMetricsQuerier) RollupToDay(_ context.Context) (int64, error)  { return 0, nil }
func (m *mockMetricsQuerier) CleanupExpired(_ context.Context, _, _ int) (int64, error) {
	return 0, nil
}

func setupMetricsRouter(h *MetricsHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/metrics/timeseries", h.TimeSeries)
	r.GET("/api/metrics/summary", h.Summary)
	r.GET("/api/metrics/top-routes", h.TopRoutes)
	return r
}

func TestTimeSeries_ValidRange(t *testing.T) {
	mock := &mockMetricsQuerier{
		timeSeriesResult: []model.TimeSeriesPoint{
			{Ts: time.Now(), RequestsTotal: 100, Status2xx: 90, LatencyP50: 5.5},
		},
	}
	h := NewMetricsHandler(mock)
	router := setupMetricsRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/metrics/timeseries?range=6h&route_id=test", nil)
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].([]interface{})
	if len(data) != 1 {
		t.Errorf("expected 1 point, got %d", len(data))
	}
	if mock.lastFilter.RangeStr != "6h" {
		t.Errorf("expected range=6h, got %s", mock.lastFilter.RangeStr)
	}
	// Backward compat: single route_id → []string{"test"}
	if len(mock.lastFilter.RouteIDs) != 1 || mock.lastFilter.RouteIDs[0] != "test" {
		t.Errorf("expected route_ids=[test], got %v", mock.lastFilter.RouteIDs)
	}
}

func TestTimeSeries_InvalidRange(t *testing.T) {
	mock := &mockMetricsQuerier{}
	h := NewMetricsHandler(mock)
	router := setupMetricsRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/metrics/timeseries?range=5m", nil)
	router.ServeHTTP(w, req)

	if w.Code != 400 {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestTimeSeries_MultiRoute(t *testing.T) {
	mock := &mockMetricsQuerier{
		timeSeriesResult: []model.TimeSeriesPoint{
			{Ts: time.Now(), RequestsTotal: 200},
		},
	}
	h := NewMetricsHandler(mock)
	router := setupMetricsRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/metrics/timeseries?range=1h&route_ids=r1,r2,r3", nil)
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if len(mock.lastFilter.RouteIDs) != 3 {
		t.Errorf("expected 3 route_ids, got %v", mock.lastFilter.RouteIDs)
	}
	if mock.lastFilter.RouteIDs[0] != "r1" || mock.lastFilter.RouteIDs[2] != "r3" {
		t.Errorf("expected [r1,r2,r3], got %v", mock.lastFilter.RouteIDs)
	}
}

func TestTimeSeries_Global(t *testing.T) {
	mock := &mockMetricsQuerier{
		timeSeriesResult: []model.TimeSeriesPoint{},
	}
	h := NewMetricsHandler(mock)
	router := setupMetricsRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/metrics/timeseries?range=1h", nil)
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if mock.lastFilter.RouteIDs != nil {
		t.Errorf("expected nil route_ids for global, got %v", mock.lastFilter.RouteIDs)
	}
}

func TestTimeSeries_CustomRange(t *testing.T) {
	mock := &mockMetricsQuerier{
		timeSeriesResult: []model.TimeSeriesPoint{
			{Ts: time.Now(), RequestsTotal: 50},
		},
	}
	h := NewMetricsHandler(mock)
	router := setupMetricsRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET",
		"/api/metrics/timeseries?from=2025-03-01T14:00:00Z&to=2025-03-01T16:00:00Z&route_ids=r1,r2", nil)
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !mock.lastFilter.IsCustom() {
		t.Error("expected custom filter")
	}
	if mock.lastFilter.From.Hour() != 14 {
		t.Errorf("expected from hour=14, got %d", mock.lastFilter.From.Hour())
	}
	if mock.lastFilter.To.Hour() != 16 {
		t.Errorf("expected to hour=16, got %d", mock.lastFilter.To.Hour())
	}
	if len(mock.lastFilter.RouteIDs) != 2 {
		t.Errorf("expected 2 route_ids, got %v", mock.lastFilter.RouteIDs)
	}
}

func TestTimeSeries_CustomRange_InvalidFrom(t *testing.T) {
	mock := &mockMetricsQuerier{}
	h := NewMetricsHandler(mock)
	router := setupMetricsRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/metrics/timeseries?from=not-a-date", nil)
	router.ServeHTTP(w, req)

	if w.Code != 400 {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestTimeSeries_CustomRange_FromAfterTo(t *testing.T) {
	mock := &mockMetricsQuerier{}
	h := NewMetricsHandler(mock)
	router := setupMetricsRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET",
		"/api/metrics/timeseries?from=2025-03-01T16:00:00Z&to=2025-03-01T14:00:00Z", nil)
	router.ServeHTTP(w, req)

	if w.Code != 400 {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestTimeSeries_PresetStillWorks(t *testing.T) {
	mock := &mockMetricsQuerier{
		timeSeriesResult: []model.TimeSeriesPoint{},
	}
	h := NewMetricsHandler(mock)
	router := setupMetricsRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/metrics/timeseries?range=1h", nil)
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if mock.lastFilter.IsCustom() {
		t.Error("expected preset filter, got custom")
	}
	if mock.lastFilter.RangeStr != "1h" {
		t.Errorf("expected range=1h, got %s", mock.lastFilter.RangeStr)
	}
}

func TestSummary_ReturnsData(t *testing.T) {
	mock := &mockMetricsQuerier{
		summaryResult: &model.MetricsSummary{
			TotalRequests: 1000,
			AvgLatencyMs:  25.5,
			ErrorRate:     0.05,
			Status2xx:     900,
			Status4xx:     40,
			Status5xx:     10,
		},
	}
	h := NewMetricsHandler(mock)
	router := setupMetricsRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/metrics/summary?range=24h", nil)
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]interface{})
	if data["total_requests"].(float64) != 1000 {
		t.Errorf("expected total_requests=1000, got %v", data["total_requests"])
	}
}

func TestSummary_WithRouteIDs(t *testing.T) {
	mock := &mockMetricsQuerier{
		summaryResult: &model.MetricsSummary{
			TotalRequests: 500,
			AvgLatencyMs:  15.0,
		},
	}
	h := NewMetricsHandler(mock)
	router := setupMetricsRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/metrics/summary?range=1h&route_ids=r1,r2", nil)
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if len(mock.lastFilter.RouteIDs) != 2 || mock.lastFilter.RouteIDs[0] != "r1" {
		t.Errorf("expected route_ids=[r1,r2], got %v", mock.lastFilter.RouteIDs)
	}
}

func TestTopRoutes_DefaultLimit(t *testing.T) {
	mock := &mockMetricsQuerier{
		topRoutesResult: []model.TopRoute{
			{RouteID: "api-v1", RequestsTotal: 500},
		},
	}
	h := NewMetricsHandler(mock)
	router := setupMetricsRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/metrics/top-routes", nil)
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if mock.lastLimit != 10 {
		t.Errorf("expected default limit=10, got %d", mock.lastLimit)
	}
}
