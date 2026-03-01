-- Add versioning and lifecycle columns to api_definitions
ALTER TABLE api_definitions
  ADD COLUMN version          TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN api_group_id     UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN cloned_from_id   UUID REFERENCES api_definitions(id) ON DELETE SET NULL,
  ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN sunset_date      TIMESTAMPTZ;

-- Backfill: each existing API is its own group
UPDATE api_definitions SET api_group_id = id;

-- Backfill: synced APIs are active, everything else stays draft
UPDATE api_definitions SET lifecycle_status = 'active' WHERE sync_status = 'synced';

-- Indexes for querying
CREATE INDEX idx_api_definitions_api_group_id ON api_definitions (api_group_id);
CREATE INDEX idx_api_definitions_lifecycle_status ON api_definitions (lifecycle_status);
CREATE INDEX idx_api_definitions_version ON api_definitions (api_group_id, version);

-- Constraint: lifecycle_status must be one of the allowed values
ALTER TABLE api_definitions
  ADD CONSTRAINT chk_lifecycle_status
  CHECK (lifecycle_status IN ('draft', 'active', 'deprecated', 'retired'));
