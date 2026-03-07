package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/fuseone/event-gateway/internal/kafka"
	"github.com/fuseone/event-gateway/internal/metrics"
	egmw "github.com/fuseone/event-gateway/internal/middleware"
	"github.com/fuseone/event-gateway/internal/schema"
)

type ProduceHandler struct {
	producer  *kafka.Producer
	collector *metrics.Collector
	validator *schema.Validator
}

func NewProduceHandler(producer *kafka.Producer, collector *metrics.Collector, validator *schema.Validator) *ProduceHandler {
	return &ProduceHandler{producer: producer, collector: collector, validator: validator}
}

func (h *ProduceHandler) Handle(w http.ResponseWriter, r *http.Request) {
	eventAPI := egmw.EventAPIFromContext(r.Context())
	if eventAPI == nil {
		http.Error(w, `{"error":"event api not resolved"}`, http.StatusInternalServerError)
		return
	}

	if !eventAPI.RestProduce {
		http.Error(w, `{"error":"REST produce is not enabled for this event API"}`, http.StatusForbidden)
		return
	}

	var req kafka.ProduceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	if len(req.Value) == 0 {
		http.Error(w, `{"error":"value is required"}`, http.StatusBadRequest)
		return
	}

	// Schema validation (if enabled for this Event API)
	if eventAPI.SchemaValidation {
		if err := h.validator.Validate(eventAPI.ID, req.Value); err != nil {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusUnprocessableEntity)
			return
		}
	}

	ctr := h.collector.For(eventAPI.ID)
	start := time.Now()

	resp, err := h.producer.Produce(r.Context(), eventAPI.Connection, eventAPI.TopicName, req)
	elapsed := time.Since(start).Microseconds()
	ctr.ProduceTotal.Add(1)
	ctr.ProduceLatencyUs.Add(elapsed)

	if err != nil {
		ctr.ProduceErrors.Add(1)
		http.Error(w, `{"error":"produce failed: `+err.Error()+`"}`, http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": resp,
	})
}
