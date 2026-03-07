-- Add schema validation flag to event_apis
ALTER TABLE event_apis ADD COLUMN IF NOT EXISTS schema_validation BOOLEAN DEFAULT false;

-- Event schemas table
CREATE TABLE IF NOT EXISTS event_schemas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_api_id    UUID NOT NULL REFERENCES event_apis(id) ON DELETE CASCADE,
    version         INTEGER NOT NULL DEFAULT 1,
    schema_type     TEXT NOT NULL DEFAULT 'json-schema',
    schema_content  JSONB NOT NULL,
    description     TEXT DEFAULT '',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_api_id, version)
);

CREATE INDEX IF NOT EXISTS idx_event_schemas_api ON event_schemas(event_api_id);

-- Notify Event Gateway when schemas change
CREATE OR REPLACE FUNCTION notify_event_schema_changed() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('event_schema_changed', COALESCE(NEW.event_api_id, OLD.event_api_id)::text);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_event_schema_changed
    AFTER INSERT OR UPDATE OR DELETE ON event_schemas
    FOR EACH ROW EXECUTE FUNCTION notify_event_schema_changed();
