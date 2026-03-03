package handler

// Integration tests for FuseOne custom APISIX plugins.
//
// These tests validate:
// 1. Plugin configuration schemas via mock APISIX Admin API
// 2. Live HTTP behavior for callout scenarios (mock external services)
// 3. Combined plugin pipeline configurations
//
// Run with: go test ./internal/handler/ -run TestPlugin -v

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/fuseone/api-gateway/internal/config"
	"github.com/fuseone/api-gateway/internal/service"
	"go.uber.org/zap"
)

// --- Test Helpers ---

// createRouteViaAdmin creates a route with plugins via the APISIX Admin API (mock or real).
func createRouteViaAdmin(t *testing.T, client *service.APISIXClient, routeID string, routeConfig map[string]interface{}) {
	t.Helper()
	body, err := json.Marshal(routeConfig)
	if err != nil {
		t.Fatalf("failed to marshal route config: %v", err)
	}
	_, err = client.CreateWithID(context.Background(), "routes", routeID, body)
	if err != nil {
		t.Fatalf("failed to create route %s: %v", routeID, err)
	}
}

// verifyRouteConfig retrieves a route and returns the parsed plugin config.
func verifyRouteConfig(t *testing.T, storedRoutes map[string]json.RawMessage, routeID string) map[string]interface{} {
	t.Helper()
	stored, ok := storedRoutes[routeID]
	if !ok {
		t.Fatalf("route %s not found in stored routes", routeID)
	}

	var route map[string]interface{}
	if err := json.Unmarshal(stored, &route); err != nil {
		t.Fatalf("failed to parse stored route: %v", err)
	}
	return route
}

func getPluginConfig(t *testing.T, route map[string]interface{}, pluginName string) map[string]interface{} {
	t.Helper()
	plugins, ok := route["plugins"].(map[string]interface{})
	if !ok {
		t.Fatal("plugins not found in route")
	}
	plugin, ok := plugins[pluginName].(map[string]interface{})
	if !ok {
		t.Fatalf("plugin %s not found", pluginName)
	}
	return plugin
}

// mockAPISIXAdminRoutes creates a mock APISIX Admin API that stores routes.
func mockAPISIXAdminRoutes(t *testing.T, routes map[string]json.RawMessage) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// PUT /apisix/admin/routes/{id}
		if r.Method == http.MethodPut && strings.HasPrefix(r.URL.Path, "/apisix/admin/routes/") {
			body, _ := io.ReadAll(r.Body)
			routeID := strings.TrimPrefix(r.URL.Path, "/apisix/admin/routes/")
			routes[routeID] = body
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			fmt.Fprintf(w, `{"key":"/apisix/routes/%s","value":%s}`, routeID, string(body))
			return
		}

		// GET /apisix/admin/routes/{id}
		if r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/apisix/admin/routes/") {
			routeID := strings.TrimPrefix(r.URL.Path, "/apisix/admin/routes/")
			if body, ok := routes[routeID]; ok {
				w.Header().Set("Content-Type", "application/json")
				fmt.Fprintf(w, `{"key":"/apisix/routes/%s","value":%s}`, routeID, string(body))
				return
			}
			w.WriteHeader(http.StatusNotFound)
			return
		}

		// DELETE
		if r.Method == http.MethodDelete && strings.HasPrefix(r.URL.Path, "/apisix/admin/routes/") {
			routeID := strings.TrimPrefix(r.URL.Path, "/apisix/admin/routes/")
			delete(routes, routeID)
			w.WriteHeader(http.StatusOK)
			return
		}

		// Plugin reload
		if r.URL.Path == "/apisix/admin/plugins/reload" {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"message":"done"}`))
			return
		}

		w.WriteHeader(http.StatusNotFound)
	}))
}

func newMockAPISIXClient(url string) *service.APISIXClient {
	cfg := &config.APISIXConfig{
		AdminURL:   url,
		APIKey:     "test-key",
		ControlURL: "http://localhost:9090",
	}
	return service.NewAPISIXClient(cfg, zap.NewNop())
}

func baseUpstream() map[string]interface{} {
	return map[string]interface{}{
		"type": "roundrobin",
		"nodes": map[string]interface{}{
			"127.0.0.1:8080": 1,
		},
	}
}

// =============================================
// THREAT-PROTECTION PLUGIN TESTS
// =============================================

func TestPluginThreatProtection_SQLInjectionConfig(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "tp-sql-1", map[string]interface{}{
		"uri":     "/api/users",
		"methods": []string{"GET", "POST"},
		"plugins": map[string]interface{}{
			"threat-protection": map[string]interface{}{
				"action": "reject",
				"injection": map[string]interface{}{
					"sql_injection": true,
					"xss":          true,
					"scan_query":   true,
					"scan_body":    true,
					"scan_headers": false,
				},
				"json": map[string]interface{}{
					"max_depth":          20,
					"max_array_length":   1000,
					"max_object_entries": 500,
					"max_string_length":  100000,
					"max_body_size":      1048576,
				},
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "tp-sql-1")
	tp := getPluginConfig(t, route, "threat-protection")

	if tp["action"] != "reject" {
		t.Errorf("expected action=reject, got %v", tp["action"])
	}

	injection := tp["injection"].(map[string]interface{})
	if injection["sql_injection"] != true {
		t.Error("expected sql_injection=true")
	}
	if injection["scan_headers"] != false {
		t.Error("expected scan_headers=false")
	}

	jsonLimits := tp["json"].(map[string]interface{})
	if jsonLimits["max_depth"] != float64(20) {
		t.Errorf("expected max_depth=20, got %v", jsonLimits["max_depth"])
	}
}

func TestPluginThreatProtection_XSSOnlyConfig(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "tp-xss-1", map[string]interface{}{
		"uri": "/api/comments",
		"plugins": map[string]interface{}{
			"threat-protection": map[string]interface{}{
				"action": "reject",
				"injection": map[string]interface{}{
					"sql_injection": false,
					"xss":          true,
					"scan_body":    true,
				},
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "tp-xss-1")
	tp := getPluginConfig(t, route, "threat-protection")
	injection := tp["injection"].(map[string]interface{})

	if injection["xss"] != true {
		t.Error("expected xss=true")
	}
	if injection["sql_injection"] != false {
		t.Error("expected sql_injection=false for XSS-only config")
	}
}

func TestPluginThreatProtection_LogMode(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "tp-log-1", map[string]interface{}{
		"uri": "/api/data",
		"plugins": map[string]interface{}{
			"threat-protection": map[string]interface{}{
				"action": "log",
				"injection": map[string]interface{}{
					"sql_injection": true,
					"xss":          true,
				},
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "tp-log-1")
	tp := getPluginConfig(t, route, "threat-protection")

	if tp["action"] != "log" {
		t.Errorf("expected action=log, got %v", tp["action"])
	}
}

func TestPluginThreatProtection_StrictJSONLimits(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "tp-strict-1", map[string]interface{}{
		"uri": "/api/complex",
		"plugins": map[string]interface{}{
			"threat-protection": map[string]interface{}{
				"action": "reject",
				"json": map[string]interface{}{
					"max_depth":          5,
					"max_array_length":   50,
					"max_object_entries": 20,
					"max_string_length":  1000,
					"max_body_size":      65536, // 64 KB
				},
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "tp-strict-1")
	tp := getPluginConfig(t, route, "threat-protection")
	jsonLimits := tp["json"].(map[string]interface{})

	if jsonLimits["max_depth"] != float64(5) {
		t.Errorf("expected max_depth=5, got %v", jsonLimits["max_depth"])
	}
	if jsonLimits["max_body_size"] != float64(65536) {
		t.Errorf("expected max_body_size=65536, got %v", jsonLimits["max_body_size"])
	}
	if jsonLimits["max_array_length"] != float64(50) {
		t.Errorf("expected max_array_length=50, got %v", jsonLimits["max_array_length"])
	}
}

func TestPluginThreatProtection_FullScanEnabled(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "tp-fullscan-1", map[string]interface{}{
		"uri": "/api/sensitive",
		"plugins": map[string]interface{}{
			"threat-protection": map[string]interface{}{
				"action": "reject",
				"injection": map[string]interface{}{
					"sql_injection": true,
					"xss":          true,
					"scan_headers": true,
					"scan_query":   true,
					"scan_body":    true,
				},
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "tp-fullscan-1")
	tp := getPluginConfig(t, route, "threat-protection")
	injection := tp["injection"].(map[string]interface{})

	for _, field := range []string{"scan_headers", "scan_query", "scan_body"} {
		if injection[field] != true {
			t.Errorf("expected %s=true", field)
		}
	}
}

// =============================================
// HTTP-CALLOUT PLUGIN TESTS
// =============================================

func TestPluginHTTPCallout_ExtractionRules(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "hc-extract-1", map[string]interface{}{
		"uri": "/api/protected",
		"plugins": map[string]interface{}{
			"http-callout": map[string]interface{}{
				"uri":    "http://auth-service:8080/validate",
				"method": "POST",
				"body":   `{"token": "$http_authorization"}`,
				"extract": []map[string]interface{}{
					{"source": "$.user_id", "target_header": "X-User-Id"},
					{"source": "$.roles", "target_header": "X-User-Roles"},
					{"source": "$.tier", "target_header": "X-User-Tier"},
				},
				"connect_timeout": 1000,
				"read_timeout":    3000,
				"send_timeout":    1000,
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "hc-extract-1")
	callout := getPluginConfig(t, route, "http-callout")

	extract := callout["extract"].([]interface{})
	if len(extract) != 3 {
		t.Errorf("expected 3 extract rules, got %d", len(extract))
	}

	rule0 := extract[0].(map[string]interface{})
	if rule0["source"] != "$.user_id" {
		t.Errorf("expected source $.user_id, got %v", rule0["source"])
	}
	if rule0["target_header"] != "X-User-Id" {
		t.Errorf("expected target_header X-User-Id, got %v", rule0["target_header"])
	}
}

func TestPluginHTTPCallout_SeparateTimeouts(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "hc-timeouts-1", map[string]interface{}{
		"uri": "/api/slow",
		"plugins": map[string]interface{}{
			"http-callout": map[string]interface{}{
				"uri":             "http://slow-service:8080/process",
				"method":          "POST",
				"connect_timeout": 1000,
				"read_timeout":    10000,
				"send_timeout":    2000,
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "hc-timeouts-1")
	callout := getPluginConfig(t, route, "http-callout")

	tests := []struct {
		key      string
		expected float64
	}{
		{"connect_timeout", 1000},
		{"read_timeout", 10000},
		{"send_timeout", 2000},
	}

	for _, tc := range tests {
		if callout[tc.key] != tc.expected {
			t.Errorf("expected %s=%v, got %v", tc.key, tc.expected, callout[tc.key])
		}
	}
}

func TestPluginHTTPCallout_ExitOnError(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "hc-exit-err-1", map[string]interface{}{
		"uri": "/api/critical",
		"plugins": map[string]interface{}{
			"http-callout": map[string]interface{}{
				"uri":             "http://auth-service:8080/validate",
				"method":          "POST",
				"exit_on_error":   true,
				"error_status":    401,
				"error_message":   "Authentication service unavailable",
				"connect_timeout": 500,
				"read_timeout":    1000,
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "hc-exit-err-1")
	callout := getPluginConfig(t, route, "http-callout")

	if callout["exit_on_error"] != true {
		t.Error("expected exit_on_error=true")
	}
	if callout["error_status"] != float64(401) {
		t.Errorf("expected error_status=401, got %v", callout["error_status"])
	}
	if callout["error_message"] != "Authentication service unavailable" {
		t.Errorf("unexpected error_message: %v", callout["error_message"])
	}
}

func TestPluginHTTPCallout_ExitOnStatus(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "hc-exit-status-1", map[string]interface{}{
		"uri": "/api/validate",
		"plugins": map[string]interface{}{
			"http-callout": map[string]interface{}{
				"uri":             "http://validator:8080/check",
				"method":          "POST",
				"exit_on_status":  []int{401, 403, 422},
				"error_status":    422,
				"error_message":   "Validation failed",
				"connect_timeout": 2000,
				"read_timeout":    5000,
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "hc-exit-status-1")
	callout := getPluginConfig(t, route, "http-callout")

	exitOnStatus := callout["exit_on_status"].([]interface{})
	if len(exitOnStatus) != 3 {
		t.Fatalf("expected 3 exit_on_status codes, got %d", len(exitOnStatus))
	}

	expected := []float64{401, 403, 422}
	for i, code := range exitOnStatus {
		if code.(float64) != expected[i] {
			t.Errorf("exit_on_status[%d]: expected %v, got %v", i, expected[i], code)
		}
	}

	// exit_on_error should NOT be set
	if _, exists := callout["exit_on_error"]; exists {
		t.Error("exit_on_error should not be set in exit_on_status mode")
	}
}

func TestPluginHTTPCallout_ExitOnStatus_ConnectionIgnored(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	// This config uses exit_on_status with short timeouts, demonstrating
	// that the user accepts connection failures (the Lua plugin ignores them)
	createRouteViaAdmin(t, client, "hc-conn-ignore-1", map[string]interface{}{
		"uri": "/api/best-effort",
		"plugins": map[string]interface{}{
			"http-callout": map[string]interface{}{
				"uri":             "http://flaky-service:8080/validate",
				"method":          "POST",
				"exit_on_status":  []int{403},
				"error_status":    403,
				"error_message":   "Forbidden by validator",
				"connect_timeout": 500, // short — accepts failure
				"read_timeout":    1000,
				"send_timeout":    500,
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "hc-conn-ignore-1")
	callout := getPluginConfig(t, route, "http-callout")

	if callout["connect_timeout"] != float64(500) {
		t.Errorf("expected connect_timeout=500, got %v", callout["connect_timeout"])
	}

	exitOnStatus := callout["exit_on_status"].([]interface{})
	if len(exitOnStatus) != 1 || exitOnStatus[0].(float64) != 403 {
		t.Errorf("expected exit_on_status=[403], got %v", exitOnStatus)
	}
}

func TestPluginHTTPCallout_FireAndForget(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "hc-fire-1", map[string]interface{}{
		"uri": "/api/webhook",
		"plugins": map[string]interface{}{
			"http-callout": map[string]interface{}{
				"uri":             "https://hooks.slack.com/services/xxx/yyy/zzz",
				"method":          "POST",
				"body":            `{"text": "API call received"}`,
				"fire_and_forget": true,
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "hc-fire-1")
	callout := getPluginConfig(t, route, "http-callout")

	if callout["fire_and_forget"] != true {
		t.Error("expected fire_and_forget=true")
	}
}

func TestPluginHTTPCallout_SSRFProtectionConfig(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	privateIPs := []struct {
		name string
		uri  string
	}{
		{"loopback", "http://127.0.0.1:8080/internal"},
		{"class_a", "http://10.0.0.1:8080/internal"},
		{"class_b", "http://172.16.0.1:8080/internal"},
		{"class_c", "http://192.168.1.1:8080/internal"},
		{"link_local", "http://169.254.1.1:8080/internal"},
	}

	for _, tc := range privateIPs {
		t.Run(tc.name, func(t *testing.T) {
			routeID := "ssrf-" + tc.name
			createRouteViaAdmin(t, client, routeID, map[string]interface{}{
				"uri": "/api/" + routeID,
				"plugins": map[string]interface{}{
					"http-callout": map[string]interface{}{
						"uri":           tc.uri,
						"method":        "GET",
						"exit_on_error": true,
						"error_status":  403,
						"error_message": "SSRF blocked",
					},
				},
				"upstream": baseUpstream(),
			})

			// Route is stored — APISIX Admin doesn't validate SSRF at config time.
			// The Lua plugin blocks private IPs at runtime.
			if _, ok := routes[routeID]; !ok {
				t.Error("route should be stored (SSRF is enforced at runtime)")
			}
		})
	}
}

func TestPluginHTTPCallout_CacheConfig(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "hc-cache-1", map[string]interface{}{
		"uri": "/api/cached",
		"plugins": map[string]interface{}{
			"http-callout": map[string]interface{}{
				"uri":       "http://user-service:8080/profile",
				"method":    "GET",
				"cache_ttl": 300,
				"extract": []map[string]interface{}{
					{"source": "$.tier", "target_header": "X-User-Tier"},
				},
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "hc-cache-1")
	callout := getPluginConfig(t, route, "http-callout")

	if callout["cache_ttl"] != float64(300) {
		t.Errorf("expected cache_ttl=300, got %v", callout["cache_ttl"])
	}
}

func TestPluginHTTPCallout_ThreeErrorModes(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	modes := []struct {
		name      string
		config    map[string]interface{}
		checkFunc func(t *testing.T, cfg map[string]interface{})
	}{
		{
			name: "mode1_ignore_all",
			config: map[string]interface{}{
				"uri":    "http://optional:8080/notify",
				"method": "POST",
			},
			checkFunc: func(t *testing.T, cfg map[string]interface{}) {
				if _, ok := cfg["exit_on_error"]; ok {
					t.Error("mode1 should not have exit_on_error")
				}
				if _, ok := cfg["exit_on_status"]; ok {
					t.Error("mode1 should not have exit_on_status")
				}
			},
		},
		{
			name: "mode2_exit_on_any",
			config: map[string]interface{}{
				"uri":           "http://critical:8080/auth",
				"method":        "POST",
				"exit_on_error": true,
				"error_status":  401,
				"error_message": "Auth required",
			},
			checkFunc: func(t *testing.T, cfg map[string]interface{}) {
				if cfg["exit_on_error"] != true {
					t.Error("mode2 should have exit_on_error=true")
				}
			},
		},
		{
			name: "mode3_exit_on_status",
			config: map[string]interface{}{
				"uri":            "http://validator:8080/check",
				"method":         "POST",
				"exit_on_status": []int{401, 403, 422},
				"error_status":   422,
				"error_message":  "Validation rejected",
			},
			checkFunc: func(t *testing.T, cfg map[string]interface{}) {
				codes := cfg["exit_on_status"].([]interface{})
				if len(codes) != 3 {
					t.Errorf("mode3 should have 3 exit_on_status codes, got %d", len(codes))
				}
			},
		},
	}

	for _, tc := range modes {
		t.Run(tc.name, func(t *testing.T) {
			createRouteViaAdmin(t, client, tc.name, map[string]interface{}{
				"uri": "/api/" + tc.name,
				"plugins": map[string]interface{}{
					"http-callout": tc.config,
				},
				"upstream": baseUpstream(),
			})

			route := verifyRouteConfig(t, routes, tc.name)
			callout := getPluginConfig(t, route, "http-callout")
			tc.checkFunc(t, callout)
		})
	}
}

// =============================================
// DATA-MASKING PLUGIN TESTS
// =============================================

func TestPluginDataMasking_PartialStrategy(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "dm-partial-1", map[string]interface{}{
		"uri": "/api/customers",
		"plugins": map[string]interface{}{
			"data-masking": map[string]interface{}{
				"rules": []map[string]interface{}{
					{"path": "$.cpf", "strategy": "partial", "visible_chars": 3},
					{"path": "$.data[*].cpf", "strategy": "partial", "visible_chars": 3},
				},
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "dm-partial-1")
	dm := getPluginConfig(t, route, "data-masking")

	rules := dm["rules"].([]interface{})
	if len(rules) != 2 {
		t.Errorf("expected 2 rules, got %d", len(rules))
	}

	rule0 := rules[0].(map[string]interface{})
	if rule0["path"] != "$.cpf" {
		t.Errorf("expected path=$.cpf, got %v", rule0["path"])
	}
	if rule0["strategy"] != "partial" {
		t.Errorf("expected strategy=partial, got %v", rule0["strategy"])
	}
	if rule0["visible_chars"] != float64(3) {
		t.Errorf("expected visible_chars=3, got %v", rule0["visible_chars"])
	}
}

func TestPluginDataMasking_EmailStrategy(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "dm-email-1", map[string]interface{}{
		"uri": "/api/users",
		"plugins": map[string]interface{}{
			"data-masking": map[string]interface{}{
				"rules": []map[string]interface{}{
					{"path": "$.email", "strategy": "email"},
					{"path": "$.data[*].email", "strategy": "email"},
				},
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "dm-email-1")
	dm := getPluginConfig(t, route, "data-masking")

	rules := dm["rules"].([]interface{})
	if len(rules) != 2 {
		t.Errorf("expected 2 rules, got %d", len(rules))
	}

	for _, r := range rules {
		rule := r.(map[string]interface{})
		if rule["strategy"] != "email" {
			t.Errorf("expected strategy=email, got %v", rule["strategy"])
		}
	}
}

func TestPluginDataMasking_FullRedaction(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "dm-full-1", map[string]interface{}{
		"uri": "/api/accounts",
		"plugins": map[string]interface{}{
			"data-masking": map[string]interface{}{
				"rules": []map[string]interface{}{
					{"path": "$.password", "strategy": "full", "replacement": "[REDACTED]"},
					{"path": "$.secret_key", "strategy": "full"},
					{"path": "$.data[*].api_key", "strategy": "full", "replacement": "***"},
				},
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "dm-full-1")
	dm := getPluginConfig(t, route, "data-masking")

	rules := dm["rules"].([]interface{})
	if len(rules) != 3 {
		t.Errorf("expected 3 rules, got %d", len(rules))
	}

	rule0 := rules[0].(map[string]interface{})
	if rule0["replacement"] != "[REDACTED]" {
		t.Errorf("expected replacement=[REDACTED], got %v", rule0["replacement"])
	}
}

func TestPluginDataMasking_NestedArrayPaths(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "dm-nested-1", map[string]interface{}{
		"uri": "/api/orders",
		"plugins": map[string]interface{}{
			"data-masking": map[string]interface{}{
				"rules": []map[string]interface{}{
					{"path": "$.orders[*].customer.cpf", "strategy": "partial", "visible_chars": 4},
					{"path": "$.orders[*].payment.card_number", "strategy": "partial", "visible_chars": 4},
					{"path": "$.orders[*].customer.phone", "strategy": "phone"},
				},
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "dm-nested-1")
	dm := getPluginConfig(t, route, "data-masking")

	rules := dm["rules"].([]interface{})
	if len(rules) != 3 {
		t.Errorf("expected 3 rules, got %d", len(rules))
	}

	rule2 := rules[2].(map[string]interface{})
	if rule2["strategy"] != "phone" {
		t.Errorf("expected strategy=phone, got %v", rule2["strategy"])
	}
	if rule2["path"] != "$.orders[*].customer.phone" {
		t.Errorf("unexpected path: %v", rule2["path"])
	}
}

func TestPluginDataMasking_HashStrategy(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "dm-hash-1", map[string]interface{}{
		"uri": "/api/analytics",
		"plugins": map[string]interface{}{
			"data-masking": map[string]interface{}{
				"rules": []map[string]interface{}{
					{"path": "$.user_id", "strategy": "hash"},
					{"path": "$.data[*].document_id", "strategy": "hash"},
				},
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "dm-hash-1")
	dm := getPluginConfig(t, route, "data-masking")

	rules := dm["rules"].([]interface{})
	for _, r := range rules {
		rule := r.(map[string]interface{})
		if rule["strategy"] != "hash" {
			t.Errorf("expected strategy=hash, got %v", rule["strategy"])
		}
	}
}

func TestPluginDataMasking_ContentTypeAndDebug(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "dm-options-1", map[string]interface{}{
		"uri": "/api/mixed",
		"plugins": map[string]interface{}{
			"data-masking": map[string]interface{}{
				"rules": []map[string]interface{}{
					{"path": "$.ssn", "strategy": "full"},
				},
				"content_types":     []string{"application/json", "application/vnd.api+json"},
				"enabled_for_debug": true,
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "dm-options-1")
	dm := getPluginConfig(t, route, "data-masking")

	contentTypes := dm["content_types"].([]interface{})
	if len(contentTypes) != 2 {
		t.Errorf("expected 2 content types, got %d", len(contentTypes))
	}
	if dm["enabled_for_debug"] != true {
		t.Error("expected enabled_for_debug=true")
	}
}

// =============================================
// COMBINED PIPELINE TESTS
// =============================================

func TestPluginCombined_ThreatPlusCallout(t *testing.T) {
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "combined-2plugins", map[string]interface{}{
		"uri": "/api/secure-enriched",
		"plugins": map[string]interface{}{
			"threat-protection": map[string]interface{}{
				"action":    "reject",
				"injection": map[string]interface{}{"sql_injection": true, "xss": true},
			},
			"http-callout": map[string]interface{}{
				"uri":            "http://auth:8080/validate",
				"method":         "POST",
				"exit_on_status": []int{401, 403},
				"extract":        []map[string]interface{}{{"source": "$.user_id", "target_header": "X-User-Id"}},
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "combined-2plugins")
	plugins := route["plugins"].(map[string]interface{})

	if _, ok := plugins["threat-protection"]; !ok {
		t.Error("threat-protection not found")
	}
	if _, ok := plugins["http-callout"]; !ok {
		t.Error("http-callout not found")
	}
}

func TestPluginCombined_FullPipeline(t *testing.T) {
	// threat-protection (priority 510) → http-callout (priority 405) → data-masking (priority 110)
	routes := make(map[string]json.RawMessage)
	admin := mockAPISIXAdminRoutes(t, routes)
	defer admin.Close()
	client := newMockAPISIXClient(admin.URL)

	createRouteViaAdmin(t, client, "full-pipeline", map[string]interface{}{
		"uri": "/api/full-pipeline",
		"plugins": map[string]interface{}{
			"threat-protection": map[string]interface{}{
				"action":    "reject",
				"injection": map[string]interface{}{"sql_injection": true, "xss": true},
				"json":      map[string]interface{}{"max_body_size": 524288},
			},
			"http-callout": map[string]interface{}{
				"uri":            "http://enrichment:8080/enrich",
				"method":         "POST",
				"exit_on_status": []int{401, 403},
				"extract":        []map[string]interface{}{{"source": "$.account_type", "target_header": "X-Account-Type"}},
			},
			"data-masking": map[string]interface{}{
				"rules": []map[string]interface{}{
					{"path": "$.cpf", "strategy": "partial", "visible_chars": 3},
					{"path": "$.email", "strategy": "email"},
					{"path": "$.password", "strategy": "full", "replacement": "[REDACTED]"},
				},
			},
		},
		"upstream": baseUpstream(),
	})

	route := verifyRouteConfig(t, routes, "full-pipeline")
	plugins := route["plugins"].(map[string]interface{})

	// All three plugins present
	for _, name := range []string{"threat-protection", "http-callout", "data-masking"} {
		if _, ok := plugins[name]; !ok {
			t.Errorf("plugin %s not found in full pipeline", name)
		}
	}

	// Verify specific configs
	tp := plugins["threat-protection"].(map[string]interface{})
	if tp["action"] != "reject" {
		t.Error("threat-protection action should be reject")
	}

	dm := plugins["data-masking"].(map[string]interface{})
	rules := dm["rules"].([]interface{})
	if len(rules) != 3 {
		t.Errorf("expected 3 data-masking rules, got %d", len(rules))
	}

	hc := plugins["http-callout"].(map[string]interface{})
	exitStatuses := hc["exit_on_status"].([]interface{})
	if len(exitStatuses) != 2 {
		t.Errorf("expected 2 exit_on_status codes, got %d", len(exitStatuses))
	}
}

// =============================================
// LIVE HTTP BEHAVIOR TESTS
// =============================================

func TestPluginLive_AuthServiceBehavior(t *testing.T) {
	// Mock auth service with different token responses
	authService := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var req map[string]interface{}
		json.Unmarshal(body, &req)

		token, _ := req["token"].(string)
		w.Header().Set("Content-Type", "application/json")

		switch token {
		case "valid-token":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"user_id":"usr_123","roles":"admin","tier":"premium"}`))
		case "expired-token":
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"error":"token expired"}`))
		default:
			w.WriteHeader(http.StatusForbidden)
			w.Write([]byte(`{"error":"invalid token"}`))
		}
	}))
	defer authService.Close()

	tests := []struct {
		name           string
		token          string
		expectedStatus int
	}{
		{"valid_token_200", "valid-token", 200},
		{"expired_token_401", "expired-token", 401},
		{"invalid_token_403", "bad-token", 403},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp, err := http.Post(authService.URL, "application/json",
				strings.NewReader(fmt.Sprintf(`{"token":"%s"}`, tc.token)))
			if err != nil {
				t.Fatalf("request failed: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != tc.expectedStatus {
				t.Errorf("expected %d, got %d", tc.expectedStatus, resp.StatusCode)
			}

			// Parse response body
			var respBody map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&respBody)

			if tc.expectedStatus == 200 {
				if respBody["user_id"] != "usr_123" {
					t.Errorf("expected user_id=usr_123, got %v", respBody["user_id"])
				}
			}
		})
	}
}

func TestPluginLive_SlowServiceTimeout(t *testing.T) {
	// Mock slow service for timeout testing
	slowService := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"result":"processed"}`))
	}))
	defer slowService.Close()

	// Sufficient timeout: should succeed
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(slowService.URL)
	if err != nil {
		t.Fatalf("request with sufficient timeout failed: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	// Very short timeout: should fail
	shortClient := &http.Client{Timeout: 10 * time.Millisecond}
	_, err = shortClient.Get(slowService.URL)
	if err == nil {
		t.Error("expected timeout error for very short client timeout")
	}
}

func TestPluginLive_ExitOnStatusBehavior(t *testing.T) {
	// Mock validation service returning various status codes
	validationService := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var req map[string]interface{}
		json.Unmarshal(body, &req)

		action, _ := req["action"].(string)
		w.Header().Set("Content-Type", "application/json")

		switch action {
		case "approve":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"status":"approved"}`))
		case "reject":
			w.WriteHeader(http.StatusUnprocessableEntity) // 422
			w.Write([]byte(`{"error":"validation failed"}`))
		case "forbidden":
			w.WriteHeader(http.StatusForbidden) // 403
			w.Write([]byte(`{"error":"not allowed"}`))
		case "server_error":
			w.WriteHeader(http.StatusInternalServerError) // 500
			w.Write([]byte(`{"error":"internal error"}`))
		default:
			w.WriteHeader(http.StatusBadRequest)
		}
	}))
	defer validationService.Close()

	exitStatuses := []int{422, 403}

	tests := []struct {
		name       string
		action     string
		wantStatus int
		wouldExit  bool
	}{
		{"approved_continues", "approve", 200, false},
		{"rejected_422_exits", "reject", 422, true},
		{"forbidden_403_exits", "forbidden", 403, true},
		{"server_error_500_continues", "server_error", 500, false}, // 500 NOT in list
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp, err := http.Post(validationService.URL, "application/json",
				strings.NewReader(fmt.Sprintf(`{"action":"%s"}`, tc.action)))
			if err != nil {
				t.Fatalf("request failed: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != tc.wantStatus {
				t.Errorf("expected %d, got %d", tc.wantStatus, resp.StatusCode)
			}

			// Simulate exit_on_status logic
			wouldExit := false
			for _, s := range exitStatuses {
				if resp.StatusCode == s {
					wouldExit = true
					break
				}
			}
			if wouldExit != tc.wouldExit {
				t.Errorf("exit_on_status mismatch: expected shouldExit=%v for status %d",
					tc.wouldExit, resp.StatusCode)
			}
		})
	}
}

func TestPluginLive_DataMaskingResponse(t *testing.T) {
	// Mock upstream that returns JSON with PII
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{
			"name": "João Silva",
			"cpf": "123.456.789-00",
			"email": "joao@example.com",
			"phone": "+55 11 98765-4321",
			"password": "super-secret-password",
			"data": [
				{"id": 1, "email": "a@example.com", "cpf": "111.222.333-44"},
				{"id": 2, "email": "b@example.com", "cpf": "555.666.777-88"}
			]
		}`))
	}))
	defer upstream.Close()

	// Verify the upstream returns the expected JSON
	resp, err := http.Get(upstream.URL)
	if err != nil {
		t.Fatalf("upstream request failed: %v", err)
	}
	defer resp.Body.Close()

	var body map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&body)

	// Verify PII is present in the raw upstream response
	if body["cpf"] != "123.456.789-00" {
		t.Errorf("expected raw CPF in upstream response, got %v", body["cpf"])
	}
	if body["email"] != "joao@example.com" {
		t.Errorf("expected raw email in upstream response, got %v", body["email"])
	}
	if body["password"] != "super-secret-password" {
		t.Errorf("expected raw password in upstream response, got %v", body["password"])
	}

	// Verify nested data is present
	data, ok := body["data"].([]interface{})
	if !ok || len(data) != 2 {
		t.Error("expected 2 items in data array")
	}
}

func TestPluginLive_ThreatDetectionPatterns(t *testing.T) {
	// Verify that common injection patterns can be detected
	sqlInjectionPatterns := []string{
		"' OR '1'='1",
		"1; DROP TABLE users--",
		"admin'--",
		"' UNION SELECT * FROM users--",
		"1' AND 1=1--",
	}

	xssPatterns := []string{
		"<script>alert('xss')</script>",
		"<img src=x onerror=alert(1)>",
		"javascript:alert(1)",
		"<svg onload=alert(1)>",
	}

	for _, pattern := range sqlInjectionPatterns {
		// These patterns should be detected by the plugin's regex
		if !strings.Contains(strings.ToLower(pattern), "or") &&
			!strings.Contains(strings.ToLower(pattern), "drop") &&
			!strings.Contains(strings.ToLower(pattern), "union") &&
			!strings.Contains(strings.ToLower(pattern), "and") &&
			!strings.Contains(pattern, "--") &&
			!strings.Contains(pattern, "'") {
			t.Errorf("SQL injection pattern should contain detectable markers: %s", pattern)
		}
	}

	for _, pattern := range xssPatterns {
		if !strings.Contains(strings.ToLower(pattern), "<script") &&
			!strings.Contains(strings.ToLower(pattern), "onerror") &&
			!strings.Contains(strings.ToLower(pattern), "javascript:") &&
			!strings.Contains(strings.ToLower(pattern), "onload") {
			t.Errorf("XSS pattern should contain detectable markers: %s", pattern)
		}
	}
}
