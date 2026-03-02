package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/config"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/service"
	"go.uber.org/zap"
)

// mockApiDefReader implements ApiDefReader for testing.
type mockApiDefReader struct {
	result *model.ApiDefinition
	err    error
}

func (m *mockApiDefReader) GetByID(_ context.Context, _ uuid.UUID) (*model.ApiDefinition, error) {
	return m.result, m.err
}

// mockDebugLogQuerier implements repository.DebugLogQuerier for testing.
type mockDebugLogQuerier struct {
	batchInsertCalls [][]model.DebugLog
	listResult       []model.DebugLog
	listTotal        int
	getByIDResult    *model.DebugLog
	lastFilter       model.DebugLogFilter
	lastGetID        int64
	batchInsertErr   error
	listErr          error
	getByIDErr       error
}

func (m *mockDebugLogQuerier) BatchInsert(_ context.Context, logs []model.DebugLog) error {
	m.batchInsertCalls = append(m.batchInsertCalls, logs)
	return m.batchInsertErr
}

func (m *mockDebugLogQuerier) List(_ context.Context, filter model.DebugLogFilter) ([]model.DebugLog, int, error) {
	m.lastFilter = filter
	return m.listResult, m.listTotal, m.listErr
}

func (m *mockDebugLogQuerier) GetByID(_ context.Context, id int64) (*model.DebugLog, error) {
	m.lastGetID = id
	return m.getByIDResult, m.getByIDErr
}

func (m *mockDebugLogQuerier) CleanupOlderThan(_ context.Context, _ int) (int64, error) {
	return 0, nil
}

func (m *mockDebugLogQuerier) TrimToMaxRows(_ context.Context, _ int) (int64, error) {
	return 0, nil
}

func setupDebugRouter(h *DebugLogHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/internal/debug-logs", h.ReceiveLogs)
	r.GET("/api/debug/logs", h.ListLogs)
	r.GET("/api/debug/logs/:id", h.GetLog)
	r.POST("/api/debug/toggle/:route_id", h.ToggleDebug)
	r.GET("/api/debug/status/:route_id", h.DebugStatus)
	r.POST("/api/debug/toggle-api/:api_id", h.ToggleApiDebug)
	r.PATCH("/api/debug/capture-api/:api_id", h.UpdateApiCaptureOptions)
	r.GET("/api/debug/status-api/:api_id", h.ApiDebugStatus)
	return r
}

func TestReceiveLogs_SingleEntry(t *testing.T) {
	mock := &mockDebugLogQuerier{}
	hub := service.NewDebugHub()
	h := NewDebugLogHandler(mock, hub, nil, nil, nil, zap.NewNop(), "http://localhost:8080/internal/debug-logs")
	router := setupDebugRouter(h)

	body := `{
		"client_ip": "192.168.1.1",
		"route_id": "route-123",
		"service_id": "svc-1",
		"start_time": 1704067200000,
		"request": {
			"method": "GET",
			"uri": "/api/v1/users?page=1",
			"headers": {"host": "example.com"},
			"size": 245
		},
		"response": {
			"status": 200,
			"headers": {"content-type": "application/json"},
			"size": 1024
		},
		"upstream": "10.0.0.5:8080",
		"latency": 152,
		"upstream_latency": 120,
		"apisix_latency": 32
	}`

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/internal/debug-logs", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	if len(mock.batchInsertCalls) != 1 {
		t.Fatalf("expected 1 BatchInsert call, got %d", len(mock.batchInsertCalls))
	}

	logs := mock.batchInsertCalls[0]
	if len(logs) != 1 {
		t.Fatalf("expected 1 log, got %d", len(logs))
	}

	l := logs[0]
	if l.RouteID != "route-123" {
		t.Errorf("expected route_id=route-123, got %s", l.RouteID)
	}
	if l.ReqMethod != "GET" {
		t.Errorf("expected method=GET, got %s", l.ReqMethod)
	}
	if l.RespStatus != 200 {
		t.Errorf("expected status=200, got %d", l.RespStatus)
	}
	if l.LatencyTotal != 152 {
		t.Errorf("expected latency_total=152, got %d", l.LatencyTotal)
	}
	if l.UpstreamAddr != "10.0.0.5:8080" {
		t.Errorf("expected upstream=10.0.0.5:8080, got %s", l.UpstreamAddr)
	}
	if l.ClientIP != "192.168.1.1" {
		t.Errorf("expected client_ip=192.168.1.1, got %s", l.ClientIP)
	}
}

func TestReceiveLogs_BatchArray(t *testing.T) {
	mock := &mockDebugLogQuerier{}
	hub := service.NewDebugHub()
	h := NewDebugLogHandler(mock, hub, nil, nil, nil, zap.NewNop(), "http://localhost:8080/internal/debug-logs")
	router := setupDebugRouter(h)

	body := `[
		{"client_ip":"1.1.1.1","route_id":"r1","start_time":1704067200000,"request":{"method":"GET","uri":"/a","headers":{},"size":10},"response":{"status":200,"headers":{},"size":50},"upstream":"10.0.0.1:80","latency":10,"upstream_latency":5,"apisix_latency":5},
		{"client_ip":"2.2.2.2","route_id":"r2","start_time":1704067201000,"request":{"method":"POST","uri":"/b","headers":{},"size":20},"response":{"status":404,"headers":{},"size":30},"upstream":"10.0.0.2:80","latency":20,"upstream_latency":15,"apisix_latency":5},
		{"client_ip":"3.3.3.3","route_id":"r3","start_time":1704067202000,"request":{"method":"DELETE","uri":"/c","headers":{},"size":0},"response":{"status":500,"headers":{},"size":100},"upstream":"10.0.0.3:80","latency":300,"upstream_latency":290,"apisix_latency":10}
	]`

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/internal/debug-logs", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	if len(mock.batchInsertCalls) != 1 {
		t.Fatalf("expected 1 BatchInsert call, got %d", len(mock.batchInsertCalls))
	}

	logs := mock.batchInsertCalls[0]
	if len(logs) != 3 {
		t.Fatalf("expected 3 logs, got %d", len(logs))
	}

	if logs[0].RouteID != "r1" || logs[1].RouteID != "r2" || logs[2].RouteID != "r3" {
		t.Errorf("route IDs don't match: %s, %s, %s", logs[0].RouteID, logs[1].RouteID, logs[2].RouteID)
	}
	if logs[2].RespStatus != 500 {
		t.Errorf("expected third log status=500, got %d", logs[2].RespStatus)
	}
}

func TestReceiveLogs_RealAPISIXPayload(t *testing.T) {
	mock := &mockDebugLogQuerier{}
	hub := service.NewDebugHub()
	h := NewDebugLogHandler(mock, hub, nil, nil, nil, zap.NewNop(), "http://localhost:8080/internal/debug-logs")
	router := setupDebugRouter(h)

	// Exact payload from APISIX 3.15.0 http-logger
	body := `{"client_ip":"172.20.0.1","route_id":"00000000000000000126","apisix_latency":7.9998912811279,"consumer":{"username":"teste"},"upstream_latency":1056,"latency":1063.9998912811,"start_time":1772463303308,"server":{"hostname":"793682b74fbe","version":"3.15.0"},"service_id":"00000000000000000061","request":{"method":"GET","headers":{"accept":"*/*","x-consumer-username":"teste","x-forwarded-proto":"http","x-correlation-id":"9dabf73b-9183-41d1-8f09-04e690f48469","x-forwarded-host":"localhost","host":"localhost:9080","user-agent":"curl/8.18.0","x-forwarded-port":"9080"},"size":103,"uri":"/teste/get","querystring":{},"url":"http://localhost:9080/teste/get"},"response":{"body":"{\"args\":{}}","size":779,"status":200,"headers":{"access-control-allow-methods":"*","content-length":"402","access-control-allow-origin":"*","content-type":"application/json","server":"APISIX/3.15.0","connection":"close","date":"Mon, 02 Mar 2026 14:55:04 GMT"}},"upstream":"54.163.232.70:443"}`

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/internal/debug-logs", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	if len(mock.batchInsertCalls) != 1 || len(mock.batchInsertCalls[0]) != 1 {
		t.Fatalf("expected 1 log entry inserted")
	}

	l := mock.batchInsertCalls[0][0]
	if l.RouteID != "00000000000000000126" {
		t.Errorf("route_id: got %q, want 00000000000000000126", l.RouteID)
	}
	if l.ServiceID != "00000000000000000061" {
		t.Errorf("service_id: got %q, want 00000000000000000061", l.ServiceID)
	}
	if l.ConsumerName != "teste" {
		t.Errorf("consumer: got %q, want teste", l.ConsumerName)
	}
	if l.ClientIP != "172.20.0.1" {
		t.Errorf("client_ip: got %q, want 172.20.0.1", l.ClientIP)
	}
	if l.ReqMethod != "GET" {
		t.Errorf("method: got %q, want GET", l.ReqMethod)
	}
	if l.ReqURI != "/teste/get" {
		t.Errorf("uri: got %q, want /teste/get", l.ReqURI)
	}
	if l.RespStatus != 200 {
		t.Errorf("status: got %d, want 200", l.RespStatus)
	}
	if l.LatencyTotal != 1063 {
		t.Errorf("latency_total: got %d, want 1063", l.LatencyTotal)
	}
	if l.LatencyUpstream == nil || *l.LatencyUpstream != 1056 {
		t.Errorf("latency_upstream: got %v, want 1056", l.LatencyUpstream)
	}
	if l.LatencyGateway == nil || *l.LatencyGateway != 7 {
		t.Errorf("latency_gateway: got %v, want 7", l.LatencyGateway)
	}
	if l.UpstreamAddr != "54.163.232.70:443" {
		t.Errorf("upstream: got %q, want 54.163.232.70:443", l.UpstreamAddr)
	}
	// start_time=1772463303308 ms → 2026-03-02
	if l.RequestTime.Year() != 2026 || l.RequestTime.Month() != time.March {
		t.Errorf("request_time: got %v, want March 2026", l.RequestTime)
	}
}

func TestListLogs_WithFilters(t *testing.T) {
	now := time.Now()
	mock := &mockDebugLogQuerier{
		listResult: []model.DebugLog{
			{ID: 1, RouteID: "r1", ReqMethod: "GET", ReqURI: "/test", RespStatus: 200, LatencyTotal: 10, RequestTime: now, CreatedAt: now},
		},
		listTotal: 1,
	}
	hub := service.NewDebugHub()
	h := NewDebugLogHandler(mock, hub, nil, nil, nil, zap.NewNop(), "")
	router := setupDebugRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/debug/logs?route_id=r1&status_min=400&status_max=599&method=POST&search=users&limit=20&offset=10", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	f := mock.lastFilter
	if f.RouteID != "r1" {
		t.Errorf("expected route_id=r1, got %s", f.RouteID)
	}
	if f.StatusMin != 400 {
		t.Errorf("expected status_min=400, got %d", f.StatusMin)
	}
	if f.StatusMax != 599 {
		t.Errorf("expected status_max=599, got %d", f.StatusMax)
	}
	if f.Method != "POST" {
		t.Errorf("expected method=POST, got %s", f.Method)
	}
	if f.Search != "users" {
		t.Errorf("expected search=users, got %s", f.Search)
	}
	if f.Limit != 20 {
		t.Errorf("expected limit=20, got %d", f.Limit)
	}
	if f.Offset != 10 {
		t.Errorf("expected offset=10, got %d", f.Offset)
	}

	// Verify response structure
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["meta"] == nil {
		t.Error("expected meta field in response")
	}
}

func TestToggleDebug_Enable(t *testing.T) {
	// Mock APISIX Admin API returning a route WITHOUT http-logger
	apisixServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == "GET" && r.URL.Path == "/apisix/admin/routes/route-1":
			// Route without http-logger plugin
			resp := map[string]interface{}{
				"key": "/apisix/routes/route-1",
				"value": map[string]interface{}{
					"id":   "route-1",
					"uri":  "/api/*",
					"name": "test-route",
					"plugins": map[string]interface{}{
						"proxy-rewrite": map[string]interface{}{},
					},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
		case r.Method == "PATCH" && r.URL.Path == "/apisix/admin/routes/route-1":
			// Verify the patch adds http-logger
			var patchBody map[string]interface{}
			json.NewDecoder(r.Body).Decode(&patchBody)
			plugins, ok := patchBody["plugins"].(map[string]interface{})
			if !ok {
				t.Error("patch body should contain plugins")
			}
			if _, has := plugins["http-logger"]; !has {
				t.Error("patch should add http-logger plugin")
			}

			resp := map[string]interface{}{
				"key":   "/apisix/routes/route-1",
				"value": map[string]interface{}{"id": "route-1"},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer apisixServer.Close()

	cfg := &config.APISIXConfig{AdminURL: apisixServer.URL, APIKey: "test-key", ControlURL: "http://localhost:9090"}
	apisixClient := service.NewAPISIXClient(cfg, zap.NewNop())
	hub := service.NewDebugHub()
	h := NewDebugLogHandler(nil, hub, apisixClient, nil, nil, zap.NewNop(), "http://localhost:8080/internal/debug-logs")
	router := setupDebugRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/debug/toggle/route-1", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]interface{})
	if data["enabled"] != true {
		t.Errorf("expected enabled=true, got %v", data["enabled"])
	}
}

func TestToggleDebug_Disable(t *testing.T) {
	callbackURL := "http://localhost:8080/internal/debug-logs"
	// Mock APISIX returning a route WITH http-logger pointing to our callback
	apisixServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == "GET" && r.URL.Path == "/apisix/admin/routes/route-1":
			resp := map[string]interface{}{
				"key": "/apisix/routes/route-1",
				"value": map[string]interface{}{
					"id":   "route-1",
					"uri":  "/api/*",
					"name": "test-route",
					"plugins": map[string]interface{}{
						"http-logger": map[string]interface{}{
							"uri":              callbackURL,
							"batch_max_size":   50,
							"include_req_body": true,
						},
						"proxy-rewrite": map[string]interface{}{},
					},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
		case r.Method == "PATCH" && r.URL.Path == "/apisix/admin/routes/route-1":
			// Verify the patch removes http-logger
			var patchBody map[string]interface{}
			json.NewDecoder(r.Body).Decode(&patchBody)
			plugins, ok := patchBody["plugins"].(map[string]interface{})
			if !ok {
				t.Error("patch body should contain plugins")
			}
			// When removing, http-logger should be nil/absent or explicitly null
			if val, has := plugins["http-logger"]; has && val != nil {
				t.Errorf("patch should remove http-logger (set to nil), got %v", val)
			}

			resp := map[string]interface{}{
				"key":   "/apisix/routes/route-1",
				"value": map[string]interface{}{"id": "route-1"},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer apisixServer.Close()

	cfg := &config.APISIXConfig{AdminURL: apisixServer.URL, APIKey: "test-key", ControlURL: "http://localhost:9090"}
	apisixClient := service.NewAPISIXClient(cfg, zap.NewNop())
	hub := service.NewDebugHub()
	h := NewDebugLogHandler(nil, hub, apisixClient, nil, nil, zap.NewNop(), callbackURL)
	router := setupDebugRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/debug/toggle/route-1", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]interface{})
	if data["enabled"] != false {
		t.Errorf("expected enabled=false, got %v", data["enabled"])
	}
}

func TestDebugStatus(t *testing.T) {
	callbackURL := "http://localhost:8080/internal/debug-logs"
	apisixServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"key": "/apisix/routes/route-1",
			"value": map[string]interface{}{
				"id":  "route-1",
				"uri": "/api/*",
				"plugins": map[string]interface{}{
					"http-logger": map[string]interface{}{
						"uri": callbackURL,
					},
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer apisixServer.Close()

	cfg := &config.APISIXConfig{AdminURL: apisixServer.URL, APIKey: "test-key", ControlURL: "http://localhost:9090"}
	apisixClient := service.NewAPISIXClient(cfg, zap.NewNop())
	hub := service.NewDebugHub()
	h := NewDebugLogHandler(nil, hub, apisixClient, nil, nil, zap.NewNop(), callbackURL)
	router := setupDebugRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/debug/status/route-1", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]interface{})
	if data["enabled"] != true {
		t.Errorf("expected enabled=true, got %v", data["enabled"])
	}
}

func TestToggleApiDebug_EnablesAllRoutes(t *testing.T) {
	callbackURL := "http://localhost:8080/internal/debug-logs"

	// Mock APISIX: 2 routes, neither has http-logger
	apisixServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		routeID := ""
		if strings.HasSuffix(r.URL.Path, "/r1") {
			routeID = "r1"
		} else if strings.HasSuffix(r.URL.Path, "/r2") {
			routeID = "r2"
		}

		if r.Method == "GET" {
			resp := map[string]interface{}{
				"key": "/apisix/routes/" + routeID,
				"value": map[string]interface{}{
					"id":      routeID,
					"plugins": map[string]interface{}{},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
		} else if r.Method == "PATCH" {
			resp := map[string]interface{}{
				"key":   "/apisix/routes/" + routeID,
				"value": map[string]interface{}{"id": routeID},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
		}
	}))
	defer apisixServer.Close()

	apiID := uuid.New()
	routeIDsJSON, _ := json.Marshal([]string{"r1", "r2"})
	mockDefs := &mockApiDefReader{
		result: &model.ApiDefinition{
			ID:             apiID,
			APISIXRouteIDs: routeIDsJSON,
		},
	}

	cfg := &config.APISIXConfig{AdminURL: apisixServer.URL, APIKey: "test-key", ControlURL: "http://localhost:9090"}
	apisixClient := service.NewAPISIXClient(cfg, zap.NewNop())
	hub := service.NewDebugHub()
	h := NewDebugLogHandler(nil, hub, apisixClient, nil, mockDefs, zap.NewNop(), callbackURL)
	router := setupDebugRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/debug/toggle-api/"+apiID.String(), nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp2 map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp2)
	data2 := resp2["data"].(map[string]interface{})
	if data2["enabled"] != true {
		t.Errorf("expected enabled=true, got %v", data2["enabled"])
	}
	routes := data2["routes"].([]interface{})
	if len(routes) != 2 {
		t.Errorf("expected 2 routes, got %d", len(routes))
	}
}

func TestApiDebugStatus(t *testing.T) {
	callbackURL := "http://localhost:8080/internal/debug-logs"

	apisixServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Route r1 has http-logger, r2 doesn't
		hasLogger := strings.HasSuffix(r.URL.Path, "/r1")
		plugins := map[string]interface{}{}
		if hasLogger {
			plugins["http-logger"] = map[string]interface{}{"uri": callbackURL}
		}
		resp := map[string]interface{}{
			"key": r.URL.Path,
			"value": map[string]interface{}{
				"plugins": plugins,
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer apisixServer.Close()

	apiID := uuid.New()
	routeIDsJSON, _ := json.Marshal([]string{"r1", "r2"})
	mockDefs := &mockApiDefReader{
		result: &model.ApiDefinition{
			ID:             apiID,
			APISIXRouteIDs: routeIDsJSON,
		},
	}

	cfg := &config.APISIXConfig{AdminURL: apisixServer.URL, APIKey: "test-key", ControlURL: "http://localhost:9090"}
	apisixClient := service.NewAPISIXClient(cfg, zap.NewNop())
	hub := service.NewDebugHub()
	h := NewDebugLogHandler(nil, hub, apisixClient, nil, mockDefs, zap.NewNop(), callbackURL)
	router := setupDebugRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/debug/status-api/"+apiID.String(), nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp2 map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp2)
	data2 := resp2["data"].(map[string]interface{})
	if data2["enabled"] != true {
		t.Errorf("expected enabled=true (r1 has debug), got %v", data2["enabled"])
	}
	routes := data2["routes"].([]interface{})
	if len(routes) != 2 {
		t.Errorf("expected 2 routes, got %d", len(routes))
	}
}

func TestToggleDebug_EnableWithCaptureOptions(t *testing.T) {
	callbackURL := "http://localhost:8080/internal/debug-logs"
	var capturedPatch map[string]interface{}

	apisixServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == "GET":
			// Route without http-logger
			resp := map[string]interface{}{
				"key": "/apisix/routes/route-1",
				"value": map[string]interface{}{
					"id":      "route-1",
					"plugins": map[string]interface{}{},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
		case r.Method == "PATCH":
			json.NewDecoder(r.Body).Decode(&capturedPatch)
			resp := map[string]interface{}{
				"key":   "/apisix/routes/route-1",
				"value": map[string]interface{}{"id": "route-1"},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer apisixServer.Close()

	cfg := &config.APISIXConfig{AdminURL: apisixServer.URL, APIKey: "test-key", ControlURL: "http://localhost:9090"}
	apisixClient := service.NewAPISIXClient(cfg, zap.NewNop())
	hub := service.NewDebugHub()
	h := NewDebugLogHandler(nil, hub, apisixClient, nil, nil, zap.NewNop(), callbackURL)
	router := setupDebugRouter(h)

	// Toggle with include_resp_body=false
	body := `{"include_resp_body": false}`
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/debug/toggle/route-1", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// Verify patch has correct capture options
	plugins := capturedPatch["plugins"].(map[string]interface{})
	logger := plugins["http-logger"].(map[string]interface{})
	if logger["include_req_body"] != true {
		t.Errorf("expected include_req_body=true (default), got %v", logger["include_req_body"])
	}
	if logger["include_resp_body"] != false {
		t.Errorf("expected include_resp_body=false, got %v", logger["include_resp_body"])
	}
}

func TestApiDebugStatus_ReturnsCaptureOptions(t *testing.T) {
	callbackURL := "http://localhost:8080/internal/debug-logs"

	apisixServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		plugins := map[string]interface{}{
			"http-logger": map[string]interface{}{
				"uri":               callbackURL,
				"include_req_body":  true,
				"include_resp_body": false,
			},
		}
		resp := map[string]interface{}{
			"key": r.URL.Path,
			"value": map[string]interface{}{
				"id":      "r1",
				"plugins": plugins,
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer apisixServer.Close()

	apiID := uuid.New()
	routeIDsJSON, _ := json.Marshal([]string{"r1"})
	mockDefs := &mockApiDefReader{
		result: &model.ApiDefinition{
			ID:             apiID,
			APISIXRouteIDs: routeIDsJSON,
		},
	}

	cfg := &config.APISIXConfig{AdminURL: apisixServer.URL, APIKey: "test-key", ControlURL: "http://localhost:9090"}
	apisixClient := service.NewAPISIXClient(cfg, zap.NewNop())
	hub := service.NewDebugHub()
	h := NewDebugLogHandler(nil, hub, apisixClient, nil, mockDefs, zap.NewNop(), callbackURL)
	router := setupDebugRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/debug/status-api/"+apiID.String(), nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]interface{})
	if data["enabled"] != true {
		t.Errorf("expected enabled=true, got %v", data["enabled"])
	}
	if data["include_req_body"] != true {
		t.Errorf("expected include_req_body=true, got %v", data["include_req_body"])
	}
	if data["include_resp_body"] != false {
		t.Errorf("expected include_resp_body=false, got %v", data["include_resp_body"])
	}
}
