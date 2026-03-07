package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// EGMetricsSnapshot matches the JSON returned by the Event Gateway /internal/metrics endpoint.
type EGMetricsSnapshot struct {
	EventApiID       string `json:"event_api_id"`
	ProduceTotal     int64  `json:"produce_total"`
	ProduceErrors    int64  `json:"produce_errors"`
	ProduceLatencyUs int64  `json:"produce_latency_us"`
	ConsumeTotal     int64  `json:"consume_total"`
	ConsumeMessages  int64  `json:"consume_messages"`
	SSEActive        int64  `json:"sse_active"`
	SSEMessagesSent  int64  `json:"sse_messages_sent"`
	WSActive         int64  `json:"ws_active"`
	WSMessagesIn     int64  `json:"ws_messages_in"`
	WSMessagesOut    int64  `json:"ws_messages_out"`
	WebhookTotal     int64  `json:"webhook_total"`
	WebhookSuccess   int64  `json:"webhook_success"`
	WebhookFailed    int64  `json:"webhook_failed"`
}

// EGMetricsScraper periodically fetches metrics from the Event Gateway and stores them.
type EGMetricsScraper struct {
	pool       *pgxpool.Pool
	egURL      string
	httpClient *http.Client
	logger     *zap.Logger
}

func NewEGMetricsScraper(pool *pgxpool.Pool, eventGatewayURL string, logger *zap.Logger) *EGMetricsScraper {
	return &EGMetricsScraper{
		pool:       pool,
		egURL:      eventGatewayURL,
		httpClient: &http.Client{Timeout: 10 * time.Second},
		logger:     logger,
	}
}

// Start scrapes every interval. Blocks until ctx is cancelled.
// If the Event Gateway is unreachable, it silently retries without spamming logs.
func (s *EGMetricsScraper) Start(ctx context.Context, interval time.Duration) {
	s.logger.Info("event gateway metrics scraper started", zap.Duration("interval", interval))
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	reachable := false
	for {
		select {
		case <-ctx.Done():
			s.logger.Info("event gateway metrics scraper stopped")
			return
		case <-ticker.C:
			if err := s.scrape(ctx); err != nil {
				if !reachable {
					// Only log once while unreachable
					continue
				}
				reachable = false
				s.logger.Warn("event gateway became unreachable, pausing metrics scrape")
			} else {
				if !reachable {
					s.logger.Info("event gateway is reachable, scraping metrics")
					reachable = true
				}
			}
		}
	}
}

func (s *EGMetricsScraper) scrape(ctx context.Context) error {
	url := fmt.Sprintf("%s/internal/metrics", s.egURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("unexpected status %d: %s", resp.StatusCode, body)
	}

	var snapshots []EGMetricsSnapshot
	if err := json.NewDecoder(resp.Body).Decode(&snapshots); err != nil {
		return fmt.Errorf("decode metrics: %w", err)
	}

	if len(snapshots) == 0 {
		return nil
	}

	ts := time.Now().UTC().Truncate(time.Minute)

	for _, snap := range snapshots {
		eventApiID, err := uuid.Parse(snap.EventApiID)
		if err != nil {
			continue
		}

		var latencyAvg float64
		if snap.ProduceTotal > 0 {
			latencyAvg = float64(snap.ProduceLatencyUs) / float64(snap.ProduceTotal) / 1000.0 // ms
		}

		_, err = s.pool.Exec(ctx, `
			INSERT INTO event_gateway_metrics (
				ts, event_api_id,
				produce_total, produce_errors, produce_latency_avg,
				consume_total, consume_messages,
				sse_connections, sse_messages,
				ws_connections, ws_messages_in, ws_messages_out,
				webhook_total, webhook_success, webhook_failed
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
			ON CONFLICT (ts, event_api_id) DO UPDATE SET
				produce_total = event_gateway_metrics.produce_total + EXCLUDED.produce_total,
				produce_errors = event_gateway_metrics.produce_errors + EXCLUDED.produce_errors,
				produce_latency_avg = EXCLUDED.produce_latency_avg,
				consume_total = event_gateway_metrics.consume_total + EXCLUDED.consume_total,
				consume_messages = event_gateway_metrics.consume_messages + EXCLUDED.consume_messages,
				sse_connections = EXCLUDED.sse_connections,
				sse_messages = event_gateway_metrics.sse_messages + EXCLUDED.sse_messages,
				ws_connections = EXCLUDED.ws_connections,
				ws_messages_in = event_gateway_metrics.ws_messages_in + EXCLUDED.ws_messages_in,
				ws_messages_out = event_gateway_metrics.ws_messages_out + EXCLUDED.ws_messages_out,
				webhook_total = event_gateway_metrics.webhook_total + EXCLUDED.webhook_total,
				webhook_success = event_gateway_metrics.webhook_success + EXCLUDED.webhook_success,
				webhook_failed = event_gateway_metrics.webhook_failed + EXCLUDED.webhook_failed
		`, ts, eventApiID,
			snap.ProduceTotal, snap.ProduceErrors, latencyAvg,
			snap.ConsumeTotal, snap.ConsumeMessages,
			snap.SSEActive, snap.SSEMessagesSent,
			snap.WSActive, snap.WSMessagesIn, snap.WSMessagesOut,
			snap.WebhookTotal, snap.WebhookSuccess, snap.WebhookFailed,
		)
		if err != nil {
			s.logger.Warn("insert eg metric", zap.Error(err), zap.String("event_api_id", snap.EventApiID))
		}
	}

	return nil
}
