package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

type EventSchemaHandler struct {
	repo *repository.EventSchemaRepository
}

func NewEventSchemaHandler(repo *repository.EventSchemaRepository) *EventSchemaHandler {
	return &EventSchemaHandler{repo: repo}
}

// List returns all schema versions for an Event API.
func (h *EventSchemaHandler) List(c *gin.Context) {
	eventApiID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid event api id"}})
		return
	}

	schemas, err := h.repo.List(c.Request.Context(), eventApiID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	if schemas == nil {
		schemas = []model.EventSchema{}
	}

	c.JSON(http.StatusOK, gin.H{"data": schemas})
}

// GetVersion returns a specific schema version.
func (h *EventSchemaHandler) GetVersion(c *gin.Context) {
	eventApiID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid event api id"}})
		return
	}

	version, err := strconv.Atoi(c.Param("version"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid version number"}})
		return
	}

	schema, err := h.repo.GetByVersion(c.Request.Context(), eventApiID, version)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if schema == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "schema version not found"}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": schema})
}

type createSchemaRequest struct {
	SchemaContent json.RawMessage `json:"schema_content" binding:"required"`
	Description   string          `json:"description"`
	IsActive      *bool           `json:"is_active"`
}

// Create creates a new schema version.
func (h *EventSchemaHandler) Create(c *gin.Context) {
	eventApiID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid event api id"}})
		return
	}

	var req createSchemaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	// Validate that schema_content is valid JSON
	if !json.Valid(req.SchemaContent) {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "schema_content is not valid JSON"}})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	schema := &model.EventSchema{
		EventApiID:    eventApiID,
		SchemaType:    "json-schema",
		SchemaContent: req.SchemaContent,
		Description:   req.Description,
		IsActive:      isActive,
	}

	if err := h.repo.Create(c.Request.Context(), schema); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": schema})
}

// Deactivate marks a schema version as inactive.
func (h *EventSchemaHandler) Deactivate(c *gin.Context) {
	eventApiID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid event api id"}})
		return
	}

	version, err := strconv.Atoi(c.Param("version"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid version number"}})
		return
	}

	if err := h.repo.Deactivate(c.Request.Context(), eventApiID, version); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
