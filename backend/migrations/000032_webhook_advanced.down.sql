ALTER TABLE webhook_subscriptions DROP COLUMN IF EXISTS consecutive_failures;
ALTER TABLE webhook_subscriptions DROP COLUMN IF EXISTS circuit_opened_at;
ALTER TABLE webhook_subscriptions DROP COLUMN IF EXISTS circuit_status;
ALTER TABLE webhook_subscriptions DROP COLUMN IF EXISTS circuit_breaker_threshold;
ALTER TABLE webhook_subscriptions DROP COLUMN IF EXISTS filter_expression;
