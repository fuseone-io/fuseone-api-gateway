package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// NotificationContact represents a reusable notification channel configuration.
type NotificationContact struct {
	ID        uuid.UUID       `json:"id"`
	Name      string          `json:"name"`
	Type      string          `json:"type"`    // "webhook", "slack", "teams", "email"
	Config    json.RawMessage `json:"config"`
	Enabled   bool            `json:"enabled"`
	CreatedBy *uuid.UUID      `json:"created_by"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

// ToAlertChannel converts a NotificationContact into an AlertChannel for use in alert rules.
func (nc *NotificationContact) ToAlertChannel() AlertChannel {
	return AlertChannel{
		Type:   nc.Type,
		Config: nc.Config,
	}
}
