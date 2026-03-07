package handler

import (
	"net/http"

	"github.com/fuseone/event-gateway/internal/metrics"
)

type MetricsHandler struct {
	collector *metrics.Collector
}

func NewMetricsHandler(collector *metrics.Collector) *MetricsHandler {
	return &MetricsHandler{collector: collector}
}

func (h *MetricsHandler) Handle(w http.ResponseWriter, r *http.Request) {
	data, err := h.collector.SnapshotJSON()
	if err != nil {
		http.Error(w, `{"error":"marshal metrics"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}
