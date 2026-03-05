package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

// AnalyticsBackendSettings is the JSON shape stored in system_settings.
// Supports both legacy single-backend format and new split format.
type AnalyticsBackendSettings struct {
	// Legacy format (switches both)
	Type          string                     `json:"type,omitempty"`
	ClickHouse    *ClickHouseSettingsPayload `json:"clickhouse,omitempty"`
	Elasticsearch *ESSettingsPayload         `json:"elasticsearch,omitempty"`

	// New split format
	TraceBackend   *BackendConfig `json:"trace_backend,omitempty"`
	MetricsBackend *BackendConfig `json:"metrics_backend,omitempty"`
}

// BackendConfig represents configuration for a single backend (trace or metrics).
type BackendConfig struct {
	Type          string                     `json:"type"`
	ClickHouse    *ClickHouseSettingsPayload `json:"clickhouse,omitempty"`
	Elasticsearch *ESSettingsPayload         `json:"elasticsearch,omitempty"`
	Prometheus    *PrometheusSettingsPayload `json:"prometheus,omitempty"`
}

type ClickHouseSettingsPayload struct {
	Addr     string `json:"addr"`
	Database string `json:"database"`
	User     string `json:"user"`
	Password string `json:"password"`
}

type ESSettingsPayload struct {
	Addresses   []string `json:"addresses"`
	Username    string   `json:"username"`
	Password    string   `json:"password"`
	APIKey      string   `json:"api_key"`
	IndexPrefix string   `json:"index_prefix"`
}

type PrometheusSettingsPayload struct {
	URL      string `json:"url"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type AnalyticsBackendHandler struct {
	proxy         *repository.AnalyticsProxy
	settings      *repository.SettingsRepository
	routeResolver repository.RouteIDResolver
	auditor       *middleware.AuditLogger
	logger        *zap.Logger
}

func NewAnalyticsBackendHandler(
	proxy *repository.AnalyticsProxy,
	settings *repository.SettingsRepository,
	auditor *middleware.AuditLogger,
	logger *zap.Logger,
) *AnalyticsBackendHandler {
	return &AnalyticsBackendHandler{
		proxy:    proxy,
		settings: settings,
		auditor:  auditor,
		logger:   logger,
	}
}

// SetRouteResolver sets the RouteIDResolver for Prometheus queries.
// Called after the route resolver is created in main.go.
func (h *AnalyticsBackendHandler) SetRouteResolver(resolver repository.RouteIDResolver) {
	h.routeResolver = resolver
}

// TestClickHouse tests a ClickHouse connection.
func (h *AnalyticsBackendHandler) TestClickHouse(c *gin.Context) {
	var req struct {
		Addr     string `json:"addr" binding:"required"`
		Database string `json:"database" binding:"required"`
		User     string `json:"user"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err := repository.TestClickHouseConnection(ctx, req.Addr, req.Database, req.User, req.Password); err != nil {
		c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
			"ok":      false,
			"message": err.Error(),
		}))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
		"ok":      true,
		"message": "Connection successful",
	}))
}

// TestElasticsearch tests an Elasticsearch connection.
func (h *AnalyticsBackendHandler) TestElasticsearch(c *gin.Context) {
	var req struct {
		Addresses []string `json:"addresses" binding:"required"`
		Username  string   `json:"username"`
		Password  string   `json:"password"`
		APIKey    string   `json:"api_key"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	if err := repository.TestElasticsearchConnection(req.Addresses, req.Username, req.Password, req.APIKey); err != nil {
		c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
			"ok":      false,
			"message": err.Error(),
		}))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
		"ok":      true,
		"message": "Connection successful",
	}))
}

// TestPrometheus tests a Prometheus/VictoriaMetrics connection.
func (h *AnalyticsBackendHandler) TestPrometheus(c *gin.Context) {
	var req struct {
		URL      string `json:"url" binding:"required"`
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err := repository.TestPrometheusConnection(ctx, req.URL, req.Username, req.Password); err != nil {
		c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
			"ok":      false,
			"message": err.Error(),
		}))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
		"ok":      true,
		"message": "Connection successful",
	}))
}

// SwitchBackend changes both trace and metrics backend at once (legacy).
func (h *AnalyticsBackendHandler) SwitchBackend(c *gin.Context) {
	var req AnalyticsBackendSettings
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	ctx := c.Request.Context()

	switch req.Type {
	case "postgresql":
		h.proxy.SwitchToPostgreSQL()

	case "clickhouse":
		if req.ClickHouse == nil {
			c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "clickhouse config required"))
			return
		}
		if err := h.proxy.SwitchToClickHouse(ctx,
			req.ClickHouse.Addr, req.ClickHouse.Database,
			req.ClickHouse.User, req.ClickHouse.Password,
		); err != nil {
			c.JSON(http.StatusBadRequest, model.NewErrorResponse("SWITCH_FAILED", err.Error()))
			return
		}

	case "elasticsearch":
		if req.Elasticsearch == nil {
			c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "elasticsearch config required"))
			return
		}
		prefix := req.Elasticsearch.IndexPrefix
		if prefix == "" {
			prefix = "fuseone"
		}
		if err := h.proxy.SwitchToElasticsearch(ctx,
			req.Elasticsearch.Addresses, req.Elasticsearch.Username,
			req.Elasticsearch.Password, req.Elasticsearch.APIKey, prefix,
		); err != nil {
			c.JSON(http.StatusBadRequest, model.NewErrorResponse("SWITCH_FAILED", err.Error()))
			return
		}

	default:
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "invalid type: must be postgresql, clickhouse, or elasticsearch"))
		return
	}

	// Persist as split format
	h.persistSplitSettings(ctx, c, req.Type, req.Type, &req)

	h.auditor.LogSuccess(c, "update", "analytics_backend", nil, "")
	h.logger.Info("analytics backend switched", zap.String("type", req.Type))

	c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
		"trace_backend":   req.Type,
		"metrics_backend": req.Type,
		"message":         "Backend switched successfully",
	}))
}

// SwitchTraceBackend changes only the trace storage backend.
func (h *AnalyticsBackendHandler) SwitchTraceBackend(c *gin.Context) {
	var req BackendConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	ctx := c.Request.Context()

	if err := h.applyTraceBackend(ctx, &req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("SWITCH_FAILED", err.Error()))
		return
	}

	h.persistCurrentSettings(ctx, c)
	h.auditor.LogSuccess(c, "update", "trace_backend", nil, "")

	c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
		"trace_backend": req.Type,
		"message":       "Trace backend switched successfully",
	}))
}

// SwitchMetricsBackend changes only the metrics storage backend.
func (h *AnalyticsBackendHandler) SwitchMetricsBackend(c *gin.Context) {
	var req BackendConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	ctx := c.Request.Context()

	if err := h.applyMetricsBackend(ctx, &req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("SWITCH_FAILED", err.Error()))
		return
	}

	h.persistCurrentSettings(ctx, c)
	h.auditor.LogSuccess(c, "update", "metrics_backend", nil, "")

	c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
		"metrics_backend": req.Type,
		"message":         "Metrics backend switched successfully",
	}))
}

// GetStatus returns the current analytics backend status.
func (h *AnalyticsBackendHandler) GetStatus(c *gin.Context) {
	c.JSON(http.StatusOK, model.NewDataResponse(gin.H{
		"type":            string(h.proxy.CurrentTraceType()), // backward compat
		"trace_backend":   string(h.proxy.CurrentTraceType()),
		"metrics_backend": string(h.proxy.CurrentMetricsType()),
	}))
}

// InitFromSettings reads the analytics_backend setting and switches if needed.
func (h *AnalyticsBackendHandler) InitFromSettings(ctx context.Context) {
	raw, err := h.settings.Get(ctx, "analytics_backend")
	if err != nil || raw == nil {
		h.initLegacyClickHouse(ctx)
		return
	}

	var settings AnalyticsBackendSettings
	if json.Unmarshal(raw, &settings) != nil {
		return
	}

	// New split format
	if settings.TraceBackend != nil || settings.MetricsBackend != nil {
		if settings.TraceBackend != nil {
			if err := h.applyTraceBackend(ctx, settings.TraceBackend); err != nil {
				h.logger.Warn("failed to init trace backend", zap.String("type", settings.TraceBackend.Type), zap.Error(err))
			}
		}
		if settings.MetricsBackend != nil {
			if err := h.applyMetricsBackend(ctx, settings.MetricsBackend); err != nil {
				h.logger.Warn("failed to init metrics backend", zap.String("type", settings.MetricsBackend.Type), zap.Error(err))
			}
		}
		return
	}

	// Legacy single-backend format: apply to both
	switch settings.Type {
	case "clickhouse":
		if settings.ClickHouse != nil {
			if err := h.proxy.SwitchToClickHouse(ctx,
				settings.ClickHouse.Addr, settings.ClickHouse.Database,
				settings.ClickHouse.User, settings.ClickHouse.Password,
			); err != nil {
				h.logger.Warn("failed to init ClickHouse backend", zap.Error(err))
			}
		}
	case "elasticsearch":
		if settings.Elasticsearch != nil {
			prefix := settings.Elasticsearch.IndexPrefix
			if prefix == "" {
				prefix = "fuseone"
			}
			if err := h.proxy.SwitchToElasticsearch(ctx,
				settings.Elasticsearch.Addresses, settings.Elasticsearch.Username,
				settings.Elasticsearch.Password, settings.Elasticsearch.APIKey, prefix,
			); err != nil {
				h.logger.Warn("failed to init Elasticsearch backend", zap.Error(err))
			}
		}
	}
}

// ---------- Internal helpers ----------

func (h *AnalyticsBackendHandler) applyTraceBackend(ctx context.Context, cfg *BackendConfig) error {
	switch cfg.Type {
	case "postgresql":
		h.proxy.SwitchTraceToPostgreSQL()
		return nil
	case "clickhouse":
		if cfg.ClickHouse == nil {
			return fmt.Errorf("clickhouse config required")
		}
		return h.proxy.SwitchTraceToClickHouse(ctx,
			cfg.ClickHouse.Addr, cfg.ClickHouse.Database,
			cfg.ClickHouse.User, cfg.ClickHouse.Password)
	case "elasticsearch":
		if cfg.Elasticsearch == nil {
			return fmt.Errorf("elasticsearch config required")
		}
		prefix := cfg.Elasticsearch.IndexPrefix
		if prefix == "" {
			prefix = "fuseone"
		}
		return h.proxy.SwitchTraceToElasticsearch(ctx,
			cfg.Elasticsearch.Addresses, cfg.Elasticsearch.Username,
			cfg.Elasticsearch.Password, cfg.Elasticsearch.APIKey, prefix)
	default:
		return fmt.Errorf("invalid trace backend type: %s", cfg.Type)
	}
}

func (h *AnalyticsBackendHandler) applyMetricsBackend(ctx context.Context, cfg *BackendConfig) error {
	switch cfg.Type {
	case "postgresql":
		h.proxy.SwitchMetricsToPostgreSQL()
		return nil
	case "clickhouse":
		if cfg.ClickHouse == nil {
			return fmt.Errorf("clickhouse config required")
		}
		return h.proxy.SwitchMetricsToClickHouse(ctx,
			cfg.ClickHouse.Addr, cfg.ClickHouse.Database,
			cfg.ClickHouse.User, cfg.ClickHouse.Password)
	case "elasticsearch":
		if cfg.Elasticsearch == nil {
			return fmt.Errorf("elasticsearch config required")
		}
		prefix := cfg.Elasticsearch.IndexPrefix
		if prefix == "" {
			prefix = "fuseone"
		}
		return h.proxy.SwitchMetricsToElasticsearch(ctx,
			cfg.Elasticsearch.Addresses, cfg.Elasticsearch.Username,
			cfg.Elasticsearch.Password, cfg.Elasticsearch.APIKey, prefix)
	case "prometheus", "victoriametrics":
		if cfg.Prometheus == nil {
			return fmt.Errorf("prometheus config required")
		}
		backendType := repository.BackendPrometheus
		if cfg.Type == "victoriametrics" {
			backendType = repository.BackendVictoriaMetrics
		}
		return h.proxy.SwitchMetricsToPrometheus(ctx, backendType,
			cfg.Prometheus.URL, cfg.Prometheus.Username, cfg.Prometheus.Password,
			h.routeResolver)
	default:
		return fmt.Errorf("invalid metrics backend type: %s", cfg.Type)
	}
}

func (h *AnalyticsBackendHandler) persistSplitSettings(ctx context.Context, c *gin.Context, traceType, metricsType string, legacy *AnalyticsBackendSettings) {
	settings := AnalyticsBackendSettings{
		TraceBackend: &BackendConfig{
			Type:          traceType,
			ClickHouse:    legacy.ClickHouse,
			Elasticsearch: legacy.Elasticsearch,
		},
		MetricsBackend: &BackendConfig{
			Type:          metricsType,
			ClickHouse:    legacy.ClickHouse,
			Elasticsearch: legacy.Elasticsearch,
		},
	}
	data, _ := json.Marshal(settings)
	userID, _ := middleware.GetUserID(c)
	if err := h.settings.Upsert(ctx, "analytics_backend", data, userID); err != nil {
		h.logger.Error("failed to persist analytics backend setting", zap.Error(err))
	}
}

func (h *AnalyticsBackendHandler) persistCurrentSettings(ctx context.Context, c *gin.Context) {
	// Read current stored settings to preserve config for each backend
	raw, _ := h.settings.Get(ctx, "analytics_backend")
	var existing AnalyticsBackendSettings
	if raw != nil {
		json.Unmarshal(raw, &existing)
	}

	if existing.TraceBackend == nil {
		existing.TraceBackend = &BackendConfig{}
	}
	if existing.MetricsBackend == nil {
		existing.MetricsBackend = &BackendConfig{}
	}

	existing.TraceBackend.Type = string(h.proxy.CurrentTraceType())
	existing.MetricsBackend.Type = string(h.proxy.CurrentMetricsType())

	// Clear legacy fields
	existing.Type = ""

	data, _ := json.Marshal(existing)
	userID, _ := middleware.GetUserID(c)
	if err := h.settings.Upsert(ctx, "analytics_backend", data, userID); err != nil {
		h.logger.Error("failed to persist analytics backend setting", zap.Error(err))
	}
}

func (h *AnalyticsBackendHandler) initLegacyClickHouse(ctx context.Context) {
	chRaw, chErr := h.settings.Get(ctx, "clickhouse")
	if chErr != nil || chRaw == nil {
		return
	}
	var legacy struct {
		Enabled  bool   `json:"enabled"`
		Addr     string `json:"addr"`
		Database string `json:"database"`
		User     string `json:"user"`
		Password string `json:"password"`
	}
	if json.Unmarshal(chRaw, &legacy) == nil && legacy.Enabled {
		if err := h.proxy.SwitchToClickHouse(ctx, legacy.Addr, legacy.Database, legacy.User, legacy.Password); err != nil {
			h.logger.Warn("failed to init ClickHouse from legacy setting", zap.Error(err))
		}
	}
}
