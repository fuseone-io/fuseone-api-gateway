package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/service"
)

type PromotionHandler struct {
	svc     *service.PromotionService
	auditor *middleware.AuditLogger
}

func NewPromotionHandler(svc *service.PromotionService, auditor *middleware.AuditLogger) *PromotionHandler {
	return &PromotionHandler{svc: svc, auditor: auditor}
}

// List returns promotion requests with optional filtering.
func (h *PromotionHandler) List(c *gin.Context) {
	status := c.Query("status")
	var apiDefID *uuid.UUID
	if raw := c.Query("api_definition_id"); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid api_definition_id"}})
			return
		}
		apiDefID = &parsed
	}

	promos, err := h.svc.List(c.Request.Context(), status, apiDefID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if promos == nil {
		promos = []model.PromotionRequest{}
	}
	c.JSON(http.StatusOK, gin.H{"data": promos})
}

// Get returns a single promotion request.
func (h *PromotionHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid promotion ID"}})
		return
	}

	promo, err := h.svc.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if promo == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "promotion request not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": promo})
}

// Create creates a new promotion request.
func (h *PromotionHandler) Create(c *gin.Context) {
	var req model.CreatePromotionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{"message": "user not authenticated"}})
		return
	}

	promo, err := h.svc.Create(c.Request.Context(), &req, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	id := promo.ID.String()
	h.auditor.LogSuccess(c, "create", "promotion_request", &id, "")

	c.JSON(http.StatusCreated, gin.H{"data": promo})
}

// Review approves or rejects a promotion request.
func (h *PromotionHandler) Review(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid promotion ID"}})
		return
	}

	var req model.ReviewPromotionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{"message": "user not authenticated"}})
		return
	}

	promo, err := h.svc.Review(c.Request.Context(), id, req.Action, userID, req.Comment)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, req.Action, "promotion_request", &idStr, "")

	c.JSON(http.StatusOK, gin.H{"data": promo})
}

// Execute deploys an approved promotion to the target environment.
func (h *PromotionHandler) Execute(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid promotion ID"}})
		return
	}

	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{"message": "user not authenticated"}})
		return
	}

	promo, err := h.svc.Execute(c.Request.Context(), id, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, "execute", "promotion_request", &idStr, "")

	c.JSON(http.StatusOK, gin.H{"data": promo})
}
