-- Add consumer_name column to all metrics tiers for per-application analytics.
-- APISIX Prometheus labels include "consumer" which identifies the APISIX consumer
-- (mapped to applications in FuseOne).

ALTER TABLE metrics_1m ADD COLUMN consumer_name TEXT NOT NULL DEFAULT '';
ALTER TABLE metrics_1h ADD COLUMN consumer_name TEXT NOT NULL DEFAULT '';
ALTER TABLE metrics_1d ADD COLUMN consumer_name TEXT NOT NULL DEFAULT '';

-- Update unique constraints to include consumer_name.
-- Existing data has consumer_name='' so uniqueness is preserved.
ALTER TABLE metrics_1m DROP CONSTRAINT metrics_1m_ts_route_id_key;
ALTER TABLE metrics_1m ADD CONSTRAINT metrics_1m_ts_route_consumer_key UNIQUE(ts, route_id, consumer_name);

ALTER TABLE metrics_1h DROP CONSTRAINT metrics_1h_ts_route_id_key;
ALTER TABLE metrics_1h ADD CONSTRAINT metrics_1h_ts_route_consumer_key UNIQUE(ts, route_id, consumer_name);

ALTER TABLE metrics_1d DROP CONSTRAINT metrics_1d_ts_route_id_key;
ALTER TABLE metrics_1d ADD CONSTRAINT metrics_1d_ts_route_consumer_key UNIQUE(ts, route_id, consumer_name);

-- Partial indexes for consumer queries (skip empty consumer = unauthenticated traffic)
CREATE INDEX idx_metrics_1m_consumer ON metrics_1m(consumer_name, ts) WHERE consumer_name != '';
CREATE INDEX idx_metrics_1h_consumer ON metrics_1h(consumer_name, ts) WHERE consumer_name != '';
CREATE INDEX idx_metrics_1d_consumer ON metrics_1d(consumer_name, ts) WHERE consumer_name != '';
