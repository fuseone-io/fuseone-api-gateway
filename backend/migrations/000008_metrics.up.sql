-- Per-minute aggregated metrics (TTL default 7 days, enforced by cleanup job)
CREATE TABLE metrics_1m (
    id              BIGSERIAL PRIMARY KEY,
    ts              TIMESTAMPTZ NOT NULL,
    route_id        TEXT NOT NULL DEFAULT '',
    route_name      TEXT NOT NULL DEFAULT '',
    requests_total  INT NOT NULL DEFAULT 0,
    status_2xx      INT NOT NULL DEFAULT 0,
    status_3xx      INT NOT NULL DEFAULT 0,
    status_4xx      INT NOT NULL DEFAULT 0,
    status_5xx      INT NOT NULL DEFAULT 0,
    latency_sum     DOUBLE PRECISION NOT NULL DEFAULT 0,
    latency_count   INT NOT NULL DEFAULT 0,
    latency_p50     DOUBLE PRECISION NOT NULL DEFAULT 0,
    latency_p95     DOUBLE PRECISION NOT NULL DEFAULT 0,
    latency_p99     DOUBLE PRECISION NOT NULL DEFAULT 0,
    bandwidth_ingress BIGINT NOT NULL DEFAULT 0,
    bandwidth_egress  BIGINT NOT NULL DEFAULT 0,
    UNIQUE(ts, route_id)
);
CREATE INDEX idx_metrics_1m_ts ON metrics_1m(ts);
CREATE INDEX idx_metrics_1m_route ON metrics_1m(route_id, ts);

-- Hourly rollup (TTL default 90 days, enforced by cleanup job)
CREATE TABLE metrics_1h (
    id              BIGSERIAL PRIMARY KEY,
    ts              TIMESTAMPTZ NOT NULL,
    route_id        TEXT NOT NULL DEFAULT '',
    route_name      TEXT NOT NULL DEFAULT '',
    requests_total  INT NOT NULL DEFAULT 0,
    status_2xx      INT NOT NULL DEFAULT 0,
    status_3xx      INT NOT NULL DEFAULT 0,
    status_4xx      INT NOT NULL DEFAULT 0,
    status_5xx      INT NOT NULL DEFAULT 0,
    latency_sum     DOUBLE PRECISION NOT NULL DEFAULT 0,
    latency_count   INT NOT NULL DEFAULT 0,
    latency_p50     DOUBLE PRECISION NOT NULL DEFAULT 0,
    latency_p95     DOUBLE PRECISION NOT NULL DEFAULT 0,
    latency_p99     DOUBLE PRECISION NOT NULL DEFAULT 0,
    bandwidth_ingress BIGINT NOT NULL DEFAULT 0,
    bandwidth_egress  BIGINT NOT NULL DEFAULT 0,
    UNIQUE(ts, route_id)
);
CREATE INDEX idx_metrics_1h_ts ON metrics_1h(ts);
CREATE INDEX idx_metrics_1h_route ON metrics_1h(route_id, ts);

-- Daily rollup (no TTL, kept indefinitely for future cold storage export)
CREATE TABLE metrics_1d (
    id              BIGSERIAL PRIMARY KEY,
    ts              TIMESTAMPTZ NOT NULL,
    route_id        TEXT NOT NULL DEFAULT '',
    route_name      TEXT NOT NULL DEFAULT '',
    requests_total  INT NOT NULL DEFAULT 0,
    status_2xx      INT NOT NULL DEFAULT 0,
    status_3xx      INT NOT NULL DEFAULT 0,
    status_4xx      INT NOT NULL DEFAULT 0,
    status_5xx      INT NOT NULL DEFAULT 0,
    latency_sum     DOUBLE PRECISION NOT NULL DEFAULT 0,
    latency_count   INT NOT NULL DEFAULT 0,
    latency_p50     DOUBLE PRECISION NOT NULL DEFAULT 0,
    latency_p95     DOUBLE PRECISION NOT NULL DEFAULT 0,
    latency_p99     DOUBLE PRECISION NOT NULL DEFAULT 0,
    bandwidth_ingress BIGINT NOT NULL DEFAULT 0,
    bandwidth_egress  BIGINT NOT NULL DEFAULT 0,
    UNIQUE(ts, route_id)
);
CREATE INDEX idx_metrics_1d_ts ON metrics_1d(ts);
CREATE INDEX idx_metrics_1d_route ON metrics_1d(route_id, ts);
