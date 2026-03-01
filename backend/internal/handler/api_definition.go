package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/service"
)

type ApiDefinitionHandler struct {
	svc   *service.ApiDefinitionService
	audit *middleware.AuditLogger
}

func NewApiDefinitionHandler(svc *service.ApiDefinitionService, audit *middleware.AuditLogger) *ApiDefinitionHandler {
	return &ApiDefinitionHandler{svc: svc, audit: audit}
}

// auditDetails wraps a plain string in JSON so it can be stored in the JSONB `details` column.
func auditDetails(msg string) string {
	if msg == "" {
		return "{}"
	}
	b, _ := json.Marshal(map[string]string{"info": msg})
	return string(b)
}

func (h *ApiDefinitionHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	search := c.Query("search")
	syncStatus := c.Query("sync_status")
	lifecycleStatus := c.Query("lifecycle_status")
	apiGroupID := c.Query("api_group_id")

	defs, total, err := h.svc.List(c.Request.Context(), page, pageSize, search, syncStatus, lifecycleStatus, apiGroupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DB_ERROR", err.Error()))
		return
	}
	if defs == nil {
		defs = []model.ApiDefinition{}
	}

	c.JSON(http.StatusOK, model.NewListResponse(defs, total, page, pageSize))
}

func (h *ApiDefinitionHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid ID"))
		return
	}

	def, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DB_ERROR", err.Error()))
		return
	}
	if def == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "API definition not found"))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(def))
}

func (h *ApiDefinitionHandler) Create(c *gin.Context) {
	var req model.CreateApiDefinitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	userID, _ := middleware.GetUserID(c)
	def, err := h.svc.Create(c.Request.Context(), &req, &userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DB_ERROR", err.Error()))
		return
	}

	h.audit.LogSuccess(c, "CREATE", "api_definition", nil, auditDetails(req.Name))
	c.JSON(http.StatusCreated, model.NewDataResponse(def))
}

func (h *ApiDefinitionHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid ID"))
		return
	}

	var req model.UpdateApiDefinitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	def, err := h.svc.Update(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DB_ERROR", err.Error()))
		return
	}
	if def == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "API definition not found"))
		return
	}

	idStr := id.String()
	h.audit.LogSuccess(c, "UPDATE", "api_definition", &idStr, auditDetails(""))
	c.JSON(http.StatusOK, model.NewDataResponse(def))
}

func (h *ApiDefinitionHandler) Deploy(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid ID"))
		return
	}

	def, err := h.svc.Deploy(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DEPLOY_ERROR", err.Error()))
		return
	}

	idStr := id.String()
	h.audit.LogSuccess(c, "DEPLOY", "api_definition", &idStr, auditDetails(""))
	c.JSON(http.StatusOK, model.NewDataResponse(def))
}

func (h *ApiDefinitionHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid ID"))
		return
	}

	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DB_ERROR", err.Error()))
		return
	}

	idStr := id.String()
	h.audit.LogSuccess(c, "DELETE", "api_definition", &idStr, auditDetails(""))
	c.JSON(http.StatusOK, model.NewDataResponse(map[string]string{"message": "deleted"}))
}

func (h *ApiDefinitionHandler) Clone(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid ID"))
		return
	}

	var req model.CloneApiDefinitionRequest
	c.ShouldBindJSON(&req)

	userID, _ := middleware.GetUserID(c)
	cloned, err := h.svc.Clone(c.Request.Context(), id, &req, &userID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", err.Error()))
			return
		}
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("CLONE_ERROR", err.Error()))
		return
	}

	idStr := id.String()
	h.audit.LogSuccess(c, "CLONE", "api_definition", &idStr, auditDetails(cloned.Version))
	c.JSON(http.StatusCreated, model.NewDataResponse(cloned))
}

func (h *ApiDefinitionHandler) GetVersions(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid ID"))
		return
	}

	existing, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DB_ERROR", err.Error()))
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "API not found"))
		return
	}

	versions, err := h.svc.GetVersions(c.Request.Context(), existing.ApiGroupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("DB_ERROR", err.Error()))
		return
	}
	if versions == nil {
		versions = []model.ApiDefinition{}
	}
	c.JSON(http.StatusOK, model.NewDataResponse(versions))
}

func (h *ApiDefinitionHandler) Deprecate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid ID"))
		return
	}

	var req model.DeprecateApiDefinitionRequest
	c.ShouldBindJSON(&req)

	result, err := h.svc.Deprecate(c.Request.Context(), id, &req)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "only active") {
			status = http.StatusConflict
		} else if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		}
		c.JSON(status, model.NewErrorResponse("LIFECYCLE_ERROR", err.Error()))
		return
	}

	idStr := id.String()
	h.audit.LogSuccess(c, "DEPRECATE", "api_definition", &idStr, auditDetails(""))
	c.JSON(http.StatusOK, model.NewDataResponse(result))
}

func (h *ApiDefinitionHandler) Retire(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid ID"))
		return
	}

	result, err := h.svc.Retire(c.Request.Context(), id)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "only deprecated") {
			status = http.StatusConflict
		} else if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		}
		c.JSON(status, model.NewErrorResponse("LIFECYCLE_ERROR", err.Error()))
		return
	}

	idStr := id.String()
	h.audit.LogSuccess(c, "RETIRE", "api_definition", &idStr, auditDetails(""))
	c.JSON(http.StatusOK, model.NewDataResponse(result))
}

func (h *ApiDefinitionHandler) Undeprecate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "Invalid ID"))
		return
	}

	result, err := h.svc.Undeprecate(c.Request.Context(), id)
	if err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "only deprecated") {
			status = http.StatusConflict
		} else if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		}
		c.JSON(status, model.NewErrorResponse("LIFECYCLE_ERROR", err.Error()))
		return
	}

	idStr := id.String()
	h.audit.LogSuccess(c, "UNDEPRECATE", "api_definition", &idStr, auditDetails(""))
	c.JSON(http.StatusOK, model.NewDataResponse(result))
}
