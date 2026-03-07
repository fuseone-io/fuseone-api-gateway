CREATE TABLE IF NOT EXISTS event_gateway_metrics (
    ts                  TIMESTAMPTZ NOT NULL,
    event_api_id        UUID NOT NULL REFERENCES event_apis(id) ON DELETE CASCADE,
    produce_total       BIGINT NOT NULL DEFAULT 0,
    produce_errors      BIGINT NOT NULL DEFAULT 0,
    produce_latency_avg DOUBLE PRECISION NOT NULL DEFAULT 0,
    consume_total       BIGINT NOT NULL DEFAULT 0,
    consume_messages    BIGINT NOT NULL DEFAULT 0,
    sse_connections     INTEGER NOT NULL DEFAULT 0,
    sse_messages        BIGINT NOT NULL DEFAULT 0,
    ws_connections      INTEGER NOT NULL DEFAULT 0,
    ws_messages_in      BIGINT NOT NULL DEFAULT 0,
    ws_messages_out     BIGINT NOT NULL DEFAULT 0,
    webhook_total       BIGINT NOT NULL DEFAULT 0,
    webhook_success     BIGINT NOT NULL DEFAULT 0,
    webhook_failed      BIGINT NOT NULL DEFAULT 0,
    UNIQUE(ts, event_api_id)
);

CREATE INDEX idx_eg_metrics_ts ON event_gateway_metrics(ts);
CREATE INDEX idx_eg_metrics_api ON event_gateway_metrics(event_api_id);
