package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/config"
	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
	"github.com/fuseone/api-gateway/internal/service"
)

type TraceHandler struct {
	repo       repository.TraceQuerier
	collector  *service.TraceCollector
	cfg        *config.TracingConfig
	policies   *service.SystemPolicies
	settings   *repository.SettingsRepository
	apiDefRepo *repository.ApiDefinitionRepository
	logger     *zap.Logger
}

func NewTraceHandler(
	repo repository.TraceQuerier,
	collector *service.TraceCollector,
	cfg *config.TracingConfig,
	policies *service.SystemPolicies,
	settings *repository.SettingsRepository,
	apiDefRepo *repository.ApiDefinitionRepository,
	logger *zap.Logger,
) *TraceHandler {
	return &TraceHandler{
		repo:       repo,
		collector:  collector,
		cfg:        cfg,
		policies:   policies,
		settings:   settings,
		apiDefRepo: apiDefRepo,
		logger:     logger,
	}
}

// ReceiveTraces handles POST /internal/traces from APISIX opentelemetry plugin.
// Accepts both protobuf (application/x-protobuf) and JSON (application/json).
func (h *TraceHandler) ReceiveTraces(c *gin.Context) {
	contentType := c.GetHeader("Content-Type")

	h.logger.Debug("trace data received",
		zap.String("content_type", contentType),
		zap.Int64("content_length", c.Request.ContentLength),
	)

	var count int
	var err error

	if strings.Contains(contentType, "protobuf") {
		count, err = h.collector.ProcessOTLP(c.Request.Body)
	} else {
		count, err = h.collector.ProcessJSON(c.Request.Body)
	}

	if err != nil {
		h.logger.Warn("failed to process traces", zap.Error(err))
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("PARSE_ERROR", err.Error()))
		return
	}

	h.logger.Debug("traces accepted", zap.Int("count", count))
	c.JSON(http.StatusOK, model.NewDataResponse(map[string]int{"accepted": count}))
}

// ListTraces handles GET /api/tracing/traces.
func (h *TraceHandler) ListTraces(c *gin.Context) {
	var params model.TraceListParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_PARAMS", err.Error()))
		return
	}

	// If api_id is provided, resolve it to apisix_route_ids
	if params.ApiID != "" && h.apiDefRepo != nil {
		apiUUID, err := uuid.Parse(params.ApiID)
		if err != nil {
			c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_PARAMS", "invalid api_id format"))
			return
		}
		apiDef, err := h.apiDefRepo.GetByID(c.Request.Context(), apiUUID)
		if err != nil {
			h.logger.Error("failed to get api definition", zap.Error(err), zap.String("api_id", params.ApiID))
			c.JSON(http.StatusInternalServerError, model.NewErrorResponse("LOOKUP_ERROR", "failed to resolve api routes"))
			return
		}
		if apiDef == nil {
			c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "api not found"))
			return
		}
		var routeIDs []string
		if len(apiDef.APISIXRouteIDs) > 0 {
			json.Unmarshal(apiDef.APISIXRouteIDs, &routeIDs)
		}
		if len(routeIDs) == 0 {
			// API has no deployed routes — return empty
			c.JSON(http.StatusOK, model.NewListResponse([]model.RequestTrace{}, 0, 1, 50))
			return
		}
		params.RouteIDs = routeIDs
		params.RouteID = "" // clear single route_id in favor of RouteIDs
	}

	traces, total, err := h.repo.List(c.Request.Context(), params)
	if err != nil {
		h.logger.Error("failed to list traces", zap.Error(err))
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("LIST_ERROR", err.Error()))
		return
	}

	limit := params.Limit
	if limit <= 0 {
		limit = 50
	}
	page := (params.Offset / limit) + 1

	c.JSON(http.StatusOK, model.NewListResponse(traces, total, page, limit))
}

// GetTrace handles GET /api/tracing/traces/:trace_id.
func (h *TraceHandler) GetTrace(c *gin.Context) {
	traceID := c.Param("trace_id")
	if traceID == "" {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_ID", "trace_id is required"))
		return
	}

	trace, err := h.repo.GetByTraceID(c.Request.Context(), traceID)
	if err != nil {
		h.logger.Error("failed to get trace", zap.Error(err), zap.String("trace_id", traceID))
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "trace not found"))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(trace))
}

// GetTracingStatus handles GET /api/tracing/status.
func (h *TraceHandler) GetTracingStatus(c *gin.Context) {
	c.JSON(http.StatusOK, model.NewDataResponse(map[string]interface{}{
		"enabled":        h.cfg.Enabled,
		"sample_rate":    h.cfg.SampleRate,
		"retention_days": h.cfg.RetentionDays,
	}))
}

// UpdateTracingSettings handles PUT /api/tracing/settings.
// Updates tracing config (enabled, sample_rate, retention_days) and pushes to APISIX.
func (h *TraceHandler) UpdateTracingSettings(c *gin.Context) {
	var req struct {
		Enabled       *bool    `json:"enabled"`
		SampleRate    *float64 `json:"sample_rate"`
		RetentionDays *int     `json:"retention_days"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_BODY", err.Error()))
		return
	}

	enabled := h.cfg.Enabled
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	sampleRate := h.cfg.SampleRate
	if req.SampleRate != nil {
		sr := *req.SampleRate
		if sr < 0 || sr > 1.0 {
			c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_PARAMS", "sample_rate must be between 0 and 1"))
			return
		}
		sampleRate = sr
	}

	retentionDays := h.cfg.RetentionDays
	if req.RetentionDays != nil {
		rd := *req.RetentionDays
		if rd < 1 || rd > 365 {
			c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_PARAMS", "retention_days must be between 1 and 365"))
			return
		}
		retentionDays = rd
	}

	// Push to APISIX and update in-memory config
	if err := h.policies.UpdateTracing(c.Request.Context(), enabled, sampleRate, retentionDays); err != nil {
		h.logger.Error("failed to update tracing settings", zap.Error(err))
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("UPDATE_ERROR", "failed to apply tracing settings"))
		return
	}

	// Persist to settings store
	settingsValue := map[string]interface{}{
		"enabled":        enabled,
		"sample_rate":    sampleRate,
		"retention_days": retentionDays,
	}
	raw, _ := json.Marshal(settingsValue)
	if h.settings != nil {
		userID, _ := middleware.GetUserID(c)
		_ = h.settings.Upsert(c.Request.Context(), "tracing", raw, userID)
	}

	h.logger.Info("tracing settings updated",
		zap.Bool("enabled", enabled),
		zap.Float64("sample_rate", sampleRate),
		zap.Int("retention_days", retentionDays),
	)

	c.JSON(http.StatusOK, model.NewDataResponse(map[string]interface{}{
		"enabled":        enabled,
		"sample_rate":    sampleRate,
		"retention_days": retentionDays,
	}))
}
