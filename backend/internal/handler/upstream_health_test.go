package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/config"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/service"
	"go.uber.org/zap"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// mockApiDefReaderForHealth implements ApiDefReader for upstream health tests.
type mockApiDefReaderForHealth struct {
	result *model.ApiDefinition
	err    error
}

func (m *mockApiDefReaderForHealth) GetByID(_ context.Context, _ uuid.UUID) (*model.ApiDefinition, error) {
	return m.result, m.err
}

func setupHealthTest(controlHandler http.HandlerFunc) (*UpstreamHealthHandler, *httptest.Server) {
	controlServer := httptest.NewServer(controlHandler)

	cfg := &config.APISIXConfig{
		AdminURL:   "http://localhost:9180",
		APIKey:     "test-key",
		ControlURL: controlServer.URL,
	}
	logger := zap.NewNop()
	client := service.NewAPISIXClient(cfg, logger)

	handler := NewUpstreamHealthHandler(client, &mockApiDefReaderForHealth{})
	return handler, controlServer
}

func setupHealthTestWithApiDefs(controlHandler http.HandlerFunc, apiDef *model.ApiDefinition) (*UpstreamHealthHandler, *httptest.Server) {
	controlServer := httptest.NewServer(controlHandler)

	cfg := &config.APISIXConfig{
		AdminURL:   "http://localhost:9180",
		APIKey:     "test-key",
		ControlURL: controlServer.URL,
	}
	logger := zap.NewNop()
	client := service.NewAPISIXClient(cfg, logger)

	handler := NewUpstreamHealthHandler(client, &mockApiDefReaderForHealth{result: apiDef})
	return handler, controlServer
}

func TestGetHealth_Success(t *testing.T) {
	healthData := `[{"name":"/apisix/upstreams/1","nodes":[{"ip":"127.0.0.1","port":8080,"status":"healthy","counter":{"http_failure":0,"success":10,"timeout_failure":0,"tcp_failure":0}}],"type":"http"}]`

	handler, server := setupHealthTest(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/healthcheck" {
			t.Errorf("expected path /v1/healthcheck, got %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(healthData))
	})
	defer server.Close()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/monitoring/upstream-health", nil)

	handler.GetHealth(c)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	var checkers []map[string]interface{}
	if err := json.Unmarshal(resp.Data, &checkers); err != nil {
		t.Fatalf("failed to parse data: %v", err)
	}

	if len(checkers) != 1 {
		t.Errorf("expected 1 checker, got %d", len(checkers))
	}
}

func TestGetHealth_ControlAPIError(t *testing.T) {
	handler, server := setupHealthTest(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte(`{"error": "control API unavailable"}`))
	})
	defer server.Close()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/monitoring/upstream-health", nil)

	handler.GetHealth(c)

	if w.Code != http.StatusBadGateway {
		t.Errorf("expected status 502, got %d", w.Code)
	}

	var resp struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Error.Code != "CONTROL_API_ERROR" {
		t.Errorf("expected error code CONTROL_API_ERROR, got %s", resp.Error.Code)
	}
}

func TestGetHealth_EmptyResponse(t *testing.T) {
	handler, server := setupHealthTest(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`[]`))
	})
	defer server.Close()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/monitoring/upstream-health", nil)

	handler.GetHealth(c)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
}

func TestGetHealth_ConnectionRefused(t *testing.T) {
	cfg := &config.APISIXConfig{
		AdminURL:   "http://localhost:9180",
		APIKey:     "test-key",
		ControlURL: "http://localhost:1",
	}
	logger := zap.NewNop()
	client := service.NewAPISIXClient(cfg, logger)
	handler := NewUpstreamHealthHandler(client, &mockApiDefReaderForHealth{})

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/monitoring/upstream-health", nil)

	handler.GetHealth(c)

	if w.Code != http.StatusBadGateway {
		t.Errorf("expected status 502 for connection error, got %d", w.Code)
	}
}

func TestGetHealthForAPI_FiltersByService(t *testing.T) {
	healthData := `[
		{"name":"/apisix/services/svc-123","nodes":[{"ip":"10.0.0.1","port":8080,"status":"healthy","counter":{"http_failure":0,"success":50,"timeout_failure":0,"tcp_failure":0}}],"type":"http"},
		{"name":"/apisix/services/svc-other","nodes":[{"ip":"10.0.0.2","port":8080,"status":"unhealthy","counter":{"http_failure":5,"success":10,"timeout_failure":0,"tcp_failure":0}}],"type":"http"},
		{"name":"/apisix/upstreams/ups-999","nodes":[{"ip":"10.0.0.3","port":9090,"status":"healthy","counter":{"http_failure":0,"success":100,"timeout_failure":0,"tcp_failure":0}}],"type":"http"}
	]`

	svcID := "svc-123"
	apiDef := &model.ApiDefinition{
		ID:              uuid.New(),
		APISIXServiceID: &svcID,
		APISIXRouteIDs:  json.RawMessage(`["route-a"]`),
	}

	handler, server := setupHealthTestWithApiDefs(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(healthData))
	}, apiDef)
	defer server.Close()

	r := gin.New()
	r.GET("/api/apis/:id/health", handler.GetHealthForAPI)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/apis/"+apiDef.ID.String()+"/health", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Data []json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	// Should only return the checker matching svc-123, not svc-other or ups-999
	if len(resp.Data) != 1 {
		t.Errorf("expected 1 filtered checker, got %d", len(resp.Data))
	}
}

func TestGetHealthForAPI_NotDeployed(t *testing.T) {
	// API without APISIX resources
	apiDef := &model.ApiDefinition{
		ID:         uuid.New(),
		SyncStatus: "draft",
	}

	handler, server := setupHealthTestWithApiDefs(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`[]`))
	}, apiDef)
	defer server.Close()

	r := gin.New()
	r.GET("/api/apis/:id/health", handler.GetHealthForAPI)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/apis/"+apiDef.ID.String()+"/health", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp struct {
		Data []interface{} `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if len(resp.Data) != 0 {
		t.Errorf("expected empty data for undeployed API, got %d items", len(resp.Data))
	}
}

func TestGetHealthForAPI_NotFound(t *testing.T) {
	// apiDefs returns nil (not found)
	handler, server := setupHealthTestWithApiDefs(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`[]`))
	}, nil)
	defer server.Close()

	r := gin.New()
	r.GET("/api/apis/:id/health", handler.GetHealthForAPI)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/apis/"+uuid.New().String()+"/health", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}
