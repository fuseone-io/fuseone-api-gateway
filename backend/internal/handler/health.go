package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/service"
)

type HealthHandler struct {
	pool     *pgxpool.Pool
	registry *service.APISIXClientRegistry
}

func NewHealthHandler(pool *pgxpool.Pool, registry *service.APISIXClientRegistry) *HealthHandler {
	return &HealthHandler{pool: pool, registry: registry}
}

func (h *HealthHandler) Live(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *HealthHandler) Ready(c *gin.Context) {
	if err := h.pool.Ping(c.Request.Context()); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "error", "database": "unavailable"})
		return
	}

	apisixStatus := "ok"
	client, err := h.registry.GetClient(c.Request.Context(), uuid.Nil)
	if err != nil {
		apisixStatus = "unavailable"
	} else if err := client.HealthCheck(c.Request.Context()); err != nil {
		apisixStatus = "unavailable"
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "ok",
		"database": "ok",
		"apisix":   apisixStatus,
	})
}
