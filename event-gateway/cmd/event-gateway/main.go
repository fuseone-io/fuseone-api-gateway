package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/fuseone/event-gateway/internal/config"
	"github.com/fuseone/event-gateway/internal/handler"
	"github.com/fuseone/event-gateway/internal/kafka"
	"github.com/fuseone/event-gateway/internal/metrics"
	egmw "github.com/fuseone/event-gateway/internal/middleware"
	"github.com/fuseone/event-gateway/internal/repository"
	"github.com/fuseone/event-gateway/internal/schema"
	"github.com/fuseone/event-gateway/internal/service"
	"github.com/fuseone/event-gateway/internal/webhook"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("load config", zap.Error(err))
	}

	// Database connection pool
	poolCfg, err := pgxpool.ParseConfig(cfg.Database.DSN())
	if err != nil {
		logger.Fatal("parse db config", zap.Error(err))
	}
	poolCfg.MaxConns = 10
	poolCfg.MinConns = 2

	pool, err := pgxpool.NewWithConfig(context.Background(), poolCfg)
	if err != nil {
		logger.Fatal("connect to database", zap.Error(err))
	}
	defer pool.Close()

	if err := pool.Ping(context.Background()); err != nil {
		logger.Fatal("ping database", zap.Error(err))
	}
	logger.Info("connected to database")

	// Initialize components
	repo := repository.NewEventApiRepository(pool, logger)
	kafkaPool := kafka.NewClientPool(logger)
	configMgr := service.NewConfigManager(repo, kafkaPool, logger)

	// Load all active event APIs
	if err := configMgr.LoadAll(context.Background()); err != nil {
		logger.Warn("initial config load failed (will retry via LISTEN)", zap.Error(err))
	}

	// Metrics collector
	collector := metrics.NewCollector()

	// Schema validator
	schemaValidator := schema.NewValidator(repo, logger)
	schemaValidator.LoadAll(context.Background(), configMgr.ListAll())

	// Topic auth (per-topic access control)
	permRepo := repository.NewPermissionRepository(pool, logger)
	topicAuth := egmw.NewTopicAuth(logger)
	if perms, err := permRepo.ListAll(context.Background()); err == nil {
		topicAuth.LoadPermissions(perms)
	} else {
		logger.Warn("failed to load initial permissions", zap.Error(err))
	}

	// Webhook engine
	webhookRepo := repository.NewWebhookRepository(pool, logger)
	webhookEngine := webhook.NewEngine(configMgr, webhookRepo, kafkaPool, collector, logger)

	// Start PostgreSQL LISTEN for config changes
	pgListener := repository.NewPGListener(pool, logger)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go pgListener.Listen(ctx, "event_api_config_changed", func(payload string) {
		configMgr.OnConfigChanged(payload)
		webhookEngine.OnConfigChanged(ctx)
		// Reload schema for changed event API
		if id, err := uuid.Parse(payload); err == nil {
			if api, ok := configMgr.GetByID(id); ok {
				schemaValidator.Reload(ctx, id, api.SchemaValidation)
			}
		}
	})
	go pgListener.Listen(ctx, "webhook_subscription_changed", func(payload string) {
		webhookEngine.OnSubscriptionChanged(ctx, payload)
	})
	go pgListener.Listen(ctx, "event_schema_changed", func(payload string) {
		if id, err := uuid.Parse(payload); err == nil {
			if api, ok := configMgr.GetByID(id); ok {
				schemaValidator.Reload(ctx, id, api.SchemaValidation)
			}
		}
	})
	go pgListener.Listen(ctx, "event_api_permission_changed", func(payload string) {
		if perms, err := permRepo.ListAll(ctx); err == nil {
			topicAuth.LoadPermissions(perms)
		}
	})

	// Start webhook delivery engine
	go webhookEngine.Start(ctx)

	// Kafka producer
	producer := kafka.NewProducer(kafkaPool)

	// HTTP Router
	r := chi.NewRouter()
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(egmw.RequestID)

	// Admin client for consumer group operations
	adminClient := kafka.NewAdminClient(kafkaPool)
	cgHandler := handler.NewConsumerGroupsHandler(adminClient, configMgr, logger)

	// Internal endpoints (not exposed via APISIX)
	r.Get("/health", handler.NewHealthHandler(pool, kafkaPool, configMgr).Handle)
	r.Post("/internal/reload", handler.NewReloadHandler(configMgr).Handle)
	r.Get("/internal/metrics", handler.NewMetricsHandler(collector).Handle)
	r.Route("/internal/event-apis/{id}/consumer-groups", func(r chi.Router) {
		r.Get("/", cgHandler.List)
		r.Get("/{groupId}", cgHandler.Describe)
		r.Post("/{groupId}/reset", cgHandler.ResetOffsets)
	})

	// Topic endpoints (exposed via APISIX with auth)
	r.Route("/topics/{topic}", func(r chi.Router) {
		r.Use(egmw.TopicResolver(configMgr))
		r.With(topicAuth.RequireProduce()).Post("/produce", handler.NewProduceHandler(producer, collector, schemaValidator).Handle)
		r.With(topicAuth.RequireConsume()).Post("/consume", handler.NewConsumeHandler(kafkaPool, collector, logger).Handle)
		r.With(topicAuth.RequireStream()).Get("/stream", handler.NewStreamHandler(kafkaPool, cfg.Kafka.SSEKeepAliveMs, collector, logger).Handle)
		r.With(topicAuth.RequireStream()).Get("/ws", handler.NewWebSocketHandler(kafkaPool, collector, logger).Handle)
	})

	// HTTP Server
	srv := &http.Server{
		Addr:        fmt.Sprintf(":%d", cfg.Server.Port),
		Handler:     r,
		IdleTimeout: time.Duration(cfg.Server.IdleTimeout) * time.Second,
		// No ReadTimeout/WriteTimeout — SSE needs unlimited
	}

	// Start server
	go func() {
		logger.Info("event gateway starting", zap.Int("port", cfg.Server.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("listen", zap.Error(err))
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down...")
	cancel() // Stop PG listener

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), time.Duration(cfg.Server.ShutdownSec)*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("server shutdown", zap.Error(err))
	}

	kafkaPool.Close()
	logger.Info("event gateway stopped")
}
