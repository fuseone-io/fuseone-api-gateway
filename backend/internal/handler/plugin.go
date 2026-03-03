package handler

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/service"
)

type PluginHandler struct {
	registry *service.APISIXClientRegistry
	audit    *middleware.AuditLogger
}

func NewPluginHandler(registry *service.APISIXClientRegistry, audit *middleware.AuditLogger) *PluginHandler {
	return &PluginHandler{registry: registry, audit: audit}
}

func (h *PluginHandler) ListPlugins(c *gin.Context) {
	client, err := h.registry.GetClient(c.Request.Context(), middleware.GetEnvironmentID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("ENVIRONMENT_ERROR", err.Error()))
		return
	}

	result, err := client.ListPlugins(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("APISIX_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(json.RawMessage(result)))
}

func (h *PluginHandler) GetPluginSchema(c *gin.Context) {
	client, err := h.registry.GetClient(c.Request.Context(), middleware.GetEnvironmentID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("ENVIRONMENT_ERROR", err.Error()))
		return
	}

	name := c.Param("name")

	result, err := client.GetPluginSchema(c.Request.Context(), name)
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("APISIX_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(json.RawMessage(result)))
}

func (h *PluginHandler) ReloadPlugins(c *gin.Context) {
	client, err := h.registry.GetClient(c.Request.Context(), middleware.GetEnvironmentID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("ENVIRONMENT_ERROR", err.Error()))
		return
	}

	err = client.ReloadPlugins(c.Request.Context())
	if err != nil {
		if h.audit != nil {
			h.audit.LogError(c, "RELOAD", "plugins", nil, "", err.Error())
		}
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("APISIX_ERROR", err.Error()))
		return
	}

	if h.audit != nil {
		h.audit.LogSuccess(c, "RELOAD", "plugins", nil, "Plugin hot-reload triggered")
	}
	c.JSON(http.StatusOK, model.NewDataResponse(map[string]string{
		"message": "Plugins reloaded successfully",
	}))
}
