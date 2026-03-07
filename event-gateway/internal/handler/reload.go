package handler

import (
	"encoding/json"
	"net/http"

	"github.com/fuseone/event-gateway/internal/service"
)

type ReloadHandler struct {
	configMgr *service.ConfigManager
}

func NewReloadHandler(configMgr *service.ConfigManager) *ReloadHandler {
	return &ReloadHandler{configMgr: configMgr}
}

func (h *ReloadHandler) Handle(w http.ResponseWriter, r *http.Request) {
	if err := h.configMgr.LoadAll(r.Context()); err != nil {
		http.Error(w, `{"error":"reload failed: `+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":     "reloaded",
		"event_apis": h.configMgr.Count(),
	})
}
