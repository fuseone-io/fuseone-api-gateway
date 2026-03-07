package model

import (
	"time"

	"github.com/google/uuid"
)

// KafkaConnection represents a Kafka cluster connection configuration.
type KafkaConnection struct {
	ID               uuid.UUID  `json:"id"`
	Name             string     `json:"name"`
	Description      string     `json:"description"`
	Brokers          []string   `json:"brokers"`
	SecurityProtocol string     `json:"security_protocol"`
	SASLMechanism    *string    `json:"sasl_mechanism"`
	SASLUsername     *string    `json:"sasl_username"`
	SASLPassword     *string    `json:"sasl_password"`
	IsActive         bool       `json:"is_active"`
	CreatedBy        *uuid.UUID `json:"created_by"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// ValidSecurityProtocols defines supported Kafka security protocols.
var ValidSecurityProtocols = map[string]bool{
	"PLAINTEXT":      true,
	"SSL":            true,
	"SASL_PLAINTEXT": true,
	"SASL_SSL":       true,
}

// ValidSASLMechanisms defines supported SASL mechanisms.
var ValidSASLMechanisms = map[string]bool{
	"PLAIN":          true,
	"SCRAM-SHA-256":  true,
	"SCRAM-SHA-512":  true,
}
