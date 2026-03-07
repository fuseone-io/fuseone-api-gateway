package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

type EventApiPermissionHandler struct {
	repo        *repository.EventApiPermissionRepository
	auditLogger *middleware.AuditLogger
}

func NewEventApiPermissionHandler(repo *repository.EventApiPermissionRepository, auditLogger *middleware.AuditLogger) *EventApiPermissionHandler {
	return &EventApiPermissionHandler{repo: repo, auditLogger: auditLogger}
}

func (h *EventApiPermissionHandler) List(c *gin.Context) {
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
		items = []model.EventApiPermission{}
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

type upsertPermissionRequest struct {
	ConsumerName  string `json:"consumer_name" binding:"required"`
	CanProduce    *bool  `json:"can_produce"`
	CanConsume    *bool  `json:"can_consume"`
	CanStream     *bool  `json:"can_stream"`
	RateLimit     *int   `json:"rate_limit"`
	RateWindowSec *int   `json:"rate_window_sec"`
}

func (h *EventApiPermissionHandler) Upsert(c *gin.Context) {
	eventApiID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid event api ID"}})
		return
	}

	var req upsertPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	perm := &model.EventApiPermission{
		EventApiID:    eventApiID,
		ConsumerName:  req.ConsumerName,
		CanProduce:    boolDefault(req.CanProduce, false),
		CanConsume:    boolDefault(req.CanConsume, false),
		CanStream:     boolDefault(req.CanStream, false),
		RateLimit:     intDefault(req.RateLimit, 0),
		RateWindowSec: intDefault(req.RateWindowSec, 60),
	}

	if err := h.repo.Upsert(c.Request.Context(), perm); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := perm.ID.String()
	h.auditLogger.LogSuccess(c, "upsert", "event_api_permission", &idStr, "")
	c.JSON(http.StatusOK, gin.H{"data": perm})
}

func (h *EventApiPermissionHandler) Delete(c *gin.Context) {
	permID, err := uuid.Parse(c.Param("permId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid permission ID"}})
		return
	}

	if err := h.repo.Delete(c.Request.Context(), permID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := permID.String()
	h.auditLogger.LogSuccess(c, "delete", "event_api_permission", &idStr, "")
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "deleted"}})
}

func intDefault(v *int, d int) int {
	if v != nil {
		return *v
	}
	return d
}
