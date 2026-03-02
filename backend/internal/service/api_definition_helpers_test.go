package service

import (
	"testing"
)

// --- stripConsumerCredentials ---

func TestStripConsumerCredentials_KeyAuth(t *testing.T) {
	config := map[string]interface{}{
		"key":              "my-secret-key",
		"hide_credentials": true,
		"header":           "apikey",
	}

	result := stripConsumerCredentials("key-auth", config)

	if _, exists := result["key"]; exists {
		t.Error("expected 'key' to be stripped from route config")
	}
	if result["hide_credentials"] != true {
		t.Error("expected 'hide_credentials' to remain")
	}
	if result["header"] != "apikey" {
		t.Error("expected 'header' to remain")
	}
}

func TestStripConsumerCredentials_BasicAuth(t *testing.T) {
	config := map[string]interface{}{
		"username":         "admin",
		"password":         "secret",
		"hide_credentials": false,
	}

	result := stripConsumerCredentials("basic-auth", config)

	if _, exists := result["username"]; exists {
		t.Error("expected 'username' to be stripped")
	}
	if _, exists := result["password"]; exists {
		t.Error("expected 'password' to be stripped")
	}
	if result["hide_credentials"] != false {
		t.Error("expected 'hide_credentials' to remain")
	}
}

func TestStripConsumerCredentials_JwtAuth(t *testing.T) {
	config := map[string]interface{}{
		"key":              "jwt-key-id",
		"secret":           "jwt-secret",
		"algorithm":        "HS256",
		"hide_credentials": true,
		"header":           "Authorization",
	}

	result := stripConsumerCredentials("jwt-auth", config)

	for _, field := range []string{"key", "secret", "algorithm"} {
		if _, exists := result[field]; exists {
			t.Errorf("expected '%s' to be stripped", field)
		}
	}
	if result["hide_credentials"] != true {
		t.Error("expected 'hide_credentials' to remain")
	}
	if result["header"] != "Authorization" {
		t.Error("expected 'header' to remain")
	}
}

func TestStripConsumerCredentials_HmacAuth(t *testing.T) {
	config := map[string]interface{}{
		"key_id":           "my-hmac-id",
		"secret_key":       "my-hmac-secret",
		"hide_credentials": true,
	}

	result := stripConsumerCredentials("hmac-auth", config)

	if _, exists := result["key_id"]; exists {
		t.Error("expected 'key_id' to be stripped")
	}
	if _, exists := result["secret_key"]; exists {
		t.Error("expected 'secret_key' to be stripped")
	}
	if result["hide_credentials"] != true {
		t.Error("expected 'hide_credentials' to remain")
	}
}

func TestStripConsumerCredentials_NonAuthPlugin(t *testing.T) {
	config := map[string]interface{}{
		"allow": []interface{}{"192.168.1.0/24"},
	}

	result := stripConsumerCredentials("ip-restriction", config)

	// Non-auth plugins should be returned unchanged
	if result["allow"] == nil {
		t.Error("expected config to pass through unchanged for non-auth plugin")
	}
}

func TestStripConsumerCredentials_NilConfig(t *testing.T) {
	result := stripConsumerCredentials("key-auth", nil)
	if result != nil {
		t.Error("expected nil for nil config")
	}
}

func TestStripConsumerCredentials_DoesNotMutateOriginal(t *testing.T) {
	original := map[string]interface{}{
		"key":              "my-key",
		"hide_credentials": true,
	}

	stripConsumerCredentials("key-auth", original)

	// Original should still have "key"
	if _, exists := original["key"]; !exists {
		t.Error("stripConsumerCredentials should not mutate the original map")
	}
}

// --- extractConsumerCredentials ---

func TestExtractConsumerCredentials_KeyAuth(t *testing.T) {
	config := map[string]interface{}{
		"key":              "my-api-key",
		"hide_credentials": true,
		"header":           "apikey",
	}

	creds := extractConsumerCredentials("key-auth", config)

	if creds["key"] != "my-api-key" {
		t.Errorf("expected key=my-api-key, got %v", creds["key"])
	}
	if _, exists := creds["hide_credentials"]; exists {
		t.Error("expected 'hide_credentials' NOT to be in credentials")
	}
	if _, exists := creds["header"]; exists {
		t.Error("expected 'header' NOT to be in credentials")
	}
}

func TestExtractConsumerCredentials_BasicAuth(t *testing.T) {
	config := map[string]interface{}{
		"username": "admin",
		"password": "secret",
	}

	creds := extractConsumerCredentials("basic-auth", config)

	if creds["username"] != "admin" {
		t.Errorf("expected username=admin, got %v", creds["username"])
	}
	if creds["password"] != "secret" {
		t.Errorf("expected password=secret, got %v", creds["password"])
	}
}

func TestExtractConsumerCredentials_EmptyKey(t *testing.T) {
	config := map[string]interface{}{
		"key":              "",
		"hide_credentials": true,
	}

	creds := extractConsumerCredentials("key-auth", config)

	// Empty string keys should be skipped
	if creds != nil {
		t.Errorf("expected nil for empty credential value, got %v", creds)
	}
}

func TestExtractConsumerCredentials_NoCreds(t *testing.T) {
	config := map[string]interface{}{
		"hide_credentials": true,
	}

	creds := extractConsumerCredentials("key-auth", config)

	if creds != nil {
		t.Errorf("expected nil when no credential fields present, got %v", creds)
	}
}

func TestExtractConsumerCredentials_NonAuthPlugin(t *testing.T) {
	config := map[string]interface{}{
		"allow": []interface{}{"192.168.1.0/24"},
	}

	creds := extractConsumerCredentials("ip-restriction", config)

	if creds != nil {
		t.Error("expected nil for non-auth plugin")
	}
}

func TestExtractConsumerCredentials_NilConfig(t *testing.T) {
	creds := extractConsumerCredentials("key-auth", nil)
	if creds != nil {
		t.Error("expected nil for nil config")
	}
}

// --- resolveVersionedURI ---

func TestResolveVersionedURI(t *testing.T) {
	tests := []struct {
		name        string
		contextPath string
		version     string
		flowURI     string
		want        string
	}{
		{"basic", "/payments", "v1", "/charge", "/v1/payments/charge"},
		{"no context path", "", "v1", "/users", "/v1/users"},
		{"no flow URI", "/payments", "v1", "", "/v1/payments"},
		{"root flow URI", "/payments", "v1", "/", "/v1/payments"},
		{"all empty", "", "v1", "", "/v1"},
		{"v2", "/orders", "v2", "/list", "/v2/orders/list"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := resolveVersionedURI(tt.contextPath, tt.version, tt.flowURI)
			if got != tt.want {
				t.Errorf("resolveVersionedURI(%q, %q, %q) = %q, want %q",
					tt.contextPath, tt.version, tt.flowURI, got, tt.want)
			}
		})
	}
}

// --- resolveBaseURI ---

func TestResolveBaseURI(t *testing.T) {
	tests := []struct {
		name        string
		contextPath string
		flowURI     string
		want        string
	}{
		{"basic", "/payments", "/charge", "/payments/charge"},
		{"no context path", "", "/users", "/users"},
		{"no flow URI", "/payments", "", "/payments"},
		{"root flow URI", "/payments", "/", "/payments"},
		{"all empty", "", "", "/"},
		{"just root", "", "/", "/"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := resolveBaseURI(tt.contextPath, tt.flowURI)
			if got != tt.want {
				t.Errorf("resolveBaseURI(%q, %q) = %q, want %q",
					tt.contextPath, tt.flowURI, got, tt.want)
			}
		})
	}
}

// --- buildContextPathRewrite ---

func TestBuildContextPathRewrite_BasicPath(t *testing.T) {
	result := buildContextPathRewrite("/payments")

	regexURI, ok := result["regex_uri"].([]string)
	if !ok || len(regexURI) != 2 {
		t.Fatalf("expected regex_uri with 2 elements, got %v", result["regex_uri"])
	}
	if regexURI[0] != "^/payments(?:/(.*))?$" {
		t.Errorf("expected pattern ^/payments(?:/(.*))?$, got %s", regexURI[0])
	}
	if regexURI[1] != "/$1" {
		t.Errorf("expected replacement /$1, got %s", regexURI[1])
	}
}

func TestBuildContextPathRewrite_NestedPath(t *testing.T) {
	result := buildContextPathRewrite("/api/v1/payments")

	regexURI := result["regex_uri"].([]string)
	if regexURI[0] != "^/api/v1/payments(?:/(.*))?$" {
		t.Errorf("expected pattern ^/api/v1/payments(?:/(.*))?$, got %s", regexURI[0])
	}
}

func TestBuildContextPathRewrite_EmptyPath(t *testing.T) {
	result := buildContextPathRewrite("")
	if result != nil {
		t.Error("expected nil for empty context path")
	}
}

func TestBuildContextPathRewrite_RootPath(t *testing.T) {
	result := buildContextPathRewrite("/")
	if result != nil {
		t.Error("expected nil for root context path — nothing to strip")
	}
}

func TestBuildContextPathRewrite_PreservesExactMatch(t *testing.T) {
	// A request to exactly /payments (no trailing path) should get / on upstream
	result := buildContextPathRewrite("/payments")

	regexURI := result["regex_uri"].([]string)
	// Pattern must also match /payments with no trailing path via optional group
	if regexURI[0] != "^/payments(?:/(.*))?$" {
		t.Errorf("unexpected pattern: %s", regexURI[0])
	}
}

func TestBuildContextPathRewrite_DoesNotConflictWithExistingPlugins(t *testing.T) {
	// buildContextPathRewrite should return only proxy-rewrite config
	result := buildContextPathRewrite("/orders")

	if len(result) != 1 {
		t.Errorf("expected exactly 1 key (regex_uri), got %d keys: %v", len(result), result)
	}
	if _, ok := result["regex_uri"]; !ok {
		t.Error("expected regex_uri key in result")
	}
}

// --- injectProxyRewrite ---

func TestInjectProxyRewrite_NewPlugin(t *testing.T) {
	plugins := map[string]interface{}{
		"key-auth": map[string]interface{}{},
	}

	injectProxyRewrite(plugins, "/payments")

	pw, ok := plugins["proxy-rewrite"]
	if !ok {
		t.Fatal("expected proxy-rewrite plugin to be injected")
	}

	pwMap := pw.(map[string]interface{})
	regexURI := pwMap["regex_uri"].([]string)
	if regexURI[0] != "^/payments(?:/(.*))?$" {
		t.Errorf("unexpected pattern: %s", regexURI[0])
	}
}

func TestInjectProxyRewrite_MergesWithExisting(t *testing.T) {
	plugins := map[string]interface{}{
		"proxy-rewrite": map[string]interface{}{
			"host": "internal.example.com",
		},
	}

	injectProxyRewrite(plugins, "/payments")

	pwMap := plugins["proxy-rewrite"].(map[string]interface{})
	// Should have both the existing host and the new regex_uri
	if pwMap["host"] != "internal.example.com" {
		t.Error("expected existing 'host' config to be preserved")
	}
	if _, ok := pwMap["regex_uri"]; !ok {
		t.Error("expected regex_uri to be added to existing proxy-rewrite")
	}
}

func TestInjectProxyRewrite_EmptyContextPath(t *testing.T) {
	plugins := map[string]interface{}{}

	injectProxyRewrite(plugins, "")

	if _, ok := plugins["proxy-rewrite"]; ok {
		t.Error("should not inject proxy-rewrite for empty context path")
	}
}

func TestInjectProxyRewrite_NilPlugins(t *testing.T) {
	// Should not panic
	injectProxyRewrite(nil, "/payments")
}

// --- sanitizeConsumerUsername ---

func TestSanitizeConsumerUsername(t *testing.T) {
	tests := []struct {
		name     string
		apiName  string
		flowName string
		want     string
	}{
		{"simple", "Teste", "Default Flow", "teste"},
		{"with flow", "My API", "Auth Flow", "my-api-auth-flow"},
		{"special chars", "API@v2!", "Flow #1", "apiv2-flow-1"},
		{"unicode", "Pagamento Único", "Default Flow", "pagamento-nico"},
		{"multiple spaces", "My   API", "Default Flow", "my-api"},
		{"hyphens collapse", "My--API", "Default Flow", "my-api"},
		{"trailing special", "API!", "Default Flow", "api"},
		{"empty flow treated as default", "Test", "", "test"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sanitizeConsumerUsername(tt.apiName, tt.flowName)
			if got != tt.want {
				t.Errorf("sanitizeConsumerUsername(%q, %q) = %q, want %q",
					tt.apiName, tt.flowName, got, tt.want)
			}
		})
	}
}
