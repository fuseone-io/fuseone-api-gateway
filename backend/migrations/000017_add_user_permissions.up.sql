-- Add users:read and users:write to editor role
UPDATE roles
SET permissions = permissions || '["users:read", "users:write"]'::jsonb
WHERE name = 'editor' AND NOT permissions ? 'users:read';

-- Add users:read to viewer role
UPDATE roles
SET permissions = permissions || '["users:read"]'::jsonb
WHERE name = 'viewer' AND NOT permissions ? 'users:read';
