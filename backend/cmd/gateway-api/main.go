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
	metricsRepo := repository.NewMetricsRepository(pool)
	debugLogRepo := repository.NewDebugLogRepository(pool)
	alertRepo := repository.NewAlertRepository(pool)
	notifContactRepo := repository.NewNotificationContactRepository(pool)
	envRepo := repository.NewEnvironmentRepository(pool)
	settingsRepo := repository.NewSettingsRepository(pool)
	deployRepo := repository.NewApiDeploymentRepository(pool)
	promoRepo := repository.NewPromotionRequestRepository(pool)
	subRepo := repository.NewSubscriptionRepository(pool)
	testSuiteRepo := repository.NewTestSuiteRepository(pool)
	testRunRepo := repository.NewTestRunRepository(pool)
	syntheticMonitorRepo := repository.NewSyntheticMonitorRepository(pool)
	slaRepo := repository.NewSLARepository(pool)

	// Initialize services
	authService := service.NewAuthService(userRepo, &cfg.Auth)
	cryptoService := service.NewCryptoService(cfg.Secrets.EncryptionKey)
	registry := service.NewAPISIXClientRegistry(envRepo, &cfg.APISIX, logger)

	// Initialize services (domain)
	secretResolver := service.NewSecretResolver(secretRepo, cryptoService)
	apiDefService := service.NewApiDefinitionService(apiDefRepo, deployRepo, registry, secretResolver, logger)

	// Initialize middleware
	auditLogger := middleware.NewAuditLogger(auditRepo, logger)

	// Initialize handlers
	authHandler := handler.NewAuthHandler(authService, userRepo, auditLogger)
	healthHandler := handler.NewHealthHandler(pool, registry)
	dashboardHandler := handler.NewDashboardHandler(registry, alertRepo)
	pluginHandler := handler.NewPluginHandler(registry, auditLogger)
	auditHandler := handler.NewAuditHandler(auditRepo)
	secretHandler := handler.NewSecretHandler(secretRepo, cryptoService, auditLogger)
	apiDefHandler := handler.NewApiDefinitionHandler(apiDefService, auditLogger)

	upstreamHealthHandler := handler.NewUpstreamHealthHandler(registry, apiDefRepo)
	metricsHandler := handler.NewMetricsHandler(metricsRepo)
	aiMetricsRepo := repository.NewAIMetricsRepository(pool)
	aiMetricsHandler := handler.NewAIMetricsHandler(aiMetricsRepo)
	alertHandler := handler.NewAlertHandler(alertRepo, auditLogger)
	alertNotifier := service.NewAlertNotifier(logger)
	reportGenerator := service.NewReportGenerator(metricsRepo)
	reportHandler := handler.NewReportHandler(reportGenerator)
	notifContactHandler := handler.NewNotificationContactHandler(notifContactRepo, alertNotifier, auditLogger)

	// Promotion service + handler
	promotionService := service.NewPromotionService(promoRepo, deployRepo, apiDefRepo, apiDefService, logger)
	promotionHandler := handler.NewPromotionHandler(promotionService, auditLogger)

	// Subscription service + handler
	subscriptionService := service.NewSubscriptionService(subRepo, registry, logger)
	subscriptionHandler := handler.NewSubscriptionHandler(subscriptionService, auditLogger)

	// User & Role management handlers
	userHandler := handler.NewUserHandler(userRepo, auditLogger)
	roleHandler := handler.NewRoleHandler(userRepo, auditLogger)

	// Settings handler
	settingsHandler := handler.NewSettingsHandler(settingsRepo, auditLogger)

	// OAuth
	oauthProviderRepo := repository.NewOAuthProviderRepository(pool)
	oauthService := service.NewOAuthService(oauthProviderRepo, userRepo, authService, &cfg.Auth, logger)
	oauthProviderHandler := handler.NewOAuthProviderHandler(oauthProviderRepo, auditLogger)
	oauthAuthHandler := handler.NewOAuthAuthHandler(oauthService)

	// Portal
	portalRepo := repository.NewPortalRepository(pool)
	portalHandler := handler.NewPortalHandler(portalRepo, userRepo, subscriptionService, authService, logger)

	// Testing services
	testExecutor := service.NewTestExecutor(logger)

	// Testing handlers
	testSuiteHandler := handler.NewTestSuiteHandler(testSuiteRepo, testRunRepo, testExecutor, auditLogger)
	testRunHandler := handler.NewTestRunHandler(testRunRepo)
	syntheticMonitorHandler := handler.NewSyntheticMonitorHandler(syntheticMonitorRepo, auditLogger)
	slaHandler := handler.NewSLAHandler(slaRepo, auditLogger)

	// Service Mesh
	meshSvc := service.NewMeshService(registry, logger)
	meshHandler := handler.NewServiceMeshHandler(meshSvc)

	// Kafka
	kafkaConnRepo := repository.NewKafkaConnectionRepository(pool)
	kafkaHandler := handler.NewKafkaHandler(kafkaConnRepo, auditLogger, logger)

	// Environment handler
	envHandler := handler.NewEnvironmentHandler(envRepo, auditLogger, logger)
	envHandler.SetRegistry(registry)

	// Debug / Troubleshooting
	debugHub := service.NewDebugHub()
	debugLogHandler := handler.NewDebugLogHandler(debugLogRepo, debugHub, registry, auditLogger, apiDefRepo, logger, cfg.Debug.CallbackURL)

	// APISIX resource handlers
	routeHandler := handler.NewAPISIXResourceHandler(registry, auditLogger, "routes")
	serviceHandler := handler.NewAPISIXResourceHandler(registry, auditLogger, "services")
	upstreamHandler := handler.NewAPISIXResourceHandler(registry, auditLogger, "upstreams")
	consumerHandler := handler.NewAPISIXResourceHandler(registry, auditLogger, "consumers")
	consumerGroupHandler := handler.NewAPISIXResourceHandler(registry, auditLogger, "consumer_groups")
	sslHandler := handler.NewAPISIXResourceHandler(registry, auditLogger, "ssls")
	globalRuleHandler := handler.NewAPISIXResourceHandler(registry, auditLogger, "global_rules")
	pluginConfigHandler := handler.NewAPISIXResourceHandler(registry, auditLogger, "plugin_configs")
	pluginMetadataHandler := handler.NewAPISIXResourceHandler(registry, auditLogger, "plugin_metadata")
	streamRouteHandler := handler.NewAPISIXResourceHandler(registry, auditLogger, "stream_routes")
	apisixSecretHandler := handler.NewAPISIXResourceHandler(registry, auditLogger, "secrets")

	// Setup router
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.SetTrustedProxies(nil)
	r.Use(gin.Recovery())
	logger.Info("CORS allowed origins", zap.Strings("origins", cfg.Server.CORSOrigins))
	r.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.Server.CORSOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Environment-ID"},
		AllowCredentials: true,
	}))
	r.Use(middleware.RequestLogger(logger))

	// Health endpoints (unauthenticated)
	r.GET("/health/live", healthHandler.Live)
	r.GET("/health/ready", healthHandler.Ready)

	// Internal endpoints (called by APISIX, no auth)
	r.POST("/internal/debug-logs", debugLogHandler.ReceiveLogs)

	// Auth endpoints (unauthenticated)
	auth := r.Group("/api/auth")
	{
		auth.POST("/login", authHandler.Login)
		auth.POST("/refresh", authHandler.Refresh)
		auth.POST("/logout", authHandler.Logout)
		// OAuth (public)
		auth.GET("/oauth/providers", oauthAuthHandler.ListEnabled)
		auth.GET("/oauth/:provider/authorize", oauthAuthHandler.Authorize)
		auth.POST("/oauth/:provider/callback", oauthAuthHandler.Callback)
	}

	// Portal endpoints (public)
	portal := r.Group("/api/portal")
	{
		portal.GET("/apis", portalHandler.ListAPIs)
		portal.GET("/apis/:id", portalHandler.GetAPI)
		portal.GET("/apis/:id/spec", portalHandler.GetSpec)
		portal.POST("/register", portalHandler.Register)
		portal.GET("/categories", portalHandler.GetCategories)
		portal.GET("/stats", portalHandler.GetStats)
	}

	// Portal endpoints (authenticated developer)
	portalAuth := r.Group("/api/portal", middleware.RequireAuth(cfg.Auth.JWTSecret))
	{
		portalAuth.GET("/my/profile", portalHandler.GetProfile)
		portalAuth.PUT("/my/profile", portalHandler.UpdateProfile)
		portalAuth.GET("/my/subscriptions", portalHandler.ListMySubscriptions)
		portalAuth.POST("/apis/:id/subscribe", portalHandler.Subscribe)
	}

	// Authenticated endpoints
	api := r.Group("/api", middleware.RequireAuth(cfg.Auth.JWTSecret), middleware.EnvironmentContext())
	{
		api.GET("/auth/me", authHandler.Me)

		// Environments
		envs := api.Group("/environments")
		{
			envs.GET("", envHandler.List)
			envs.POST("", middleware.RequirePermission("environments:write"), envHandler.Create)
			envs.GET("/:id", envHandler.Get)
			envs.PUT("/:id", middleware.RequirePermission("environments:write"), envHandler.Update)
			envs.DELETE("/:id", middleware.RequirePermission("environments:write"), envHandler.Delete)
			envs.POST("/:id/set-default", middleware.RequirePermission("environments:write"), envHandler.SetDefault)
			envs.POST("/:id/test-connection", middleware.RequirePermission("environments:write"), envHandler.TestConnection)
		}

		// Dashboard
		api.GET("/dashboard/summary", middleware.RequirePermission("dashboard:read"), dashboardHandler.Summary)

		// Audit
		api.GET("/audit", middleware.RequirePermission("audit:read"), auditHandler.List)

		// Monitoring
		api.GET("/monitoring/upstream-health", middleware.RequirePermission("monitoring:read"), upstreamHealthHandler.GetHealth)

		// Metrics
		api.GET("/metrics/timeseries", middleware.RequirePermission("monitoring:read"), metricsHandler.TimeSeries)
		api.GET("/metrics/summary", middleware.RequirePermission("monitoring:read"), metricsHandler.Summary)
		api.GET("/metrics/top-routes", middleware.RequirePermission("monitoring:read"), metricsHandler.TopRoutes)
		api.GET("/metrics/top-consumers", middleware.RequirePermission("monitoring:read"), metricsHandler.TopConsumers)

		// AI Metrics
		ai := api.Group("/ai")
		{
			ai.GET("/metrics/timeseries", middleware.RequirePermission("ai_metrics:read"), aiMetricsHandler.TimeSeries)
			ai.GET("/metrics/summary", middleware.RequirePermission("ai_metrics:read"), aiMetricsHandler.Summary)
			ai.GET("/metrics/top-providers", middleware.RequirePermission("ai_metrics:read"), aiMetricsHandler.TopProviders)
			ai.GET("/metrics/top-models", middleware.RequirePermission("ai_metrics:read"), aiMetricsHandler.TopModels)
		}

		// Debug / Troubleshooting
		debug := api.Group("/debug")
		{
			debug.GET("/logs", middleware.RequirePermission("monitoring:read"), debugLogHandler.ListLogs)
			debug.GET("/logs/stream", middleware.RequirePermission("monitoring:read"), debugLogHandler.StreamLogs)
			debug.GET("/logs/:id", middleware.RequirePermission("monitoring:read"), debugLogHandler.GetLog)
			debug.POST("/toggle/:route_id", middleware.RequirePermission("monitoring:write"), debugLogHandler.ToggleDebug)
			debug.GET("/status/:route_id", middleware.RequirePermission("monitoring:read"), debugLogHandler.DebugStatus)
			debug.POST("/toggle-api/:api_id", middleware.RequirePermission("monitoring:write"), debugLogHandler.ToggleApiDebug)
			debug.PATCH("/capture-api/:api_id", middleware.RequirePermission("monitoring:write"), debugLogHandler.UpdateApiCaptureOptions)
			debug.GET("/status-api/:api_id", middleware.RequirePermission("monitoring:read"), debugLogHandler.ApiDebugStatus)
			debug.GET("/active-routes", middleware.RequirePermission("monitoring:read"), debugLogHandler.DebugActiveRoutes)
		}

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

		// Plugins
		api.GET("/apisix/plugins", middleware.RequirePermission("plugins:read"), pluginHandler.ListPlugins)
		api.GET("/apisix/plugins/:name", middleware.RequirePermission("plugins:read"), pluginHandler.GetPluginSchema)
		api.PUT("/apisix/plugins/reload", middleware.RequirePermission("plugins:write"), pluginHandler.ReloadPlugins)

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
			// Portal settings
			apis.GET("/:id/portal", middleware.RequirePermission("apis:read"), portalHandler.GetPortalSettings)
			apis.PATCH("/:id/portal", middleware.RequirePermission("apis:write"), portalHandler.UpdatePortalSettings)
			// Deployments & Diff
			apis.GET("/:id/deployments", middleware.RequirePermission("apis:read"), apiDefHandler.ListDeployments)
			apis.GET("/:id/diff", middleware.RequirePermission("apis:read"), apiDefHandler.DiffBetweenEnvs)
			// Per-API monitoring
			apis.GET("/:id/health", middleware.RequirePermission("monitoring:read"), upstreamHealthHandler.GetHealthForAPI)
		}

		// Promotions
		promotions := api.Group("/promotions")
		{
			promotions.GET("", middleware.RequirePermission("apis:read"), promotionHandler.List)
			promotions.POST("", middleware.RequirePermission("apis:write"), promotionHandler.Create)
			promotions.GET("/:id", middleware.RequirePermission("apis:read"), promotionHandler.Get)
			promotions.POST("/:id/review", middleware.RequirePermission("apis:write"), promotionHandler.Review)
			promotions.POST("/:id/execute", middleware.RequirePermission("apis:write"), promotionHandler.Execute)
		}

		// Subscriptions
		subscriptions := api.Group("/subscriptions")
		{
			subscriptions.GET("", middleware.RequirePermission("consumers:read"), subscriptionHandler.List)
			subscriptions.GET("/:id", middleware.RequirePermission("consumers:read"), subscriptionHandler.Get)
			subscriptions.POST("", middleware.RequirePermission("consumers:write"), subscriptionHandler.Create)
			subscriptions.POST("/:id/review", middleware.RequirePermission("consumers:write"), subscriptionHandler.Review)
			subscriptions.POST("/:id/suspend", middleware.RequirePermission("consumers:write"), subscriptionHandler.Suspend)
			subscriptions.POST("/:id/revoke", middleware.RequirePermission("consumers:write"), subscriptionHandler.Revoke)
		}

		// Users
		users := api.Group("/users")
		{
			users.GET("", middleware.RequirePermission("users:read"), userHandler.List)
			users.GET("/:id", middleware.RequirePermission("users:read"), userHandler.Get)
			users.POST("", middleware.RequirePermission("users:write"), userHandler.Create)
			users.PUT("/:id", middleware.RequirePermission("users:write"), userHandler.Update)
			users.POST("/:id/reset-password", middleware.RequirePermission("users:write"), userHandler.ResetPassword)
			users.DELETE("/:id", middleware.RequirePermission("users:write"), userHandler.Delete)
		}

		// Roles
		roles := api.Group("/roles")
		{
			roles.GET("", middleware.RequirePermission("users:read"), roleHandler.List)
			roles.GET("/:id", middleware.RequirePermission("users:read"), roleHandler.Get)
			roles.POST("", middleware.RequirePermission("users:write"), roleHandler.Create)
			roles.PUT("/:id", middleware.RequirePermission("users:write"), roleHandler.Update)
			roles.DELETE("/:id", middleware.RequirePermission("users:write"), roleHandler.Delete)
		}

		// System Settings
		sysSettings := api.Group("/settings")
		{
			sysSettings.GET("/:key", middleware.RequirePermission("settings:read"), settingsHandler.Get)
			sysSettings.PUT("/:key", middleware.RequirePermission("settings:write"), settingsHandler.Update)
		}

		// OAuth Providers (admin)
		oauthAdmin := api.Group("/oauth/providers")
		{
			oauthAdmin.GET("", middleware.RequirePermission("settings:read"), oauthProviderHandler.List)
			oauthAdmin.GET("/:id", middleware.RequirePermission("settings:read"), oauthProviderHandler.Get)
			oauthAdmin.POST("", middleware.RequirePermission("settings:write"), oauthProviderHandler.Create)
			oauthAdmin.PUT("/:id", middleware.RequirePermission("settings:write"), oauthProviderHandler.Update)
			oauthAdmin.DELETE("/:id", middleware.RequirePermission("settings:write"), oauthProviderHandler.Delete)
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

		// Alerts
		alerts := api.Group("/alerts")
		{
			alerts.GET("/rules", middleware.RequirePermission("monitoring:read"), alertHandler.ListRules)
			alerts.GET("/rules/:id", middleware.RequirePermission("monitoring:read"), alertHandler.GetRule)
			alerts.POST("/rules", middleware.RequirePermission("monitoring:write"), alertHandler.CreateRule)
			alerts.PUT("/rules/:id", middleware.RequirePermission("monitoring:write"), alertHandler.UpdateRule)
			alerts.DELETE("/rules/:id", middleware.RequirePermission("monitoring:write"), alertHandler.DeleteRule)
			alerts.POST("/rules/:id/ack", middleware.RequirePermission("monitoring:write"), alertHandler.AcknowledgeRule)
			alerts.GET("/events", middleware.RequirePermission("monitoring:read"), alertHandler.ListEvents)
			alerts.GET("/firing-count", middleware.RequirePermission("monitoring:read"), alertHandler.CountFiring)
		}

		// Reports
		reports := api.Group("/reports")
		{
			reports.GET("/usage/csv", middleware.RequirePermission("monitoring:read"), reportHandler.UsageCSV)
			reports.GET("/consumers/csv", middleware.RequirePermission("monitoring:read"), reportHandler.ConsumerCSV)
			reports.GET("/timeseries/csv", middleware.RequirePermission("monitoring:read"), reportHandler.TimeSeriesCSV)
		}

		// Notification Contacts
		contacts := api.Group("/notification-contacts")
		{
			contacts.GET("", middleware.RequirePermission("monitoring:read"), notifContactHandler.List)
			contacts.GET("/:id", middleware.RequirePermission("monitoring:read"), notifContactHandler.Get)
			contacts.POST("", middleware.RequirePermission("monitoring:write"), notifContactHandler.Create)
			contacts.PUT("/:id", middleware.RequirePermission("monitoring:write"), notifContactHandler.Update)
			contacts.DELETE("/:id", middleware.RequirePermission("monitoring:write"), notifContactHandler.Delete)
			contacts.POST("/:id/test", middleware.RequirePermission("monitoring:write"), notifContactHandler.TestContact)
		}

		// Testing: Test Suites
		testSuites := api.Group("/testing/suites")
		{
			testSuites.GET("", middleware.RequirePermission("testing:read"), testSuiteHandler.List)
			testSuites.GET("/:id", middleware.RequirePermission("testing:read"), testSuiteHandler.Get)
			testSuites.POST("", middleware.RequirePermission("testing:write"), testSuiteHandler.Create)
			testSuites.PUT("/:id", middleware.RequirePermission("testing:write"), testSuiteHandler.Update)
			testSuites.DELETE("/:id", middleware.RequirePermission("testing:write"), testSuiteHandler.Delete)
			testSuites.POST("/:id/run", middleware.RequirePermission("testing:write"), testSuiteHandler.Run)
		}

		// Testing: Test Runs
		testRuns := api.Group("/testing/runs")
		{
			testRuns.GET("", middleware.RequirePermission("testing:read"), testRunHandler.ListBySuite)
			testRuns.GET("/:id", middleware.RequirePermission("testing:read"), testRunHandler.Get)
		}

		// Testing: Synthetic Monitors
		monitors := api.Group("/testing/monitors")
		{
			monitors.GET("", middleware.RequirePermission("testing:read"), syntheticMonitorHandler.List)
			monitors.GET("/:id", middleware.RequirePermission("testing:read"), syntheticMonitorHandler.Get)
			monitors.POST("", middleware.RequirePermission("testing:write"), syntheticMonitorHandler.Create)
			monitors.PUT("/:id", middleware.RequirePermission("testing:write"), syntheticMonitorHandler.Update)
			monitors.DELETE("/:id", middleware.RequirePermission("testing:write"), syntheticMonitorHandler.Delete)
		}

		// Testing: SLA Definitions
		slas := api.Group("/testing/sla")
		{
			slas.GET("", middleware.RequirePermission("testing:read"), slaHandler.List)
			slas.GET("/:id", middleware.RequirePermission("testing:read"), slaHandler.Get)
			slas.POST("", middleware.RequirePermission("testing:write"), slaHandler.Create)
			slas.PUT("/:id", middleware.RequirePermission("testing:write"), slaHandler.Update)
			slas.DELETE("/:id", middleware.RequirePermission("testing:write"), slaHandler.Delete)
		}

		// Service Mesh
		mesh := api.Group("/mesh")
		{
			mesh.GET("/overview", middleware.RequirePermission("monitoring:read"), meshHandler.GetOverview)
			mesh.GET("/services", middleware.RequirePermission("monitoring:read"), meshHandler.ListServices)
			mesh.GET("/services/:id", middleware.RequirePermission("monitoring:read"), meshHandler.GetService)
			mesh.GET("/topology", middleware.RequirePermission("monitoring:read"), meshHandler.GetTopology)
			mesh.GET("/discovery-status", middleware.RequirePermission("monitoring:read"), meshHandler.GetDiscoveryStatus)
		}

		// Kafka Event Gateway
		kafka := api.Group("/kafka")
		{
			kafka.GET("/connections", middleware.RequirePermission("kafka:read"), kafkaHandler.ListConnections)
			kafka.GET("/connections/:id", middleware.RequirePermission("kafka:read"), kafkaHandler.GetConnection)
			kafka.POST("/connections", middleware.RequirePermission("kafka:write"), kafkaHandler.CreateConnection)
			kafka.PUT("/connections/:id", middleware.RequirePermission("kafka:write"), kafkaHandler.UpdateConnection)
			kafka.DELETE("/connections/:id", middleware.RequirePermission("kafka:write"), kafkaHandler.DeleteConnection)
			kafka.GET("/:connectionId/topics", middleware.RequirePermission("kafka:read"), kafkaHandler.ListTopics)
			kafka.GET("/:connectionId/topics/:topicName", middleware.RequirePermission("kafka:read"), kafkaHandler.GetTopic)
			kafka.POST("/:connectionId/topics/:topicName/produce", middleware.RequirePermission("kafka:write"), kafkaHandler.ProduceMessage)
			kafka.POST("/:connectionId/topics/:topicName/consume", middleware.RequirePermission("kafka:read"), kafkaHandler.ConsumeMessages)
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

	// Ensure platform-level global rules (best-effort, non-blocking)
	systemPolicies := service.NewSystemPolicies(registry.Fallback(), logger)
	go func() {
		if err := systemPolicies.EnsureSystemGlobalRules(context.Background()); err != nil {
			logger.Warn("system policies init failed", zap.Error(err))
		}
	}()

	// Start metrics scraper and rollup (background)
	var bgCancel context.CancelFunc
	var bgCtx context.Context
	bgCtx, bgCancel = context.WithCancel(context.Background())

	if cfg.Metrics.Enabled {
		metricsScraper := service.NewMetricsScraper(&cfg.Metrics, metricsRepo, registry.Fallback(), logger)
		metricsRollup := service.NewMetricsRollup(metricsRepo, &cfg.Metrics, logger)
		go metricsScraper.Start(bgCtx)
		go metricsRollup.Start(bgCtx)

		// AI token metrics scraper (shares same Prometheus endpoint)
		aiRouteResolver := service.NewRouteNameResolver(registry.Fallback(), logger)
		aiScraper := service.NewAIMetricsScraper(&cfg.Metrics, aiMetricsRepo, settingsRepo, aiRouteResolver, logger)
		go aiScraper.Start(bgCtx)
		go aiScraper.StartRollup(bgCtx)
	}

	// Start alert evaluator (background)
	if cfg.Alerts.Enabled {
		alertEvaluator := service.NewAlertEvaluator(alertRepo, metricsRepo, aiMetricsRepo, alertNotifier, logger, cfg.Alerts.EvalIntervalSec)
		go alertEvaluator.Start(bgCtx)
	}

	// Start synthetic runner (background)
	if cfg.Testing.SyntheticEnabled {
		syntheticRunner := service.NewSyntheticRunner(syntheticMonitorRepo, testSuiteRepo, testRunRepo, testExecutor, logger, cfg.Testing.SyntheticIntervalSec)
		go syntheticRunner.Start(bgCtx)
	}

	// Start SLA evaluator (background)
	if cfg.Testing.SLAEnabled {
		slaEvaluator := service.NewSLAEvaluator(slaRepo, metricsRepo, logger, cfg.Testing.SLAIntervalSec)
		go slaEvaluator.Start(bgCtx)
	}

	// Start debug log cleanup (background)
	if cfg.Debug.Enabled {
		debugCleanup := service.NewDebugCleanup(debugLogRepo, &cfg.Debug, logger)
		go debugCleanup.Start(bgCtx)
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
	bgCancel()
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
