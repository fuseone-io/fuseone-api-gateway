package service

import (
	"context"
	"testing"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/google/uuid"
)

// fakeSecretRepo implements SecretLookup for testing.
type fakeSecretRepo struct {
	secrets map[string][]byte // name → encrypted value
}

func (f *fakeSecretRepo) GetByName(_ context.Context, name string) (*model.Secret, []byte, error) {
	enc, ok := f.secrets[name]
	if !ok {
		return nil, nil, nil
	}
	return &model.Secret{ID: uuid.New(), Name: name}, enc, nil
}

func newTestResolver(secrets map[string]string) *SecretResolver {
	crypto := NewCryptoService("test-passphrase")

	encrypted := make(map[string][]byte, len(secrets))
	for name, plaintext := range secrets {
		enc, _ := crypto.Encrypt([]byte(plaintext))
		encrypted[name] = enc
	}

	return &SecretResolver{repo: &fakeSecretRepo{secrets: encrypted}, crypto: crypto}
}

func TestResolveConfig_PlainValues(t *testing.T) {
	r := newTestResolver(nil)

	config := map[string]interface{}{
		"host": "localhost",
		"port": float64(8080),
	}

	resolved, err := r.ResolveConfig(context.Background(), config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resolved["host"] != "localhost" {
		t.Errorf("expected host=localhost, got %v", resolved["host"])
	}
	if resolved["port"] != float64(8080) {
		t.Errorf("expected port=8080, got %v", resolved["port"])
	}
}

func TestResolveConfig_LocalSecret(t *testing.T) {
	r := newTestResolver(map[string]string{
		"my-api-key": "super-secret-123",
	})

	config := map[string]interface{}{
		"key":              "$secret://local/my-api-key",
		"hide_credentials": true,
	}

	resolved, err := r.ResolveConfig(context.Background(), config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resolved["key"] != "super-secret-123" {
		t.Errorf("expected key=super-secret-123, got %v", resolved["key"])
	}
	if resolved["hide_credentials"] != true {
		t.Errorf("expected hide_credentials=true, got %v", resolved["hide_credentials"])
	}
}

func TestResolveConfig_SecretNotFound(t *testing.T) {
	r := newTestResolver(nil)

	config := map[string]interface{}{
		"key": "$secret://local/nonexistent",
	}

	_, err := r.ResolveConfig(context.Background(), config)
	if err == nil {
		t.Fatal("expected error for missing secret, got nil")
	}
}

func TestResolveConfig_NestedMap(t *testing.T) {
	r := newTestResolver(map[string]string{
		"db-pass": "p@ssw0rd",
	})

	config := map[string]interface{}{
		"database": map[string]interface{}{
			"host":     "db.local",
			"password": "$secret://local/db-pass",
		},
	}

	resolved, err := r.ResolveConfig(context.Background(), config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	nested := resolved["database"].(map[string]interface{})
	if nested["host"] != "db.local" {
		t.Errorf("expected host=db.local, got %v", nested["host"])
	}
	if nested["password"] != "p@ssw0rd" {
		t.Errorf("expected password=p@ssw0rd, got %v", nested["password"])
	}
}

func TestResolveConfig_Array(t *testing.T) {
	r := newTestResolver(map[string]string{
		"token-1": "abc",
	})

	config := map[string]interface{}{
		"tokens": []interface{}{"plain-value", "$secret://local/token-1"},
	}

	resolved, err := r.ResolveConfig(context.Background(), config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	tokens := resolved["tokens"].([]interface{})
	if tokens[0] != "plain-value" {
		t.Errorf("expected tokens[0]=plain-value, got %v", tokens[0])
	}
	if tokens[1] != "abc" {
		t.Errorf("expected tokens[1]=abc, got %v", tokens[1])
	}
}

func TestResolveConfig_NonLocalSecretPassedThrough(t *testing.T) {
	r := newTestResolver(nil)

	config := map[string]interface{}{
		"key": "$secret://vault/my-key",
	}

	resolved, err := r.ResolveConfig(context.Background(), config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resolved["key"] != "$secret://vault/my-key" {
		t.Errorf("expected vault ref to pass through, got %v", resolved["key"])
	}
}

func TestResolveConfig_EmptyConfig(t *testing.T) {
	r := newTestResolver(nil)

	resolved, err := r.ResolveConfig(context.Background(), map[string]interface{}{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resolved) != 0 {
		t.Errorf("expected empty map, got %v", resolved)
	}
}

func TestResolveConfig_MultipleSecrets(t *testing.T) {
	r := newTestResolver(map[string]string{
		"api-key":    "key-123",
		"api-secret": "secret-456",
	})

	config := map[string]interface{}{
		"key":    "$secret://local/api-key",
		"secret": "$secret://local/api-secret",
		"region": "us-east-1",
	}

	resolved, err := r.ResolveConfig(context.Background(), config)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resolved["key"] != "key-123" {
		t.Errorf("expected key=key-123, got %v", resolved["key"])
	}
	if resolved["secret"] != "secret-456" {
		t.Errorf("expected secret=secret-456, got %v", resolved["secret"])
	}
	if resolved["region"] != "us-east-1" {
		t.Errorf("expected region=us-east-1, got %v", resolved["region"])
	}
}
