package model

import (
	"time"

	"github.com/google/uuid"
)

type EventApi struct {
	ID                  uuid.UUID  `json:"id"`
	Name                string     `json:"name"`
	Description         string     `json:"description"`
	Slug                string     `json:"slug"`
	KafkaConnectionID   uuid.UUID  `json:"kafka_connection_id"`
	TopicName           string     `json:"topic_name"`
	RestProduce         bool       `json:"rest_produce"`
	RestConsume         bool       `json:"rest_consume"`
	SSEEnabled          bool       `json:"sse_enabled"`
	WebsocketEnabled    bool       `json:"websocket_enabled"`
	WebhookEnabled      bool       `json:"webhook_enabled"`
	ConsumerGroupPrefix string     `json:"consumer_group_prefix"`
	AutoOffsetReset     string     `json:"auto_offset_reset"`
	SchemaValidation    bool       `json:"schema_validation"`
	Status              string     `json:"status"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}
