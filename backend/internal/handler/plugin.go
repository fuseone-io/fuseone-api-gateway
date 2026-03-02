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
	apisix *service.APISIXClient
	audit  *middleware.AuditLogger
}

func NewPluginHandler(apisix *service.APISIXClient, audit *middleware.AuditLogger) *PluginHandler {
	return &PluginHandler{apisix: apisix, audit: audit}
}

func (h *PluginHandler) ListPlugins(c *gin.Context) {
	result, err := h.apisix.ListPlugins(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("APISIX_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(json.RawMessage(result)))
}

func (h *PluginHandler) GetPluginSchema(c *gin.Context) {
	name := c.Param("name")

	result, err := h.apisix.GetPluginSchema(c.Request.Context(), name)
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("APISIX_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(json.RawMessage(result)))
}

func (h *PluginHandler) ReloadPlugins(c *gin.Context) {
	err := h.apisix.ReloadPlugins(c.Request.Context())
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
