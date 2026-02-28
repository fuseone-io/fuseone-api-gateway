BEGIN;

CREATE TABLE IF NOT EXISTS system_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_by  UUID REFERENCES users(id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_settings (key, value) VALUES
    ('apisix', '{"admin_url": "http://apisix:9180", "api_key": ""}'),
    ('auth', '{"allow_registration": false}'),
    ('general', '{"site_name": "FuseOne API Gateway"}')
ON CONFLICT (key) DO NOTHING;

COMMIT;
