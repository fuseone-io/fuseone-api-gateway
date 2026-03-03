CREATE TABLE promotion_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_definition_id   UUID NOT NULL REFERENCES api_definitions(id) ON DELETE CASCADE,
    source_env_id       UUID NOT NULL REFERENCES environments(id),
    target_env_id       UUID NOT NULL REFERENCES environments(id),
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected','deployed','failed')),
    definition_snapshot JSONB NOT NULL,
    diff_summary        JSONB,
    requested_by        UUID NOT NULL REFERENCES users(id),
    reviewed_by         UUID REFERENCES users(id),
    review_comment      TEXT NOT NULL DEFAULT '',
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at         TIMESTAMPTZ,
    deployed_at         TIMESTAMPTZ
);

CREATE INDEX idx_promotion_requests_api ON promotion_requests (api_definition_id);
CREATE INDEX idx_promotion_requests_status ON promotion_requests (status) WHERE status = 'pending';
