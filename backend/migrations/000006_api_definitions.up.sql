-- API definitions with draft/deploy workflow
CREATE TABLE IF NOT EXISTS api_definitions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT NOT NULL DEFAULT '',
    description       TEXT NOT NULL DEFAULT '',
    definition        JSONB NOT NULL,
    sync_status       TEXT NOT NULL DEFAULT 'draft',
    apisix_service_id TEXT,
    apisix_route_ids  JSONB NOT NULL DEFAULT '[]',
    created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deployed_at       TIMESTAMPTZ
);

CREATE INDEX idx_api_definitions_name ON api_definitions (name);
CREATE INDEX idx_api_definitions_sync_status ON api_definitions (sync_status);
CREATE INDEX idx_api_definitions_created_at ON api_definitions (created_at DESC);
