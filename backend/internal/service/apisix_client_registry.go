package service

import (
	"context"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/config"
	"github.com/fuseone/api-gateway/internal/repository"
)

// APISIXClientRegistry manages APISIX clients for multiple environments.
// Clients are lazily created and cached; Invalidate on environment update/delete.
type APISIXClientRegistry struct {
	mu       sync.RWMutex
	clients  map[uuid.UUID]*APISIXClient
	envRepo  repository.EnvironmentQuerier
	fallback *APISIXClient
	logger   *zap.Logger
}

// NewAPISIXClientRegistry creates a registry with a fallback client from config.yaml.
func NewAPISIXClientRegistry(envRepo repository.EnvironmentQuerier, fallbackCfg *config.APISIXConfig, logger *zap.Logger) *APISIXClientRegistry {
	return &APISIXClientRegistry{
		clients:  make(map[uuid.UUID]*APISIXClient),
		envRepo:  envRepo,
		fallback: NewAPISIXClient(fallbackCfg, logger),
		logger:   logger,
	}
}

// GetClient returns the APISIX client for the given environment.
// If envID is uuid.Nil, the default environment is used.
func (r *APISIXClientRegistry) GetClient(ctx context.Context, envID uuid.UUID) (*APISIXClient, error) {
	if envID == uuid.Nil {
		env, err := r.envRepo.GetDefault(ctx)
		if err != nil || env == nil {
			// Fall back to config-based client
			return r.fallback, nil
		}
		envID = env.ID
	}

	// Check cache
	r.mu.RLock()
	if client, ok := r.clients[envID]; ok {
		r.mu.RUnlock()
		return client, nil
	}
	r.mu.RUnlock()

	// Load from DB and create client
	env, err := r.envRepo.GetByID(ctx, envID)
	if err != nil {
		return nil, fmt.Errorf("loading environment %s: %w", envID, err)
	}
	if env == nil {
		return nil, fmt.Errorf("environment %s not found", envID)
	}

	cfg := &config.APISIXConfig{
		AdminURL:   env.AdminURL,
		APIKey:     env.APIKey,
		ControlURL: env.ControlURL,
	}
	client := NewAPISIXClient(cfg, r.logger)

	r.mu.Lock()
	r.clients[envID] = client
	r.mu.Unlock()

	return client, nil
}

// Invalidate removes a cached client (call after environment update/delete).
func (r *APISIXClientRegistry) Invalidate(envID uuid.UUID) {
	r.mu.Lock()
	delete(r.clients, envID)
	r.mu.Unlock()
}

// InvalidateAll clears the entire cache.
func (r *APISIXClientRegistry) InvalidateAll() {
	r.mu.Lock()
	r.clients = make(map[uuid.UUID]*APISIXClient)
	r.mu.Unlock()
}

// Fallback returns the config.yaml-based client (for background workers).
func (r *APISIXClientRegistry) Fallback() *APISIXClient {
	return r.fallback
}
