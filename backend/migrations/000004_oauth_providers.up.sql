BEGIN;

CREATE TABLE IF NOT EXISTS oauth_providers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider      VARCHAR(50) NOT NULL,
    client_id     TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    scopes        TEXT[] DEFAULT '{}',
    is_enabled    BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_oauth_providers_provider ON oauth_providers(provider);

CREATE TABLE IF NOT EXISTS user_oauth_links (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider      VARCHAR(50) NOT NULL,
    provider_uid  TEXT NOT NULL,
    email         VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_user_oauth_links_provider_uid ON user_oauth_links(provider, provider_uid);
CREATE INDEX idx_user_oauth_links_user_id ON user_oauth_links(user_id);

COMMIT;
