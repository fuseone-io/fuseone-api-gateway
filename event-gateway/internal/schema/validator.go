package schema

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/fuseone/event-gateway/internal/repository"
	"github.com/google/uuid"
	"github.com/santhosh-tekuri/jsonschema/v6"
	"go.uber.org/zap"
)

// Validator caches compiled JSON Schemas per Event API and validates payloads.
type Validator struct {
	repo   *repository.EventApiRepository
	logger *zap.Logger

	mu      sync.RWMutex
	schemas map[uuid.UUID]*jsonschema.Schema // compiled schemas by event_api_id
}

func NewValidator(repo *repository.EventApiRepository, logger *zap.Logger) *Validator {
	return &Validator{
		repo:    repo,
		logger:  logger,
		schemas: make(map[uuid.UUID]*jsonschema.Schema),
	}
}

// LoadAll loads active schemas for all event APIs that have schema_validation enabled.
func (v *Validator) LoadAll(ctx context.Context, apis []repository.EventApiWithConnection) {
	v.mu.Lock()
	defer v.mu.Unlock()

	v.schemas = make(map[uuid.UUID]*jsonschema.Schema)
	for _, api := range apis {
		if !api.SchemaValidation {
			continue
		}
		content, err := v.repo.LoadActiveSchema(ctx, api.ID)
		if err != nil || content == nil {
			continue
		}
		compiled, err := compileSchema(content)
		if err != nil {
			v.logger.Warn("failed to compile schema",
				zap.String("event_api", api.Slug),
				zap.Error(err),
			)
			continue
		}
		v.schemas[api.ID] = compiled
	}
	v.logger.Info("loaded event schemas", zap.Int("count", len(v.schemas)))
}

// Reload reloads the schema for a specific event API.
func (v *Validator) Reload(ctx context.Context, eventApiID uuid.UUID, schemaValidation bool) {
	if !schemaValidation {
		v.mu.Lock()
		delete(v.schemas, eventApiID)
		v.mu.Unlock()
		return
	}

	content, err := v.repo.LoadActiveSchema(ctx, eventApiID)
	if err != nil || content == nil {
		v.mu.Lock()
		delete(v.schemas, eventApiID)
		v.mu.Unlock()
		return
	}

	compiled, err := compileSchema(content)
	if err != nil {
		v.logger.Warn("failed to compile schema on reload",
			zap.String("event_api_id", eventApiID.String()),
			zap.Error(err),
		)
		return
	}

	v.mu.Lock()
	v.schemas[eventApiID] = compiled
	v.mu.Unlock()
}

// Validate checks a JSON payload against the compiled schema for the given Event API.
// Returns nil if no schema is loaded (validation passes by default).
func (v *Validator) Validate(eventApiID uuid.UUID, payload json.RawMessage) error {
	v.mu.RLock()
	sch, ok := v.schemas[eventApiID]
	v.mu.RUnlock()

	if !ok {
		return nil // No schema loaded — pass through
	}

	var data interface{}
	if err := json.Unmarshal(payload, &data); err != nil {
		return fmt.Errorf("invalid JSON payload: %w", err)
	}

	if err := sch.Validate(data); err != nil {
		return fmt.Errorf("schema validation failed: %w", err)
	}

	return nil
}

func compileSchema(content json.RawMessage) (*jsonschema.Schema, error) {
	var schemaMap interface{}
	if err := json.Unmarshal(content, &schemaMap); err != nil {
		return nil, fmt.Errorf("unmarshal schema: %w", err)
	}

	c := jsonschema.NewCompiler()
	if err := c.AddResource("schema.json", schemaMap); err != nil {
		return nil, fmt.Errorf("add schema resource: %w", err)
	}

	compiled, err := c.Compile("schema.json")
	if err != nil {
		return nil, fmt.Errorf("compile schema: %w", err)
	}

	return compiled, nil
}
