package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
	"github.com/fuseone/api-gateway/internal/service"
)

// ApiDefReader is a minimal interface for looking up API definitions.
type ApiDefReader interface {
	GetByID(ctx context.Context, id uuid.UUID) (*model.ApiDefinition, error)
}

type DebugLogHandler struct {
	repo        repository.DebugLogQuerier
	hub         *service.DebugHub
	registry    *service.APISIXClientRegistry
	audit       *middleware.AuditLogger
	apiDefs     ApiDefReader
	logger      *zap.Logger
	callbackURL string
}

func NewDebugLogHandler(
	repo repository.DebugLogQuerier,
	hub *service.DebugHub,
	registry *service.APISIXClientRegistry,
	audit *middleware.AuditLogger,
	apiDefs ApiDefReader,
	logger *zap.Logger,
	callbackURL string,
) *DebugLogHandler {
	return &DebugLogHandler{
		repo:        repo,
		hub:         hub,
		registry:    registry,
		audit:       audit,
		apiDefs:     apiDefs,
		logger:      logger,
		callbackURL: callbackURL,
	}
}

// apisixLogEntry maps the APISIX http-logger JSON format.
// Actual APISIX 3.x payload shape (latencies are top-level, not nested):
//
//	{
//	  "client_ip": "...", "route_id": "...", "service_id": "...",
//	  "start_time": 1772463303308,          // milliseconds
//	  "latency": 1063.99,                   // total (ms, float)
//	  "upstream_latency": 1056,              // ms
//	  "apisix_latency": 7.99,               // ms
//	  "request": { "method", "uri", "url", "headers", "body", "size", "querystring" },
//	  "response": { "status", "headers", "body", "size" },
//	  "upstream": "host:port",
//	  "consumer": { "username": "..." },
//	  "server": { "hostname", "version" }
//	}
type apisixLogEntry struct {
	ClientIP  string          `json:"client_ip"`
	RouteID   json.RawMessage `json:"route_id"`
	ServiceID json.RawMessage `json:"service_id"`
	Consumer  *struct {
		Username string `json:"username"`
	} `json:"consumer"`
	StartTime       float64 `json:"start_time"` // Unix ms
	Latency         float64 `json:"latency"`    // total ms
	UpstreamLatency float64 `json:"upstream_latency"`
	APISIXLatency   float64 `json:"apisix_latency"`
	Request         struct {
		Method  string          `json:"method"`
		URI     string          `json:"uri"`
		URL     string          `json:"url"`
		Headers json.RawMessage `json:"headers"`
		Body    *string         `json:"body"`
		Size    int             `json:"size"`
	} `json:"request"`
	Response struct {
		Status  int             `json:"status"`
		Headers json.RawMessage `json:"headers"`
		Body    *string         `json:"body"`
		Size    int             `json:"size"`
	} `json:"response"`
	Upstream json.RawMessage `json:"upstream"`
}

// rawToString extracts a string from a json.RawMessage that may be a JSON string or number.
func rawToString(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" || string(raw) == `""` {
		return ""
	}
	var s string
	if json.Unmarshal(raw, &s) == nil {
		return s
	}
	// Might be a number (APISIX sometimes sends route_id as number)
	return strings.Trim(string(raw), `"`)
}

// flattenHeaders converts APISIX headers (where values can be strings or arrays) to a flat map.
func flattenHeaders(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var m map[string]interface{}
	if json.Unmarshal(raw, &m) != nil {
		return raw // return as-is if not a map
	}
	flat := make(map[string]string, len(m))
	for k, v := range m {
		switch val := v.(type) {
		case string:
			flat[k] = val
		case []interface{}:
			if len(val) > 0 {
				flat[k] = fmt.Sprintf("%v", val[0])
			}
		default:
			flat[k] = fmt.Sprintf("%v", v)
		}
	}
	out, _ := json.Marshal(flat)
	return out
}

func (e *apisixLogEntry) toDebugLog() model.DebugLog {
	reqHeaders := flattenHeaders(e.Request.Headers)
	respHeaders := flattenHeaders(e.Response.Headers)

	var consumerName string
	if e.Consumer != nil {
		consumerName = e.Consumer.Username
	}

	upstreamLatency := int(e.UpstreamLatency)
	gatewayLatency := int(e.APISIXLatency)

	requestTime := time.UnixMilli(int64(e.StartTime))

	return model.DebugLog{
		RouteID:         rawToString(e.RouteID),
		ServiceID:       rawToString(e.ServiceID),
		ConsumerName:    consumerName,
		ReqMethod:       e.Request.Method,
		ReqURI:          e.Request.URI,
		ReqHeaders:      reqHeaders,
		ReqBody:         e.Request.Body,
		ReqSize:         e.Request.Size,
		ClientIP:        e.ClientIP,
		RespStatus:      int16(e.Response.Status),
		RespHeaders:     respHeaders,
		RespBody:        e.Response.Body,
		RespSize:        e.Response.Size,
		LatencyTotal:    int(e.Latency),
		LatencyUpstream: &upstreamLatency,
		LatencyGateway:  &gatewayLatency,
		UpstreamAddr:    rawToString(e.Upstream),
		RequestTime:     requestTime,
	}
}

// ReceiveLogs handles POST /internal/debug-logs from APISIX http-logger.
// Accepts both a single JSON object and a JSON array (batch mode).
func (h *DebugLogHandler) ReceiveLogs(c *gin.Context) {
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("READ_ERROR", "failed to read body"))
		return
	}

	var entries []apisixLogEntry

	// Try array first, then single object
	if err := json.Unmarshal(bodyBytes, &entries); err != nil {
		var single apisixLogEntry
		if err := json.Unmarshal(bodyBytes, &single); err != nil {
			h.logger.Warn("failed to parse APISIX log payload",
				zap.Error(err),
				zap.String("raw_body", string(bodyBytes[:min(len(bodyBytes), 2000)])),
			)
			c.JSON(http.StatusBadRequest, model.NewErrorResponse("PARSE_ERROR", "invalid log format"))
			return
		}
		entries = []apisixLogEntry{single}
	}

	if len(entries) == 0 {
		c.JSON(http.StatusOK, model.NewDataResponse(map[string]int{"received": 0}))
		return
	}

	logs := make([]model.DebugLog, 0, len(entries))
	for i := range entries {
		logs = append(logs, entries[i].toDebugLog())
	}

	// Persist to DB
	if err := h.repo.BatchInsert(c.Request.Context(), logs); err != nil {
		h.logger.Error("failed to insert debug logs", zap.Error(err))
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INSERT_ERROR", "failed to store logs"))
		return
	}

	// Broadcast to SSE subscribers
	for i := range logs {
		h.hub.Broadcast(logs[i])
	}

	c.JSON(http.StatusOK, model.NewDataResponse(map[string]int{"received": len(logs)}))
}

// ListLogs handles GET /api/debug/logs with query filters.
// Supports api_id param: resolves to all route_ids belonging to that API.
func (h *DebugLogHandler) ListLogs(c *gin.Context) {
	var filter model.DebugLogFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_FILTER", err.Error()))
		return
	}

	// If api_id is provided, resolve to route IDs
	apiID := c.Query("api_id")
	if apiID != "" {
		routeIDs, err := h.resolveApiRouteIDs(c.Request.Context(), apiID)
		if err != nil {
			c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_API", err.Error()))
			return
		}
		filter.RouteIDs = routeIDs
		filter.RouteID = "" // api_id takes precedence
	}

	logs, total, err := h.repo.List(c.Request.Context(), filter)
	if err != nil {
		h.logger.Error("failed to list debug logs", zap.Error(err))
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("LIST_ERROR", err.Error()))
		return
	}

	limit := filter.Limit
	if limit == 0 {
		limit = 50
	}
	page := (filter.Offset / limit) + 1

	c.JSON(http.StatusOK, model.NewListResponse(logs, total, page, limit))
}

// GetLog handles GET /api/debug/logs/:id.
func (h *DebugLogHandler) GetLog(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_ID", "id must be a number"))
		return
	}

	log, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		h.logger.Error("failed to get debug log", zap.Error(err), zap.Int64("id", id))
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("GET_ERROR", err.Error()))
		return
	}
	if log == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "log not found"))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(log))
}

// StreamLogs handles GET /api/debug/logs/stream (SSE).
func (h *DebugLogHandler) StreamLogs(c *gin.Context) {
	routeFilter := c.Query("route_id")

	ch := h.hub.Subscribe(routeFilter)
	defer h.hub.Unsubscribe(ch)

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Flush()

	clientGone := c.Request.Context().Done()

	for {
		select {
		case <-clientGone:
			return
		case log, ok := <-ch:
			if !ok {
				return
			}
			data, err := json.Marshal(log)
			if err != nil {
				continue
			}
			c.SSEvent("log", string(data))
			c.Writer.Flush()
		}
	}
}

// ToggleDebug handles POST /api/debug/toggle/:route_id.
// Adds or removes the http-logger plugin from the route.
// Accepts optional JSON body: { "include_req_body": bool, "include_resp_body": bool }
func (h *DebugLogHandler) ToggleDebug(c *gin.Context) {
	client, err := h.registry.GetClient(c.Request.Context(), middleware.GetEnvironmentID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("ENVIRONMENT_ERROR", err.Error()))
		return
	}

	routeID := c.Param("route_id")
	opts := parseCaptureOptions(c)

	newState, err := h.toggleRouteDebug(c.Request.Context(), client, routeID, opts)
	if err != nil {
		h.logger.Error("failed to toggle debug", zap.Error(err), zap.String("route_id", routeID))
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("APISIX_ERROR", err.Error()))
		return
	}

	if h.audit != nil {
		action := "debug_enable"
		if !newState {
			action = "debug_disable"
		}
		h.audit.LogSuccess(c, action, "route", &routeID, "toggled debug mode")
	}

	c.JSON(http.StatusOK, model.NewDataResponse(map[string]interface{}{
		"route_id": routeID,
		"enabled":  newState,
	}))
}

// ToggleApiDebug handles POST /api/debug/toggle-api/:api_id.
// Toggles debug on ALL routes belonging to the API definition.
// Accepts optional JSON body: { "include_req_body": bool, "include_resp_body": bool }
func (h *DebugLogHandler) ToggleApiDebug(c *gin.Context) {
	client, err := h.registry.GetClient(c.Request.Context(), middleware.GetEnvironmentID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("ENVIRONMENT_ERROR", err.Error()))
		return
	}

	apiID := c.Param("api_id")
	opts := parseCaptureOptions(c)

	routeIDs, err := h.resolveApiRouteIDs(c.Request.Context(), apiID)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_API", err.Error()))
		return
	}
	if len(routeIDs) == 0 {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("NO_ROUTES", "API has no deployed routes"))
		return
	}

	// Check current state of first route to determine direction
	currentlyEnabled := h.isRouteDebugEnabled(c.Request.Context(), client, routeIDs[0])
	targetState := !currentlyEnabled

	results := make([]map[string]interface{}, 0, len(routeIDs))
	for _, rid := range routeIDs {
		enabled := h.isRouteDebugEnabled(c.Request.Context(), client, rid)
		// Only toggle if needed (ensure all routes end up in same state)
		if enabled != targetState {
			newState, err := h.toggleRouteDebug(c.Request.Context(), client, rid, opts)
			if err != nil {
				h.logger.Warn("failed to toggle route debug", zap.Error(err), zap.String("route_id", rid))
				results = append(results, map[string]interface{}{"route_id": rid, "enabled": enabled, "error": err.Error()})
				continue
			}
			results = append(results, map[string]interface{}{"route_id": rid, "enabled": newState})
		} else {
			results = append(results, map[string]interface{}{"route_id": rid, "enabled": enabled})
		}
	}

	if h.audit != nil {
		action := "debug_enable"
		if !targetState {
			action = "debug_disable"
		}
		h.audit.LogSuccess(c, action, "api", &apiID, "toggled debug mode for API")
	}

	c.JSON(http.StatusOK, model.NewDataResponse(map[string]interface{}{
		"api_id":  apiID,
		"enabled": targetState,
		"routes":  results,
	}))
}

// UpdateApiCaptureOptions handles PATCH /api/debug/capture-api/:api_id.
// Updates capture options on all enabled routes without toggling.
func (h *DebugLogHandler) UpdateApiCaptureOptions(c *gin.Context) {
	client, err := h.registry.GetClient(c.Request.Context(), middleware.GetEnvironmentID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("ENVIRONMENT_ERROR", err.Error()))
		return
	}

	apiID := c.Param("api_id")
	opts := parseCaptureOptions(c)

	routeIDs, err := h.resolveApiRouteIDs(c.Request.Context(), apiID)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_API", err.Error()))
		return
	}

	for _, rid := range routeIDs {
		if h.isRouteDebugEnabled(c.Request.Context(), client, rid) {
			if err := h.updateRouteCaptureOptions(c.Request.Context(), client, rid, opts); err != nil {
				h.logger.Warn("failed to update capture options", zap.Error(err), zap.String("route_id", rid))
			}
		}
	}

	c.JSON(http.StatusOK, model.NewDataResponse(map[string]interface{}{
		"api_id":            apiID,
		"include_req_body":  opts.IncludeReqBody,
		"include_resp_body": opts.IncludeRespBody,
	}))
}

// ApiDebugStatus handles GET /api/debug/status-api/:api_id.
func (h *DebugLogHandler) ApiDebugStatus(c *gin.Context) {
	client, err := h.registry.GetClient(c.Request.Context(), middleware.GetEnvironmentID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("ENVIRONMENT_ERROR", err.Error()))
		return
	}

	apiID := c.Param("api_id")

	routeIDs, err := h.resolveApiRouteIDs(c.Request.Context(), apiID)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_API", err.Error()))
		return
	}

	anyEnabled := false
	// Read capture options from first enabled route (all routes share the same config)
	includeReqBody := true
	includeRespBody := true
	captureRead := false

	routes := make([]map[string]interface{}, 0, len(routeIDs))
	for _, rid := range routeIDs {
		enabled := h.isRouteDebugEnabled(c.Request.Context(), client, rid)
		if enabled {
			anyEnabled = true
			if !captureRead {
				includeReqBody, includeRespBody = h.getRouteCaptureOptions(c.Request.Context(), client, rid)
				captureRead = true
			}
		}
		routes = append(routes, map[string]interface{}{"route_id": rid, "enabled": enabled})
	}

	c.JSON(http.StatusOK, model.NewDataResponse(map[string]interface{}{
		"api_id":            apiID,
		"enabled":           anyEnabled,
		"include_req_body":  includeReqBody,
		"include_resp_body": includeRespBody,
		"routes":            routes,
	}))
}

// DebugStatus handles GET /api/debug/status/:route_id.
func (h *DebugLogHandler) DebugStatus(c *gin.Context) {
	client, err := h.registry.GetClient(c.Request.Context(), middleware.GetEnvironmentID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("ENVIRONMENT_ERROR", err.Error()))
		return
	}

	routeID := c.Param("route_id")

	enabled := h.isRouteDebugEnabled(c.Request.Context(), client, routeID)
	includeReqBody, includeRespBody := h.getRouteCaptureOptions(c.Request.Context(), client, routeID)

	c.JSON(http.StatusOK, model.NewDataResponse(map[string]interface{}{
		"route_id":          routeID,
		"enabled":           enabled,
		"include_req_body":  includeReqBody,
		"include_resp_body": includeRespBody,
	}))
}

// ToggleDebugRequest is the optional JSON body for toggle endpoints.
// *bool fields distinguish "not sent" (nil → default true) from explicit false.
type ToggleDebugRequest struct {
	IncludeReqBody  *bool `json:"include_req_body"`
	IncludeRespBody *bool `json:"include_resp_body"`
}

// captureOptions holds the resolved boolean capture flags.
type captureOptions struct {
	IncludeReqBody  bool
	IncludeRespBody bool
}

// parseCaptureOptions reads ToggleDebugRequest from context body; defaults to true for both.
func parseCaptureOptions(c *gin.Context) captureOptions {
	opts := captureOptions{IncludeReqBody: true, IncludeRespBody: true}
	var body ToggleDebugRequest
	if c.Request.Body != nil && c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&body); err == nil {
			if body.IncludeReqBody != nil {
				opts.IncludeReqBody = *body.IncludeReqBody
			}
			if body.IncludeRespBody != nil {
				opts.IncludeRespBody = *body.IncludeRespBody
			}
		}
	}
	return opts
}

// --- internal helpers ---

// toggleRouteDebug toggles the http-logger plugin on a single route and returns the new state.
// When enabling, uses the provided capture options. Uses merge-patch to only modify http-logger.
func (h *DebugLogHandler) toggleRouteDebug(ctx context.Context, client *service.APISIXClient, routeID string, opts captureOptions) (bool, error) {
	enabled := h.isRouteDebugEnabled(ctx, client, routeID)

	var patchPlugins map[string]interface{}
	if enabled {
		// Remove http-logger via merge-patch (null deletes the key)
		patchPlugins = map[string]interface{}{
			"http-logger": nil,
		}
	} else {
		// Add http-logger plugin with capture options
		patchPlugins = map[string]interface{}{
			"http-logger": map[string]interface{}{
				"uri":               h.callbackURL,
				"batch_max_size":    1,
				"concat_method":     "json",
				"include_req_body":  opts.IncludeReqBody,
				"include_resp_body": opts.IncludeRespBody,
			},
		}
	}

	patchData, _ := json.Marshal(map[string]interface{}{"plugins": patchPlugins})
	h.logger.Info("patching route for debug toggle",
		zap.String("route_id", routeID),
		zap.Bool("enabling", !enabled),
		zap.String("patch", string(patchData)),
	)

	if _, err := client.Patch(ctx, "routes", routeID, patchData); err != nil {
		return false, fmt.Errorf("APISIX patch failed for route %s: %w", routeID, err)
	}

	return !enabled, nil
}

// updateRouteCaptureOptions patches only the capture options on an already-enabled route.
func (h *DebugLogHandler) updateRouteCaptureOptions(ctx context.Context, client *service.APISIXClient, routeID string, opts captureOptions) error {
	patchPlugins := map[string]interface{}{
		"http-logger": map[string]interface{}{
			"uri":               h.callbackURL,
			"batch_max_size":    1,
			"concat_method":     "json",
			"include_req_body":  opts.IncludeReqBody,
			"include_resp_body": opts.IncludeRespBody,
		},
	}
	patchData, _ := json.Marshal(map[string]interface{}{"plugins": patchPlugins})
	if _, err := client.Patch(ctx, "routes", routeID, patchData); err != nil {
		return fmt.Errorf("APISIX patch failed for route %s: %w", routeID, err)
	}
	return nil
}

// isRouteDebugEnabled checks if a route has our http-logger.
func (h *DebugLogHandler) isRouteDebugEnabled(ctx context.Context, client *service.APISIXClient, routeID string) bool {
	routeRaw, err := client.Get(ctx, "routes", routeID)
	if err != nil {
		return false
	}
	var routeResp struct {
		Value struct {
			Plugins map[string]interface{} `json:"plugins"`
		} `json:"value"`
	}
	if err := json.Unmarshal(routeRaw, &routeResp); err != nil {
		return false
	}
	return h.hasOurHttpLogger(routeResp.Value.Plugins)
}

// getRouteCaptureOptions reads include_req_body / include_resp_body from the http-logger config.
// Returns (true, true) as defaults if the route can't be read or debug is off.
func (h *DebugLogHandler) getRouteCaptureOptions(ctx context.Context, client *service.APISIXClient, routeID string) (includeReqBody, includeRespBody bool) {
	includeReqBody = true
	includeRespBody = true

	routeRaw, err := client.Get(ctx, "routes", routeID)
	if err != nil {
		return
	}
	var routeResp struct {
		Value struct {
			Plugins map[string]interface{} `json:"plugins"`
		} `json:"value"`
	}
	if err := json.Unmarshal(routeRaw, &routeResp); err != nil {
		return
	}
	httpLogger, ok := routeResp.Value.Plugins["http-logger"]
	if !ok || httpLogger == nil {
		return
	}
	loggerMap, ok := httpLogger.(map[string]interface{})
	if !ok {
		return
	}
	if v, ok := loggerMap["include_req_body"].(bool); ok {
		includeReqBody = v
	}
	if v, ok := loggerMap["include_resp_body"].(bool); ok {
		includeRespBody = v
	}
	return
}

// resolveApiRouteIDs looks up an API definition and returns its APISIX route IDs.
func (h *DebugLogHandler) resolveApiRouteIDs(ctx context.Context, apiIDStr string) ([]string, error) {
	id, err := uuid.Parse(apiIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid api_id: %s", apiIDStr)
	}

	apiDef, err := h.apiDefs.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup API: %w", err)
	}
	if apiDef == nil {
		return nil, fmt.Errorf("API not found: %s", apiIDStr)
	}

	var routeIDs []string
	if apiDef.APISIXRouteIDs != nil {
		if err := json.Unmarshal(apiDef.APISIXRouteIDs, &routeIDs); err != nil {
			return nil, fmt.Errorf("invalid route IDs in API definition: %w", err)
		}
	}
	return routeIDs, nil
}

// DebugActiveRoutes handles GET /api/debug/active-routes.
// Returns all APISIX route IDs that currently have our http-logger (debug) enabled.
// The frontend uses this to show debug badges on the API listing by matching route IDs locally.
func (h *DebugLogHandler) DebugActiveRoutes(c *gin.Context) {
	client, err := h.registry.GetClient(c.Request.Context(), middleware.GetEnvironmentID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("ENVIRONMENT_ERROR", err.Error()))
		return
	}

	listResp, err := client.List(c.Request.Context(), "routes")
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("APISIX_ERROR", "Failed to list routes"))
		return
	}

	activeRouteIDs := make([]string, 0)
	for _, node := range listResp.List {
		var route struct {
			ID      interface{}                    `json:"id"`
			Plugins map[string]interface{} `json:"plugins"`
		}
		if err := json.Unmarshal(node.Value, &route); err != nil {
			continue
		}
		if h.hasOurHttpLogger(route.Plugins) {
			activeRouteIDs = append(activeRouteIDs, fmt.Sprintf("%v", route.ID))
		}
	}

	c.JSON(http.StatusOK, model.NewDataResponse(activeRouteIDs))
}

// hasOurHttpLogger checks if the route has an http-logger plugin pointing to our callback URL.
func (h *DebugLogHandler) hasOurHttpLogger(plugins map[string]interface{}) bool {
	if plugins == nil {
		return false
	}
	httpLogger, ok := plugins["http-logger"]
	if !ok || httpLogger == nil {
		return false
	}
	loggerMap, ok := httpLogger.(map[string]interface{})
	if !ok {
		return false
	}
	uri, _ := loggerMap["uri"].(string)
	return uri == h.callbackURL
}
