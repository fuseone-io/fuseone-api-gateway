BEGIN;

CREATE TABLE IF NOT EXISTS test_suites (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    api_id      TEXT,
    steps       JSONB NOT NULL DEFAULT '[]',
    tags        TEXT[] NOT NULL DEFAULT '{}',
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_test_suites_api_id ON test_suites(api_id) WHERE api_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS test_runs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suite_id      UUID NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
    status        TEXT NOT NULL DEFAULT 'pending',
    trigger_type  TEXT NOT NULL DEFAULT 'manual',
    results       JSONB NOT NULL DEFAULT '[]',
    total_steps   INT NOT NULL DEFAULT 0,
    passed_steps  INT NOT NULL DEFAULT 0,
    failed_steps  INT NOT NULL DEFAULT 0,
    duration_ms   INT NOT NULL DEFAULT 0,
    started_at    TIMESTAMPTZ,
    finished_at   TIMESTAMPTZ,
    created_by    UUID REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_test_runs_suite_id ON test_runs(suite_id, created_at DESC);
CREATE INDEX idx_test_runs_status ON test_runs(status);

COMMIT;
