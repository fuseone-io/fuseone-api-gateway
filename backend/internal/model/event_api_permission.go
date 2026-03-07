package model

import (
	"time"

	"github.com/google/uuid"
)

type EventApiPermission struct {
	ID            uuid.UUID `json:"id"`
	EventApiID    uuid.UUID `json:"event_api_id"`
	ConsumerName  string    `json:"consumer_name"`
	CanProduce    bool      `json:"can_produce"`
	CanConsume    bool      `json:"can_consume"`
	CanStream     bool      `json:"can_stream"`
	RateLimit     int       `json:"rate_limit"`
	RateWindowSec int       `json:"rate_window_sec"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
