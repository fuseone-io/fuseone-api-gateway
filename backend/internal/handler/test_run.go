package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

// TestRunHandler handles read operations for test runs.
type TestRunHandler struct {
	runRepo repository.TestRunQuerier
}

// NewTestRunHandler creates a new TestRunHandler.
func NewTestRunHandler(runRepo repository.TestRunQuerier) *TestRunHandler {
	return &TestRunHandler{runRepo: runRepo}
}

// Get returns a single test run by ID.
func (h *TestRunHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid test run ID"}})
		return
	}

	run, err := h.runRepo.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if run == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"message": "test run not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": run})
}

// ListBySuite returns test runs for a given suite ID.
func (h *TestRunHandler) ListBySuite(c *gin.Context) {
	suiteIDStr := c.Query("suite_id")
	if suiteIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "suite_id query parameter is required"}})
		return
	}

	suiteID, err := uuid.Parse(suiteIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "invalid suite_id"}})
		return
	}

	limit := 50
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}

	runs, err := h.runRepo.ListBySuite(c.Request.Context(), suiteID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
	if runs == nil {
		runs = []model.TestRun{}
	}
	c.JSON(http.StatusOK, gin.H{"data": runs})
}
