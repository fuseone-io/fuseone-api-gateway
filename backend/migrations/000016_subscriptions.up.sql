CREATE TABLE subscriptions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_username TEXT NOT NULL,
    api_definition_id UUID NOT NULL REFERENCES api_definitions(id) ON DELETE CASCADE,
    plan_id           TEXT NOT NULL DEFAULT '',
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','active','suspended','revoked')),
    requested_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at       TIMESTAMPTZ,
    revoked_at        TIMESTAMPTZ,
    notes             TEXT NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_consumer ON subscriptions(consumer_username);
CREATE INDEX idx_subscriptions_api ON subscriptions(api_definition_id);
CREATE UNIQUE INDEX idx_subscriptions_unique ON subscriptions(consumer_username, api_definition_id)
    WHERE status IN ('pending', 'active');
