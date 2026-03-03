package model

import (
	"time"

	"github.com/google/uuid"
)

// SLADefinition defines a Service Level Agreement target for an API or globally.
type SLADefinition struct {
	ID               uuid.UUID  `json:"id"`
	Name             string     `json:"name"`
	Description      string     `json:"description"`
	ApiID            *string    `json:"api_id"`
	AvailabilityPct  float64    `json:"availability_pct"`
	LatencyP99Ms     int        `json:"latency_p99_ms"`
	ErrorRatePct     float64    `json:"error_rate_pct"`
	EvalWindow       string     `json:"eval_window"` // 7d, 30d, 90d
	CurrentAvail     float64    `json:"current_avail"`
	CurrentLatency   int        `json:"current_latency"`
	CurrentError     float64    `json:"current_error"`
	BudgetRemaining  float64    `json:"budget_remaining"`
	ComplianceStatus string     `json:"compliance_status"` // compliant, at_risk, breached
	LastEvalAt       *time.Time `json:"last_eval_at"`
	CreatedBy        *uuid.UUID `json:"created_by"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// ValidSLAEvalWindows defines supported SLA evaluation windows.
var ValidSLAEvalWindows = map[string]bool{
	"7d": true, "30d": true, "90d": true,
}

// ValidComplianceStatuses defines supported compliance status values.
var ValidComplianceStatuses = map[string]bool{
	"compliant": true, "at_risk": true, "breached": true,
}
