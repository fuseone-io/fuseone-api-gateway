-- Per-topic access control: scope consumers to specific Event APIs
CREATE TABLE IF NOT EXISTS event_api_permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_api_id    UUID NOT NULL REFERENCES event_apis(id) ON DELETE CASCADE,
    consumer_name   TEXT NOT NULL,            -- APISIX consumer username
    can_produce     BOOLEAN DEFAULT false,
    can_consume     BOOLEAN DEFAULT false,
    can_stream      BOOLEAN DEFAULT false,
    rate_limit      INTEGER DEFAULT 0,        -- 0 = unlimited (requests per window)
    rate_window_sec INTEGER DEFAULT 60,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_api_id, consumer_name)
);

CREATE INDEX idx_eap_event_api ON event_api_permissions(event_api_id);
CREATE INDEX idx_eap_consumer ON event_api_permissions(consumer_name);

-- Trigger for pg_notify on permission changes
CREATE OR REPLACE FUNCTION notify_event_api_permission_change() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('event_api_permission_changed', COALESCE(NEW.event_api_id, OLD.event_api_id)::text);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_event_api_permission_changed
    AFTER INSERT OR UPDATE OR DELETE ON event_api_permissions
    FOR EACH ROW EXECUTE FUNCTION notify_event_api_permission_change();
