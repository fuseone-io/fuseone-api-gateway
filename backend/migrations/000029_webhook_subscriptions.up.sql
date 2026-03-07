-- Webhook subscriptions — URLs to deliver Kafka messages to
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_api_id    UUID NOT NULL REFERENCES event_apis(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    secret          TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    headers         JSONB NOT NULL DEFAULT '{}',
    retry_policy    JSONB NOT NULL DEFAULT '{"max_attempts":3,"backoff_seconds":[10,30,90]}',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook delivery log — one row per delivery attempt
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id   UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    event_api_id      UUID NOT NULL REFERENCES event_apis(id) ON DELETE CASCADE,
    kafka_partition   INTEGER NOT NULL,
    kafka_offset      BIGINT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'pending',
    attempts          INTEGER NOT NULL DEFAULT 0,
    last_status_code  INTEGER,
    last_error        TEXT,
    next_retry_at     TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending
    ON webhook_deliveries(next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_sub
    ON webhook_deliveries(subscription_id, created_at DESC);

-- NOTIFY trigger for Event Gateway hot reload
CREATE OR REPLACE FUNCTION notify_webhook_sub_change() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('webhook_subscription_changed',
        COALESCE(NEW.event_api_id, OLD.event_api_id)::text);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhook_sub_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON webhook_subscriptions
    FOR EACH ROW EXECUTE FUNCTION notify_webhook_sub_change();
