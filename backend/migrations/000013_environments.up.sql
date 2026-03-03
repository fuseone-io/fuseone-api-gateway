BEGIN;

CREATE TABLE IF NOT EXISTS environments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    color       TEXT NOT NULL DEFAULT '#6b7280',
    sort_order  INT NOT NULL DEFAULT 0,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    admin_url   TEXT NOT NULL,
    api_key     TEXT NOT NULL DEFAULT '',
    control_url TEXT NOT NULL DEFAULT '',
    metrics_url TEXT NOT NULL DEFAULT '',
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure exactly one default environment
CREATE UNIQUE INDEX IF NOT EXISTS idx_environments_default ON environments (is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_environments_sort ON environments (sort_order, name);

-- Seed the "Default" environment from current system_settings (apisix key)
INSERT INTO environments (name, slug, description, color, sort_order, is_default, admin_url, api_key, control_url)
SELECT
    'Default',
    'default',
    'Default environment',
    '#3b82f6',
    0,
    TRUE,
    COALESCE((value->>'admin_url')::TEXT, 'http://localhost:9180'),
    COALESCE((value->>'api_key')::TEXT, ''),
    COALESCE((value->>'control_url')::TEXT, 'http://localhost:9090')
FROM system_settings
WHERE key = 'apisix'
ON CONFLICT (slug) DO NOTHING;

-- Fallback if system_settings didn't have an apisix entry
INSERT INTO environments (name, slug, description, color, sort_order, is_default, admin_url, control_url)
VALUES ('Default', 'default', 'Default environment', '#3b82f6', 0, TRUE, 'http://localhost:9180', 'http://localhost:9090')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
