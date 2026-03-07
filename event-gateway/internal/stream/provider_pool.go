package stream

import (
	"fmt"
	"sync"

	"github.com/fuseone/event-gateway/internal/model"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ProviderPool manages StreamProvider instances keyed by connection ID.
// It replaces kafka.ClientPool as the central connection registry.
type ProviderPool struct {
	mu        sync.RWMutex
	providers map[uuid.UUID]StreamProvider
	refCount  map[uuid.UUID]int
	logger    *zap.Logger
}

func NewProviderPool(logger *zap.Logger) *ProviderPool {
	return &ProviderPool{
		providers: make(map[uuid.UUID]StreamProvider),
		refCount:  make(map[uuid.UUID]int),
		logger:    logger,
	}
}

// GetOrCreate returns an existing provider or creates a new one for the given connection.
func (p *ProviderPool) GetOrCreate(conn model.StreamConnection) (StreamProvider, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if prov, ok := p.providers[conn.ID]; ok {
		p.refCount[conn.ID]++
		return prov, nil
	}

	var (
		prov StreamProvider
		err  error
	)

	switch conn.ConnectionType {
	case "nats":
		prov, err = newNATSProvider(conn, p.logger)
	default:
		prov, err = newKafkaProvider(conn, p.logger)
	}

	if err != nil {
		return nil, fmt.Errorf("create %s provider: %w", conn.ConnectionType, err)
	}

	p.providers[conn.ID] = prov
	p.refCount[conn.ID] = 1
	p.logger.Info("stream provider created",
		zap.String("type", prov.Type()),
		zap.String("connection_id", conn.ID.String()),
	)

	return prov, nil
}

// Release decrements the reference count. Closes the provider when count reaches zero.
func (p *ProviderPool) Release(id uuid.UUID) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.refCount[id]--
	if p.refCount[id] <= 0 {
		if prov, ok := p.providers[id]; ok {
			_ = prov.Close()
			delete(p.providers, id)
			delete(p.refCount, id)
			p.logger.Info("stream provider closed", zap.String("connection_id", id.String()))
		}
	}
}

// ActiveProviders returns the number of live provider connections.
func (p *ProviderPool) ActiveProviders() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return len(p.providers)
}

// Close shuts down all providers.
func (p *ProviderPool) Close() {
	p.mu.Lock()
	defer p.mu.Unlock()

	for id, prov := range p.providers {
		_ = prov.Close()
		p.logger.Info("stream provider closed", zap.String("connection_id", id.String()))
	}
	p.providers = make(map[uuid.UUID]StreamProvider)
	p.refCount = make(map[uuid.UUID]int)
}
