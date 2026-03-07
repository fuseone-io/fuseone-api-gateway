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

// EventApiHandler handles Event API CRUD and deploy/undeploy operations.
type EventApiHandler struct {
	repo        *repository.EventApiRepository
	deployer    *service.EventApiDeployer
	auditLogger *middleware.AuditLogger
}

// NewEventApiHandler creates a new EventApiHandler.
func NewEventApiHandler(repo *repository.EventApiRepository, deployer *service.EventApiDeployer, auditLogger *middleware.AuditLogger) *EventApiHandler {
	return &EventApiHandler{repo: repo, deployer: deployer, auditLogger: auditLogger}
}

// List returns all Event APIs.
func (h *EventApiHandler) List(c *gin.Context) {
	items, err := h.repo.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if items == nil {
		items = []model.EventApi{}
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// Get returns a single Event API by ID.
func (h *EventApiHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid ID"}})
		return
	}

	ea, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if ea == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "event api not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": ea})
}

type createEventApiRequest struct {
	Name                string          `json:"name" binding:"required"`
	Description         string          `json:"description"`
	Slug                string          `json:"slug" binding:"required"`
	KafkaConnectionID   uuid.UUID       `json:"kafka_connection_id" binding:"required"`
	TopicName           string          `json:"topic_name" binding:"required"`
	RestProduce         *bool           `json:"rest_produce"`
	RestConsume         *bool           `json:"rest_consume"`
	SSEEnabled          *bool           `json:"sse_enabled"`
	WebsocketEnabled    *bool           `json:"websocket_enabled"`
	WebhookEnabled      *bool           `json:"webhook_enabled"`
	ContextPath         string          `json:"context_path"`
	APISIXPlugins       json.RawMessage `json:"apisix_plugins"`
	ConsumerGroupPrefix string          `json:"consumer_group_prefix"`
	AutoOffsetReset     string          `json:"auto_offset_reset"`
	SchemaValidation    *bool           `json:"schema_validation"`
}

// Create creates a new Event API in draft status.
func (h *EventApiHandler) Create(c *gin.Context) {
	var req createEventApiRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	contextPath := req.ContextPath
	if contextPath == "" {
		contextPath = "/events"
	}
	consumerGroupPrefix := req.ConsumerGroupPrefix
	if consumerGroupPrefix == "" {
		consumerGroupPrefix = "fuseone-eg"
	}
	autoOffsetReset := req.AutoOffsetReset
	if autoOffsetReset == "" {
		autoOffsetReset = "latest"
	}
	if !model.ValidAutoOffsetResets[autoOffsetReset] {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "auto_offset_reset must be 'latest' or 'earliest'"}})
		return
	}

	plugins := req.APISIXPlugins
	if plugins == nil {
		plugins = json.RawMessage(`{}`)
	}

	var createdBy *uuid.UUID
	if uid, exists := c.Get("user_id"); exists {
		if parsed, err := uuid.Parse(uid.(string)); err == nil {
			createdBy = &parsed
		}
	}

	ea := &model.EventApi{
		Name:                req.Name,
		Description:         req.Description,
		Slug:                req.Slug,
		KafkaConnectionID:   req.KafkaConnectionID,
		TopicName:           req.TopicName,
		RestProduce:         boolDefault(req.RestProduce, true),
		RestConsume:         boolDefault(req.RestConsume, false),
		SSEEnabled:          boolDefault(req.SSEEnabled, true),
		WebsocketEnabled:    boolDefault(req.WebsocketEnabled, false),
		WebhookEnabled:      boolDefault(req.WebhookEnabled, false),
		ContextPath:         contextPath,
		APISIXPlugins:       plugins,
		ConsumerGroupPrefix: consumerGroupPrefix,
		AutoOffsetReset:     autoOffsetReset,
		SchemaValidation:    boolDefault(req.SchemaValidation, false),
		Status:              "draft",
		CreatedBy:           createdBy,
	}

	if err := h.repo.Create(c.Request.Context(), ea); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := ea.ID.String()
	h.auditLogger.LogSuccess(c, "create", "event_api", &idStr, "")
	c.JSON(http.StatusCreated, gin.H{"data": ea})
}

type updateEventApiRequest struct {
	Name                *string         `json:"name"`
	Description         *string         `json:"description"`
	Slug                *string         `json:"slug"`
	KafkaConnectionID   *uuid.UUID      `json:"kafka_connection_id"`
	TopicName           *string         `json:"topic_name"`
	RestProduce         *bool           `json:"rest_produce"`
	RestConsume         *bool           `json:"rest_consume"`
	SSEEnabled          *bool           `json:"sse_enabled"`
	WebsocketEnabled    *bool           `json:"websocket_enabled"`
	WebhookEnabled      *bool           `json:"webhook_enabled"`
	ContextPath         *string         `json:"context_path"`
	APISIXPlugins       json.RawMessage `json:"apisix_plugins"`
	ConsumerGroupPrefix *string         `json:"consumer_group_prefix"`
	AutoOffsetReset     *string         `json:"auto_offset_reset"`
	SchemaValidation    *bool           `json:"schema_validation"`
}

// Update updates an existing Event API.
func (h *EventApiHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid ID"}})
		return
	}

	existing, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "event api not found"}})
		return
	}

	var req updateEventApiRequest
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
	if req.Slug != nil {
		existing.Slug = *req.Slug
	}
	if req.KafkaConnectionID != nil {
		existing.KafkaConnectionID = *req.KafkaConnectionID
	}
	if req.TopicName != nil {
		existing.TopicName = *req.TopicName
	}
	if req.RestProduce != nil {
		existing.RestProduce = *req.RestProduce
	}
	if req.RestConsume != nil {
		existing.RestConsume = *req.RestConsume
	}
	if req.SSEEnabled != nil {
		existing.SSEEnabled = *req.SSEEnabled
	}
	if req.WebsocketEnabled != nil {
		existing.WebsocketEnabled = *req.WebsocketEnabled
	}
	if req.WebhookEnabled != nil {
		existing.WebhookEnabled = *req.WebhookEnabled
	}
	if req.ContextPath != nil {
		existing.ContextPath = *req.ContextPath
	}
	if req.APISIXPlugins != nil {
		existing.APISIXPlugins = req.APISIXPlugins
	}
	if req.ConsumerGroupPrefix != nil {
		existing.ConsumerGroupPrefix = *req.ConsumerGroupPrefix
	}
	if req.AutoOffsetReset != nil {
		if !model.ValidAutoOffsetResets[*req.AutoOffsetReset] {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "auto_offset_reset must be 'latest' or 'earliest'"}})
			return
		}
		existing.AutoOffsetReset = *req.AutoOffsetReset
	}
	if req.SchemaValidation != nil {
		existing.SchemaValidation = *req.SchemaValidation
	}

	if err := h.repo.Update(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := id.String()
	h.auditLogger.LogSuccess(c, "update", "event_api", &idStr, "")
	c.JSON(http.StatusOK, gin.H{"data": existing})
}

// Delete deletes an Event API.
func (h *EventApiHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid ID"}})
		return
	}

	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := id.String()
	h.auditLogger.LogSuccess(c, "delete", "event_api", &idStr, "")
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "deleted"}})
}

// Deploy creates APISIX routes for the Event API.
func (h *EventApiHandler) Deploy(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid ID"}})
		return
	}

	envID := resolveEnvID(c)

	var deployedBy *uuid.UUID
	if uid, exists := c.Get("user_id"); exists {
		if parsed, err := uuid.Parse(uid.(string)); err == nil {
			deployedBy = &parsed
		}
	}

	ea, err := h.deployer.Deploy(c.Request.Context(), id, envID, deployedBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := id.String()
	h.auditLogger.LogSuccess(c, "deploy", "event_api", &idStr, "")
	c.JSON(http.StatusOK, gin.H{"data": ea})
}

// Undeploy removes APISIX routes for the Event API.
func (h *EventApiHandler) Undeploy(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid ID"}})
		return
	}

	envID := resolveEnvID(c)

	ea, err := h.deployer.Undeploy(c.Request.Context(), id, envID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := id.String()
	h.auditLogger.LogSuccess(c, "undeploy", "event_api", &idStr, "")
	c.JSON(http.StatusOK, gin.H{"data": ea})
}

func boolDefault(v *bool, def bool) bool {
	if v == nil {
		return def
	}
	return *v
}

func resolveEnvID(c *gin.Context) uuid.UUID {
	envHeader := c.GetHeader("X-Environment-ID")
	if envHeader != "" {
		if parsed, err := uuid.Parse(envHeader); err == nil {
			return parsed
		}
	}
	return uuid.Nil
}
