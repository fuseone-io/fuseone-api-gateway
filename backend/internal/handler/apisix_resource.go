package handler

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/service"
)

// APISIXResourceHandler provides generic CRUD for any APISIX resource type
type APISIXResourceHandler struct {
	registry     *service.APISIXClientRegistry
	audit        *middleware.AuditLogger
	resourceName string // e.g., "routes", "services", "upstreams"
}

func NewAPISIXResourceHandler(registry *service.APISIXClientRegistry, audit *middleware.AuditLogger, resourceName string) *APISIXResourceHandler {
	return &APISIXResourceHandler{
		registry:     registry,
		audit:        audit,
		resourceName: resourceName,
	}
}

func (h *APISIXResourceHandler) List(c *gin.Context) {
	client, err := h.registry.GetClient(c.Request.Context(), middleware.GetEnvironmentID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("ENVIRONMENT_ERROR", err.Error()))
		return
	}

	result, err := client.List(c.Request.Context(), h.resourceName)
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("APISIX_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(result))
}

func (h *APISIXResourceHandler) Get(c *gin.Context) {
	client, err := h.registry.GetClient(c.Request.Context(), middleware.GetEnvironmentID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("ENVIRONMENT_ERROR", err.Error()))
		return
	}

	id := c.Param("id")

	result, err := client.Get(c.Request.Context(), h.resourceName, id)
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("APISIX_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(json.RawMessage(result)))
}

func (h *APISIXResourceHandler) Create(c *gin.Context) {
	client, err := h.registry.GetClient(c.Request.Context(), middleware.GetEnvironmentID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("ENVIRONMENT_ERROR", err.Error()))
		return
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid request body"))
		return
	}

	result, err := client.Create(c.Request.Context(), h.resourceName, body)
	if err != nil {
		h.audit.LogError(c, "CREATE", h.resourceName, nil, string(body), err.Error())
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("APISIX_ERROR", err.Error()))
		return
	}

	h.audit.LogSuccess(c, "CREATE", h.resourceName, nil, string(body))
	c.JSON(http.StatusCreated, model.NewDataResponse(json.RawMessage(result)))
}

func (h *APISIXResourceHandler) Update(c *gin.Context) {
	client, err := h.registry.GetClient(c.Request.Context(), middleware.GetEnvironmentID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("ENVIRONMENT_ERROR", err.Error()))
		return
	}

	id := c.Param("id")
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid request body"))
		return
	}

	result, err := client.Update(c.Request.Context(), h.resourceName, id, body)
	if err != nil {
		h.audit.LogError(c, "UPDATE", h.resourceName, &id, string(body), err.Error())
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("APISIX_ERROR", err.Error()))
		return
	}

	h.audit.LogSuccess(c, "UPDATE", h.resourceName, &id, string(body))
	c.JSON(http.StatusOK, model.NewDataResponse(json.RawMessage(result)))
}

func (h *APISIXResourceHandler) Patch(c *gin.Context) {
	client, err := h.registry.GetClient(c.Request.Context(), middleware.GetEnvironmentID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("ENVIRONMENT_ERROR", err.Error()))
		return
	}

	id := c.Param("id")
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid request body"))
		return
	}

	result, err := client.Patch(c.Request.Context(), h.resourceName, id, body)
	if err != nil {
		h.audit.LogError(c, "UPDATE", h.resourceName, &id, string(body), err.Error())
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("APISIX_ERROR", err.Error()))
		return
	}

	h.audit.LogSuccess(c, "UPDATE", h.resourceName, &id, string(body))
	c.JSON(http.StatusOK, model.NewDataResponse(json.RawMessage(result)))
}

func (h *APISIXResourceHandler) Delete(c *gin.Context) {
	client, err := h.registry.GetClient(c.Request.Context(), middleware.GetEnvironmentID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("ENVIRONMENT_ERROR", err.Error()))
		return
	}

	id := c.Param("id")

	if err := client.Delete(c.Request.Context(), h.resourceName, id); err != nil {
		h.audit.LogError(c, "DELETE", h.resourceName, &id, "", err.Error())
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("APISIX_ERROR", err.Error()))
		return
	}

	h.audit.LogSuccess(c, "DELETE", h.resourceName, &id, "")
	c.JSON(http.StatusOK, model.NewDataResponse(map[string]string{"message": "deleted"}))
}
