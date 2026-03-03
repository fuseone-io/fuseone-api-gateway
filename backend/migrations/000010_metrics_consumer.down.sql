-- Reverse consumer_name addition

DROP INDEX IF EXISTS idx_metrics_1m_consumer;
DROP INDEX IF EXISTS idx_metrics_1h_consumer;
DROP INDEX IF EXISTS idx_metrics_1d_consumer;

ALTER TABLE metrics_1m DROP CONSTRAINT metrics_1m_ts_route_consumer_key;
ALTER TABLE metrics_1m ADD CONSTRAINT metrics_1m_ts_route_id_key UNIQUE(ts, route_id);

ALTER TABLE metrics_1h DROP CONSTRAINT metrics_1h_ts_route_consumer_key;
ALTER TABLE metrics_1h ADD CONSTRAINT metrics_1h_ts_route_id_key UNIQUE(ts, route_id);

ALTER TABLE metrics_1d DROP CONSTRAINT metrics_1d_ts_route_consumer_key;
ALTER TABLE metrics_1d ADD CONSTRAINT metrics_1d_ts_route_id_key UNIQUE(ts, route_id);

ALTER TABLE metrics_1m DROP COLUMN consumer_name;
ALTER TABLE metrics_1h DROP COLUMN consumer_name;
ALTER TABLE metrics_1d DROP COLUMN consumer_name;
