package model

import (
	"time"

	"github.com/google/uuid"
)

// TestStep represents a single step within a test suite.
type TestStep struct {
	Name        string            `json:"name"`
	Method      string            `json:"method"`
	URL         string            `json:"url"`
	Headers     map[string]string `json:"headers,omitempty"`
	Body        string            `json:"body,omitempty"`
	Assertions  []Assertion       `json:"assertions"`
	ExtractVars map[string]string `json:"extract_vars,omitempty"` // jsonpath -> var name
	DelayMs     int               `json:"delay_ms,omitempty"`
}

// Assertion defines an expected condition to validate in a test step response.
type Assertion struct {
	Type     string `json:"type"`     // status_code, header, body_json, body_contains, response_time
	Target   string `json:"target"`   // e.g., "Content-Type" for header, "$.data.id" for body_json
	Operator string `json:"operator"` // eq, neq, gt, lt, gte, lte, contains, matches
	Expected string `json:"expected"`
}

// TestSuite groups a sequence of test steps for API testing.
type TestSuite struct {
	ID          uuid.UUID  `json:"id"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	ApiID       *string    `json:"api_id"`
	Steps       []TestStep `json:"steps"`
	Tags        []string   `json:"tags"`
	CreatedBy   *uuid.UUID `json:"created_by"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// ValidAssertionTypes defines supported assertion types.
var ValidAssertionTypes = map[string]bool{
	"status_code":   true,
	"header":        true,
	"body_json":     true,
	"body_contains": true,
	"response_time": true,
}

// ValidAssertionOperators defines supported assertion operators.
var ValidAssertionOperators = map[string]bool{
	"eq":       true,
	"neq":      true,
	"gt":       true,
	"lt":       true,
	"gte":      true,
	"lte":      true,
	"contains": true,
	"matches":  true,
}
