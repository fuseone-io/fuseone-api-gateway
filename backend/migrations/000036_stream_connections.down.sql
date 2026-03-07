ALTER TABLE kafka_connections
    DROP COLUMN IF EXISTS connection_type,
    DROP COLUMN IF EXISTS nats_urls,
    DROP COLUMN IF EXISTS nats_token,
    DROP COLUMN IF EXISTS nats_nkey_seed,
    DROP COLUMN IF EXISTS nats_credentials,
    DROP COLUMN IF EXISTS nats_jetstream,
    DROP COLUMN IF EXISTS nats_tls;
