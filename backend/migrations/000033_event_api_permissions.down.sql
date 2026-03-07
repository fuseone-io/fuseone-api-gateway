DROP TRIGGER IF EXISTS trg_event_api_permission_changed ON event_api_permissions;
DROP FUNCTION IF EXISTS notify_event_api_permission_change();
DROP TABLE IF EXISTS event_api_permissions;
