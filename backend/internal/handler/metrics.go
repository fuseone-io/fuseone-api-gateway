package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

type MetricsHandler struct {
	repo repository.MetricsQuerier
}

func NewMetricsHandler(repo repository.MetricsQuerier) *MetricsHandler {
	return &MetricsHandler{repo: repo}
}

var validRanges = map[string]bool{
	"1h": true, "6h": true, "24h": true, "7d": true,
}

// parseRouteIDs reads route_ids (comma-separated) with fallback to single route_id for backward compat.
func parseRouteIDs(c *gin.Context) []string {
	if ids := c.Query("route_ids"); ids != "" {
		parts := strings.Split(ids, ",")
		var result []string
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p != "" {
				result = append(result, p)
			}
		}
		return result
	}
	if id := c.Query("route_id"); id != "" {
		return []string{id}
	}
	return nil
}

const maxCustomSpan = 90 * 24 * time.Hour // 90 days

// parseMetricsFilter builds a MetricsFilter from query parameters.
// Supports preset "range" or custom "from"/"to" (RFC3339).
func parseMetricsFilter(c *gin.Context) (*repository.MetricsFilter, error) {
	routeIDs := parseRouteIDs(c)
	fromStr := c.Query("from")

	if fromStr != "" {
		from, err := time.Parse(time.RFC3339, fromStr)
		if err != nil {
			return nil, &filterError{code: "INVALID_FROM", msg: "from must be RFC3339 (e.g. 2025-03-01T14:00:00Z)"}
		}
		to := time.Now()
		if toStr := c.Query("to"); toStr != "" {
			to, err = time.Parse(time.RFC3339, toStr)
			if err != nil {
				return nil, &filterError{code: "INVALID_TO", msg: "to must be RFC3339 (e.g. 2025-03-01T16:00:00Z)"}
			}
		}
		if !from.Before(to) {
			return nil, &filterError{code: "INVALID_RANGE", msg: "from must be before to"}
		}
		if to.Sub(from) > maxCustomSpan {
			return nil, &filterError{code: "RANGE_TOO_LARGE", msg: "custom range cannot exceed 90 days"}
		}
		return &repository.MetricsFilter{RouteIDs: routeIDs, From: from, To: to}, nil
	}

	rangeStr := c.DefaultQuery("range", "1h")
	if !validRanges[rangeStr] {
		return nil, &filterError{code: "INVALID_RANGE", msg: "range must be 1h, 6h, 24h, or 7d"}
	}
	return &repository.MetricsFilter{RouteIDs: routeIDs, RangeStr: rangeStr}, nil
}

type filterError struct {
	code string
	msg  string
}

func (e *filterError) Error() string { return e.msg }

func (h *MetricsHandler) TimeSeries(c *gin.Context) {
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
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("METRICS_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(points))
}

func (h *MetricsHandler) Summary(c *gin.Context) {
	// Default range for summary is 24h (different from timeseries)
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
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("METRICS_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(summary))
}

func (h *MetricsHandler) TopRoutes(c *gin.Context) {
	// Default range for top routes is 24h
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

	routes, err := h.repo.TopRoutes(c.Request.Context(), *filter, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.NewErrorResponse("METRICS_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, model.NewDataResponse(routes))
}
