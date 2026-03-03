package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/service"
)

type SubscriptionHandler struct {
	svc     *service.SubscriptionService
	auditor *middleware.AuditLogger
}

func NewSubscriptionHandler(svc *service.SubscriptionService, auditor *middleware.AuditLogger) *SubscriptionHandler {
	return &SubscriptionHandler{svc: svc, auditor: auditor}
}

// List returns subscriptions with optional filtering.
func (h *SubscriptionHandler) List(c *gin.Context) {
	consumerUsername := c.Query("consumer_username")
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

	subs, err := h.svc.List(c.Request.Context(), consumerUsername, apiDefID, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if subs == nil {
		subs = []model.Subscription{}
	}
	c.JSON(http.StatusOK, gin.H{"data": subs})
}

// Get returns a single subscription.
func (h *SubscriptionHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid subscription ID"}})
		return
	}

	sub, err := h.svc.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if sub == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "subscription not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": sub})
}

// Create creates a new subscription request.
func (h *SubscriptionHandler) Create(c *gin.Context) {
	var req model.CreateSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{"message": "user not authenticated"}})
		return
	}

	sub, err := h.svc.Create(c.Request.Context(), &req, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	id := sub.ID.String()
	h.auditor.LogSuccess(c, "create", "subscription", &id, "")

	c.JSON(http.StatusCreated, gin.H{"data": sub})
}

// Review approves or rejects a subscription.
func (h *SubscriptionHandler) Review(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid subscription ID"}})
		return
	}

	var req model.ReviewSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{"message": "user not authenticated"}})
		return
	}

	var sub *model.Subscription
	idStr := id.String()

	switch req.Action {
	case "approve":
		sub, err = h.svc.Approve(c.Request.Context(), id, userID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
			return
		}
		h.auditor.LogSuccess(c, "approve", "subscription", &idStr, "")
	case "reject":
		sub, err = h.svc.Reject(c.Request.Context(), id, req.Notes)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
			return
		}
		h.auditor.LogSuccess(c, "reject", "subscription", &idStr, "")
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "action must be 'approve' or 'reject'"}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": sub})
}

// Suspend suspends an active subscription.
func (h *SubscriptionHandler) Suspend(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid subscription ID"}})
		return
	}

	sub, err := h.svc.Suspend(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, "suspend", "subscription", &idStr, "")

	c.JSON(http.StatusOK, gin.H{"data": sub})
}

// Revoke revokes an active or suspended subscription.
func (h *SubscriptionHandler) Revoke(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid subscription ID"}})
		return
	}

	var body struct {
		Notes string `json:"notes"`
	}
	_ = c.ShouldBindJSON(&body)

	sub, err := h.svc.Revoke(c.Request.Context(), id, body.Notes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, "revoke", "subscription", &idStr, "")

	c.JSON(http.StatusOK, gin.H{"data": sub})
}
