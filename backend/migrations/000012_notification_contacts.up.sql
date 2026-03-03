-- Centralized notification contacts (Slack, Teams, Webhook, Email)
CREATE TABLE notification_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,                  -- 'webhook','slack','teams','email'
    config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nc_type ON notification_contacts(type);
CREATE INDEX idx_nc_enabled ON notification_contacts(enabled) WHERE enabled = true;
