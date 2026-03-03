package model

import "time"

// AITokenRow represents a single row in ai_token_metrics_1m/1h/1d tables.
type AITokenRow struct {
	ID               int64     `json:"id"`
	Ts               time.Time `json:"ts"`
	RouteID          string    `json:"route_id"`
	RouteName        string    `json:"route_name"`
	ConsumerName     string    `json:"consumer_name"`
	Provider         string    `json:"provider"`
	Model            string    `json:"model"`
	Requests         int       `json:"requests"`
	PromptTokens     int       `json:"prompt_tokens"`
	CompletionTokens int       `json:"completion_tokens"`
	TotalTokens      int       `json:"total_tokens"`
	EstimatedCostUSD float64   `json:"estimated_cost_usd"`
}

// AITokenTimeSeries is a single data point for chart display.
type AITokenTimeSeries struct {
	Ts               time.Time `json:"ts"`
	Requests         int       `json:"requests"`
	PromptTokens     int64     `json:"prompt_tokens"`
	CompletionTokens int64     `json:"completion_tokens"`
	TotalTokens      int64     `json:"total_tokens"`
	EstimatedCostUSD float64   `json:"estimated_cost_usd"`
}

// AITokenSummary provides aggregate stats for a time range.
type AITokenSummary struct {
	TotalRequests    int64   `json:"total_requests"`
	TotalPrompt      int64   `json:"total_prompt_tokens"`
	TotalCompletion  int64   `json:"total_completion_tokens"`
	TotalTokens      int64   `json:"total_tokens"`
	TotalCostUSD     float64 `json:"total_cost_usd"`
	AvgTokensPerReq  float64 `json:"avg_tokens_per_request"`
	UniqueProviders  int     `json:"unique_providers"`
	UniqueModels     int     `json:"unique_models"`
}

// TopProvider represents a provider ranked by token usage.
type TopProvider struct {
	Provider         string  `json:"provider"`
	Requests         int64   `json:"requests"`
	TotalTokens      int64   `json:"total_tokens"`
	EstimatedCostUSD float64 `json:"estimated_cost_usd"`
}

// TopModel represents a model ranked by token usage.
type TopModel struct {
	Provider         string  `json:"provider"`
	Model            string  `json:"model"`
	Requests         int64   `json:"requests"`
	PromptTokens     int64   `json:"prompt_tokens"`
	CompletionTokens int64   `json:"completion_tokens"`
	TotalTokens      int64   `json:"total_tokens"`
	EstimatedCostUSD float64 `json:"estimated_cost_usd"`
}

// CostModelEntry represents pricing for a single model.
type CostModelEntry struct {
	PromptPer1K     float64 `json:"prompt_per_1k"`
	CompletionPer1K float64 `json:"completion_per_1k"`
}

// CostModels maps provider → model → pricing.
type CostModels map[string]map[string]CostModelEntry

// LookupCost returns the estimated cost for a given provider+model+tokens.
func (cm CostModels) LookupCost(provider, model string, promptTokens, completionTokens int) float64 {
	if models, ok := cm[provider]; ok {
		if entry, ok := models[model]; ok {
			return (float64(promptTokens)/1000)*entry.PromptPer1K +
				(float64(completionTokens)/1000)*entry.CompletionPer1K
		}
	}
	return 0
}
