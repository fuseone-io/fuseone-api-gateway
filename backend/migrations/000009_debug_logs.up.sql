CREATE TABLE debug_logs (
    id               BIGSERIAL PRIMARY KEY,
    route_id         TEXT NOT NULL,
    service_id       TEXT,
    consumer_name    TEXT,
    req_method       TEXT NOT NULL,
    req_uri          TEXT NOT NULL,
    req_headers      JSONB,
    req_body         TEXT,
    req_size         INTEGER,
    client_ip        INET,
    resp_status      SMALLINT NOT NULL,
    resp_headers     JSONB,
    resp_body        TEXT,
    resp_size        INTEGER,
    latency_total    INTEGER NOT NULL,
    latency_upstream INTEGER,
    latency_gateway  INTEGER,
    upstream_addr    TEXT,
    request_time     TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_debug_logs_route_time ON debug_logs (route_id, request_time DESC);
CREATE INDEX idx_debug_logs_status ON debug_logs (resp_status, request_time DESC);
CREATE INDEX idx_debug_logs_created ON debug_logs (created_at);
