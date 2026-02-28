package handler

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/service"
)

type PluginHandler struct {
	apisix *service.APISIXClient
}

func NewPluginHandler(apisix *service.APISIXClient) *PluginHandler {
	return &PluginHandler{apisix: apisix}
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
