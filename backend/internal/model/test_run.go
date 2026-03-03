package model

import (
	"time"

	"github.com/google/uuid"
)

// StepResult records the outcome of executing a single test step.
type StepResult struct {
	StepName      string            `json:"step_name"`
	StepIndex     int               `json:"step_index"`
	Status        string            `json:"status"` // passed, failed, error, skipped
	StatusCode    int               `json:"status_code,omitempty"`
	ResponseTime  int               `json:"response_time_ms"`
	ResponseBody  string            `json:"response_body,omitempty"`
	Headers       map[string]string `json:"headers,omitempty"`
	Assertions    []AssertionResult `json:"assertions"`
	Error         string            `json:"error,omitempty"`
	ExtractedVars map[string]string `json:"extracted_vars,omitempty"`
}

// AssertionResult records the outcome of a single assertion evaluation.
type AssertionResult struct {
	Type     string `json:"type"`
	Target   string `json:"target"`
	Operator string `json:"operator"`
	Expected string `json:"expected"`
	Actual   string `json:"actual"`
	Passed   bool   `json:"passed"`
	Error    string `json:"error,omitempty"`
}

// TestRun represents a single execution of a test suite.
type TestRun struct {
	ID          uuid.UUID    `json:"id"`
	SuiteID     uuid.UUID    `json:"suite_id"`
	Status      string       `json:"status"`       // pending, running, passed, failed, error
	TriggerType string       `json:"trigger_type"` // manual, synthetic, ci
	Results     []StepResult `json:"results"`
	TotalSteps  int          `json:"total_steps"`
	PassedSteps int          `json:"passed_steps"`
	FailedSteps int          `json:"failed_steps"`
	DurationMs  int          `json:"duration_ms"`
	StartedAt   *time.Time   `json:"started_at"`
	FinishedAt  *time.Time   `json:"finished_at"`
	CreatedBy   *uuid.UUID   `json:"created_by"`
	CreatedAt   time.Time    `json:"created_at"`
}

// Test run status constants.
const (
	RunStatusPending = "pending"
	RunStatusRunning = "running"
	RunStatusPassed  = "passed"
	RunStatusFailed  = "failed"
	RunStatusError   = "error"
)

// Test run trigger type constants.
const (
	TriggerManual    = "manual"
	TriggerSynthetic = "synthetic"
	TriggerCI        = "ci"
)

// Step result status constants.
const (
	StepStatusPassed  = "passed"
	StepStatusFailed  = "failed"
	StepStatusError   = "error"
	StepStatusSkipped = "skipped"
)
