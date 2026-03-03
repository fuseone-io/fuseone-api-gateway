package handler

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

type SettingsHandler struct {
	repo    *repository.SettingsRepository
	auditor *middleware.AuditLogger
}

func NewSettingsHandler(repo *repository.SettingsRepository, auditor *middleware.AuditLogger) *SettingsHandler {
	return &SettingsHandler{repo: repo, auditor: auditor}
}

// Get returns a setting by key.
func (h *SettingsHandler) Get(c *gin.Context) {
	key := c.Param("key")
	if key == "" {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "key is required"))
		return
	}

	value, err := h.repo.Get(c.Request.Context(), key)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}
	if value == nil {
		c.JSON(http.StatusNotFound, model.NewErrorResponse("NOT_FOUND", "setting not found"))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(json.RawMessage(value)))
}

// Update updates a setting by key.
func (h *SettingsHandler) Update(c *gin.Context) {
	key := c.Param("key")
	if key == "" {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", "key is required"))
		return
	}

	var req struct {
		Value json.RawMessage `json:"value" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("BAD_REQUEST", err.Error()))
		return
	}

	userID, ok := middleware.GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, model.NewErrorResponse("UNAUTHORIZED", "user not authenticated"))
		return
	}

	if err := h.repo.Upsert(c.Request.Context(), key, req.Value, userID); err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("INTERNAL", err.Error()))
		return
	}

	h.auditor.LogSuccess(c, "update", "setting", &key, "")

	c.JSON(http.StatusOK, model.NewDataResponse(json.RawMessage(req.Value)))
}
