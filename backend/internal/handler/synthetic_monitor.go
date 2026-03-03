package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

// SyntheticMonitorHandler handles CRUD operations for synthetic monitors.
type SyntheticMonitorHandler struct {
	repo    repository.SyntheticMonitorQuerier
	auditor *middleware.AuditLogger
}

// NewSyntheticMonitorHandler creates a new SyntheticMonitorHandler.
func NewSyntheticMonitorHandler(repo repository.SyntheticMonitorQuerier, auditor *middleware.AuditLogger) *SyntheticMonitorHandler {
	return &SyntheticMonitorHandler{repo: repo, auditor: auditor}
}

type createSyntheticMonitorRequest struct {
	Name        string    `json:"name" binding:"required"`
	Description string    `json:"description"`
	Enabled     *bool     `json:"enabled"`
	SuiteID     uuid.UUID `json:"suite_id" binding:"required"`
	IntervalSec int       `json:"interval_sec" binding:"required"`
	Locations   []string  `json:"locations"`
}

type updateSyntheticMonitorRequest struct {
	Name        *string   `json:"name"`
	Description *string   `json:"description"`
	Enabled     *bool     `json:"enabled"`
	SuiteID     *uuid.UUID `json:"suite_id"`
	IntervalSec *int      `json:"interval_sec"`
	Locations   []string  `json:"locations"`
}

// List returns all synthetic monitors.
func (h *SyntheticMonitorHandler) List(c *gin.Context) {
	monitors, err := h.repo.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if monitors == nil {
		monitors = []model.SyntheticMonitor{}
	}
	c.JSON(http.StatusOK, gin.H{"data": monitors})
}

// Get returns a single synthetic monitor by ID.
func (h *SyntheticMonitorHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid monitor ID"}})
		return
	}

	monitor, err := h.repo.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if monitor == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "monitor not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": monitor})
}

// Create creates a new synthetic monitor.
func (h *SyntheticMonitorHandler) Create(c *gin.Context) {
	var req createSyntheticMonitorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	if req.IntervalSec < 10 {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "interval_sec must be at least 10 seconds"}})
		return
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	locations := req.Locations
	if locations == nil {
		locations = []string{}
	}

	var createdBy *uuid.UUID
	if uid, ok := middleware.GetUserID(c); ok {
		createdBy = &uid
	}

	monitor := &model.SyntheticMonitor{
		Name:            req.Name,
		Description:     req.Description,
		Enabled:         enabled,
		SuiteID:         req.SuiteID,
		IntervalSec:     req.IntervalSec,
		Locations:       locations,
		UptimePct:       0,
		LastStatus:      model.MonitorStatusUnknown,
		ConsecutiveFail: 0,
		CreatedBy:       createdBy,
	}

	if err := h.repo.Create(c.Request.Context(), monitor); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	id := monitor.ID.String()
	h.auditor.LogSuccess(c, "create", "synthetic_monitor", &id, "")

	c.JSON(http.StatusCreated, gin.H{"data": monitor})
}

// Update modifies an existing synthetic monitor.
func (h *SyntheticMonitorHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid monitor ID"}})
		return
	}

	existing, err := h.repo.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "monitor not found"}})
		return
	}

	var req updateSyntheticMonitorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.Description != nil {
		existing.Description = *req.Description
	}
	if req.Enabled != nil {
		existing.Enabled = *req.Enabled
	}
	if req.SuiteID != nil {
		existing.SuiteID = *req.SuiteID
	}
	if req.IntervalSec != nil {
		if *req.IntervalSec < 10 {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "interval_sec must be at least 10 seconds"}})
			return
		}
		existing.IntervalSec = *req.IntervalSec
	}
	if req.Locations != nil {
		existing.Locations = req.Locations
	}

	if err := h.repo.Update(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, "update", "synthetic_monitor", &idStr, "")

	c.JSON(http.StatusOK, gin.H{"data": existing})
}

// Delete removes a synthetic monitor.
func (h *SyntheticMonitorHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid monitor ID"}})
		return
	}

	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, "delete", "synthetic_monitor", &idStr, "")

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "deleted"}})
}
