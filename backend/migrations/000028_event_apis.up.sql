CREATE TABLE IF NOT EXISTS event_apis (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  TEXT NOT NULL,
    description           TEXT NOT NULL DEFAULT '',
    slug                  TEXT NOT NULL UNIQUE,
    kafka_connection_id   UUID NOT NULL REFERENCES kafka_connections(id),
    topic_name            TEXT NOT NULL,
    rest_produce          BOOLEAN NOT NULL DEFAULT true,
    rest_consume          BOOLEAN NOT NULL DEFAULT false,
    sse_enabled           BOOLEAN NOT NULL DEFAULT true,
    websocket_enabled     BOOLEAN NOT NULL DEFAULT false,
    webhook_enabled       BOOLEAN NOT NULL DEFAULT false,
    context_path          TEXT NOT NULL DEFAULT '/events',
    apisix_route_ids      JSONB NOT NULL DEFAULT '[]',
    apisix_plugins        JSONB NOT NULL DEFAULT '{}',
    consumer_group_prefix TEXT NOT NULL DEFAULT 'fuseone-eg',
    auto_offset_reset     TEXT NOT NULL DEFAULT 'latest',
    status                TEXT NOT NULL DEFAULT 'draft',
    deployed_at           TIMESTAMPTZ,
    deployed_by           UUID REFERENCES users(id),
    created_by            UUID REFERENCES users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger NOTIFY for Event Gateway automatic reload
CREATE OR REPLACE FUNCTION notify_event_api_change() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('event_api_config_changed', COALESCE(NEW.id, OLD.id)::text);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER event_api_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON event_apis
    FOR EACH ROW EXECUTE FUNCTION notify_event_api_change();
