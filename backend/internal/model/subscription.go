package model

import (
	"time"

	"github.com/google/uuid"
)

// Subscription status constants
const (
	SubscriptionPending   = "pending"
	SubscriptionActive    = "active"
	SubscriptionSuspended = "suspended"
	SubscriptionRevoked   = "revoked"
)

type Subscription struct {
	ID               uuid.UUID  `db:"id" json:"id"`
	ConsumerUsername  string     `db:"consumer_username" json:"consumer_username"`
	ApiDefinitionID  uuid.UUID  `db:"api_definition_id" json:"api_definition_id"`
	PlanID           string     `db:"plan_id" json:"plan_id"`
	Status           string     `db:"status" json:"status"`
	RequestedBy      *uuid.UUID `db:"requested_by" json:"requested_by,omitempty"`
	ApprovedBy       *uuid.UUID `db:"approved_by" json:"approved_by,omitempty"`
	RequestedAt      time.Time  `db:"requested_at" json:"requested_at"`
	ApprovedAt       *time.Time `db:"approved_at" json:"approved_at,omitempty"`
	RevokedAt        *time.Time `db:"revoked_at" json:"revoked_at,omitempty"`
	Notes            string     `db:"notes" json:"notes"`
	CreatedAt        time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time  `db:"updated_at" json:"updated_at"`
}

type CreateSubscriptionRequest struct {
	ConsumerUsername string    `json:"consumer_username" binding:"required"`
	ApiDefinitionID  uuid.UUID `json:"api_definition_id" binding:"required"`
	PlanID           string    `json:"plan_id"`
	Notes            string    `json:"notes"`
}

type ReviewSubscriptionRequest struct {
	Action string `json:"action" binding:"required"` // "approve" or "reject"
	Notes  string `json:"notes"`
}
