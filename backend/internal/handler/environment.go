package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/config"
	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
	"github.com/fuseone/api-gateway/internal/service"
	"go.uber.org/zap"
)

type EnvironmentHandler struct {
	repo    *repository.EnvironmentRepository
	auditor *middleware.AuditLogger
	logger  *zap.Logger
	// registry is set after the handler is created (avoids circular dep in main.go)
	registry *service.APISIXClientRegistry
}

func NewEnvironmentHandler(
	repo *repository.EnvironmentRepository,
	auditor *middleware.AuditLogger,
	logger *zap.Logger,
) *EnvironmentHandler {
	return &EnvironmentHandler{repo: repo, auditor: auditor, logger: logger}
}

func (h *EnvironmentHandler) SetRegistry(reg *service.APISIXClientRegistry) {
	h.registry = reg
}

// List returns all environments.
func (h *EnvironmentHandler) List(c *gin.Context) {
	envs, err := h.repo.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if envs == nil {
		envs = []model.Environment{}
	}
	c.JSON(http.StatusOK, gin.H{"data": envs})
}

// Get returns a single environment.
func (h *EnvironmentHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid environment ID"}})
		return
	}

	env, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if env == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "environment not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": env})
}

type createEnvironmentRequest struct {
	Name        string `json:"name" binding:"required"`
	Slug        string `json:"slug" binding:"required"`
	Description string `json:"description"`
	Color       string `json:"color"`
	SortOrder   int    `json:"sort_order"`
	AdminURL    string `json:"admin_url" binding:"required"`
	APIKey      string `json:"api_key"`
	ControlURL  string `json:"control_url"`
	MetricsURL  string `json:"metrics_url"`
}

// Create creates a new environment.
func (h *EnvironmentHandler) Create(c *gin.Context) {
	var req createEnvironmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	var createdBy *uuid.UUID
	if uid, ok := middleware.GetUserID(c); ok {
		createdBy = &uid
	}

	color := req.Color
	if color == "" {
		color = "#6b7280"
	}

	env := &model.Environment{
		Name:        req.Name,
		Slug:        req.Slug,
		Description: req.Description,
		Color:       color,
		SortOrder:   req.SortOrder,
		AdminURL:    req.AdminURL,
		APIKey:      req.APIKey,
		ControlURL:  req.ControlURL,
		MetricsURL:  req.MetricsURL,
		CreatedBy:   createdBy,
	}

	if err := h.repo.Create(c.Request.Context(), env); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	id := env.ID.String()
	h.auditor.LogSuccess(c, "create", "environment", &id, "")

	c.JSON(http.StatusCreated, gin.H{"data": env})
}

type updateEnvironmentRequest struct {
	Name        *string `json:"name"`
	Slug        *string `json:"slug"`
	Description *string `json:"description"`
	Color       *string `json:"color"`
	SortOrder   *int    `json:"sort_order"`
	AdminURL    *string `json:"admin_url"`
	APIKey      *string `json:"api_key"`
	ControlURL  *string `json:"control_url"`
	MetricsURL  *string `json:"metrics_url"`
}

// Update updates an environment.
func (h *EnvironmentHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid environment ID"}})
		return
	}

	existing, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "environment not found"}})
		return
	}

	var req updateEnvironmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.Slug != nil {
		existing.Slug = *req.Slug
	}
	if req.Description != nil {
		existing.Description = *req.Description
	}
	if req.Color != nil {
		existing.Color = *req.Color
	}
	if req.SortOrder != nil {
		existing.SortOrder = *req.SortOrder
	}
	if req.AdminURL != nil {
		existing.AdminURL = *req.AdminURL
	}
	if req.APIKey != nil {
		existing.APIKey = *req.APIKey
	}
	if req.ControlURL != nil {
		existing.ControlURL = *req.ControlURL
	}
	if req.MetricsURL != nil {
		existing.MetricsURL = *req.MetricsURL
	}

	if err := h.repo.Update(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	// Invalidate cached APISIX client for this environment
	if h.registry != nil {
		h.registry.Invalidate(id)
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, "update", "environment", &idStr, "")

	c.JSON(http.StatusOK, gin.H{"data": existing})
}

// Delete removes an environment.
func (h *EnvironmentHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid environment ID"}})
		return
	}

	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	// Invalidate cached APISIX client
	if h.registry != nil {
		h.registry.Invalidate(id)
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, "delete", "environment", &idStr, "")

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "deleted"}})
}

// SetDefault marks an environment as the default.
func (h *EnvironmentHandler) SetDefault(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid environment ID"}})
		return
	}

	if err := h.repo.SetDefault(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, "set_default", "environment", &idStr, "")

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "default updated"}})
}

// TestConnection tests the APISIX connection for an environment.
func (h *EnvironmentHandler) TestConnection(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid environment ID"}})
		return
	}

	env, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if env == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "environment not found"}})
		return
	}

	// Create a temporary APISIX client to test the connection
	testClient := service.NewAPISIXClient(&config.APISIXConfig{
		AdminURL:   env.AdminURL,
		APIKey:     env.APIKey,
		ControlURL: env.ControlURL,
	}, h.logger)

	start := time.Now()
	_, err = testClient.List(c.Request.Context(), "routes")
	latency := time.Since(start)

	if err != nil {
		c.JSON(http.StatusOK, gin.H{"data": gin.H{
			"success":    false,
			"message":    "Connection failed: " + err.Error(),
			"latency_ms": latency.Milliseconds(),
		}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"success":    true,
		"message":    "Connected",
		"latency_ms": latency.Milliseconds(),
	}})
}
