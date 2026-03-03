BEGIN;

ALTER TABLE oauth_providers
    DROP COLUMN IF EXISTS default_role_id,
    DROP COLUMN IF EXISTS auto_create_users,
    DROP COLUMN IF EXISTS extra_config,
    DROP COLUMN IF EXISTS display_name;

COMMIT;
