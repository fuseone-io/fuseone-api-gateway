CREATE TABLE IF NOT EXISTS request_traces (
    id              BIGSERIAL,
    trace_id        VARCHAR(32) NOT NULL,
    root_span_id    VARCHAR(16),
    service_name    VARCHAR(255),
    route_id        VARCHAR(255),
    route_name      VARCHAR(255),
    method          VARCHAR(10),
    uri             TEXT,
    status_code     INTEGER,
    duration_ns     BIGINT NOT NULL DEFAULT 0,
    spans           JSONB NOT NULL DEFAULT '[]',
    attributes      JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Default partition catches any data not covered by monthly partitions
CREATE TABLE IF NOT EXISTS request_traces_default PARTITION OF request_traces DEFAULT;

CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON request_traces (trace_id);
CREATE INDEX IF NOT EXISTS idx_traces_route_id ON request_traces (route_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traces_created_at ON request_traces (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traces_status ON request_traces (status_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traces_duration ON request_traces (duration_ns DESC, created_at DESC);
