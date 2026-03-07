package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

type EGMetricsHandler struct {
	pool   *pgxpool.Pool
	logger *zap.Logger
}

func NewEGMetricsHandler(pool *pgxpool.Pool, logger *zap.Logger) *EGMetricsHandler {
	return &EGMetricsHandler{pool: pool, logger: logger}
}

// TimeSeries godoc
// GET /api/kafka/event-apis/:id/metrics?range=1h|6h|24h|7d
type egMetricsRow struct {
	Ts              time.Time `json:"ts"`
	ProduceTotal    int64     `json:"produce_total"`
	ProduceErrors   int64     `json:"produce_errors"`
	ProduceLatency  float64   `json:"produce_latency_avg"`
	ConsumeTotal    int64     `json:"consume_total"`
	ConsumeMessages int64     `json:"consume_messages"`
	SSEConnections  int       `json:"sse_connections"`
	SSEMessages     int64     `json:"sse_messages"`
	WSConnections   int       `json:"ws_connections"`
	WSMessagesIn    int64     `json:"ws_messages_in"`
	WSMessagesOut   int64     `json:"ws_messages_out"`
	WebhookTotal    int64     `json:"webhook_total"`
	WebhookSuccess  int64     `json:"webhook_success"`
	WebhookFailed   int64     `json:"webhook_failed"`
}

type egMetricsSummary struct {
	ProduceTotal    int64   `json:"produce_total"`
	ProduceErrors   int64   `json:"produce_errors"`
	ProduceLatency  float64 `json:"produce_latency_avg"`
	ConsumeTotal    int64   `json:"consume_total"`
	ConsumeMessages int64   `json:"consume_messages"`
	SSEConnections  int     `json:"sse_connections"`
	SSEMessages     int64   `json:"sse_messages"`
	WSConnections   int     `json:"ws_connections"`
	WSMessagesIn    int64   `json:"ws_messages_in"`
	WSMessagesOut   int64   `json:"ws_messages_out"`
	WebhookTotal    int64   `json:"webhook_total"`
	WebhookSuccess  int64   `json:"webhook_success"`
	WebhookFailed   int64   `json:"webhook_failed"`
}

var egValidRanges = map[string]string{
	"1h":  "1 hour",
	"6h":  "6 hours",
	"24h": "24 hours",
	"7d":  "7 days",
	"30d": "30 days",
}

func (h *EGMetricsHandler) TimeSeries(c *gin.Context) {
	id := c.Param("id")
	rangeStr := c.DefaultQuery("range", "24h")

	interval, ok := egValidRanges[rangeStr]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid range"})
		return
	}

	rows, err := h.pool.Query(c.Request.Context(), `
		SELECT ts, produce_total, produce_errors, produce_latency_avg,
			consume_total, consume_messages,
			sse_connections, sse_messages,
			ws_connections, ws_messages_in, ws_messages_out,
			webhook_total, webhook_success, webhook_failed
		FROM event_gateway_metrics
		WHERE event_api_id = $1 AND ts >= NOW() - $2::interval
		ORDER BY ts ASC
	`, id, interval)
	if err != nil {
		h.logger.Error("query eg metrics timeseries", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}
	defer rows.Close()

	var result []egMetricsRow
	for rows.Next() {
		var r egMetricsRow
		if err := rows.Scan(
			&r.Ts, &r.ProduceTotal, &r.ProduceErrors, &r.ProduceLatency,
			&r.ConsumeTotal, &r.ConsumeMessages,
			&r.SSEConnections, &r.SSEMessages,
			&r.WSConnections, &r.WSMessagesIn, &r.WSMessagesOut,
			&r.WebhookTotal, &r.WebhookSuccess, &r.WebhookFailed,
		); err != nil {
			h.logger.Error("scan eg metrics row", zap.Error(err))
			continue
		}
		result = append(result, r)
	}

	if result == nil {
		result = []egMetricsRow{}
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

func (h *EGMetricsHandler) Summary(c *gin.Context) {
	id := c.Param("id")
	rangeStr := c.DefaultQuery("range", "24h")

	interval, ok := egValidRanges[rangeStr]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid range"})
		return
	}

	var s egMetricsSummary
	err := h.pool.QueryRow(c.Request.Context(), `
		SELECT
			COALESCE(SUM(produce_total), 0),
			COALESCE(SUM(produce_errors), 0),
			COALESCE(AVG(NULLIF(produce_latency_avg, 0)), 0),
			COALESCE(SUM(consume_total), 0),
			COALESCE(SUM(consume_messages), 0),
			COALESCE(MAX(sse_connections), 0),
			COALESCE(SUM(sse_messages), 0),
			COALESCE(MAX(ws_connections), 0),
			COALESCE(SUM(ws_messages_in), 0),
			COALESCE(SUM(ws_messages_out), 0),
			COALESCE(SUM(webhook_total), 0),
			COALESCE(SUM(webhook_success), 0),
			COALESCE(SUM(webhook_failed), 0)
		FROM event_gateway_metrics
		WHERE event_api_id = $1 AND ts >= NOW() - $2::interval
	`, id, interval).Scan(
		&s.ProduceTotal, &s.ProduceErrors, &s.ProduceLatency,
		&s.ConsumeTotal, &s.ConsumeMessages,
		&s.SSEConnections, &s.SSEMessages,
		&s.WSConnections, &s.WSMessagesIn, &s.WSMessagesOut,
		&s.WebhookTotal, &s.WebhookSuccess, &s.WebhookFailed,
	)
	if err != nil {
		h.logger.Error("query eg metrics summary", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": s})
}
