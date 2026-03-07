package model

import (
	"time"

	"github.com/google/uuid"
)

// KafkaConnection represents a stream connection configuration (Kafka or NATS).
type KafkaConnection struct {
	ID               uuid.UUID  `json:"id"`
	Name             string     `json:"name"`
	Description      string     `json:"description"`
	ConnectionType   string     `json:"connection_type"` // "kafka" | "nats"
	IsActive         bool       `json:"is_active"`
	CreatedBy        *uuid.UUID `json:"created_by"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`

	// Kafka fields
	Brokers          []string `json:"brokers"`
	SecurityProtocol string   `json:"security_protocol"`
	SASLMechanism    *string  `json:"sasl_mechanism"`
	SASLUsername     *string  `json:"sasl_username"`
	SASLPassword     *string  `json:"sasl_password"`

	// NATS fields
	NATSURLs        []string `json:"nats_urls"`
	NATSToken       *string  `json:"nats_token"`
	NATSNKeySeed    *string  `json:"nats_nkey_seed"`
	NATSCredentials *string  `json:"nats_credentials"`
	NATSJetStream   bool     `json:"nats_jetstream"`
	NATSTLS         bool     `json:"nats_tls"`
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
	"PLAIN":         true,
	"SCRAM-SHA-256": true,
	"SCRAM-SHA-512": true,
}

// ValidConnectionTypes defines supported stream provider types.
var ValidConnectionTypes = map[string]bool{
	"kafka": true,
	"nats":  true,
}
