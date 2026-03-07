package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// EventSchema represents a versioned JSON Schema for an Event API.
type EventSchema struct {
	ID           uuid.UUID       `json:"id"`
	EventApiID   uuid.UUID       `json:"event_api_id"`
	Version      int             `json:"version"`
	SchemaType   string          `json:"schema_type"`
	SchemaContent json.RawMessage `json:"schema_content"`
	Description  string          `json:"description"`
	IsActive     bool            `json:"is_active"`
	CreatedAt    time.Time       `json:"created_at"`
}
