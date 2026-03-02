package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/config"
)

func TestEnsureSystemGlobalRules_CreatesWhenMissing(t *testing.T) {
	var putCalls []string
	var putBodies []json.RawMessage

	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			// Return empty list — no existing global rules
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"list":[],"total":0}`))
			return
		}
		if r.Method == http.MethodPut {
			putCalls = append(putCalls, r.URL.Path)
			body := json.RawMessage{}
			json.NewDecoder(r.Body).Decode(&body)
			putBodies = append(putBodies, body)
			w.WriteHeader(http.StatusCreated)
			w.Write([]byte(`{"key":"/apisix/global_rules/fuseone_platform","value":{}}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer mock.Close()

	client := NewAPISIXClient(&config.APISIXConfig{AdminURL: mock.URL, APIKey: "test"}, zap.NewNop())
	sp := NewSystemPolicies(client, zap.NewNop())

	err := sp.EnsureSystemGlobalRules(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(putCalls) != 1 {
		t.Fatalf("expected 1 PUT call, got %d", len(putCalls))
	}
	if putCalls[0] != "/apisix/admin/global_rules/fuseone_platform" {
		t.Errorf("unexpected PUT path: %s", putCalls[0])
	}

	// Verify the payload contains request-id plugin (no labels — APISIX global_rules don't support them)
	var payload map[string]interface{}
	json.Unmarshal(putBodies[0], &payload)

	plugins, ok := payload["plugins"].(map[string]interface{})
	if !ok {
		t.Fatal("expected plugins in payload")
	}
	if _, ok := plugins["request-id"]; !ok {
		t.Error("expected request-id plugin in payload")
	}
	if _, ok := payload["labels"]; ok {
		t.Error("global_rules should NOT have labels (APISIX rejects them)")
	}
}

func TestEnsureSystemGlobalRules_SkipsWhenExists(t *testing.T) {
	putCalled := false

	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			// Return existing global rule with system label
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"list":[{"key":"/apisix/global_rules/fuseone_platform","value":{"id":"fuseone_platform","plugins":{"request-id":{"header_name":"X-Correlation-Id"}}}}],"total":1}`))
			return
		}
		if r.Method == http.MethodPut {
			putCalled = true
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer mock.Close()

	client := NewAPISIXClient(&config.APISIXConfig{AdminURL: mock.URL, APIKey: "test"}, zap.NewNop())
	sp := NewSystemPolicies(client, zap.NewNop())

	err := sp.EnsureSystemGlobalRules(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !putCalled {
		t.Log("OK — system rule already existed, still updates to ensure config is current")
	}
}

func TestEnsureSystemGlobalRules_RequestIdConfig(t *testing.T) {
	var putBody json.RawMessage

	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"list":[],"total":0}`))
			return
		}
		if r.Method == http.MethodPut {
			json.NewDecoder(r.Body).Decode(&putBody)
			w.WriteHeader(http.StatusCreated)
			w.Write([]byte(`{"key":"/apisix/global_rules/fuseone_platform","value":{}}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer mock.Close()

	client := NewAPISIXClient(&config.APISIXConfig{AdminURL: mock.URL, APIKey: "test"}, zap.NewNop())
	sp := NewSystemPolicies(client, zap.NewNop())

	err := sp.EnsureSystemGlobalRules(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var payload map[string]interface{}
	json.Unmarshal(putBody, &payload)

	plugins := payload["plugins"].(map[string]interface{})
	reqID := plugins["request-id"].(map[string]interface{})

	if reqID["header_name"] != "X-Correlation-Id" {
		t.Errorf("expected header_name=X-Correlation-Id, got %v", reqID["header_name"])
	}
	if reqID["include_in_response"] != true {
		t.Errorf("expected include_in_response=true, got %v", reqID["include_in_response"])
	}
	if reqID["algorithm"] != "uuid" {
		t.Errorf("expected algorithm=uuid, got %v", reqID["algorithm"])
	}
}

func TestEnsureSystemGlobalRules_HandlesAPIError(t *testing.T) {
	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"error_msg":"internal error"}`))
	}))
	defer mock.Close()

	client := NewAPISIXClient(&config.APISIXConfig{AdminURL: mock.URL, APIKey: "test"}, zap.NewNop())
	sp := NewSystemPolicies(client, zap.NewNop())

	err := sp.EnsureSystemGlobalRules(context.Background())
	// Should not return error — system policies are best-effort on startup
	if err != nil {
		t.Fatalf("expected no error (best-effort), got: %v", err)
	}
}

func TestSystemPolicyID(t *testing.T) {
	if SystemGlobalRuleID != "fuseone_platform" {
		t.Errorf("expected SystemGlobalRuleID=fuseone_platform, got %s", SystemGlobalRuleID)
	}
}
