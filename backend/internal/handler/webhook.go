package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

// WebhookHandler handles webhook subscription CRUD and delivery log retrieval.
type WebhookHandler struct {
	repo        *repository.WebhookRepository
	auditLogger *middleware.AuditLogger
}

func NewWebhookHandler(repo *repository.WebhookRepository, auditLogger *middleware.AuditLogger) *WebhookHandler {
	return &WebhookHandler{repo: repo, auditLogger: auditLogger}
}

// List returns all webhook subscriptions for a given Event API.
func (h *WebhookHandler) List(c *gin.Context) {
	eventApiID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid event api ID"}})
		return
	}

	items, err := h.repo.List(c.Request.Context(), eventApiID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if items == nil {
		items = []model.WebhookSubscription{}
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// Get returns a single webhook subscription by ID.
func (h *WebhookHandler) Get(c *gin.Context) {
	whID, err := uuid.Parse(c.Param("whId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid webhook ID"}})
		return
	}

	sub, err := h.repo.GetByID(c.Request.Context(), whID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if sub == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "webhook not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": sub})
}

type createWebhookRequest struct {
	URL                     string          `json:"url" binding:"required"`
	Secret                  string          `json:"secret"`
	Description             string          `json:"description"`
	Headers                 json.RawMessage `json:"headers"`
	RetryPolicy             json.RawMessage `json:"retry_policy"`
	IsActive                *bool           `json:"is_active"`
	FilterExpression        string          `json:"filter_expression"`
	CircuitBreakerThreshold *int            `json:"circuit_breaker_threshold"`
}

// Create creates a new webhook subscription.
func (h *WebhookHandler) Create(c *gin.Context) {
	eventApiID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid event api ID"}})
		return
	}

	var req createWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	cbThreshold := 5
	if req.CircuitBreakerThreshold != nil {
		cbThreshold = *req.CircuitBreakerThreshold
	}

	sub := &model.WebhookSubscription{
		EventApiID:              eventApiID,
		URL:                     req.URL,
		Secret:                  req.Secret,
		Description:             req.Description,
		Headers:                 req.Headers,
		RetryPolicy:             req.RetryPolicy,
		IsActive:                boolDefault(req.IsActive, true),
		FilterExpression:        req.FilterExpression,
		CircuitBreakerThreshold: cbThreshold,
	}

	if err := h.repo.Create(c.Request.Context(), sub); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := sub.ID.String()
	h.auditLogger.LogSuccess(c, "create", "webhook_subscription", &idStr, "")
	c.JSON(http.StatusCreated, gin.H{"data": sub})
}

type updateWebhookRequest struct {
	URL                     *string         `json:"url"`
	Secret                  *string         `json:"secret"`
	Description             *string         `json:"description"`
	Headers                 json.RawMessage `json:"headers"`
	RetryPolicy             json.RawMessage `json:"retry_policy"`
	IsActive                *bool           `json:"is_active"`
	FilterExpression        *string         `json:"filter_expression"`
	CircuitBreakerThreshold *int            `json:"circuit_breaker_threshold"`
}

// Update updates an existing webhook subscription.
func (h *WebhookHandler) Update(c *gin.Context) {
	whID, err := uuid.Parse(c.Param("whId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid webhook ID"}})
		return
	}

	existing, err := h.repo.GetByID(c.Request.Context(), whID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "webhook not found"}})
		return
	}

	var req updateWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	if req.URL != nil {
		existing.URL = *req.URL
	}
	if req.Secret != nil {
		existing.Secret = *req.Secret
	}
	if req.Description != nil {
		existing.Description = *req.Description
	}
	if req.Headers != nil {
		existing.Headers = req.Headers
	}
	if req.RetryPolicy != nil {
		existing.RetryPolicy = req.RetryPolicy
	}
	if req.IsActive != nil {
		existing.IsActive = *req.IsActive
	}
	if req.FilterExpression != nil {
		existing.FilterExpression = *req.FilterExpression
	}
	if req.CircuitBreakerThreshold != nil {
		existing.CircuitBreakerThreshold = *req.CircuitBreakerThreshold
	}

	if err := h.repo.Update(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := whID.String()
	h.auditLogger.LogSuccess(c, "update", "webhook_subscription", &idStr, "")
	c.JSON(http.StatusOK, gin.H{"data": existing})
}

// Delete deletes a webhook subscription.
func (h *WebhookHandler) Delete(c *gin.Context) {
	whID, err := uuid.Parse(c.Param("whId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid webhook ID"}})
		return
	}

	if err := h.repo.Delete(c.Request.Context(), whID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := whID.String()
	h.auditLogger.LogSuccess(c, "delete", "webhook_subscription", &idStr, "")
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "deleted"}})
}

// ListDeliveries returns the delivery log for a webhook subscription.
func (h *WebhookHandler) ListDeliveries(c *gin.Context) {
	whID, err := uuid.Parse(c.Param("whId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid webhook ID"}})
		return
	}

	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	items, err := h.repo.ListDeliveries(c.Request.Context(), whID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if items == nil {
		items = []model.WebhookDelivery{}
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// ResetCircuitBreaker resets the circuit breaker for a webhook subscription.
func (h *WebhookHandler) ResetCircuitBreaker(c *gin.Context) {
	whID, err := uuid.Parse(c.Param("whId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid webhook ID"}})
		return
	}

	if err := h.repo.ResetCircuitBreaker(c.Request.Context(), whID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := whID.String()
	h.auditLogger.LogSuccess(c, "reset_circuit_breaker", "webhook_subscription", &idStr, "")
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// RetryDelivery re-queues a failed delivery for retry.
func (h *WebhookHandler) RetryDelivery(c *gin.Context) {
	dlvID, err := uuid.Parse(c.Param("dlvId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid delivery ID"}})
		return
	}

	if err := h.repo.RetryDelivery(c.Request.Context(), dlvID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
