package webhook

import (
	"context"
	"fmt"
	"sync"

	"github.com/fuseone/event-gateway/internal/metrics"
	"github.com/fuseone/event-gateway/internal/repository"
	"github.com/fuseone/event-gateway/internal/service"
	"github.com/fuseone/event-gateway/internal/stream"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Engine manages webhook delivery for all active Event APIs.
// It runs one stream consumer per webhook-enabled Event API and dispatches
// messages to all active webhook subscriptions.
type Engine struct {
	configMgr   *service.ConfigManager
	webhookRepo *repository.WebhookRepository
	dispatcher  *Dispatcher
	logger      *zap.Logger

	mu      sync.Mutex
	workers map[uuid.UUID]context.CancelFunc // event_api_id → cancel func
}

func NewEngine(
	configMgr *service.ConfigManager,
	webhookRepo *repository.WebhookRepository,
	collector *metrics.Collector,
	logger *zap.Logger,
) *Engine {
	return &Engine{
		configMgr:   configMgr,
		webhookRepo: webhookRepo,
		dispatcher:  NewDispatcher(webhookRepo, collector, logger),
		logger:      logger,
		workers:     make(map[uuid.UUID]context.CancelFunc),
	}
}

// Start initializes webhook consumers for all active Event APIs that have webhook_enabled=true.
// Blocks until ctx is cancelled.
func (e *Engine) Start(ctx context.Context) {
	e.logger.Info("webhook engine starting")
	e.reconcile(ctx)
	<-ctx.Done()
	e.stopAll()
	e.logger.Info("webhook engine stopped")
}

// OnConfigChanged is called when an Event API config changes.
// It reconciles webhook workers — starts/stops consumers as needed.
func (e *Engine) OnConfigChanged(ctx context.Context) {
	e.reconcile(ctx)
}

// OnSubscriptionChanged is called when a webhook subscription changes.
// The payload is the event_api_id. We just reconcile.
func (e *Engine) OnSubscriptionChanged(ctx context.Context, payload string) {
	id, err := uuid.Parse(payload)
	if err != nil {
		e.logger.Warn("invalid webhook subscription change payload", zap.String("payload", payload))
		return
	}

	// Check if this Event API still has webhook enabled and active subscriptions
	api, ok := e.configMgr.GetByID(id)
	if !ok || !api.WebhookEnabled {
		e.stopWorker(id)
		return
	}

	subs, err := e.webhookRepo.ListActiveByEventApiID(context.Background(), id)
	if err != nil {
		e.logger.Error("list webhook subscriptions", zap.Error(err))
		return
	}

	e.mu.Lock()
	_, running := e.workers[id]
	e.mu.Unlock()

	if len(subs) > 0 && !running {
		e.startWorker(context.Background(), api)
	} else if len(subs) == 0 && running {
		e.stopWorker(id)
	}
}

// reconcile ensures a worker is running for each webhook-enabled Event API that has active subscriptions.
func (e *Engine) reconcile(ctx context.Context) {
	apis := e.configMgr.ListWebhookEnabled()

	desired := make(map[uuid.UUID]bool)
	for _, api := range apis {
		subs, err := e.webhookRepo.ListActiveByEventApiID(ctx, api.ID)
		if err != nil {
			e.logger.Error("list subscriptions for reconcile", zap.Error(err), zap.String("slug", api.Slug))
			continue
		}
		if len(subs) > 0 {
			desired[api.ID] = true
		}
	}

	e.mu.Lock()
	// Stop workers for Event APIs no longer desired
	for id, cancel := range e.workers {
		if !desired[id] {
			cancel()
			delete(e.workers, id)
			e.logger.Info("stopped webhook worker (no longer needed)", zap.String("event_api_id", id.String()))
		}
	}
	e.mu.Unlock()

	// Start workers for newly desired Event APIs
	for _, api := range apis {
		if !desired[api.ID] {
			continue
		}
		e.mu.Lock()
		_, running := e.workers[api.ID]
		e.mu.Unlock()
		if !running {
			e.startWorker(ctx, &api)
		}
	}

	e.logger.Info("webhook engine reconciled", zap.Int("workers", len(desired)))
}

func (e *Engine) startWorker(parentCtx context.Context, api *repository.EventApiWithConnection) {
	groupID := fmt.Sprintf("%s-webhook-%s", api.ConsumerGroupPrefix, api.ID.String()[:8])

	ctx, cancel := context.WithCancel(parentCtx)

	msgCh, closer, err := api.Provider.Subscribe(ctx, api.TopicName, groupID, api.AutoOffsetReset)
	if err != nil {
		cancel()
		e.logger.Error("create webhook consumer", zap.Error(err), zap.String("slug", api.Slug))
		return
	}

	e.mu.Lock()
	e.workers[api.ID] = func() { cancel(); closer.Close() }
	e.mu.Unlock()

	e.logger.Info("started webhook worker",
		zap.String("slug", api.Slug),
		zap.String("topic", api.TopicName),
		zap.String("group_id", groupID),
	)

	go func() {
		defer func() {
			e.mu.Lock()
			delete(e.workers, api.ID)
			e.mu.Unlock()
		}()

		for {
			select {
			case <-ctx.Done():
				return
			case msg, ok := <-msgCh:
				if !ok {
					return
				}
				e.dispatchToSubscribers(ctx, api.ID, api.Slug, msg)
			}
		}
	}()
}

// dispatchToSubscribers sends a message to all active webhook subscribers for the Event API.
func (e *Engine) dispatchToSubscribers(ctx context.Context, eventApiID uuid.UUID, slug string, msg stream.Message) {
	subs, err := e.webhookRepo.ListActiveByEventApiID(ctx, eventApiID)
	if err != nil {
		e.logger.Error("list subscribers for dispatch", zap.Error(err))
		return
	}

	for _, sub := range subs {
		// Apply event filter if configured
		if sub.FilterExpression != "" && !MatchesFilter(sub.FilterExpression, msg.Value) {
			e.logger.Debug("event filtered out",
				zap.String("subscription_id", sub.ID.String()),
				zap.String("filter", sub.FilterExpression),
			)
			continue
		}
		// Dispatch each subscriber in its own goroutine for parallelism
		sub := sub
		go e.dispatcher.Deliver(ctx, sub, msg, slug)
	}
}

func (e *Engine) stopWorker(id uuid.UUID) {
	e.mu.Lock()
	cancel, ok := e.workers[id]
	if ok {
		cancel()
		delete(e.workers, id)
	}
	e.mu.Unlock()
	if ok {
		e.logger.Info("stopped webhook worker", zap.String("event_api_id", id.String()))
	}
}

func (e *Engine) stopAll() {
	e.mu.Lock()
	defer e.mu.Unlock()
	for id, cancel := range e.workers {
		cancel()
		delete(e.workers, id)
	}
}
