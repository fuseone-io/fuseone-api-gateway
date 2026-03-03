-- Developer role for portal users
INSERT INTO roles (id, name, description, permissions, is_system)
VALUES (
    gen_random_uuid(),
    'developer',
    'API consumer with portal access',
    '["portal:read","portal:subscribe"]',
    true
) ON CONFLICT (name) DO NOTHING;

-- Portal fields on api_definitions
ALTER TABLE api_definitions
    ADD COLUMN IF NOT EXISTS openapi_spec TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS portal_visible BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS portal_categories TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_api_definitions_portal_visible
    ON api_definitions (portal_visible) WHERE portal_visible = true;
