package model

import (
	"time"

	"github.com/google/uuid"
)

// SyntheticMonitor defines a scheduled monitor that periodically executes a test suite.
type SyntheticMonitor struct {
	ID               uuid.UUID   `json:"id"`
	Name             string      `json:"name"`
	Description      string      `json:"description"`
	Enabled          bool        `json:"enabled"`
	SuiteID          uuid.UUID   `json:"suite_id"`
	IntervalSec      int         `json:"interval_sec"`
	Locations        []string    `json:"locations"`
	NotifyContactIDs []uuid.UUID `json:"notify_contact_ids"`
	UptimePct        float64     `json:"uptime_pct"`
	LastStatus       string      `json:"last_status"` // unknown, up, down, degraded
	LastRunAt        *time.Time  `json:"last_run_at"`
	LastRunID        *uuid.UUID  `json:"last_run_id"`
	ConsecutiveFail  int         `json:"consecutive_fail"`
	CreatedBy        *uuid.UUID  `json:"created_by"`
	CreatedAt        time.Time   `json:"created_at"`
	UpdatedAt        time.Time   `json:"updated_at"`
}

// Synthetic monitor status constants.
const (
	MonitorStatusUnknown  = "unknown"
	MonitorStatusUp       = "up"
	MonitorStatusDown     = "down"
	MonitorStatusDegraded = "degraded"
)
