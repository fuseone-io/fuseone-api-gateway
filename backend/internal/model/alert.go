package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// AlertRule represents an alert rule that the evaluator checks periodically.
type AlertRule struct {
	ID          uuid.UUID       `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Enabled     bool            `json:"enabled"`
	RuleType    string          `json:"rule_type"`    // "error_rate", "latency_p99", "traffic_drop"
	ScopeType   string          `json:"scope_type"`   // "global", "route", "consumer"
	ScopeIDs    []string        `json:"scope_ids"`
	Threshold   float64         `json:"threshold"`
	EvalWindow  string          `json:"eval_window"`  // "1m","5m","15m","30m","1h"
	Channels    []AlertChannel  `json:"channels"`
	State       string          `json:"state"`        // "ok", "firing", "acknowledged"
	LastEval    *time.Time      `json:"last_eval"`
	FiredAt     *time.Time      `json:"fired_at"`
	CreatedBy   *uuid.UUID      `json:"created_by"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

// AlertChannel represents a notification channel attached to a rule.
type AlertChannel struct {
	Type   string          `json:"type"`   // "webhook", "slack", "teams", "email"
	Config json.RawMessage `json:"config"` // channel-specific config
}

// WebhookConfig holds the configuration for a generic webhook alert channel.
type WebhookConfig struct {
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers,omitempty"`
}

// SlackConfig holds the configuration for a Slack Incoming Webhook channel.
type SlackConfig struct {
	WebhookURL string `json:"webhook_url"`
	Channel    string `json:"channel,omitempty"`  // optional override
	Username   string `json:"username,omitempty"` // optional bot name
}

// TeamsConfig holds the configuration for a Microsoft Teams Incoming Webhook channel.
type TeamsConfig struct {
	WebhookURL string `json:"webhook_url"`
}

// EmailConfig holds the configuration for an email alert channel.
type EmailConfig struct {
	To []string `json:"to"`
}

// ValidChannelTypes defines supported notification channel types.
var ValidChannelTypes = map[string]bool{
	"webhook": true, "slack": true, "teams": true, "email": true,
}

// AlertEvent records a state transition for an alert rule.
type AlertEvent struct {
	ID        int64      `json:"id"`
	RuleID    uuid.UUID  `json:"rule_id"`
	EventType string     `json:"event_type"` // "fired", "resolved", "acknowledged"
	Message   string     `json:"message"`
	Value     *float64   `json:"value"`
	Threshold *float64   `json:"threshold"`
	AckedBy   *uuid.UUID `json:"acked_by"`
	CreatedAt time.Time  `json:"created_at"`
}

// Valid rule types.
const (
	RuleTypeErrorRate   = "error_rate"
	RuleTypeLatencyP99  = "latency_p99"
	RuleTypeTrafficDrop = "traffic_drop"
	RuleTypeTokenBudget = "token_budget"
	RuleTypeCostBudget  = "cost_budget"
)

// Valid alert states.
const (
	AlertStateOK           = "ok"
	AlertStateFiring       = "firing"
	AlertStateAcknowledged = "acknowledged"
)

// Valid eval windows.
var ValidEvalWindows = map[string]bool{
	"1m": true, "5m": true, "15m": true, "30m": true, "1h": true,
}

// Valid rule types set.
var ValidRuleTypes = map[string]bool{
	RuleTypeErrorRate: true, RuleTypeLatencyP99: true, RuleTypeTrafficDrop: true,
	RuleTypeTokenBudget: true, RuleTypeCostBudget: true,
}

// Valid scope types.
var ValidScopeTypes = map[string]bool{
	"global": true, "route": true, "consumer": true,
}
