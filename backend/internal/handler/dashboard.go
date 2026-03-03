package handler

import (
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"

	"github.com/fuseone/api-gateway/internal/middleware"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
	"github.com/fuseone/api-gateway/internal/service"
)

type DashboardHandler struct {
	registry  *service.APISIXClientRegistry
	alertRepo repository.AlertQuerier
}

func NewDashboardHandler(registry *service.APISIXClientRegistry, alertRepo repository.AlertQuerier) *DashboardHandler {
	return &DashboardHandler{registry: registry, alertRepo: alertRepo}
}

type DashboardSummary struct {
	Routes         int    `json:"routes"`
	Services       int    `json:"services"`
	Upstreams      int    `json:"upstreams"`
	Consumers      int    `json:"consumers"`
	SSLCerts       int    `json:"ssl_certs"`
	GlobalRules    int    `json:"global_rules"`
	Plugins        int    `json:"plugins"`
	StreamRoutes   int    `json:"stream_routes"`
	FiringAlerts   int    `json:"firing_alerts"`
	APISIXStatus   string `json:"apisix_status"`
}

func (h *DashboardHandler) Summary(c *gin.Context) {
	ctx := c.Request.Context()
	summary := DashboardSummary{APISIXStatus: "healthy"}

	client, err := h.registry.GetClient(ctx, middleware.GetEnvironmentID(c))
	if err != nil {
		c.JSON(http.StatusBadGateway, model.NewErrorResponse("ENVIRONMENT_ERROR", err.Error()))
		return
	}

	var wg sync.WaitGroup
	var mu sync.Mutex

	resources := []struct {
		name string
		dest *int
	}{
		{"routes", &summary.Routes},
		{"services", &summary.Services},
		{"upstreams", &summary.Upstreams},
		{"consumers", &summary.Consumers},
		{"ssls", &summary.SSLCerts},
		{"global_rules", &summary.GlobalRules},
		{"stream_routes", &summary.StreamRoutes},
	}

	for _, r := range resources {
		wg.Add(1)
		go func(name string, dest *int) {
			defer wg.Done()
			result, err := client.List(ctx, name)
			if err != nil {
				mu.Lock()
				summary.APISIXStatus = "degraded"
				mu.Unlock()
				return
			}
			mu.Lock()
			*dest = result.Total
			mu.Unlock()
		}(r.name, r.dest)
	}

	wg.Wait()

	if err := client.HealthCheck(ctx); err != nil {
		summary.APISIXStatus = "unhealthy"
	}

	// Firing alerts count (best-effort)
	if h.alertRepo != nil {
		if count, err := h.alertRepo.CountFiring(ctx); err == nil {
			summary.FiringAlerts = count
		}
	}

	c.JSON(http.StatusOK, model.NewDataResponse(summary))
}
