DROP INDEX IF EXISTS idx_api_definitions_portal_visible;

ALTER TABLE api_definitions
    DROP COLUMN IF EXISTS portal_categories,
    DROP COLUMN IF EXISTS portal_visible,
    DROP COLUMN IF EXISTS openapi_spec;

DELETE FROM roles WHERE name = 'developer';
