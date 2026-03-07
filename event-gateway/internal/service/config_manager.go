package service

import (
	"context"
	"sync"

	"github.com/fuseone/event-gateway/internal/kafka"
	"github.com/fuseone/event-gateway/internal/repository"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ConfigManager loads event API configurations from the database
// and maintains an in-memory map for fast lookups.
type ConfigManager struct {
	repo      *repository.EventApiRepository
	kafkaPool *kafka.ClientPool
	logger    *zap.Logger

	mu      sync.RWMutex
	bySlug  map[string]*repository.EventApiWithConnection
	byID    map[uuid.UUID]*repository.EventApiWithConnection
}

func NewConfigManager(repo *repository.EventApiRepository, kafkaPool *kafka.ClientPool, logger *zap.Logger) *ConfigManager {
	return &ConfigManager{
		repo:      repo,
		kafkaPool: kafkaPool,
		logger:    logger,
		bySlug:    make(map[string]*repository.EventApiWithConnection),
		byID:      make(map[uuid.UUID]*repository.EventApiWithConnection),
	}
}

// LoadAll reads all active event APIs from the database and populates the in-memory map.
func (cm *ConfigManager) LoadAll(ctx context.Context) error {
	apis, err := cm.repo.ListActive(ctx)
	if err != nil {
		return err
	}

	cm.mu.Lock()
	defer cm.mu.Unlock()

	cm.bySlug = make(map[string]*repository.EventApiWithConnection, len(apis))
	cm.byID = make(map[uuid.UUID]*repository.EventApiWithConnection, len(apis))

	for i := range apis {
		api := &apis[i]
		cm.bySlug[api.Slug] = api
		cm.byID[api.ID] = api

		// Pre-create Kafka client for this connection
		if _, err := cm.kafkaPool.GetOrCreate(api.Connection); err != nil {
			cm.logger.Error("failed to create kafka client for event api",
				zap.String("slug", api.Slug),
				zap.Error(err),
			)
		}
	}

	cm.logger.Info("loaded event api configs", zap.Int("count", len(apis)))
	return nil
}

// GetBySlug returns the event API config for a given slug.
func (cm *ConfigManager) GetBySlug(slug string) (*repository.EventApiWithConnection, bool) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	api, ok := cm.bySlug[slug]
	return api, ok
}

// GetByID returns the event API config for a given ID.
func (cm *ConfigManager) GetByID(id uuid.UUID) (*repository.EventApiWithConnection, bool) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	api, ok := cm.byID[id]
	return api, ok
}

// OnConfigChanged handles PostgreSQL NOTIFY for event_api_config_changed.
// It reloads the specific event API from the database.
func (cm *ConfigManager) OnConfigChanged(payload string) {
	id, err := uuid.Parse(payload)
	if err != nil {
		cm.logger.Warn("invalid config change payload", zap.String("payload", payload))
		// Full reload as fallback
		if err := cm.LoadAll(context.Background()); err != nil {
			cm.logger.Error("full reload failed", zap.Error(err))
		}
		return
	}

	api, err := cm.repo.GetByID(context.Background(), id)
	if err != nil {
		// Might have been deleted — remove from map
		cm.mu.Lock()
		for slug, existing := range cm.bySlug {
			if existing.ID == id {
				delete(cm.bySlug, slug)
				break
			}
		}
		delete(cm.byID, id)
		cm.mu.Unlock()
		cm.logger.Info("event api removed from config", zap.String("id", id.String()))
		return
	}

	cm.mu.Lock()
	// Remove old slug mapping if slug changed
	for slug, existing := range cm.bySlug {
		if existing.ID == id {
			delete(cm.bySlug, slug)
			break
		}
	}
	cm.bySlug[api.Slug] = api
	cm.byID[api.ID] = api
	cm.mu.Unlock()

	// Ensure Kafka client exists
	if _, err := cm.kafkaPool.GetOrCreate(api.Connection); err != nil {
		cm.logger.Error("failed to create kafka client on config change", zap.Error(err))
	}

	cm.logger.Info("event api config updated",
		zap.String("slug", api.Slug),
		zap.String("status", api.Status),
	)
}

// Count returns the number of active event APIs.
func (cm *ConfigManager) Count() int {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return len(cm.bySlug)
}

// ListAll returns all active Event APIs.
func (cm *ConfigManager) ListAll() []repository.EventApiWithConnection {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	result := make([]repository.EventApiWithConnection, 0, len(cm.byID))
	for _, api := range cm.byID {
		result = append(result, *api)
	}
	return result
}

// ListWebhookEnabled returns all active Event APIs that have webhook_enabled=true.
func (cm *ConfigManager) ListWebhookEnabled() []repository.EventApiWithConnection {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	var result []repository.EventApiWithConnection
	for _, api := range cm.byID {
		if api.WebhookEnabled {
			result = append(result, *api)
		}
	}
	return result
}
