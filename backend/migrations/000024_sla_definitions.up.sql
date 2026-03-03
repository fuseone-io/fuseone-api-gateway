BEGIN;

CREATE TABLE IF NOT EXISTS sla_definitions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT NOT NULL,
    description       TEXT NOT NULL DEFAULT '',
    api_id            TEXT,
    availability_pct  DOUBLE PRECISION NOT NULL DEFAULT 99.9,
    latency_p99_ms    INT NOT NULL DEFAULT 500,
    error_rate_pct    DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    eval_window       TEXT NOT NULL DEFAULT '30d',
    current_avail     DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    current_latency   INT NOT NULL DEFAULT 0,
    current_error     DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    budget_remaining  DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    compliance_status TEXT NOT NULL DEFAULT 'compliant',
    last_eval_at      TIMESTAMPTZ,
    created_by        UUID REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sla_definitions_api_id ON sla_definitions(api_id) WHERE api_id IS NOT NULL;
CREATE INDEX idx_sla_definitions_compliance ON sla_definitions(compliance_status);

COMMIT;
