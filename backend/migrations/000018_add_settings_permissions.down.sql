-- Remove settings:read and settings:write from editor
UPDATE roles
SET permissions = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements(permissions) AS elem
    WHERE elem::text NOT IN ('"settings:read"', '"settings:write"')
)
WHERE name = 'editor';

-- Remove settings:read from viewer
UPDATE roles
SET permissions = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements(permissions) AS elem
    WHERE elem::text != '"settings:read"'
)
WHERE name = 'viewer';
