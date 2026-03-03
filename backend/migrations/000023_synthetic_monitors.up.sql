BEGIN;

CREATE TABLE IF NOT EXISTS synthetic_monitors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    enabled         BOOLEAN NOT NULL DEFAULT true,
    suite_id        UUID NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
    interval_sec    INT NOT NULL DEFAULT 300,
    locations       TEXT[] NOT NULL DEFAULT '{"default"}',
    uptime_pct      DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    last_status     TEXT NOT NULL DEFAULT 'unknown',
    last_run_at     TIMESTAMPTZ,
    last_run_id     UUID,
    consecutive_fail INT NOT NULL DEFAULT 0,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_synthetic_monitors_enabled ON synthetic_monitors(enabled) WHERE enabled = true;
CREATE INDEX idx_synthetic_monitors_suite ON synthetic_monitors(suite_id);

COMMIT;
