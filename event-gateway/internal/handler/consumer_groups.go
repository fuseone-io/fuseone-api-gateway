package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/fuseone/event-gateway/internal/service"
	"github.com/fuseone/event-gateway/internal/stream"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type ConsumerGroupsHandler struct {
	configMgr *service.ConfigManager
	logger    *zap.Logger
}

func NewConsumerGroupsHandler(configMgr *service.ConfigManager, logger *zap.Logger) *ConsumerGroupsHandler {
	return &ConsumerGroupsHandler{
		configMgr: configMgr,
		logger:    logger,
	}
}

// List returns all consumer groups matching the Event API's prefix.
func (h *ConsumerGroupsHandler) List(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid event api id"}`, http.StatusBadRequest)
		return
	}

	api, ok := h.configMgr.GetByID(id)
	if !ok {
		http.Error(w, `{"error":"event api not found"}`, http.StatusNotFound)
		return
	}

	groups, err := api.Provider.ListGroups(r.Context(), api.TopicName, api.ConsumerGroupPrefix)
	if err != nil {
		if errors.Is(err, stream.ErrNotSupported) {
			http.Error(w, `{"error":"consumer groups not supported for this provider"}`, http.StatusNotImplemented)
			return
		}
		h.logger.Error("list consumer groups", zap.Error(err))
		http.Error(w, `{"error":"failed to list consumer groups"}`, http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"data": groups})
}

// Describe returns detailed info about a specific consumer group.
func (h *ConsumerGroupsHandler) Describe(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid event api id"}`, http.StatusBadRequest)
		return
	}

	groupID := chi.URLParam(r, "groupId")
	if groupID == "" {
		http.Error(w, `{"error":"group_id is required"}`, http.StatusBadRequest)
		return
	}

	api, ok := h.configMgr.GetByID(id)
	if !ok {
		http.Error(w, `{"error":"event api not found"}`, http.StatusNotFound)
		return
	}

	info, err := api.Provider.DescribeGroup(r.Context(), api.TopicName, groupID)
	if err != nil {
		if errors.Is(err, stream.ErrNotSupported) {
			http.Error(w, `{"error":"consumer group describe not supported for this provider"}`, http.StatusNotImplemented)
			return
		}
		h.logger.Error("describe consumer group", zap.Error(err))
		http.Error(w, `{"error":"failed to describe consumer group"}`, http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"data": info})
}

// ResetOffsets resets the consumer group offsets for the event API's topic.
func (h *ConsumerGroupsHandler) ResetOffsets(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"invalid event api id"}`, http.StatusBadRequest)
		return
	}

	groupID := chi.URLParam(r, "groupId")
	if groupID == "" {
		http.Error(w, `{"error":"group_id is required"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		Strategy string `json:"strategy"` // "earliest" or "latest"
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}
	if req.Strategy == "" {
		req.Strategy = "latest"
	}

	api, ok := h.configMgr.GetByID(id)
	if !ok {
		http.Error(w, `{"error":"event api not found"}`, http.StatusNotFound)
		return
	}

	if err := api.Provider.ResetGroup(r.Context(), api.TopicName, groupID, req.Strategy); err != nil {
		if errors.Is(err, stream.ErrNotSupported) {
			http.Error(w, `{"error":"group reset not supported for this provider"}`, http.StatusNotImplemented)
			return
		}
		h.logger.Error("reset offsets", zap.Error(err))
		http.Error(w, `{"error":"failed to reset offsets: `+err.Error()+`"}`, http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"ok": true})
}
