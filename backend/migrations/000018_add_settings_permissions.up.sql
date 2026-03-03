-- Add settings:read and settings:write to editor role
UPDATE roles
SET permissions = permissions || '["settings:read", "settings:write"]'::jsonb
WHERE name = 'editor' AND NOT permissions ? 'settings:read';

-- Add settings:read to viewer role
UPDATE roles
SET permissions = permissions || '["settings:read"]'::jsonb
WHERE name = 'viewer' AND NOT permissions ? 'settings:read';
