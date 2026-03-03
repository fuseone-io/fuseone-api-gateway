-- Remove users:read and users:write from editor
UPDATE roles
SET permissions = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements(permissions) AS elem
    WHERE elem::text NOT IN ('"users:read"', '"users:write"')
)
WHERE name = 'editor';

-- Remove users:read from viewer
UPDATE roles
SET permissions = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements(permissions) AS elem
    WHERE elem::text != '"users:read"'
)
WHERE name = 'viewer';
