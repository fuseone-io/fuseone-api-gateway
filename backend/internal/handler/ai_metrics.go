package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

type AIMetricsHandler struct {
	repo *repository.AIMetricsRepository
}

func NewAIMetricsHandler(repo *repository.AIMetricsRepository) *AIMetricsHandler {
	return &AIMetricsHandler{repo: repo}
}

func (h *AIMetricsHandler) TimeSeries(c *gin.Context) {
	filter, err := parseMetricsFilter(c)
	if err != nil {
		if fe, ok := err.(*filterError); ok {
			c.JSON(http.StatusBadRequest, model.NewErrorResponse(fe.code, fe.msg))
			return
		}
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_FILTER", err.Error()))
		return
	}

	points, err := h.repo.TimeSeries(c.Request.Context(), *filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("AI_METRICS_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(points))
}

func (h *AIMetricsHandler) Summary(c *gin.Context) {
	if c.Query("range") == "" && c.Query("from") == "" {
		c.Request.URL.RawQuery += "&range=24h"
	}

	filter, err := parseMetricsFilter(c)
	if err != nil {
		if fe, ok := err.(*filterError); ok {
			c.JSON(http.StatusBadRequest, model.NewErrorResponse(fe.code, fe.msg))
			return
		}
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_FILTER", err.Error()))
		return
	}

	summary, err := h.repo.Summary(c.Request.Context(), *filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("AI_METRICS_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(summary))
}

func (h *AIMetricsHandler) TopProviders(c *gin.Context) {
	if c.Query("range") == "" && c.Query("from") == "" {
		c.Request.URL.RawQuery += "&range=24h"
	}

	filter, err := parseMetricsFilter(c)
	if err != nil {
		if fe, ok := err.(*filterError); ok {
			c.JSON(http.StatusBadRequest, model.NewErrorResponse(fe.code, fe.msg))
			return
		}
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_FILTER", err.Error()))
		return
	}

	limitStr := c.DefaultQuery("limit", "10")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	providers, err := h.repo.TopProviders(c.Request.Context(), *filter, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("AI_METRICS_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(providers))
}

func (h *AIMetricsHandler) TopModels(c *gin.Context) {
	if c.Query("range") == "" && c.Query("from") == "" {
		c.Request.URL.RawQuery += "&range=24h"
	}

	filter, err := parseMetricsFilter(c)
	if err != nil {
		if fe, ok := err.(*filterError); ok {
			c.JSON(http.StatusBadRequest, model.NewErrorResponse(fe.code, fe.msg))
			return
		}
		c.JSON(http.StatusBadRequest, model.NewErrorResponse("INVALID_FILTER", err.Error()))
		return
	}

	limitStr := c.DefaultQuery("limit", "10")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	models, err := h.repo.TopModels(c.Request.Context(), *filter, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("AI_METRICS_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(models))
}
