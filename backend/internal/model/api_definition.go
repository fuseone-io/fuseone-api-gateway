package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Lifecycle status constants
const (
	LifecycleDraft      = "draft"
	LifecycleActive     = "active"
	LifecycleDeprecated = "deprecated"
	LifecycleRetired    = "retired"
)

type ApiDefinition struct {
	ID              uuid.UUID        `db:"id" json:"id"`
	Name            string           `db:"name" json:"name"`
	Description     string           `db:"description" json:"description"`
	Definition      json.RawMessage  `db:"definition" json:"definition"`
	SyncStatus      string           `db:"sync_status" json:"sync_status"` // draft, synced, out_of_sync
	APISIXServiceID *string          `db:"apisix_service_id" json:"apisix_service_id,omitempty"`
	APISIXRouteIDs  json.RawMessage  `db:"apisix_route_ids" json:"apisix_route_ids"`
	CreatedBy       *uuid.UUID       `db:"created_by" json:"created_by,omitempty"`
	CreatedAt       time.Time        `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time        `db:"updated_at" json:"updated_at"`
	DeployedAt      *time.Time       `db:"deployed_at" json:"deployed_at,omitempty"`
	Version         string           `db:"version" json:"version"`
	ApiGroupID      uuid.UUID        `db:"api_group_id" json:"api_group_id"`
	ClonedFromID    *uuid.UUID       `db:"cloned_from_id" json:"cloned_from_id,omitempty"`
	LifecycleStatus string           `db:"lifecycle_status" json:"lifecycle_status"`
	SunsetDate      *time.Time       `db:"sunset_date" json:"sunset_date,omitempty"`
}

type CreateApiDefinitionRequest struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Definition  json.RawMessage `json:"definition" binding:"required"`
}

type UpdateApiDefinitionRequest struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Definition  json.RawMessage `json:"definition" binding:"required"`
}

type CloneApiDefinitionRequest struct {
	Version string `json:"version,omitempty"`
}

type DeprecateApiDefinitionRequest struct {
	SunsetDate *time.Time `json:"sunset_date,omitempty"`
}
