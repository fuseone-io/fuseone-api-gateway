package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type ApiDeployment struct {
	ID                 uuid.UUID       `db:"id" json:"id"`
	ApiDefinitionID    uuid.UUID       `db:"api_definition_id" json:"api_definition_id"`
	EnvironmentID      uuid.UUID       `db:"environment_id" json:"environment_id"`
	APISIXServiceID    *string         `db:"apisix_service_id" json:"apisix_service_id,omitempty"`
	APISIXRouteIDs     json.RawMessage `db:"apisix_route_ids" json:"apisix_route_ids"`
	SyncStatus         string          `db:"sync_status" json:"sync_status"`
	DeployedAt         *time.Time      `db:"deployed_at" json:"deployed_at,omitempty"`
	DeployedBy         *uuid.UUID      `db:"deployed_by" json:"deployed_by,omitempty"`
	DefinitionSnapshot json.RawMessage `db:"definition_snapshot" json:"definition_snapshot,omitempty"`
	CreatedAt          time.Time       `db:"created_at" json:"created_at"`
	UpdatedAt          time.Time       `db:"updated_at" json:"updated_at"`
}
