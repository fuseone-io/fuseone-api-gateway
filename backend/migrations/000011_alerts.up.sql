BEGIN;

CREATE TABLE IF NOT EXISTS alert_rules (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    enabled       BOOLEAN NOT NULL DEFAULT true,
    rule_type     TEXT NOT NULL,          -- 'error_rate', 'latency_p99', 'traffic_drop'
    scope_type    TEXT NOT NULL DEFAULT 'global', -- 'global', 'route', 'consumer'
    scope_ids     TEXT[] NOT NULL DEFAULT '{}',
    threshold     DOUBLE PRECISION NOT NULL,
    eval_window   TEXT NOT NULL DEFAULT '5m',    -- '1m','5m','15m','30m','1h'
    channels      JSONB NOT NULL DEFAULT '[]',   -- [{type:"webhook",config:{url,headers}}]
    state         TEXT NOT NULL DEFAULT 'ok',    -- 'ok','firing','acknowledged'
    last_eval     TIMESTAMPTZ,
    fired_at      TIMESTAMPTZ,
    created_by    UUID REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled) WHERE enabled = true;
CREATE INDEX idx_alert_rules_state ON alert_rules(state);

CREATE TABLE IF NOT EXISTS alert_events (
    id            BIGSERIAL PRIMARY KEY,
    rule_id       UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    event_type    TEXT NOT NULL,           -- 'fired','resolved','acknowledged'
    message       TEXT NOT NULL DEFAULT '',
    value         DOUBLE PRECISION,
    threshold     DOUBLE PRECISION,
    acked_by      UUID REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_events_rule_id ON alert_events(rule_id, created_at DESC);
CREATE INDEX idx_alert_events_type ON alert_events(event_type, created_at DESC);

COMMIT;
