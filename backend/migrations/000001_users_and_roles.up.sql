BEGIN;

CREATE TABLE IF NOT EXISTS roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50) UNIQUE NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    permissions JSONB NOT NULL DEFAULT '[]',
    is_system   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(100) UNIQUE NOT NULL,
    email         VARCHAR(255) UNIQUE,
    display_name  VARCHAR(255) NOT NULL DEFAULT '',
    password_hash TEXT,
    role_id       UUID NOT NULL REFERENCES roles(id),
    is_active     BOOLEAN NOT NULL DEFAULT true,
    avatar_url    TEXT NOT NULL DEFAULT '',
    totp_secret   TEXT NOT NULL DEFAULT '',
    totp_enabled  BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_is_active ON users(is_active);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at  TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Default roles
INSERT INTO roles (name, description, permissions, is_system) VALUES
    ('admin', 'Full access to all resources', '["*"]', true),
    ('editor', 'Can create, edit, and delete API resources',
     '["routes:read","routes:write","services:read","services:write","upstreams:read","upstreams:write","consumers:read","consumers:write","plugins:read","plugins:write","ssl:read","ssl:write","global_rules:read","global_rules:write","secrets:read","secrets:write","stream_routes:read","stream_routes:write","monitoring:read","dashboard:read"]',
     true),
    ('viewer', 'Read-only access to all resources',
     '["routes:read","services:read","upstreams:read","consumers:read","plugins:read","ssl:read","global_rules:read","secrets:read","stream_routes:read","monitoring:read","dashboard:read","audit:read"]',
     true)
ON CONFLICT (name) DO NOTHING;

-- Default admin user (password: changeme)
INSERT INTO users (username, email, display_name, password_hash, role_id)
SELECT 'admin', 'admin@localhost', 'Administrator',
       '$2a$10$VnuIYVbS82OAX8x4FsrxhOrcYv9/FGzAh4krNsmiKC0MmjrI9Usma',
       id
FROM roles WHERE name = 'admin'
ON CONFLICT (username) DO NOTHING;

COMMIT;
