package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/service"
)

type HealthHandler struct {
	pool   *pgxpool.Pool
	apisix *service.APISIXClient
}

func NewHealthHandler(pool *pgxpool.Pool, apisix *service.APISIXClient) *HealthHandler {
	return &HealthHandler{pool: pool, apisix: apisix}
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
	if err := h.apisix.HealthCheck(c.Request.Context()); err != nil {
		apisixStatus = "unavailable"
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "ok",
		"database": "ok",
		"apisix":   apisixStatus,
	})
}
