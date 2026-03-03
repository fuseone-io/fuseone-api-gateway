package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/fuseone/api-gateway/internal/repository"
	"github.com/fuseone/api-gateway/internal/service"
)

type ReportHandler struct {
	generator *service.ReportGenerator
}

func NewReportHandler(generator *service.ReportGenerator) *ReportHandler {
	return &ReportHandler{generator: generator}
}

func (h *ReportHandler) parseReportFilter(c *gin.Context) repository.MetricsFilter {
	filter := repository.MetricsFilter{}

	rangeStr := c.DefaultQuery("range", "24h")
	from := c.Query("from")
	to := c.Query("to")

	if from != "" {
		if t, err := time.Parse(time.RFC3339, from); err == nil {
			filter.From = t
			if to != "" {
				if t2, err := time.Parse(time.RFC3339, to); err == nil {
					filter.To = t2
				}
			} else {
				filter.To = time.Now().UTC()
			}
		}
	} else {
		filter.RangeStr = rangeStr
	}

	if ids := c.Query("route_ids"); ids != "" {
		for _, id := range splitComma(ids) {
			if id != "" {
				filter.RouteIDs = append(filter.RouteIDs, id)
			}
		}
	}
	if names := c.Query("consumer_names"); names != "" {
		for _, n := range splitComma(names) {
			if n != "" {
				filter.ConsumerNames = append(filter.ConsumerNames, n)
			}
		}
	}

	return filter
}

func splitComma(s string) []string {
	var result []string
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ',' {
			part := s[start:i]
			if part != "" {
				result = append(result, part)
			}
			start = i + 1
		}
	}
	return result
}

// UsageCSV generates a CSV report of per-route usage.
func (h *ReportHandler) UsageCSV(c *gin.Context) {
	filter := h.parseReportFilter(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	filename := fmt.Sprintf("usage-report-%s.csv", time.Now().UTC().Format("2006-01-02"))
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))

	if err := h.generator.GenerateUsageCSV(c.Request.Context(), filter, limit, c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
}

// ConsumerCSV generates a CSV report of per-consumer usage.
func (h *ReportHandler) ConsumerCSV(c *gin.Context) {
	filter := h.parseReportFilter(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	filename := fmt.Sprintf("consumer-report-%s.csv", time.Now().UTC().Format("2006-01-02"))
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))

	if err := h.generator.GenerateConsumerCSV(c.Request.Context(), filter, limit, c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
}

// TimeSeriesCSV generates a CSV report of time-series data.
func (h *ReportHandler) TimeSeriesCSV(c *gin.Context) {
	filter := h.parseReportFilter(c)

	filename := fmt.Sprintf("timeseries-report-%s.csv", time.Now().UTC().Format("2006-01-02"))
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))

	if err := h.generator.GenerateTimeSeriesCSV(c.Request.Context(), filter, c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}
}
