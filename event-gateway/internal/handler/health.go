package handler

import (
	"encoding/json"
	"net/http"

	"github.com/fuseone/event-gateway/internal/service"
	"github.com/fuseone/event-gateway/internal/stream"
	"github.com/jackc/pgx/v5/pgxpool"
)

type HealthHandler struct {
	pool         *pgxpool.Pool
	providerPool *stream.ProviderPool
	configMgr    *service.ConfigManager
}

func NewHealthHandler(pool *pgxpool.Pool, providerPool *stream.ProviderPool, configMgr *service.ConfigManager) *HealthHandler {
	return &HealthHandler{pool: pool, providerPool: providerPool, configMgr: configMgr}
}

func (h *HealthHandler) Handle(w http.ResponseWriter, r *http.Request) {
	status := "ok"

	// Check DB
	if err := h.pool.Ping(r.Context()); err != nil {
		status = "degraded"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    status,
		"event_apis": h.configMgr.Count(),
		"providers": h.providerPool.ActiveProviders(),
	})
}
