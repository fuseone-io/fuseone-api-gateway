-- Advanced webhook features: circuit breaker + event filtering
ALTER TABLE webhook_subscriptions ADD COLUMN IF NOT EXISTS filter_expression TEXT DEFAULT '';
ALTER TABLE webhook_subscriptions ADD COLUMN IF NOT EXISTS circuit_breaker_threshold INTEGER DEFAULT 5;
ALTER TABLE webhook_subscriptions ADD COLUMN IF NOT EXISTS circuit_status TEXT DEFAULT 'closed';
ALTER TABLE webhook_subscriptions ADD COLUMN IF NOT EXISTS circuit_opened_at TIMESTAMPTZ;
ALTER TABLE webhook_subscriptions ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0;
