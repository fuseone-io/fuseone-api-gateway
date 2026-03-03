package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type OAuthProvider struct {
	ID              uuid.UUID       `db:"id" json:"id"`
	Provider        string          `db:"provider" json:"provider"`
	DisplayName     string          `db:"display_name" json:"display_name"`
	ClientID        string          `db:"client_id" json:"client_id"`
	ClientSecret    string          `db:"client_secret" json:"-"`
	HasSecret       bool            `db:"-" json:"has_secret"`
	Scopes          []string        `db:"scopes" json:"scopes"`
	ExtraConfig     json.RawMessage `db:"extra_config" json:"extra_config"`
	AutoCreateUsers bool            `db:"auto_create_users" json:"auto_create_users"`
	DefaultRoleID   *uuid.UUID      `db:"default_role_id" json:"default_role_id,omitempty"`
	IsEnabled       bool            `db:"is_enabled" json:"is_enabled"`
	CreatedAt       time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time       `db:"updated_at" json:"updated_at"`
}

type UserOAuthLink struct {
	ID          uuid.UUID `db:"id" json:"id"`
	UserID      uuid.UUID `db:"user_id" json:"user_id"`
	Provider    string    `db:"provider" json:"provider"`
	ProviderUID string    `db:"provider_uid" json:"provider_uid"`
	Email       string    `db:"email" json:"email"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

type PublicOAuthProvider struct {
	Provider    string `json:"provider"`
	DisplayName string `json:"display_name"`
}
