package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

// SecretLookup is the interface needed by SecretResolver to fetch secrets.
type SecretLookup interface {
	GetByName(ctx context.Context, name string) (*model.Secret, []byte, error)
}

// SecretResolver resolves $secret://local/... references to plaintext values.
// External references ($secret://vault/..., $secret://aws/...) are passed through.
type SecretResolver struct {
	repo   SecretLookup
	crypto *CryptoService
}

func NewSecretResolver(repo *repository.SecretRepository, crypto *CryptoService) *SecretResolver {
	return &SecretResolver{repo: repo, crypto: crypto}
}

const localSecretPrefix = "$secret://local/"

// ResolveConfig walks a config map and resolves any $secret://local/... string values
// to their decrypted plaintext. Non-local secret references are left as-is.
func (r *SecretResolver) ResolveConfig(ctx context.Context, config map[string]interface{}) (map[string]interface{}, error) {
	resolved := make(map[string]interface{}, len(config))
	for k, v := range config {
		val, err := r.resolveValue(ctx, v)
		if err != nil {
			return nil, fmt.Errorf("resolving key %q: %w", k, err)
		}
		resolved[k] = val
	}
	return resolved, nil
}

func (r *SecretResolver) resolveValue(ctx context.Context, v interface{}) (interface{}, error) {
	switch val := v.(type) {
	case string:
		if strings.HasPrefix(val, localSecretPrefix) {
			secretName := strings.TrimPrefix(val, localSecretPrefix)
			return r.resolveLocalSecret(ctx, secretName)
		}
		return val, nil
	case map[string]interface{}:
		return r.ResolveConfig(ctx, val)
	case []interface{}:
		result := make([]interface{}, len(val))
		for i, item := range val {
			resolved, err := r.resolveValue(ctx, item)
			if err != nil {
				return nil, err
			}
			result[i] = resolved
		}
		return result, nil
	default:
		return v, nil
	}
}

func (r *SecretResolver) resolveLocalSecret(ctx context.Context, name string) (string, error) {
	_, encryptedValue, err := r.repo.GetByName(ctx, name)
	if err != nil {
		return "", fmt.Errorf("fetching secret %q: %w", name, err)
	}
	if encryptedValue == nil {
		return "", fmt.Errorf("secret %q not found", name)
	}

	plaintext, err := r.crypto.Decrypt(encryptedValue)
	if err != nil {
		return "", fmt.Errorf("decrypting secret %q: %w", name, err)
	}

	return string(plaintext), nil
}
