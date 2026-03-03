package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/fuseone/api-gateway/internal/model"
)

// AIMetricsRepository handles CRUD for ai_token_metrics tables.
type AIMetricsRepository struct {
	pool *pgxpool.Pool
}

func NewAIMetricsRepository(pool *pgxpool.Pool) *AIMetricsRepository {
	return &AIMetricsRepository{pool: pool}
}

func (r *AIMetricsRepository) BatchUpsertMinute(ctx context.Context, rows []model.AITokenRow) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	for _, row := range rows {
		_, err := tx.Exec(ctx, `
			INSERT INTO ai_token_metrics_1m (
				ts, route_id, route_name, consumer_name,
				provider, model, requests,
				prompt_tokens, completion_tokens, total_tokens,
				estimated_cost_usd
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			ON CONFLICT (ts, route_id, consumer_name, provider, model) DO UPDATE SET
				route_name = EXCLUDED.route_name,
				requests = ai_token_metrics_1m.requests + EXCLUDED.requests,
				prompt_tokens = ai_token_metrics_1m.prompt_tokens + EXCLUDED.prompt_tokens,
				completion_tokens = ai_token_metrics_1m.completion_tokens + EXCLUDED.completion_tokens,
				total_tokens = ai_token_metrics_1m.total_tokens + EXCLUDED.total_tokens,
				estimated_cost_usd = ai_token_metrics_1m.estimated_cost_usd + EXCLUDED.estimated_cost_usd
		`,
			row.Ts, row.RouteID, row.RouteName, row.ConsumerName,
			row.Provider, row.Model, row.Requests,
			row.PromptTokens, row.CompletionTokens, row.TotalTokens,
			row.EstimatedCostUSD,
		)
		if err != nil {
			return fmt.Errorf("upsert row: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// aiRangeToTable returns the table and interval for preset ranges.
func aiRangeToTable(rangeStr string) (table string, interval string) {
	switch rangeStr {
	case "1h":
		return "ai_token_metrics_1m", "1 hour"
	case "6h":
		return "ai_token_metrics_1m", "6 hours"
	case "24h":
		return "ai_token_metrics_1m", "24 hours"
	case "7d":
		return "ai_token_metrics_1h", "7 days"
	case "30d":
		return "ai_token_metrics_1d", "30 days"
	default:
		return "ai_token_metrics_1m", "1 hour"
	}
}

func aiTableForSpan(span time.Duration) string {
	hours := span.Hours()
	switch {
	case hours <= 24:
		return "ai_token_metrics_1m"
	case hours <= 7*24:
		return "ai_token_metrics_1h"
	default:
		return "ai_token_metrics_1d"
	}
}

func aiResolveFilter(f MetricsFilter) (table string, whereClause string, args []interface{}) {
	if f.IsCustom() {
		table = aiTableForSpan(f.To.Sub(f.From))
		whereClause = "ts >= $1 AND ts <= $2"
		args = []interface{}{f.From, f.To}
		nextArg := 3
		if len(f.RouteIDs) == 1 {
			whereClause += fmt.Sprintf(" AND route_id = $%d", nextArg)
			args = append(args, f.RouteIDs[0])
			nextArg++
		} else if len(f.RouteIDs) > 1 {
			whereClause += fmt.Sprintf(" AND route_id = ANY($%d)", nextArg)
			args = append(args, f.RouteIDs)
			nextArg++
		}
		if len(f.ConsumerNames) == 1 {
			whereClause += fmt.Sprintf(" AND consumer_name = $%d", nextArg)
			args = append(args, f.ConsumerNames[0])
		} else if len(f.ConsumerNames) > 1 {
			whereClause += fmt.Sprintf(" AND consumer_name = ANY($%d)", nextArg)
			args = append(args, f.ConsumerNames)
		}
	} else {
		var interval string
		table, interval = aiRangeToTable(f.RangeStr)
		whereClause = "ts >= NOW() - $1::interval"
		args = []interface{}{interval}
		nextArg := 2
		if len(f.RouteIDs) == 1 {
			whereClause += fmt.Sprintf(" AND route_id = $%d", nextArg)
			args = append(args, f.RouteIDs[0])
			nextArg++
		} else if len(f.RouteIDs) > 1 {
			whereClause += fmt.Sprintf(" AND route_id = ANY($%d)", nextArg)
			args = append(args, f.RouteIDs)
			nextArg++
		}
		if len(f.ConsumerNames) == 1 {
			whereClause += fmt.Sprintf(" AND consumer_name = $%d", nextArg)
			args = append(args, f.ConsumerNames[0])
		} else if len(f.ConsumerNames) > 1 {
			whereClause += fmt.Sprintf(" AND consumer_name = ANY($%d)", nextArg)
			args = append(args, f.ConsumerNames)
		}
	}
	return
}

func (r *AIMetricsRepository) TimeSeries(ctx context.Context, filter MetricsFilter) ([]model.AITokenTimeSeries, error) {
	table, where, args := aiResolveFilter(filter)

	query := fmt.Sprintf(`
		SELECT ts,
			SUM(requests) as requests,
			SUM(prompt_tokens) as prompt_tokens,
			SUM(completion_tokens) as completion_tokens,
			SUM(total_tokens) as total_tokens,
			SUM(estimated_cost_usd) as estimated_cost_usd
		FROM %s
		WHERE %s
		GROUP BY ts
		ORDER BY ts
	`, table, where)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query timeseries: %w", err)
	}
	defer rows.Close()

	var result []model.AITokenTimeSeries
	for rows.Next() {
		var p model.AITokenTimeSeries
		if err := rows.Scan(&p.Ts, &p.Requests, &p.PromptTokens, &p.CompletionTokens, &p.TotalTokens, &p.EstimatedCostUSD); err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		result = append(result, p)
	}
	return result, nil
}

func (r *AIMetricsRepository) Summary(ctx context.Context, filter MetricsFilter) (*model.AITokenSummary, error) {
	table, where, args := aiResolveFilter(filter)

	query := fmt.Sprintf(`
		SELECT
			COALESCE(SUM(requests), 0),
			COALESCE(SUM(prompt_tokens), 0),
			COALESCE(SUM(completion_tokens), 0),
			COALESCE(SUM(total_tokens), 0),
			COALESCE(SUM(estimated_cost_usd), 0),
			CASE WHEN SUM(requests) > 0 THEN SUM(total_tokens)::float / SUM(requests) ELSE 0 END,
			COUNT(DISTINCT provider),
			COUNT(DISTINCT model)
		FROM %s
		WHERE %s
	`, table, where)

	var s model.AITokenSummary
	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&s.TotalRequests, &s.TotalPrompt, &s.TotalCompletion,
		&s.TotalTokens, &s.TotalCostUSD, &s.AvgTokensPerReq,
		&s.UniqueProviders, &s.UniqueModels,
	)
	if err != nil {
		return nil, fmt.Errorf("query summary: %w", err)
	}
	return &s, nil
}

func (r *AIMetricsRepository) TopProviders(ctx context.Context, filter MetricsFilter, limit int) ([]model.TopProvider, error) {
	table, where, args := aiResolveFilter(filter)
	nextArg := len(args) + 1

	query := fmt.Sprintf(`
		SELECT provider,
			SUM(requests) as requests,
			SUM(total_tokens) as total_tokens,
			SUM(estimated_cost_usd) as estimated_cost_usd
		FROM %s
		WHERE %s AND provider != ''
		GROUP BY provider
		ORDER BY total_tokens DESC
		LIMIT $%d
	`, table, where, nextArg)

	rows, err := r.pool.Query(ctx, query, append(args, limit)...)
	if err != nil {
		return nil, fmt.Errorf("query top providers: %w", err)
	}
	defer rows.Close()

	var result []model.TopProvider
	for rows.Next() {
		var p model.TopProvider
		if err := rows.Scan(&p.Provider, &p.Requests, &p.TotalTokens, &p.EstimatedCostUSD); err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		result = append(result, p)
	}
	return result, nil
}

func (r *AIMetricsRepository) TopModels(ctx context.Context, filter MetricsFilter, limit int) ([]model.TopModel, error) {
	table, where, args := aiResolveFilter(filter)
	nextArg := len(args) + 1

	query := fmt.Sprintf(`
		SELECT provider, model,
			SUM(requests) as requests,
			SUM(prompt_tokens) as prompt_tokens,
			SUM(completion_tokens) as completion_tokens,
			SUM(total_tokens) as total_tokens,
			SUM(estimated_cost_usd) as estimated_cost_usd
		FROM %s
		WHERE %s AND model != ''
		GROUP BY provider, model
		ORDER BY total_tokens DESC
		LIMIT $%d
	`, table, where, nextArg)

	rows, err := r.pool.Query(ctx, query, append(args, limit)...)
	if err != nil {
		return nil, fmt.Errorf("query top models: %w", err)
	}
	defer rows.Close()

	var result []model.TopModel
	for rows.Next() {
		var m model.TopModel
		if err := rows.Scan(&m.Provider, &m.Model, &m.Requests, &m.PromptTokens, &m.CompletionTokens, &m.TotalTokens, &m.EstimatedCostUSD); err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		result = append(result, m)
	}
	return result, nil
}

func (r *AIMetricsRepository) RollupToHour(ctx context.Context) (int64, error) {
	tag, err := r.pool.Exec(ctx, `
		INSERT INTO ai_token_metrics_1h (ts, route_id, route_name, consumer_name, provider, model, requests, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd)
		SELECT
			date_trunc('hour', ts) as ts,
			route_id, MAX(route_name), consumer_name, provider, model,
			SUM(requests), SUM(prompt_tokens), SUM(completion_tokens), SUM(total_tokens), SUM(estimated_cost_usd)
		FROM ai_token_metrics_1m
		WHERE ts < date_trunc('hour', NOW())
			AND ts >= date_trunc('hour', NOW()) - INTERVAL '2 hours'
		GROUP BY date_trunc('hour', ts), route_id, consumer_name, provider, model
		ON CONFLICT (ts, route_id, consumer_name, provider, model) DO UPDATE SET
			route_name = EXCLUDED.route_name,
			requests = EXCLUDED.requests,
			prompt_tokens = EXCLUDED.prompt_tokens,
			completion_tokens = EXCLUDED.completion_tokens,
			total_tokens = EXCLUDED.total_tokens,
			estimated_cost_usd = EXCLUDED.estimated_cost_usd
	`)
	if err != nil {
		return 0, fmt.Errorf("rollup to hour: %w", err)
	}
	return tag.RowsAffected(), nil
}

func (r *AIMetricsRepository) RollupToDay(ctx context.Context) (int64, error) {
	tag, err := r.pool.Exec(ctx, `
		INSERT INTO ai_token_metrics_1d (ts, route_id, route_name, consumer_name, provider, model, requests, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd)
		SELECT
			date_trunc('day', ts) as ts,
			route_id, MAX(route_name), consumer_name, provider, model,
			SUM(requests), SUM(prompt_tokens), SUM(completion_tokens), SUM(total_tokens), SUM(estimated_cost_usd)
		FROM ai_token_metrics_1h
		WHERE ts < date_trunc('day', NOW())
			AND ts >= date_trunc('day', NOW()) - INTERVAL '2 days'
		GROUP BY date_trunc('day', ts), route_id, consumer_name, provider, model
		ON CONFLICT (ts, route_id, consumer_name, provider, model) DO UPDATE SET
			route_name = EXCLUDED.route_name,
			requests = EXCLUDED.requests,
			prompt_tokens = EXCLUDED.prompt_tokens,
			completion_tokens = EXCLUDED.completion_tokens,
			total_tokens = EXCLUDED.total_tokens,
			estimated_cost_usd = EXCLUDED.estimated_cost_usd
	`)
	if err != nil {
		return 0, fmt.Errorf("rollup to day: %w", err)
	}
	return tag.RowsAffected(), nil
}

func (r *AIMetricsRepository) CleanupExpired(ctx context.Context, ttl1mDays, ttl1hDays int) (int64, error) {
	var total int64
	tag, err := r.pool.Exec(ctx, fmt.Sprintf("DELETE FROM ai_token_metrics_1m WHERE ts < NOW() - INTERVAL '%d days'", ttl1mDays))
	if err != nil {
		return 0, fmt.Errorf("cleanup 1m: %w", err)
	}
	total += tag.RowsAffected()

	tag, err = r.pool.Exec(ctx, fmt.Sprintf("DELETE FROM ai_token_metrics_1h WHERE ts < NOW() - INTERVAL '%d days'", ttl1hDays))
	if err != nil {
		return 0, fmt.Errorf("cleanup 1h: %w", err)
	}
	total += tag.RowsAffected()

	return total, nil
}
