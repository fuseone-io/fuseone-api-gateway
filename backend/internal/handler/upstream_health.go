package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/service"
)

type UpstreamHealthHandler struct {
	registry *service.APISIXClientRegistry
	apiDefs  ApiDefReader
}

func NewUpstreamHealthHandler(registry *service.APISIXClientRegistry, apiDefs ApiDefReader) *UpstreamHealthHandler {
	return &UpstreamHealthHandler{registry: registry, apiDefs: apiDefs}
}

func (h *UpstreamHealthHandler) GetHealth(c *gin.Context) {
	client, err := h.registry.GetClient(c.Request.Context(), middleware.GetEnvironmentID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("ENVIRONMENT_ERROR", err.Error()))
		return
	}

	body, err := client.GetUpstreamHealth(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("CONTROL_API_ERROR", err.Error()))
		return
	}

	var result json.RawMessage
	if err := json.Unmarshal(body, &result); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("PARSE_ERROR", "failed to parse health check response"))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(result))
}

// GetHealthForAPI handles GET /api/apis/:id/health.
// Returns upstream health checkers filtered to the API's service and routes.
func (h *UpstreamHealthHandler) GetHealthForAPI(c *gin.Context) {
	apiIDStr := c.Param("id")
	apiID, err := uuid.Parse(apiIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_ID", "invalid API ID"))
		return
	}

	apiDef, err := h.apiDefs.GetByID(c.Request.Context(), apiID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DB_ERROR", err.Error()))
		return
	}
	if apiDef == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "API not found"))
		return
	}

	// Collect APISIX IDs to match against health checker names
	matchIDs := make(map[string]bool)
	if apiDef.APISIXServiceID != nil && *apiDef.APISIXServiceID != "" {
		matchIDs[*apiDef.APISIXServiceID] = true
	}
	if apiDef.APISIXRouteIDs != nil {
		var routeIDs []string
		if err := json.Unmarshal(apiDef.APISIXRouteIDs, &routeIDs); err == nil {
			for _, rid := range routeIDs {
				matchIDs[rid] = true
			}
		}
	}

	// If API has no APISIX resources, return empty
	if len(matchIDs) == 0 {
		c.JSON(http.StatusOK, model.NewDataResponse([]interface{}{}))
		return
	}

	client, err := h.registry.GetClient(c.Request.Context(), middleware.GetEnvironmentID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("ENVIRONMENT_ERROR", err.Error()))
		return
	}

	body, err := client.GetUpstreamHealth(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("CONTROL_API_ERROR", err.Error()))
		return
	}

	// Parse health checker array and filter
	var checkers []json.RawMessage
	if err := json.Unmarshal(body, &checkers); err != nil {
		// Might be an empty object or error response
		c.JSON(http.StatusOK, model.NewDataResponse([]interface{}{}))
		return
	}

	var filtered []json.RawMessage
	for _, raw := range checkers {
		var checker struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal(raw, &checker); err != nil {
			continue
		}
		if matchesAPIResource(checker.Name, matchIDs) {
			filtered = append(filtered, raw)
		}
	}

	if filtered == nil {
		filtered = []json.RawMessage{}
	}
	c.JSON(http.StatusOK, model.NewDataResponse(filtered))
}

// matchesAPIResource checks if a health checker name like "/apisix/routes/123"
// or "/apisix/services/456" matches any of the given APISIX resource IDs.
func matchesAPIResource(checkerName string, ids map[string]bool) bool {
	// Health checker names follow pattern: /apisix/{resource_type}/{id}
	parts := strings.Split(checkerName, "/")
	if len(parts) >= 4 {
		resourceID := parts[len(parts)-1]
		if ids[resourceID] {
			return true
		}
	}
	// Also check if any ID appears as substring (for nested patterns)
	for id := range ids {
		if strings.Contains(checkerName, fmt.Sprintf("/%s", id)) {
			return true
		}
	}
	return false
}
