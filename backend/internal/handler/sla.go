package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

// SLAHandler handles CRUD operations for SLA definitions.
type SLAHandler struct {
	repo    repository.SLAQuerier
	auditor *middleware.AuditLogger
}

// NewSLAHandler creates a new SLAHandler.
func NewSLAHandler(repo repository.SLAQuerier, auditor *middleware.AuditLogger) *SLAHandler {
	return &SLAHandler{repo: repo, auditor: auditor}
}

type createSLARequest struct {
	Name            string  `json:"name" binding:"required"`
	Description     string  `json:"description"`
	ApiID           *string `json:"api_id"`
	AvailabilityPct float64 `json:"availability_pct" binding:"required"`
	LatencyP99Ms    int     `json:"latency_p99_ms"`
	ErrorRatePct    float64 `json:"error_rate_pct"`
	EvalWindow      string  `json:"eval_window" binding:"required"`
}

type updateSLARequest struct {
	Name            *string  `json:"name"`
	Description     *string  `json:"description"`
	ApiID           *string  `json:"api_id"`
	AvailabilityPct *float64 `json:"availability_pct"`
	LatencyP99Ms    *int     `json:"latency_p99_ms"`
	ErrorRatePct    *float64 `json:"error_rate_pct"`
	EvalWindow      *string  `json:"eval_window"`
}

// List returns all SLA definitions with optional api_id filter.
func (h *SLAHandler) List(c *gin.Context) {
	var apiID *string
	if raw := c.Query("api_id"); raw != "" {
		apiID = &raw
	}

	slas, err := h.repo.List(c.Request.Context(), apiID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if slas == nil {
		slas = []model.SLADefinition{}
	}
	c.JSON(http.StatusOK, gin.H{"data": slas})
}

// Get returns a single SLA definition by ID.
func (h *SLAHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid SLA ID"}})
		return
	}

	sla, err := h.repo.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if sla == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "SLA definition not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": sla})
}

// Create creates a new SLA definition.
func (h *SLAHandler) Create(c *gin.Context) {
	var req createSLARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	if !model.ValidSLAEvalWindows[req.EvalWindow] {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid eval_window; must be 7d, 30d, or 90d"}})
		return
	}

	if req.AvailabilityPct < 0 || req.AvailabilityPct > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "availability_pct must be between 0 and 100"}})
		return
	}

	if req.ErrorRatePct < 0 || req.ErrorRatePct > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "error_rate_pct must be between 0 and 100"}})
		return
	}

	var createdBy *uuid.UUID
	if uid, ok := middleware.GetUserID(c); ok {
		createdBy = &uid
	}

	sla := &model.SLADefinition{
		Name:             req.Name,
		Description:      req.Description,
		ApiID:            req.ApiID,
		AvailabilityPct:  req.AvailabilityPct,
		LatencyP99Ms:     req.LatencyP99Ms,
		ErrorRatePct:     req.ErrorRatePct,
		EvalWindow:       req.EvalWindow,
		CurrentAvail:     0,
		CurrentLatency:   0,
		CurrentError:     0,
		BudgetRemaining:  100,
		ComplianceStatus: "compliant",
		CreatedBy:        createdBy,
	}

	if err := h.repo.Create(c.Request.Context(), sla); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	id := sla.ID.String()
	h.auditor.LogSuccess(c, "create", "sla_definition", &id, "")

	c.JSON(http.StatusCreated, gin.H{"data": sla})
}

// Update modifies an existing SLA definition.
func (h *SLAHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid SLA ID"}})
		return
	}

	existing, err := h.repo.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "SLA definition not found"}})
		return
	}

	var req updateSLARequest
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
	if req.ApiID != nil {
		existing.ApiID = req.ApiID
	}
	if req.AvailabilityPct != nil {
		if *req.AvailabilityPct < 0 || *req.AvailabilityPct > 100 {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "availability_pct must be between 0 and 100"}})
			return
		}
		existing.AvailabilityPct = *req.AvailabilityPct
	}
	if req.LatencyP99Ms != nil {
		existing.LatencyP99Ms = *req.LatencyP99Ms
	}
	if req.ErrorRatePct != nil {
		if *req.ErrorRatePct < 0 || *req.ErrorRatePct > 100 {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "error_rate_pct must be between 0 and 100"}})
			return
		}
		existing.ErrorRatePct = *req.ErrorRatePct
	}
	if req.EvalWindow != nil {
		if !model.ValidSLAEvalWindows[*req.EvalWindow] {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid eval_window; must be 7d, 30d, or 90d"}})
			return
		}
		existing.EvalWindow = *req.EvalWindow
	}

	if err := h.repo.Update(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, "update", "sla_definition", &idStr, "")

	c.JSON(http.StatusOK, gin.H{"data": existing})
}

// Delete removes an SLA definition.
func (h *SLAHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid SLA ID"}})
		return
	}

	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, "delete", "sla_definition", &idStr, "")

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "deleted"}})
}
