package model

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID  `db:"id" json:"id"`
	Username     string     `db:"username" json:"username"`
	Email        *string    `db:"email" json:"email,omitempty"`
	DisplayName  string     `db:"display_name" json:"display_name"`
	PasswordHash *string    `db:"password_hash" json:"-"`
	RoleID       uuid.UUID  `db:"role_id" json:"role_id"`
	RoleName     string     `db:"role_name" json:"role_name,omitempty"`
	IsActive     bool       `db:"is_active" json:"is_active"`
	AvatarURL    string     `db:"avatar_url" json:"avatar_url,omitempty"`
	TOTPSecret   string     `db:"totp_secret" json:"-"`
	TOTPEnabled  bool       `db:"totp_enabled" json:"totp_enabled"`
	LastLoginAt  *time.Time `db:"last_login_at" json:"last_login_at,omitempty"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time  `db:"updated_at" json:"updated_at"`
}

type Role struct {
	ID          uuid.UUID `db:"id" json:"id"`
	Name        string    `db:"name" json:"name"`
	Description string    `db:"description" json:"description"`
	Permissions []string  `db:"permissions" json:"permissions"`
	IsSystem    bool      `db:"is_system" json:"is_system"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

type RefreshToken struct {
	ID        uuid.UUID  `db:"id"`
	UserID    uuid.UUID  `db:"user_id"`
	TokenHash string     `db:"token_hash"`
	ExpiresAt time.Time  `db:"expires_at"`
	CreatedAt time.Time  `db:"created_at"`
	RevokedAt *time.Time `db:"revoked_at"`
}
