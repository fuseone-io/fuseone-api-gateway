package model

import (
	"time"

	"github.com/google/uuid"
)

type Environment struct {
	ID          uuid.UUID  `json:"id"`
	Name        string     `json:"name"`
	Slug        string     `json:"slug"`
	Description string     `json:"description"`
	Color       string     `json:"color"`
	SortOrder   int        `json:"sort_order"`
	IsDefault   bool       `json:"is_default"`
	AdminURL    string     `json:"admin_url"`
	APIKey      string     `json:"-"` // never sent to frontend
	ControlURL  string     `json:"control_url"`
	MetricsURL  string     `json:"metrics_url"`
	CreatedBy   *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
