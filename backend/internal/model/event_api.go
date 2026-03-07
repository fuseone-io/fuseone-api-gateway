package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// EventApi represents a managed Event API that exposes a Kafka topic
// through REST, SSE, WebSocket, and Webhook protocols.
type EventApi struct {
	ID                  uuid.UUID       `json:"id"`
	Name                string          `json:"name"`
	Description         string          `json:"description"`
	Slug                string          `json:"slug"`
	KafkaConnectionID   uuid.UUID       `json:"kafka_connection_id"`
	TopicName           string          `json:"topic_name"`
	RestProduce         bool            `json:"rest_produce"`
	RestConsume         bool            `json:"rest_consume"`
	SSEEnabled          bool            `json:"sse_enabled"`
	WebsocketEnabled    bool            `json:"websocket_enabled"`
	WebhookEnabled      bool            `json:"webhook_enabled"`
	ContextPath         string          `json:"context_path"`
	APISIXRouteIDs      json.RawMessage `json:"apisix_route_ids"`
	APISIXPlugins       json.RawMessage `json:"apisix_plugins"`
	ConsumerGroupPrefix string          `json:"consumer_group_prefix"`
	AutoOffsetReset     string          `json:"auto_offset_reset"`
	SchemaValidation    bool            `json:"schema_validation"`
	Status              string          `json:"status"`
	DeployedAt          *time.Time      `json:"deployed_at"`
	DeployedBy          *uuid.UUID      `json:"deployed_by"`
	CreatedBy           *uuid.UUID      `json:"created_by"`
	CreatedAt           time.Time       `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`
}

// EventApiWithConnection enriches an EventApi with the associated KafkaConnection details.
type EventApiWithConnection struct {
	EventApi
	Connection KafkaConnection `json:"connection"`
}

// ValidEventApiStatuses defines the lifecycle statuses for Event APIs.
var ValidEventApiStatuses = map[string]bool{
	"draft":  true,
	"active": true,
}

// ValidAutoOffsetResets defines allowed offset reset strategies.
var ValidAutoOffsetResets = map[string]bool{
	"latest":   true,
	"earliest": true,
}
