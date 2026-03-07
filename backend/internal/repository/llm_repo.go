package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

// LLMRepository handles persistence for LLM configs and usage logs.
type LLMRepository struct {
	pool *pgxpool.Pool
}

// NewLLMRepository creates a new LLMRepository.
func NewLLMRepository(pool *pgxpool.Pool) *LLMRepository {
	return &LLMRepository{pool: pool}
}

// Upsert creates or updates an LLM provider config.
func (r *LLMRepository) Upsert(ctx context.Context, cfg *model.LLMConfig, encryptedKey []byte) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO llm_configs (provider, model, api_key_encrypted, enabled, daily_quota, created_by, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (provider) DO UPDATE SET
			model             = EXCLUDED.model,
			api_key_encrypted = CASE WHEN length(EXCLUDED.api_key_encrypted) > 0 THEN EXCLUDED.api_key_encrypted ELSE llm_configs.api_key_encrypted END,
			enabled           = EXCLUDED.enabled,
			daily_quota       = EXCLUDED.daily_quota,
			updated_at        = NOW()
		RETURNING id, created_at, updated_at`,
		cfg.Provider, cfg.Model, encryptedKey, cfg.Enabled, cfg.DailyQuota, cfg.CreatedBy,
	)
	return err
}

// Get returns a config and its encrypted key for a given provider.
func (r *LLMRepository) Get(ctx context.Context, provider model.LLMProvider) (*model.LLMConfig, []byte, error) {
	cfg := &model.LLMConfig{}
	var encKey []byte
	err := r.pool.QueryRow(ctx, `
		SELECT id, provider, model, api_key_encrypted, enabled, daily_quota, created_by, created_at, updated_at
		FROM llm_configs WHERE provider = $1`, provider,
	).Scan(&cfg.ID, &cfg.Provider, &cfg.Model, &encKey,
		&cfg.Enabled, &cfg.DailyQuota, &cfg.CreatedBy, &cfg.CreatedAt, &cfg.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil, nil
		}
		return nil, nil, err
	}
	return cfg, encKey, nil
}

// GetActive returns the enabled provider config with its decrypted key.
func (r *LLMRepository) GetActive(ctx context.Context) (*model.LLMConfig, []byte, error) {
	cfg := &model.LLMConfig{}
	var encKey []byte
	err := r.pool.QueryRow(ctx, `
		SELECT id, provider, model, api_key_encrypted, enabled, daily_quota, created_by, created_at, updated_at
		FROM llm_configs WHERE enabled = true LIMIT 1`,
	).Scan(&cfg.ID, &cfg.Provider, &cfg.Model, &encKey,
		&cfg.Enabled, &cfg.DailyQuota, &cfg.CreatedBy, &cfg.CreatedAt, &cfg.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil, nil
		}
		return nil, nil, err
	}
	return cfg, encKey, nil
}

// List returns all provider configs without API keys.
func (r *LLMRepository) List(ctx context.Context) ([]model.LLMConfig, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, provider, model, enabled, daily_quota, created_by, created_at, updated_at
		FROM llm_configs ORDER BY provider`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cfgs []model.LLMConfig
	for rows.Next() {
		var c model.LLMConfig
		if err := rows.Scan(&c.ID, &c.Provider, &c.Model, &c.Enabled,
			&c.DailyQuota, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		cfgs = append(cfgs, c)
	}
	return cfgs, nil
}

// DisableAll sets enabled = false for all providers.
func (r *LLMRepository) DisableAll(ctx context.Context) error {
	_, err := r.pool.Exec(ctx, `UPDATE llm_configs SET enabled = false, updated_at = NOW()`)
	return err
}

// Delete removes a provider config.
func (r *LLMRepository) Delete(ctx context.Context, provider model.LLMProvider) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM llm_configs WHERE provider = $1`, provider)
	return err
}

// InsertLog records a single LLM usage event.
func (r *LLMRepository) InsertLog(ctx context.Context, log *model.LLMUsageLog) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO llm_usage_logs (provider, model, endpoint, tokens_in, tokens_out, duration_ms, success, error_message, user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		log.Provider, log.Model, log.Endpoint,
		log.TokensIn, log.TokensOut, log.DurationMs,
		log.Success, log.ErrorMessage, log.UserID,
	)
	return err
}

// CountTodayUsage returns the number of successful calls made today for a provider.
func (r *LLMRepository) CountTodayUsage(ctx context.Context, provider model.LLMProvider) (int, error) {
	var count int
	today := time.Now().UTC().Truncate(24 * time.Hour)
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM llm_usage_logs
		WHERE provider = $1 AND created_at >= $2 AND success = true`,
		provider, today,
	).Scan(&count)
	return count, err
}

// GetUsageSummary returns today and this month's usage per provider.
func (r *LLMRepository) GetUsageSummary(ctx context.Context) ([]model.LLMUsageSummary, error) {
	today := time.Now().UTC().Truncate(24 * time.Hour)
	monthStart := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC)

	rows, err := r.pool.Query(ctx, `
		SELECT
			c.provider,
			c.daily_quota,
			COUNT(CASE WHEN l.created_at >= $1 AND l.success THEN 1 END)  AS today_usage,
			COUNT(CASE WHEN l.created_at >= $2 AND l.success THEN 1 END)  AS month_usage
		FROM llm_configs c
		LEFT JOIN llm_usage_logs l ON l.provider = c.provider
		GROUP BY c.provider, c.daily_quota
		ORDER BY c.provider`,
		today, monthStart,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []model.LLMUsageSummary
	for rows.Next() {
		var s model.LLMUsageSummary
		if err := rows.Scan(&s.Provider, &s.DailyQuota, &s.TodayUsage, &s.MonthUsage); err != nil {
			return nil, err
		}
		if s.DailyQuota > 0 {
			s.QuotaPercent = float64(s.TodayUsage) / float64(s.DailyQuota) * 100
		}
		summaries = append(summaries, s)
	}
	return summaries, nil
}
