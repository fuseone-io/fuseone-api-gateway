-- Extend kafka_connections to support multiple stream providers (Kafka, NATS, …)
ALTER TABLE kafka_connections
    ADD COLUMN IF NOT EXISTS connection_type    TEXT    NOT NULL DEFAULT 'kafka',
    ADD COLUMN IF NOT EXISTS nats_urls          TEXT[],
    ADD COLUMN IF NOT EXISTS nats_token         TEXT,
    ADD COLUMN IF NOT EXISTS nats_nkey_seed     TEXT,
    ADD COLUMN IF NOT EXISTS nats_credentials   TEXT,
    ADD COLUMN IF NOT EXISTS nats_jetstream     BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS nats_tls           BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN kafka_connections.connection_type IS 'Stream provider type: kafka | nats';
COMMENT ON COLUMN kafka_connections.nats_urls        IS 'NATS server URLs (nats://host:4222)';
COMMENT ON COLUMN kafka_connections.nats_jetstream   IS 'Enable JetStream for persistence';
