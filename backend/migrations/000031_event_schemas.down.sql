DROP TRIGGER IF EXISTS trg_event_schema_changed ON event_schemas;
DROP FUNCTION IF EXISTS notify_event_schema_changed();
DROP TABLE IF EXISTS event_schemas;
ALTER TABLE event_apis DROP COLUMN IF EXISTS schema_validation;
