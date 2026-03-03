package handler

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
	"github.com/fuseone/api-gateway/internal/service"
)

type NotificationContactHandler struct {
	repo     repository.NotificationContactQuerier
	notifier *service.AlertNotifier
	auditor  *middleware.AuditLogger
}

func NewNotificationContactHandler(
	repo repository.NotificationContactQuerier,
	notifier *service.AlertNotifier,
	auditor *middleware.AuditLogger,
) *NotificationContactHandler {
	return &NotificationContactHandler{repo: repo, notifier: notifier, auditor: auditor}
}

// List returns all notification contacts.
func (h *NotificationContactHandler) List(c *gin.Context) {
	contacts, err := h.repo.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if contacts == nil {
		contacts = []model.NotificationContact{}
	}
	c.JSON(http.StatusOK, gin.H{"data": contacts})
}

// Get returns a single notification contact.
func (h *NotificationContactHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid contact ID"}})
		return
	}

	contact, err := h.repo.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if contact == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "contact not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": contact})
}

type createContactRequest struct {
	Name    string                 `json:"name" binding:"required"`
	Type    string                 `json:"type" binding:"required"`
	Config  map[string]interface{} `json:"config" binding:"required"`
	Enabled *bool                  `json:"enabled"`
}

// Create creates a new notification contact.
func (h *NotificationContactHandler) Create(c *gin.Context) {
	var req createContactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	if !model.ValidChannelTypes[req.Type] {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid type; must be webhook, slack, teams, or email"}})
		return
	}

	configJSON, err := marshalConfig(req.Config)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid config"}})
		return
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	var createdBy *uuid.UUID
	if uid, exists := c.Get("user_id"); exists {
		if parsed, err := uuid.Parse(uid.(string)); err == nil {
			createdBy = &parsed
		}
	}

	contact := &model.NotificationContact{
		Name:      req.Name,
		Type:      req.Type,
		Config:    configJSON,
		Enabled:   enabled,
		CreatedBy: createdBy,
	}

	if err := h.repo.Create(c.Request.Context(), contact); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	id := contact.ID.String()
	h.auditor.LogSuccess(c, "create", "notification_contact", &id, "")

	c.JSON(http.StatusCreated, gin.H{"data": contact})
}

type updateContactRequest struct {
	Name    *string                `json:"name"`
	Type    *string                `json:"type"`
	Config  map[string]interface{} `json:"config"`
	Enabled *bool                  `json:"enabled"`
}

// Update updates a notification contact.
func (h *NotificationContactHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid contact ID"}})
		return
	}

	existing, err := h.repo.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "contact not found"}})
		return
	}

	var req updateContactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.Type != nil {
		if !model.ValidChannelTypes[*req.Type] {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid type"}})
			return
		}
		existing.Type = *req.Type
	}
	if req.Config != nil {
		configJSON, err := marshalConfig(req.Config)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid config"}})
			return
		}
		existing.Config = configJSON
	}
	if req.Enabled != nil {
		existing.Enabled = *req.Enabled
	}

	if err := h.repo.Update(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, "update", "notification_contact", &idStr, "")

	c.JSON(http.StatusOK, gin.H{"data": existing})
}

// Delete removes a notification contact.
func (h *NotificationContactHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid contact ID"}})
		return
	}

	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	delStr := id.String()
	h.auditor.LogSuccess(c, "delete", "notification_contact", &delStr, "")

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "deleted"}})
}

// TestContact sends a test notification through a saved contact.
func (h *NotificationContactHandler) TestContact(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid contact ID"}})
		return
	}

	contact, err := h.repo.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if contact == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "contact not found"}})
		return
	}

	if err := h.notifier.TestChannel(c.Request.Context(), contact.Type, contact.Config); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "test notification sent successfully"}})
}

func marshalConfig(cfg map[string]interface{}) ([]byte, error) {
	return json.Marshal(cfg)
}
