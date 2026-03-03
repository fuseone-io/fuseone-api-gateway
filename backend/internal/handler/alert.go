package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

type AlertHandler struct {
	repo     repository.AlertQuerier
	auditor  *middleware.AuditLogger
}

func NewAlertHandler(repo repository.AlertQuerier, auditor *middleware.AuditLogger) *AlertHandler {
	return &AlertHandler{repo: repo, auditor: auditor}
}

// ListRules returns all alert rules.
func (h *AlertHandler) ListRules(c *gin.Context) {
	rules, err := h.repo.ListRules(c.Request.Context(), false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if rules == nil {
		rules = []model.AlertRule{}
	}
	c.JSON(http.StatusOK, gin.H{"data": rules})
}

// GetRule returns a single alert rule.
func (h *AlertHandler) GetRule(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid rule ID"}})
		return
	}

	rule, err := h.repo.GetRule(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if rule == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "rule not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rule})
}

type createAlertRuleRequest struct {
	Name        string               `json:"name" binding:"required"`
	Description string               `json:"description"`
	Enabled     *bool                `json:"enabled"`
	RuleType    string               `json:"rule_type" binding:"required"`
	ScopeType   string               `json:"scope_type"`
	ScopeIDs    []string             `json:"scope_ids"`
	Threshold   float64              `json:"threshold" binding:"required"`
	EvalWindow  string               `json:"eval_window"`
	Channels    []model.AlertChannel `json:"channels"`
}

// CreateRule creates a new alert rule.
func (h *AlertHandler) CreateRule(c *gin.Context) {
	var req createAlertRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	if !model.ValidRuleTypes[req.RuleType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid rule_type; must be error_rate, latency_p99, or traffic_drop"}})
		return
	}

	scopeType := req.ScopeType
	if scopeType == "" {
		scopeType = "global"
	}
	if !model.ValidScopeTypes[scopeType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid scope_type; must be global, route, or consumer"}})
		return
	}

	evalWindow := req.EvalWindow
	if evalWindow == "" {
		evalWindow = "5m"
	}
	if !model.ValidEvalWindows[evalWindow] {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid eval_window; must be 1m, 5m, 15m, 30m, or 1h"}})
		return
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	scopeIDs := req.ScopeIDs
	if scopeIDs == nil {
		scopeIDs = []string{}
	}
	channels := req.Channels
	if channels == nil {
		channels = []model.AlertChannel{}
	}

	// Extract user ID from JWT context
	var createdBy *uuid.UUID
	if uid, exists := c.Get("user_id"); exists {
		if parsed, err := uuid.Parse(uid.(string)); err == nil {
			createdBy = &parsed
		}
	}

	rule := &model.AlertRule{
		Name:        req.Name,
		Description: req.Description,
		Enabled:     enabled,
		RuleType:    req.RuleType,
		ScopeType:   scopeType,
		ScopeIDs:    scopeIDs,
		Threshold:   req.Threshold,
		EvalWindow:  evalWindow,
		Channels:    channels,
		State:       model.AlertStateOK,
		CreatedBy:   createdBy,
	}

	if err := h.repo.CreateRule(c.Request.Context(), rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	id := rule.ID.String()
	h.auditor.LogSuccess(c, "create", "alert_rule", &id, "")

	c.JSON(http.StatusCreated, gin.H{"data": rule})
}

type updateAlertRuleRequest struct {
	Name        *string              `json:"name"`
	Description *string              `json:"description"`
	Enabled     *bool                `json:"enabled"`
	RuleType    *string              `json:"rule_type"`
	ScopeType   *string              `json:"scope_type"`
	ScopeIDs    []string             `json:"scope_ids"`
	Threshold   *float64             `json:"threshold"`
	EvalWindow  *string              `json:"eval_window"`
	Channels    []model.AlertChannel `json:"channels"`
}

// UpdateRule updates an existing alert rule.
func (h *AlertHandler) UpdateRule(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid rule ID"}})
		return
	}

	existing, err := h.repo.GetRule(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "rule not found"}})
		return
	}

	var req updateAlertRuleRequest
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
	if req.RuleType != nil {
		if !model.ValidRuleTypes[*req.RuleType] {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid rule_type"}})
			return
		}
		existing.RuleType = *req.RuleType
	}
	if req.ScopeType != nil {
		if !model.ValidScopeTypes[*req.ScopeType] {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid scope_type"}})
			return
		}
		existing.ScopeType = *req.ScopeType
	}
	if req.ScopeIDs != nil {
		existing.ScopeIDs = req.ScopeIDs
	}
	if req.Threshold != nil {
		existing.Threshold = *req.Threshold
	}
	if req.EvalWindow != nil {
		if !model.ValidEvalWindows[*req.EvalWindow] {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid eval_window"}})
			return
		}
		existing.EvalWindow = *req.EvalWindow
	}
	if req.Channels != nil {
		existing.Channels = req.Channels
	}

	if err := h.repo.UpdateRule(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, "update", "alert_rule", &idStr, "")

	c.JSON(http.StatusOK, gin.H{"data": existing})
}

// DeleteRule deletes an alert rule.
func (h *AlertHandler) DeleteRule(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid rule ID"}})
		return
	}

	if err := h.repo.DeleteRule(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	delStr := id.String()
	h.auditor.LogSuccess(c, "delete", "alert_rule", &delStr, "")

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "deleted"}})
}

// AcknowledgeRule acknowledges a firing alert.
func (h *AlertHandler) AcknowledgeRule(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid rule ID"}})
		return
	}

	existing, err := h.repo.GetRule(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "rule not found"}})
		return
	}
	if existing.State != model.AlertStateFiring {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "rule is not firing"}})
		return
	}

	if err := h.repo.UpdateRuleState(c.Request.Context(), id, model.AlertStateAcknowledged, nil); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	// Extract user ID for ack event
	var ackedBy *uuid.UUID
	if uid, exists := c.Get("user_id"); exists {
		if parsed, err := uuid.Parse(uid.(string)); err == nil {
			ackedBy = &parsed
		}
	}

	event := &model.AlertEvent{
		RuleID:    id,
		EventType: "acknowledged",
		Message:   "Alert acknowledged by user",
		AckedBy:   ackedBy,
	}
	if err := h.repo.CreateEvent(c.Request.Context(), event); err != nil {
		// Non-critical
	}

	ackStr := id.String()
	h.auditor.LogSuccess(c, "acknowledge", "alert_rule", &ackStr, "")

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "acknowledged"}})
}

// ListEvents returns alert events.
func (h *AlertHandler) ListEvents(c *gin.Context) {
	var ruleID *uuid.UUID
	if idStr := c.Query("rule_id"); idStr != "" {
		parsed, err := uuid.Parse(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid rule_id"}})
			return
		}
		ruleID = &parsed
	}

	limit := 50
	if l := c.Query("limit"); l != "" {
		// Simple parse
		n := 0
		for _, ch := range l {
			n = n*10 + int(ch-'0')
		}
		if n > 0 && n <= 200 {
			limit = n
		}
	}

	events, err := h.repo.ListEvents(c.Request.Context(), ruleID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if events == nil {
		events = []model.AlertEvent{}
	}
	c.JSON(http.StatusOK, gin.H{"data": events})
}

// CountFiring returns the number of currently firing alerts.
func (h *AlertHandler) CountFiring(c *gin.Context) {
	count, err := h.repo.CountFiring(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"count": count}})
}
