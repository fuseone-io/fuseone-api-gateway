DROP TABLE IF EXISTS ai_token_metrics_1d;
DROP TABLE IF EXISTS ai_token_metrics_1h;
DROP TABLE IF EXISTS ai_token_metrics_1m;

-- Remove ai_metrics:read from admin
UPDATE roles
SET permissions = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements(permissions) AS elem
    WHERE elem::text != '"ai_metrics:read"'
)
WHERE name IN ('admin', 'viewer');
