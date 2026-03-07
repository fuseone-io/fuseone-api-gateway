DROP TRIGGER IF EXISTS webhook_sub_change_trigger ON webhook_subscriptions;
DROP FUNCTION IF EXISTS notify_webhook_sub_change;
DROP TABLE IF EXISTS webhook_deliveries;
DROP TABLE IF EXISTS webhook_subscriptions;
