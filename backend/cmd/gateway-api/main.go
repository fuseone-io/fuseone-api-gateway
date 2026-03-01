package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/config"
	"github.com/fuseone/api-gateway/internal/database"
	"github.com/fuseone/api-gateway/internal/handler"
	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/repository"
	"github.com/fuseone/api-gateway/internal/service"
)

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	// Database connection
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	poolCfg, err := pgxpool.ParseConfig(cfg.Database.DSN())
	if err != nil {
		logger.Fatal("failed to parse database config", zap.Error(err))
	}
	poolCfg.MaxConns = cfg.Database.MaxConns
	poolCfg.MinConns = cfg.Database.MinConns

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		logger.Fatal("failed to create database pool", zap.Error(err))
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		logger.Fatal("failed to ping database", zap.Error(err))
	}
	logger.Info("database connected")

	// Run migrations
	if err := database.RunMigrations(ctx, pool, logger); err != nil {
		logger.Fatal("failed to run migrations", zap.Error(err))
	}

	// Initialize repositories
	userRepo := repository.NewUserRepository(pool)
	auditRepo := repository.NewAuditRepository(pool)
	secretRepo := repository.NewSecretRepository(pool)
	apiDefRepo := repository.NewApiDefinitionRepository(pool)

	// Initialize services
	authService := service.NewAuthService(userRepo, &cfg.Auth)
	apisixClient := service.NewAPISIXClient(&cfg.APISIX, logger)
	cryptoService := service.NewCryptoService(cfg.Secrets.EncryptionKey)

	// Initialize services (domain)
	apiDefService := service.NewApiDefinitionService(apiDefRepo, apisixClient, logger)

	// Initialize middleware
	auditLogger := middleware.NewAuditLogger(auditRepo, logger)

	// Initialize handlers
	authHandler := handler.NewAuthHandler(authService, userRepo, auditLogger)
	healthHandler := handler.NewHealthHandler(pool, apisixClient)
	dashboardHandler := handler.NewDashboardHandler(apisixClient)
	pluginHandler := handler.NewPluginHandler(apisixClient)
	auditHandler := handler.NewAuditHandler(auditRepo)
	secretHandler := handler.NewSecretHandler(secretRepo, cryptoService, auditLogger)
	apiDefHandler := handler.NewApiDefinitionHandler(apiDefService, auditLogger)

	// APISIX resource handlers
	routeHandler := handler.NewAPISIXResourceHandler(apisixClient, auditLogger, "routes")
	serviceHandler := handler.NewAPISIXResourceHandler(apisixClient, auditLogger, "services")
	upstreamHandler := handler.NewAPISIXResourceHandler(apisixClient, auditLogger, "upstreams")
	consumerHandler := handler.NewAPISIXResourceHandler(apisixClient, auditLogger, "consumers")
	consumerGroupHandler := handler.NewAPISIXResourceHandler(apisixClient, auditLogger, "consumer_groups")
	sslHandler := handler.NewAPISIXResourceHandler(apisixClient, auditLogger, "ssls")
	globalRuleHandler := handler.NewAPISIXResourceHandler(apisixClient, auditLogger, "global_rules")
	pluginConfigHandler := handler.NewAPISIXResourceHandler(apisixClient, auditLogger, "plugin_configs")
	pluginMetadataHandler := handler.NewAPISIXResourceHandler(apisixClient, auditLogger, "plugin_metadata")
	streamRouteHandler := handler.NewAPISIXResourceHandler(apisixClient, auditLogger, "stream_routes")
	apisixSecretHandler := handler.NewAPISIXResourceHandler(apisixClient, auditLogger, "secrets")

	// Setup router
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.SetTrustedProxies(nil)
	r.Use(gin.Recovery())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.Server.CORSOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))
	r.Use(middleware.RequestLogger(logger))

	// Health endpoints (unauthenticated)
	r.GET("/health/live", healthHandler.Live)
	r.GET("/health/ready", healthHandler.Ready)

	// Auth endpoints (unauthenticated)
	auth := r.Group("/api/auth")
	{
		auth.POST("/login", authHandler.Login)
		auth.POST("/refresh", authHandler.Refresh)
		auth.POST("/logout", authHandler.Logout)
	}

	// Authenticated endpoints
	api := r.Group("/api", middleware.RequireAuth(cfg.Auth.JWTSecret))
	{
		api.GET("/auth/me", authHandler.Me)

		// Dashboard
		api.GET("/dashboard/summary", middleware.RequirePermission("dashboard:read"), dashboardHandler.Summary)

		// Audit
		api.GET("/audit", middleware.RequirePermission("audit:read"), auditHandler.List)

		// APISIX Resources
		registerResourceRoutes(api, "apisix/routes", routeHandler, "routes")
		registerResourceRoutes(api, "apisix/services", serviceHandler, "services")
		registerResourceRoutes(api, "apisix/upstreams", upstreamHandler, "upstreams")
		registerResourceRoutes(api, "apisix/consumers", consumerHandler, "consumers")
		registerResourceRoutes(api, "apisix/consumer-groups", consumerGroupHandler, "consumers")
		registerResourceRoutes(api, "apisix/ssls", sslHandler, "ssl")
		registerResourceRoutes(api, "apisix/global-rules", globalRuleHandler, "global_rules")
		registerResourceRoutes(api, "apisix/plugin-configs", pluginConfigHandler, "plugins")
		registerResourceRoutes(api, "apisix/plugin-metadata", pluginMetadataHandler, "plugins")
		registerResourceRoutes(api, "apisix/stream-routes", streamRouteHandler, "stream_routes")
		registerResourceRoutes(api, "apisix/secrets", apisixSecretHandler, "secrets")

		// Plugins (read-only)
		api.GET("/apisix/plugins", middleware.RequirePermission("plugins:read"), pluginHandler.ListPlugins)
		api.GET("/apisix/plugins/:name", middleware.RequirePermission("plugins:read"), pluginHandler.GetPluginSchema)

		// API Definitions (draft/deploy workflow)
		apis := api.Group("/apis")
		{
			apis.GET("", middleware.RequirePermission("apis:read"), apiDefHandler.List)
			apis.GET("/:id", middleware.RequirePermission("apis:read"), apiDefHandler.Get)
			apis.POST("", middleware.RequirePermission("apis:write"), apiDefHandler.Create)
			apis.PUT("/:id", middleware.RequirePermission("apis:write"), apiDefHandler.Update)
			apis.POST("/:id/deploy", middleware.RequirePermission("apis:write"), apiDefHandler.Deploy)
			apis.DELETE("/:id", middleware.RequirePermission("apis:write"), apiDefHandler.Delete)
			// Versioning
			apis.POST("/:id/clone", middleware.RequirePermission("apis:write"), apiDefHandler.Clone)
			apis.GET("/:id/versions", middleware.RequirePermission("apis:read"), apiDefHandler.GetVersions)
			// Lifecycle
			apis.POST("/:id/deprecate", middleware.RequirePermission("apis:write"), apiDefHandler.Deprecate)
			apis.POST("/:id/retire", middleware.RequirePermission("apis:write"), apiDefHandler.Retire)
			apis.POST("/:id/undeprecate", middleware.RequirePermission("apis:write"), apiDefHandler.Undeprecate)
		}

		// Local Secrets vault
		secrets := api.Group("/secrets")
		{
			secrets.GET("", middleware.RequirePermission("secrets:read"), secretHandler.ListSecrets)
			secrets.GET("/:id", middleware.RequirePermission("secrets:read"), secretHandler.GetSecret)
			secrets.POST("", middleware.RequirePermission("secrets:write"), secretHandler.CreateSecret)
			secrets.PUT("/:id", middleware.RequirePermission("secrets:write"), secretHandler.UpdateSecret)
			secrets.DELETE("/:id", middleware.RequirePermission("secrets:write"), secretHandler.DeleteSecret)
		}

		// Secret Managers (external: Vault, AWS, GCP)
		managers := api.Group("/secret-managers")
		{
			managers.GET("", middleware.RequirePermission("secrets:read"), secretHandler.ListManagers)
			managers.GET("/:id", middleware.RequirePermission("secrets:read"), secretHandler.GetManager)
			managers.POST("", middleware.RequirePermission("secrets:write"), secretHandler.CreateManager)
			managers.PUT("/:id", middleware.RequirePermission("secrets:write"), secretHandler.UpdateManager)
			managers.DELETE("/:id", middleware.RequirePermission("secrets:write"), secretHandler.DeleteManager)
		}
	}

	// Start server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Server.Port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logger.Info("server starting", zap.Int("port", cfg.Server.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server error", zap.Error(err))
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down server...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Fatal("server forced shutdown", zap.Error(err))
	}

	logger.Info("server stopped")
}

func registerResourceRoutes(group *gin.RouterGroup, path string, h *handler.APISIXResourceHandler, permBase string) {
	g := group.Group("/" + path)
	{
		g.GET("", middleware.RequirePermission(permBase+":read"), h.List)
		g.GET("/:id", middleware.RequirePermission(permBase+":read"), h.Get)
		g.POST("", middleware.RequirePermission(permBase+":write"), h.Create)
		g.PUT("/:id", middleware.RequirePermission(permBase+":write"), h.Update)
		g.PATCH("/:id", middleware.RequirePermission(permBase+":write"), h.Patch)
		g.DELETE("/:id", middleware.RequirePermission(permBase+":write"), h.Delete)
	}
}
