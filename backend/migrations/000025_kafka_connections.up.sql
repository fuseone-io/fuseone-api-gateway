BEGIN;

CREATE TABLE IF NOT EXISTS kafka_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    brokers         TEXT[] NOT NULL DEFAULT '{}',
    security_protocol TEXT NOT NULL DEFAULT 'PLAINTEXT',
    sasl_mechanism  TEXT,
    sasl_username   TEXT,
    sasl_password   TEXT,
    bridge_url      TEXT NOT NULL DEFAULT 'http://kafka-bridge:8080',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kafka_connections_active ON kafka_connections(is_active) WHERE is_active = true;

COMMIT;
