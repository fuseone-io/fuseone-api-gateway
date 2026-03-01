ALTER TABLE api_definitions DROP CONSTRAINT IF EXISTS chk_lifecycle_status;
DROP INDEX IF EXISTS idx_api_definitions_version;
DROP INDEX IF EXISTS idx_api_definitions_lifecycle_status;
DROP INDEX IF EXISTS idx_api_definitions_api_group_id;
ALTER TABLE api_definitions
  DROP COLUMN IF EXISTS sunset_date,
  DROP COLUMN IF EXISTS lifecycle_status,
  DROP COLUMN IF EXISTS cloned_from_id,
  DROP COLUMN IF EXISTS api_group_id,
  DROP COLUMN IF EXISTS version;
