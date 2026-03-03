package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

type RoleHandler struct {
	userRepo *repository.UserRepository
	auditor  *middleware.AuditLogger
}

func NewRoleHandler(userRepo *repository.UserRepository, auditor *middleware.AuditLogger) *RoleHandler {
	return &RoleHandler{userRepo: userRepo, auditor: auditor}
}

// List returns all roles.
func (h *RoleHandler) List(c *gin.Context) {
	roles, err := h.userRepo.ListRoles(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}
	if roles == nil {
		roles = []model.Role{}
	}
	c.JSON(http.StatusOK, model.NewDataResponse(roles))
}

// Get returns a single role.
func (h *RoleHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "invalid role ID"))
		return
	}

	role, err := h.userRepo.GetRoleByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}
	if role == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "role not found"))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(role))
}

type createRoleRequest struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions" binding:"required"`
}

// Create creates a new role.
func (h *RoleHandler) Create(c *gin.Context) {
	var req createRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	role := &model.Role{
		Name:        req.Name,
		Description: req.Description,
		Permissions: req.Permissions,
	}

	if err := h.userRepo.CreateRole(c.Request.Context(), role); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	idStr := role.ID.String()
	h.auditor.LogSuccess(c, "create", "role", &idStr, "")

	c.JSON(http.StatusCreated, model.NewDataResponse(role))
}

type updateRoleRequest struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions" binding:"required"`
}

// Update updates a role (blocks system roles).
func (h *RoleHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "invalid role ID"))
		return
	}

	existing, err := h.userRepo.GetRoleByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "role not found"))
		return
	}
	if existing.IsSystem {
		c.JSON(http.StatusForbidden, model.NewErrorResponse("FORBIDDEN", "cannot modify system roles"))
		return
	}

	var req updateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	existing.Name = req.Name
	existing.Description = req.Description
	existing.Permissions = req.Permissions

	if err := h.userRepo.UpdateRole(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, "update", "role", &idStr, "")

	c.JSON(http.StatusOK, model.NewDataResponse(existing))
}

// Delete deletes a role (blocks system roles and roles with assigned users).
func (h *RoleHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "invalid role ID"))
		return
	}

	existing, err := h.userRepo.GetRoleByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "role not found"))
		return
	}
	if existing.IsSystem {
		c.JSON(http.StatusForbidden, model.NewErrorResponse("FORBIDDEN", "cannot delete system roles"))
		return
	}

	count, err := h.userRepo.CountUsersWithRole(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}
	if count > 0 {
		c.JSON(http.StatusConflict, model.NewErrorResponse("CONFLICT", "cannot delete role with assigned users"))
		return
	}

	if err := h.userRepo.DeleteRole(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, "delete", "role", &idStr, "")

	c.JSON(http.StatusOK, model.NewDataResponse(map[string]string{"message": "role deleted"}))
}
