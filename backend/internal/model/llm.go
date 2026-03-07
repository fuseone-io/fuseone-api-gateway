package model

import (
	"time"

	"github.com/google/uuid"
)

// LLMProvider identifies a supported LLM provider.
type LLMProvider string

const (
	ProviderOpenAI    LLMProvider = "openai"
	ProviderAnthropic LLMProvider = "anthropic"
	ProviderGoogle    LLMProvider = "google"
	ProviderGroq      LLMProvider = "groq"
)

// ValidModels maps each provider to its supported model IDs.
var ValidModels = map[LLMProvider][]string{
	ProviderOpenAI:    {"gpt-4o", "gpt-4o-mini", "gpt-4.1"},
	ProviderAnthropic: {"claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001"},
	ProviderGoogle:    {"gemini-2.5-pro", "gemini-2.5-flash"},
	ProviderGroq:      {"llama-3.3-70b-versatile", "mixtral-8x7b-32768"},
}

// IsValidProvider returns true if the provider is supported.
func IsValidProvider(p string) bool {
	_, ok := ValidModels[LLMProvider(p)]
	return ok
}

// IsValidModel returns true if the model is valid for the given provider.
func IsValidModel(p LLMProvider, m string) bool {
	for _, v := range ValidModels[p] {
		if v == m {
			return true
		}
	}
	return false
}

// LLMConfig stores a provider's configuration. The api_key is never exposed in JSON.
type LLMConfig struct {
	ID         uuid.UUID   `json:"id"`
	Provider   LLMProvider `json:"provider"`
	Model      string      `json:"model"`
	Enabled    bool        `json:"enabled"`
	DailyQuota int         `json:"daily_quota"`
	CreatedBy  *uuid.UUID  `json:"created_by,omitempty"`
	CreatedAt  time.Time   `json:"created_at"`
	UpdatedAt  time.Time   `json:"updated_at"`
}

// LLMUsageLog records a single LLM call for quota tracking and analytics.
type LLMUsageLog struct {
	ID           uuid.UUID  `json:"id"`
	Provider     string     `json:"provider"`
	Model        string     `json:"model"`
	Endpoint     string     `json:"endpoint"`
	TokensIn     int        `json:"tokens_in"`
	TokensOut    int        `json:"tokens_out"`
	DurationMs   int        `json:"duration_ms"`
	Success      bool       `json:"success"`
	ErrorMessage string     `json:"error_message,omitempty"`
	UserID       *uuid.UUID `json:"user_id,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

// LLMUsageSummary aggregates today's and this month's usage for a provider.
type LLMUsageSummary struct {
	Provider     string  `json:"provider"`
	TodayUsage   int     `json:"today_usage"`
	MonthUsage   int     `json:"month_usage"`
	DailyQuota   int     `json:"daily_quota"`
	QuotaPercent float64 `json:"quota_percent"`
}
