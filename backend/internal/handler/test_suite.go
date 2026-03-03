package handler

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
	"github.com/fuseone/api-gateway/internal/service"
)

// TestSuiteHandler handles CRUD operations for test suites and test execution.
type TestSuiteHandler struct {
	suiteRepo repository.TestSuiteQuerier
	runRepo   repository.TestRunQuerier
	executor  *service.TestExecutor
	auditor   *middleware.AuditLogger
}

// NewTestSuiteHandler creates a new TestSuiteHandler.
func NewTestSuiteHandler(
	suiteRepo repository.TestSuiteQuerier,
	runRepo repository.TestRunQuerier,
	executor *service.TestExecutor,
	auditor *middleware.AuditLogger,
) *TestSuiteHandler {
	return &TestSuiteHandler{
		suiteRepo: suiteRepo,
		runRepo:   runRepo,
		executor:  executor,
		auditor:   auditor,
	}
}

type createTestSuiteRequest struct {
	Name        string           `json:"name" binding:"required"`
	Description string           `json:"description"`
	ApiID       *string          `json:"api_id"`
	Steps       []model.TestStep `json:"steps" binding:"required"`
	Tags        []string         `json:"tags"`
}

type updateTestSuiteRequest struct {
	Name        *string          `json:"name"`
	Description *string          `json:"description"`
	ApiID       *string          `json:"api_id"`
	Steps       []model.TestStep `json:"steps"`
	Tags        []string         `json:"tags"`
}

type runTestSuiteRequest struct {
	TriggerType string `json:"trigger_type"` // manual, ci (defaults to manual)
}

// List returns all test suites with optional filtering.
func (h *TestSuiteHandler) List(c *gin.Context) {
	var apiID *string
	if raw := c.Query("api_id"); raw != "" {
		apiID = &raw
	}
	tag := c.Query("tag")

	suites, err := h.suiteRepo.List(c.Request.Context(), apiID, tag)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if suites == nil {
		suites = []model.TestSuite{}
	}
	c.JSON(http.StatusOK, gin.H{"data": suites})
}

// Get returns a single test suite by ID.
func (h *TestSuiteHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid test suite ID"}})
		return
	}

	suite, err := h.suiteRepo.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if suite == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "test suite not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": suite})
}

// Create creates a new test suite.
func (h *TestSuiteHandler) Create(c *gin.Context) {
	var req createTestSuiteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	// Validate assertions in steps
	for i, step := range req.Steps {
		if step.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": fmt.Sprintf("step name is required at index %d", i)}})
			return
		}
		if step.Method == "" || step.URL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "step method and URL are required"}})
			return
		}
		for _, a := range step.Assertions {
			if !model.ValidAssertionTypes[a.Type] {
				c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid assertion type: " + a.Type}})
				return
			}
			if !model.ValidAssertionOperators[a.Operator] {
				c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid assertion operator: " + a.Operator}})
				return
			}
		}
	}

	var createdBy *uuid.UUID
	if uid, ok := middleware.GetUserID(c); ok {
		createdBy = &uid
	}

	tags := req.Tags
	if tags == nil {
		tags = []string{}
	}

	suite := &model.TestSuite{
		Name:        req.Name,
		Description: req.Description,
		ApiID:       req.ApiID,
		Steps:       req.Steps,
		Tags:        tags,
		CreatedBy:   createdBy,
	}

	if err := h.suiteRepo.Create(c.Request.Context(), suite); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	id := suite.ID.String()
	h.auditor.LogSuccess(c, "create", "test_suite", &id, "")

	c.JSON(http.StatusCreated, gin.H{"data": suite})
}

// Update modifies an existing test suite.
func (h *TestSuiteHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid test suite ID"}})
		return
	}

	existing, err := h.suiteRepo.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "test suite not found"}})
		return
	}

	var req updateTestSuiteRequest
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
	if req.Steps != nil {
		// Validate assertions in updated steps
		for _, step := range req.Steps {
			for _, a := range step.Assertions {
				if !model.ValidAssertionTypes[a.Type] {
					c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid assertion type: " + a.Type}})
					return
				}
				if !model.ValidAssertionOperators[a.Operator] {
					c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid assertion operator: " + a.Operator}})
					return
				}
			}
		}
		existing.Steps = req.Steps
	}
	if req.Tags != nil {
		existing.Tags = req.Tags
	}

	if err := h.suiteRepo.Update(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, "update", "test_suite", &idStr, "")

	c.JSON(http.StatusOK, gin.H{"data": existing})
}

// Delete removes a test suite.
func (h *TestSuiteHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid test suite ID"}})
		return
	}

	if err := h.suiteRepo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	idStr := id.String()
	h.auditor.LogSuccess(c, "delete", "test_suite", &idStr, "")

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "deleted"}})
}

// Run executes a test suite and returns the test run result.
func (h *TestSuiteHandler) Run(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid test suite ID"}})
		return
	}

	suite, err := h.suiteRepo.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if suite == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "test suite not found"}})
		return
	}

	var req runTestSuiteRequest
	_ = c.ShouldBindJSON(&req)
	triggerType := req.TriggerType
	if triggerType == "" {
		triggerType = model.TriggerManual
	}

	// Set created_by on the test run
	var createdBy *uuid.UUID
	if uid, ok := middleware.GetUserID(c); ok {
		createdBy = &uid
	}

	// Execute the test suite
	run := h.executor.Execute(c.Request.Context(), suite, triggerType)
	run.CreatedBy = createdBy

	// Persist the test run
	if err := h.runRepo.Create(c.Request.Context(), run); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	runID := run.ID.String()
	h.auditor.LogSuccess(c, "run", "test_suite", &runID, "")

	c.JSON(http.StatusOK, gin.H{"data": run})
}
