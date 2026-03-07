package model

import "github.com/google/uuid"

type KafkaConnection struct {
	ID               uuid.UUID `json:"id"`
	Brokers          []string  `json:"brokers"`
	SecurityProtocol string    `json:"security_protocol"`
	SASLMechanism    *string   `json:"sasl_mechanism,omitempty"`
	SASLUsername     *string   `json:"sasl_username,omitempty"`
	SASLPassword     *string   `json:"sasl_password,omitempty"`
}
