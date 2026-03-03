CREATE TABLE api_deployments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_definition_id   UUID NOT NULL REFERENCES api_definitions(id) ON DELETE CASCADE,
    environment_id      UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    apisix_service_id   TEXT,
    apisix_route_ids    JSONB NOT NULL DEFAULT '[]',
    sync_status         TEXT NOT NULL DEFAULT 'pending'
                        CHECK (sync_status IN ('pending','synced','out_of_sync','failed')),
    deployed_at         TIMESTAMPTZ,
    deployed_by         UUID REFERENCES users(id),
    definition_snapshot JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(api_definition_id, environment_id)
);

-- Migrate existing deploys to default env
INSERT INTO api_deployments (api_definition_id, environment_id, apisix_service_id, apisix_route_ids, sync_status, deployed_at)
SELECT ad.id, e.id, ad.apisix_service_id, ad.apisix_route_ids,
       CASE WHEN ad.sync_status = 'synced' THEN 'synced' ELSE 'pending' END, ad.deployed_at
FROM api_definitions ad CROSS JOIN environments e
WHERE e.is_default = TRUE AND ad.apisix_service_id IS NOT NULL;
