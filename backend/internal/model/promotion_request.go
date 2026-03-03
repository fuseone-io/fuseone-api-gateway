package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Promotion status constants
const (
	PromotionPending  = "pending"
	PromotionApproved = "approved"
	PromotionRejected = "rejected"
	PromotionDeployed = "deployed"
	PromotionFailed   = "failed"
)

type PromotionRequest struct {
	ID                 uuid.UUID       `db:"id" json:"id"`
	ApiDefinitionID    uuid.UUID       `db:"api_definition_id" json:"api_definition_id"`
	SourceEnvID        uuid.UUID       `db:"source_env_id" json:"source_env_id"`
	TargetEnvID        uuid.UUID       `db:"target_env_id" json:"target_env_id"`
	Status             string          `db:"status" json:"status"`
	DefinitionSnapshot json.RawMessage `db:"definition_snapshot" json:"definition_snapshot"`
	DiffSummary        json.RawMessage `db:"diff_summary" json:"diff_summary,omitempty"`
	RequestedBy        uuid.UUID       `db:"requested_by" json:"requested_by"`
	ReviewedBy         *uuid.UUID      `db:"reviewed_by" json:"reviewed_by,omitempty"`
	ReviewComment      string          `db:"review_comment" json:"review_comment"`
	RequestedAt        time.Time       `db:"requested_at" json:"requested_at"`
	ReviewedAt         *time.Time      `db:"reviewed_at" json:"reviewed_at,omitempty"`
	DeployedAt         *time.Time      `db:"deployed_at" json:"deployed_at,omitempty"`
}

type CreatePromotionRequest struct {
	ApiDefinitionID uuid.UUID `json:"api_definition_id" binding:"required"`
	SourceEnvID     uuid.UUID `json:"source_env_id" binding:"required"`
	TargetEnvID     uuid.UUID `json:"target_env_id" binding:"required"`
}

type ReviewPromotionRequest struct {
	Action  string `json:"action" binding:"required"` // "approve" or "reject"
	Comment string `json:"comment"`
}

// DiffResult represents the differences between two JSON definitions.
type DiffResult struct {
	Added   []DiffEntry `json:"added,omitempty"`
	Removed []DiffEntry `json:"removed,omitempty"`
	Changed []DiffEntry `json:"changed,omitempty"`
}

type DiffEntry struct {
	Path     string      `json:"path"`
	OldValue interface{} `json:"old_value,omitempty"`
	NewValue interface{} `json:"new_value,omitempty"`
}
