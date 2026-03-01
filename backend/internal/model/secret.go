package model

import (
	"time"

	"github.com/google/uuid"
)

type Secret struct {
	ID          uuid.UUID  `db:"id" json:"id"`
	Name        string     `db:"name" json:"name"`
	Description string     `db:"description" json:"description"`
	Tags        []string   `db:"tags" json:"tags"`
	CreatedBy   *uuid.UUID `db:"created_by" json:"created_by,omitempty"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time  `db:"updated_at" json:"updated_at"`
	// encrypted_value is never exposed in JSON — handled internally
}

type CreateSecretRequest struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	Value       string   `json:"value" binding:"required"`
	Tags        []string `json:"tags"`
}

type UpdateSecretRequest struct {
	Description *string  `json:"description"`
	Value       *string  `json:"value"`
	Tags        *[]string `json:"tags"`
}

type SecretManager struct {
	ID        uuid.UUID              `db:"id" json:"id"`
	Name      string                 `db:"name" json:"name"`
	Type      string                 `db:"type" json:"type"` // vault, aws, gcp, env
	Config    map[string]interface{} `db:"config" json:"config"`
	IsActive  bool                   `db:"is_active" json:"is_active"`
	CreatedBy *uuid.UUID             `db:"created_by" json:"created_by,omitempty"`
	CreatedAt time.Time              `db:"created_at" json:"created_at"`
	UpdatedAt time.Time              `db:"updated_at" json:"updated_at"`
}

type CreateSecretManagerRequest struct {
	Name   string                 `json:"name" binding:"required"`
	Type   string                 `json:"type" binding:"required"`
	Config map[string]interface{} `json:"config" binding:"required"`
}

type UpdateSecretManagerRequest struct {
	Name     *string                 `json:"name"`
	Config   *map[string]interface{} `json:"config"`
	IsActive *bool                   `json:"is_active"`
}
