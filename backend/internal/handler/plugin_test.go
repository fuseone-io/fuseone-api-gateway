package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/fuseone/api-gateway/internal/config"
	"github.com/fuseone/api-gateway/internal/service"
	"go.uber.org/zap"
)

func setupPluginTest(adminHandler http.HandlerFunc) (*PluginHandler, *httptest.Server) {
	adminServer := httptest.NewServer(adminHandler)

	cfg := &config.APISIXConfig{
		AdminURL:   adminServer.URL,
		APIKey:     "test-key",
		ControlURL: "http://localhost:9090",
	}
	logger := zap.NewNop()
	client := service.NewAPISIXClient(cfg, logger)

	handler := NewPluginHandler(client, nil)
	return handler, adminServer
}

func TestReloadPlugins_Success(t *testing.T) {
	handler, server := setupPluginTest(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/apisix/admin/plugins/reload" {
			t.Errorf("expected path /apisix/admin/plugins/reload, got %s", r.URL.Path)
		}
		if r.Method != http.MethodPut {
			t.Errorf("expected PUT, got %s", r.Method)
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"message":"done"}`))
	})
	defer server.Close()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("PUT", "/api/apisix/plugins/reload", nil)

	handler.ReloadPlugins(c)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Data struct {
			Message string `json:"message"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if resp.Data.Message != "Plugins reloaded successfully" {
		t.Errorf("expected success message, got %s", resp.Data.Message)
	}
}

func TestReloadPlugins_APISIXError(t *testing.T) {
	handler, server := setupPluginTest(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte(`{"error_msg":"service unavailable"}`))
	})
	defer server.Close()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("PUT", "/api/apisix/plugins/reload", nil)

	handler.ReloadPlugins(c)

	if w.Code != http.StatusBadGateway {
		t.Errorf("expected 502, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Error.Code != "APISIX_ERROR" {
		t.Errorf("expected error code APISIX_ERROR, got %s", resp.Error.Code)
	}
}

func TestReloadPlugins_ConnectionRefused(t *testing.T) {
	cfg := &config.APISIXConfig{
		AdminURL:   "http://localhost:1",
		APIKey:     "test-key",
		ControlURL: "http://localhost:9090",
	}
	logger := zap.NewNop()
	client := service.NewAPISIXClient(cfg, logger)
	handler := NewPluginHandler(client, nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("PUT", "/api/apisix/plugins/reload", nil)

	handler.ReloadPlugins(c)

	if w.Code != http.StatusBadGateway {
		t.Errorf("expected 502 for connection error, got %d", w.Code)
	}
}

func TestListPlugins_Success(t *testing.T) {
	handler, server := setupPluginTest(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/apisix/admin/plugins/list" {
			t.Errorf("expected path /apisix/admin/plugins/list, got %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`["key-auth","http-callout","data-masking","threat-protection"]`))
	})
	defer server.Close()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/api/apisix/plugins", nil)

	handler.ListPlugins(c)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}
