package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/service"
)

// ServiceMeshHandler exposes service mesh topology and discovery endpoints.
type ServiceMeshHandler struct {
	meshSvc *service.MeshService
}

// NewServiceMeshHandler creates a handler backed by the given MeshService.
func NewServiceMeshHandler(meshSvc *service.MeshService) *ServiceMeshHandler {
	return &ServiceMeshHandler{meshSvc: meshSvc}
}

// GetOverview handles GET /api/mesh/overview.
// Returns aggregate statistics about total services, healthy/unhealthy nodes,
// and active discovery types.
func (h *ServiceMeshHandler) GetOverview(c *gin.Context) {
	overview, err := h.meshSvc.GetOverview(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("MESH_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(overview))
}

// ListServices handles GET /api/mesh/services.
// Returns all upstreams with discovery info, nodes, and cross-referenced routes.
func (h *ServiceMeshHandler) ListServices(c *gin.Context) {
	services, err := h.meshSvc.ListServices(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("MESH_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(services))
}

// GetService handles GET /api/mesh/services/:id.
// Returns detailed information for a single upstream/service, including
// all backend nodes with health status and referencing routes.
func (h *ServiceMeshHandler) GetService(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_ID", "service ID is required"))
		return
	}

	svc, err := h.meshSvc.GetService(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("MESH_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(svc))
}

// GetTopology handles GET /api/mesh/topology.
// Returns the full service dependency graph — services as nodes and
// route/plugin references as directed edges.
func (h *ServiceMeshHandler) GetTopology(c *gin.Context) {
	topology, err := h.meshSvc.GetTopology(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("MESH_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(topology))
}

// GetDiscoveryStatus handles GET /api/mesh/discovery-status.
// Returns the health status of each service discovery mechanism in use.
func (h *ServiceMeshHandler) GetDiscoveryStatus(c *gin.Context) {
	statuses, err := h.meshSvc.GetDiscoveryStatus(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("MESH_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(statuses))
}
