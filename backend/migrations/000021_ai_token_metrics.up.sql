-- AI Token Metrics: per-minute granularity
CREATE TABLE IF NOT EXISTS ai_token_metrics_1m (
    id                  BIGSERIAL PRIMARY KEY,
    ts                  TIMESTAMPTZ NOT NULL,
    route_id            TEXT NOT NULL,
    route_name          TEXT NOT NULL DEFAULT '',
    consumer_name       TEXT NOT NULL DEFAULT '',
    provider            TEXT NOT NULL DEFAULT '',
    model               TEXT NOT NULL DEFAULT '',
    requests            INT NOT NULL DEFAULT 0,
    prompt_tokens       INT NOT NULL DEFAULT 0,
    completion_tokens   INT NOT NULL DEFAULT 0,
    total_tokens        INT NOT NULL DEFAULT 0,
    estimated_cost_usd  NUMERIC(12,6) NOT NULL DEFAULT 0,
    UNIQUE (ts, route_id, consumer_name, provider, model)
);

CREATE INDEX idx_ai_token_1m_ts ON ai_token_metrics_1m (ts);
CREATE INDEX idx_ai_token_1m_route ON ai_token_metrics_1m (route_id, ts);

-- AI Token Metrics: hourly rollup
CREATE TABLE IF NOT EXISTS ai_token_metrics_1h (
    id                  BIGSERIAL PRIMARY KEY,
    ts                  TIMESTAMPTZ NOT NULL,
    route_id            TEXT NOT NULL,
    route_name          TEXT NOT NULL DEFAULT '',
    consumer_name       TEXT NOT NULL DEFAULT '',
    provider            TEXT NOT NULL DEFAULT '',
    model               TEXT NOT NULL DEFAULT '',
    requests            INT NOT NULL DEFAULT 0,
    prompt_tokens       INT NOT NULL DEFAULT 0,
    completion_tokens   INT NOT NULL DEFAULT 0,
    total_tokens        INT NOT NULL DEFAULT 0,
    estimated_cost_usd  NUMERIC(12,6) NOT NULL DEFAULT 0,
    UNIQUE (ts, route_id, consumer_name, provider, model)
);

CREATE INDEX idx_ai_token_1h_ts ON ai_token_metrics_1h (ts);

-- AI Token Metrics: daily rollup
CREATE TABLE IF NOT EXISTS ai_token_metrics_1d (
    id                  BIGSERIAL PRIMARY KEY,
    ts                  TIMESTAMPTZ NOT NULL,
    route_id            TEXT NOT NULL,
    route_name          TEXT NOT NULL DEFAULT '',
    consumer_name       TEXT NOT NULL DEFAULT '',
    provider            TEXT NOT NULL DEFAULT '',
    model               TEXT NOT NULL DEFAULT '',
    requests            INT NOT NULL DEFAULT 0,
    prompt_tokens       INT NOT NULL DEFAULT 0,
    completion_tokens   INT NOT NULL DEFAULT 0,
    total_tokens        INT NOT NULL DEFAULT 0,
    estimated_cost_usd  NUMERIC(12,6) NOT NULL DEFAULT 0,
    UNIQUE (ts, route_id, consumer_name, provider, model)
);

CREATE INDEX idx_ai_token_1d_ts ON ai_token_metrics_1d (ts);

-- Add ai_metrics:read permission to admin role
UPDATE roles
SET permissions = permissions || '["ai_metrics:read"]'::jsonb
WHERE name = 'admin' AND NOT permissions ? 'ai_metrics:read';

-- Add ai_metrics:read permission to viewer role
UPDATE roles
SET permissions = permissions || '["ai_metrics:read"]'::jsonb
WHERE name = 'viewer' AND NOT permissions ? 'ai_metrics:read';
