package model

import "github.com/google/uuid"

// StreamConnection is the unified connection model for all stream providers
// (Kafka, NATS, …). It replaces KafkaConnection as the primary connection record.
type StreamConnection struct {
	ID             uuid.UUID `json:"id"`
	ConnectionType string    `json:"connection_type"` // "kafka" | "nats"

	// Kafka fields
	Brokers          []string `json:"brokers,omitempty"`
	SecurityProtocol string   `json:"security_protocol,omitempty"`
	SASLMechanism    *string  `json:"sasl_mechanism,omitempty"`
	SASLUsername     *string  `json:"sasl_username,omitempty"`
	SASLPassword     *string  `json:"sasl_password,omitempty"`

	// NATS fields
	NATSURLs        []string `json:"nats_urls,omitempty"`
	NATSToken       *string  `json:"nats_token,omitempty"`
	NATSNKeySeed    *string  `json:"nats_nkey_seed,omitempty"`
	NATSCredentials *string  `json:"nats_credentials,omitempty"`
	NATSJetStream   bool     `json:"nats_jetstream,omitempty"`
	NATSTLS         bool     `json:"nats_tls,omitempty"`
}

// KafkaConnection is kept for backward-compat with the kafka package internals.
type KafkaConnection struct {
	ID               uuid.UUID `json:"id"`
	Brokers          []string  `json:"brokers"`
	SecurityProtocol string    `json:"security_protocol"`
	SASLMechanism    *string   `json:"sasl_mechanism,omitempty"`
	SASLUsername     *string   `json:"sasl_username,omitempty"`
	SASLPassword     *string   `json:"sasl_password,omitempty"`
}

// KafkaConnectionFrom converts a StreamConnection to the legacy KafkaConnection view.
func KafkaConnectionFrom(sc StreamConnection) KafkaConnection {
	return KafkaConnection{
		ID:               sc.ID,
		Brokers:          sc.Brokers,
		SecurityProtocol: sc.SecurityProtocol,
		SASLMechanism:    sc.SASLMechanism,
		SASLUsername:     sc.SASLUsername,
		SASLPassword:     sc.SASLPassword,
	}
}
