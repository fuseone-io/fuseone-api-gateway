CREATE TABLE IF NOT EXISTS llm_configs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider          TEXT NOT NULL UNIQUE,
    model             TEXT NOT NULL,
    api_key_encrypted BYTEA NOT NULL,
    enabled           BOOLEAN NOT NULL DEFAULT false,
    daily_quota       INTEGER NOT NULL DEFAULT 100,
    created_by        UUID REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS llm_usage_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider      TEXT NOT NULL,
    model         TEXT NOT NULL,
    endpoint      TEXT NOT NULL,
    tokens_in     INTEGER NOT NULL DEFAULT 0,
    tokens_out    INTEGER NOT NULL DEFAULT 0,
    duration_ms   INTEGER NOT NULL DEFAULT 0,
    success       BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT NOT NULL DEFAULT '',
    user_id       UUID REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_created ON llm_usage_logs(created_at, provider);
