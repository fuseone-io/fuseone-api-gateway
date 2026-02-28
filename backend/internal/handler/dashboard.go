package handler

import (
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/service"
)

type DashboardHandler struct {
	apisix *service.APISIXClient
}

func NewDashboardHandler(apisix *service.APISIXClient) *DashboardHandler {
	return &DashboardHandler{apisix: apisix}
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
	APISIXStatus   string `json:"apisix_status"`
}

func (h *DashboardHandler) Summary(c *gin.Context) {
	ctx := c.Request.Context()
	summary := DashboardSummary{APISIXStatus: "healthy"}

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
			result, err := h.apisix.List(ctx, name)
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

	if err := h.apisix.HealthCheck(ctx); err != nil {
		summary.APISIXStatus = "unhealthy"
	}

	c.JSON(http.StatusOK, model.NewDataResponse(summary))
}
