package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
	"github.com/google/uuid"
)

type ApiDefinitionService struct {
	repo   *repository.ApiDefinitionRepository
	apisix *APISIXClient
	logger *zap.Logger
}

func NewApiDefinitionService(repo *repository.ApiDefinitionRepository, apisix *APISIXClient, logger *zap.Logger) *ApiDefinitionService {
	return &ApiDefinitionService{repo: repo, apisix: apisix, logger: logger}
}

func (s *ApiDefinitionService) Get(ctx context.Context, id uuid.UUID) (*model.ApiDefinition, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *ApiDefinitionService) List(ctx context.Context, page, pageSize int, search, syncStatus, lifecycleStatus, apiGroupID string) ([]model.ApiDefinition, int, error) {
	return s.repo.List(ctx, page, pageSize, search, syncStatus, lifecycleStatus, apiGroupID)
}

func (s *ApiDefinitionService) Create(ctx context.Context, req *model.CreateApiDefinitionRequest, userID *uuid.UUID) (*model.ApiDefinition, error) {
	groupID := uuid.New()
	d := &model.ApiDefinition{
		Name:            req.Name,
		Description:     req.Description,
		Definition:      req.Definition,
		SyncStatus:      "draft",
		CreatedBy:       userID,
		Version:         "v1",
		ApiGroupID:      groupID,
		LifecycleStatus: model.LifecycleDraft,
	}
	if err := s.repo.Create(ctx, d); err != nil {
		return nil, fmt.Errorf("creating api definition: %w", err)
	}
	return d, nil
}

func (s *ApiDefinitionService) Update(ctx context.Context, id uuid.UUID, req *model.UpdateApiDefinitionRequest) (*model.ApiDefinition, error) {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, nil
	}

	// Determine new sync status
	newStatus := "draft"
	if existing.SyncStatus == "synced" {
		newStatus = "out_of_sync"
	} else if existing.SyncStatus == "out_of_sync" {
		newStatus = "out_of_sync"
	}

	if err := s.repo.Update(ctx, id, req.Name, req.Description, req.Definition, newStatus); err != nil {
		return nil, err
	}

	return s.repo.GetByID(ctx, id)
}

func (s *ApiDefinitionService) Delete(ctx context.Context, id uuid.UUID) error {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if existing == nil {
		return fmt.Errorf("not found")
	}

	// If deployed, remove from APISIX
	if existing.APISIXServiceID != nil && *existing.APISIXServiceID != "" {
		// Delete all routes tracked in apisix_route_ids
		var routeIDs []string
		if err := json.Unmarshal(existing.APISIXRouteIDs, &routeIDs); err == nil {
			for _, rid := range routeIDs {
				if delErr := s.apisix.Delete(ctx, "routes", rid); delErr != nil {
					s.logger.Warn("failed to delete APISIX route", zap.String("id", rid), zap.Error(delErr))
				}
			}
		}
		// Delete service
		if delErr := s.apisix.Delete(ctx, "services", *existing.APISIXServiceID); delErr != nil {
			s.logger.Warn("failed to delete APISIX service", zap.String("id", *existing.APISIXServiceID), zap.Error(delErr))
		}
	}

	return s.repo.Delete(ctx, id)
}

// flowRouteMapping tracks APISIX route IDs per strategy for a single flow.
type flowRouteMapping struct {
	flowIndex int
	routeIDs  map[string]string // strategy -> APISIX route ID ("path", "header", "default")
}

// Deploy pushes the API definition to APISIX.
func (s *ApiDefinitionService) Deploy(ctx context.Context, id uuid.UUID) (*model.ApiDefinition, error) {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, fmt.Errorf("not found")
	}

	// Parse the definition to extract APISIX payloads
	var def struct {
		Name             string                 `json:"name"`
		Description      string                 `json:"description"`
		Status           string                 `json:"status"`
		Endpoint         map[string]interface{} `json:"endpoint"`
		Hosts            []string               `json:"hosts"`
		ContextPath      string                 `json:"context_path"`
		RoutingMode      string                 `json:"routing_mode"`
		IsDefaultVersion bool                   `json:"is_default_version"`
		Flows            []struct {
			ID         string                       `json:"id"`
			RouteID    *string                      `json:"routeId"`
			RouteIDs   map[string]string             `json:"routeIds"`
			Name       string                       `json:"name"`
			Entrypoint map[string]interface{}        `json:"entrypoint"`
			Policies   []struct {
				Name    string                 `json:"name"`
				Enabled bool                   `json:"enabled"`
				Config  map[string]interface{} `json:"config"`
			} `json:"policies"`
		} `json:"flows"`
		ServiceID *string           `json:"serviceId"`
		Labels    map[string]string `json:"labels"`
	}

	if err := json.Unmarshal(existing.Definition, &def); err != nil {
		return nil, fmt.Errorf("parsing definition: %w", err)
	}

	// Default routing mode
	routingMode := def.RoutingMode
	if routingMode == "" {
		routingMode = "path"
	}

	// Build upstream from endpoint
	upstream := buildUpstream(def.Endpoint)

	// Build service payload
	servicePayload := map[string]interface{}{
		"name":     def.Name,
		"desc":     def.Description,
		"upstream": upstream,
	}
	if def.Labels != nil {
		servicePayload["labels"] = def.Labels
	}

	serviceJSON, _ := json.Marshal(servicePayload)

	// Create or update APISIX Service
	var serviceID string
	if existing.APISIXServiceID != nil && *existing.APISIXServiceID != "" {
		serviceID = *existing.APISIXServiceID
		if _, err := s.apisix.Update(ctx, "services", serviceID, serviceJSON); err != nil {
			return nil, fmt.Errorf("updating APISIX service: %w", err)
		}
	} else {
		respBody, err := s.apisix.Create(ctx, "services", serviceJSON)
		if err != nil {
			return nil, fmt.Errorf("creating APISIX service: %w", err)
		}
		serviceID = extractID(respBody)
		if serviceID == "" {
			return nil, fmt.Errorf("failed to get service ID from APISIX response")
		}
	}

	// Track existing route IDs for cleanup
	var oldRouteIDs []string
	if existing.APISIXRouteIDs != nil {
		json.Unmarshal(existing.APISIXRouteIDs, &oldRouteIDs)
	}

	// Create/update routes — each flow may generate multiple routes
	allNewRouteIDs := make([]string, 0, len(def.Flows)*3)
	usedRouteIDs := map[string]bool{}

	flowMappings := make([]flowRouteMapping, len(def.Flows))

	for i, flow := range def.Flows {
		// Build plugins map
		plugins := map[string]interface{}{}
		for _, p := range flow.Policies {
			if p.Enabled {
				plugins[p.Name] = p.Config
			}
		}

		// Route status
		routeStatus := 1
		if def.Status == "disabled" {
			routeStatus = 0
		}

		// Extract flow URI and hosts/methods
		flowURI, _ := flow.Entrypoint["uri"].(string)
		var hosts []interface{}
		if h, ok := flow.Entrypoint["hosts"].([]interface{}); ok {
			hosts = h
		}
		var methods []interface{}
		if m, ok := flow.Entrypoint["methods"].([]interface{}); ok {
			methods = m
		}

		// Initialize route IDs map from existing flow
		existingRouteIDs := flow.RouteIDs
		if existingRouteIDs == nil {
			existingRouteIDs = map[string]string{}
		}
		// Backcompat: if flow has routeId but no routeIds, treat as "path"
		if flow.RouteID != nil && *flow.RouteID != "" && len(existingRouteIDs) == 0 {
			existingRouteIDs["path"] = *flow.RouteID
		}

		newFlowRouteIDs := map[string]string{}

		// Determine which route strategies to generate
		type routeStrategy struct {
			key      string   // "path", "header", "default"
			uri      string
			vars     [][]interface{}
			nameSfx  string
			priority int
		}

		strategies := []routeStrategy{}

		if routingMode == "path" || routingMode == "both" {
			resolvedURI := resolveVersionedURI(def.ContextPath, existing.Version, flowURI)
			strategies = append(strategies, routeStrategy{
				key: "path", uri: resolvedURI, nameSfx: "(path)",
			})
		}

		if routingMode == "header" || routingMode == "both" {
			resolvedURI := resolveBaseURI(def.ContextPath, flowURI)
			vars := [][]interface{}{
				{"http_x_api_version", "==", existing.Version},
			}
			strategies = append(strategies, routeStrategy{
				key: "header", uri: resolvedURI, vars: vars, nameSfx: "(header)",
			})
		}

		if def.IsDefaultVersion && (routingMode == "header" || routingMode == "both") {
			resolvedURI := resolveBaseURI(def.ContextPath, flowURI)
			strategies = append(strategies, routeStrategy{
				key: "default", uri: resolvedURI, nameSfx: "(default)", priority: -1,
			})
		}

		// If no strategies matched (shouldn't happen), fallback to simple mode
		if len(strategies) == 0 {
			strategies = append(strategies, routeStrategy{
				key: "path", uri: flowURI,
			})
		}

		for _, strat := range strategies {
			// Build route name
			routeName := def.Name
			if len(def.Flows) > 1 {
				routeName = fmt.Sprintf("%s - %s", def.Name, flow.Name)
			}
			if len(strategies) > 1 {
				routeName = fmt.Sprintf("%s %s", routeName, strat.nameSfx)
			}

			routePayload := map[string]interface{}{
				"name":       routeName,
				"desc":       def.Description,
				"uri":        strat.uri,
				"service_id": serviceID,
				"status":     routeStatus,
				"labels": map[string]string{
					"_fuseone_api":      serviceID,
					"_fuseone_strategy": strat.key,
				},
			}

			// Flow-level hosts override, otherwise API-level hosts
			if len(hosts) > 0 {
				routePayload["hosts"] = hosts
			} else if len(def.Hosts) > 0 {
				routePayload["hosts"] = def.Hosts
			}
			if len(methods) > 0 {
				routePayload["methods"] = methods
			}
			if len(plugins) > 0 {
				routePayload["plugins"] = plugins
			}
			if strat.vars != nil {
				routePayload["vars"] = strat.vars
			}
			if strat.priority != 0 {
				routePayload["priority"] = strat.priority
			}

			routeJSON, _ := json.Marshal(routePayload)

			existingID := existingRouteIDs[strat.key]

			if existingID != "" {
				// Update existing route
				if _, err := s.apisix.Update(ctx, "routes", existingID, routeJSON); err != nil {
					return nil, fmt.Errorf("updating APISIX route %s (%s): %w", existingID, strat.key, err)
				}
				newFlowRouteIDs[strat.key] = existingID
				allNewRouteIDs = append(allNewRouteIDs, existingID)
				usedRouteIDs[existingID] = true
			} else {
				// Create new route
				respBody, err := s.apisix.Create(ctx, "routes", routeJSON)
				if err != nil {
					return nil, fmt.Errorf("creating APISIX route (%s): %w", strat.key, err)
				}
				routeID := extractID(respBody)
				if routeID == "" {
					return nil, fmt.Errorf("failed to get route ID from APISIX response")
				}
				newFlowRouteIDs[strat.key] = routeID
				allNewRouteIDs = append(allNewRouteIDs, routeID)
				usedRouteIDs[routeID] = true
			}
		}

		// Remove routes from strategies no longer used
		for key, rid := range existingRouteIDs {
			if _, stillUsed := newFlowRouteIDs[key]; !stillUsed && rid != "" {
				if delErr := s.apisix.Delete(ctx, "routes", rid); delErr != nil {
					s.logger.Warn("failed to delete orphaned strategy route",
						zap.String("id", rid), zap.String("strategy", key), zap.Error(delErr))
				}
			}
		}

		flowMappings[i] = flowRouteMapping{flowIndex: i, routeIDs: newFlowRouteIDs}
	}

	// Delete orphaned routes (from previous deploy)
	for _, oldID := range oldRouteIDs {
		if !usedRouteIDs[oldID] {
			if delErr := s.apisix.Delete(ctx, "routes", oldID); delErr != nil {
				s.logger.Warn("failed to delete orphaned APISIX route", zap.String("id", oldID), zap.Error(delErr))
			}
		}
	}

	// Update definition in DB with APISIX IDs
	updatedDef := updateDefinitionWithRouteIDs(existing.Definition, serviceID, flowMappings)
	if err := s.repo.Update(ctx, id, existing.Name, existing.Description, updatedDef, "synced"); err != nil {
		return nil, fmt.Errorf("updating definition after deploy: %w", err)
	}

	// Mark as deployed
	if err := s.repo.SetDeployed(ctx, id, serviceID, allNewRouteIDs); err != nil {
		return nil, fmt.Errorf("setting deployed status: %w", err)
	}

	// Auto-transition lifecycle: draft -> active on deploy
	if existing.LifecycleStatus == model.LifecycleDraft {
		if err := s.repo.UpdateLifecycleStatus(ctx, id, model.LifecycleActive, nil); err != nil {
			s.logger.Warn("failed to auto-activate on deploy", zap.Error(err))
		}
	}

	return s.repo.GetByID(ctx, id)
}

// resolveVersionedURI builds a path-versioned URI: /{version}{contextPath}{flowURI}
func resolveVersionedURI(contextPath, version, flowURI string) string {
	uri := "/" + version
	if contextPath != "" {
		uri += contextPath
	}
	if flowURI != "" && flowURI != "/" {
		uri += flowURI
	}
	if uri == "" {
		uri = "/"
	}
	return uri
}

// resolveBaseURI builds a URI without version: {contextPath}{flowURI}
func resolveBaseURI(contextPath, flowURI string) string {
	uri := contextPath
	if flowURI != "" && flowURI != "/" {
		uri += flowURI
	}
	if uri == "" {
		uri = "/"
	}
	return uri
}

// Clone creates a copy of an API definition with an incremented version.
func (s *ApiDefinitionService) Clone(ctx context.Context, id uuid.UUID, req *model.CloneApiDefinitionRequest, userID *uuid.UUID) (*model.ApiDefinition, error) {
	source, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if source == nil {
		return nil, fmt.Errorf("not found")
	}

	nextVersion := req.Version
	if nextVersion == "" {
		nextVersion = incrementVersion(source.Version)
	}

	cleanedDef := clearAPISIXIDsFromDefinition(source.Definition)

	cloned := &model.ApiDefinition{
		Name:            source.Name,
		Description:     source.Description,
		Definition:      cleanedDef,
		SyncStatus:      "draft",
		CreatedBy:       userID,
		Version:         nextVersion,
		ApiGroupID:      source.ApiGroupID,
		ClonedFromID:    &source.ID,
		LifecycleStatus: model.LifecycleDraft,
	}

	if err := s.repo.Create(ctx, cloned); err != nil {
		return nil, fmt.Errorf("cloning api definition: %w", err)
	}
	return cloned, nil
}

// Deprecate marks an active API as deprecated and injects deprecation headers in APISIX.
func (s *ApiDefinitionService) Deprecate(ctx context.Context, id uuid.UUID, req *model.DeprecateApiDefinitionRequest) (*model.ApiDefinition, error) {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, fmt.Errorf("not found")
	}
	if existing.LifecycleStatus != model.LifecycleActive {
		return nil, fmt.Errorf("only active APIs can be deprecated (current: %s)", existing.LifecycleStatus)
	}

	if err := s.repo.UpdateLifecycleStatus(ctx, id, model.LifecycleDeprecated, req.SunsetDate); err != nil {
		return nil, fmt.Errorf("updating lifecycle: %w", err)
	}

	// Inject deprecation headers via APISIX
	if existing.APISIXServiceID != nil && *existing.APISIXServiceID != "" {
		s.injectDeprecationHeaders(ctx, existing, req.SunsetDate)
	}

	return s.repo.GetByID(ctx, id)
}

// Retire marks a deprecated API as retired and configures APISIX to return 410 Gone.
func (s *ApiDefinitionService) Retire(ctx context.Context, id uuid.UUID) (*model.ApiDefinition, error) {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, fmt.Errorf("not found")
	}
	if existing.LifecycleStatus != model.LifecycleDeprecated {
		return nil, fmt.Errorf("only deprecated APIs can be retired (current: %s)", existing.LifecycleStatus)
	}

	if err := s.repo.UpdateLifecycleStatus(ctx, id, model.LifecycleRetired, existing.SunsetDate); err != nil {
		return nil, fmt.Errorf("updating lifecycle: %w", err)
	}

	// Configure APISIX routes to return 410 Gone
	if existing.APISIXServiceID != nil && *existing.APISIXServiceID != "" {
		s.retireInAPISIX(ctx, existing)
	}

	return s.repo.GetByID(ctx, id)
}

// Undeprecate reactivates a deprecated API and removes deprecation headers from APISIX.
func (s *ApiDefinitionService) Undeprecate(ctx context.Context, id uuid.UUID) (*model.ApiDefinition, error) {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, fmt.Errorf("not found")
	}
	if existing.LifecycleStatus != model.LifecycleDeprecated {
		return nil, fmt.Errorf("only deprecated APIs can be reactivated (current: %s)", existing.LifecycleStatus)
	}

	if err := s.repo.UpdateLifecycleStatus(ctx, id, model.LifecycleActive, nil); err != nil {
		return nil, fmt.Errorf("updating lifecycle: %w", err)
	}

	// Remove deprecation headers from APISIX routes
	if existing.APISIXServiceID != nil && *existing.APISIXServiceID != "" {
		s.removeDeprecationHeaders(ctx, existing)
	}

	return s.repo.GetByID(ctx, id)
}

// GetVersions returns all versions of an API group.
func (s *ApiDefinitionService) GetVersions(ctx context.Context, apiGroupID uuid.UUID) ([]model.ApiDefinition, error) {
	return s.repo.ListByGroup(ctx, apiGroupID)
}

// --- APISIX Deprecation Helpers ---

func (s *ApiDefinitionService) injectDeprecationHeaders(ctx context.Context, api *model.ApiDefinition, sunsetDate *time.Time) {
	var routeIDs []string
	if err := json.Unmarshal(api.APISIXRouteIDs, &routeIDs); err != nil {
		return
	}

	headers := map[string]string{
		"Deprecation": "true",
	}
	if sunsetDate != nil {
		headers["Sunset"] = sunsetDate.UTC().Format(time.RFC1123)
	}

	// Check for a newer active version to build Link header
	successor, _ := s.repo.GetActiveVersionInGroup(ctx, api.ApiGroupID, api.ID)
	if successor != nil {
		var sucDef struct {
			Flows []struct {
				Entrypoint struct {
					URI string `json:"uri"`
				} `json:"entrypoint"`
			} `json:"flows"`
		}
		if err := json.Unmarshal(successor.Definition, &sucDef); err == nil && len(sucDef.Flows) > 0 {
			headers["Link"] = fmt.Sprintf(`<%s>; rel="successor-version"`, sucDef.Flows[0].Entrypoint.URI)
		}
	}

	for _, rid := range routeIDs {
		s.patchRouteHeaders(ctx, rid, headers, nil)
	}
}

func (s *ApiDefinitionService) removeDeprecationHeaders(ctx context.Context, api *model.ApiDefinition) {
	var routeIDs []string
	if err := json.Unmarshal(api.APISIXRouteIDs, &routeIDs); err != nil {
		return
	}

	for _, rid := range routeIDs {
		// Remove the response-rewrite plugin entirely
		patch := map[string]interface{}{
			"plugins": map[string]interface{}{
				"response-rewrite": nil,
			},
		}
		patchJSON, _ := json.Marshal(patch)
		if _, err := s.apisix.Patch(ctx, "routes", rid, patchJSON); err != nil {
			s.logger.Warn("failed to remove deprecation headers",
				zap.String("route_id", rid), zap.Error(err))
		}
	}
}

func (s *ApiDefinitionService) retireInAPISIX(ctx context.Context, api *model.ApiDefinition) {
	var routeIDs []string
	if err := json.Unmarshal(api.APISIXRouteIDs, &routeIDs); err != nil {
		return
	}

	for _, rid := range routeIDs {
		patch := map[string]interface{}{
			"plugins": map[string]interface{}{
				"response-rewrite": map[string]interface{}{
					"status_code": 410,
					"body":        `{"error":{"code":"API_RETIRED","message":"This API version has been retired."}}`,
					"headers": map[string]interface{}{
						"set": map[string]string{
							"Content-Type": "application/json",
						},
					},
				},
			},
		}
		patchJSON, _ := json.Marshal(patch)
		if _, err := s.apisix.Patch(ctx, "routes", rid, patchJSON); err != nil {
			s.logger.Warn("failed to retire route in APISIX",
				zap.String("route_id", rid), zap.Error(err))
		}
	}
}

func (s *ApiDefinitionService) patchRouteHeaders(ctx context.Context, routeID string, setHeaders map[string]string, removeHeaders []string) {
	plugin := map[string]interface{}{
		"headers": map[string]interface{}{},
	}
	h := plugin["headers"].(map[string]interface{})
	if len(setHeaders) > 0 {
		h["set"] = setHeaders
	}
	if len(removeHeaders) > 0 {
		h["remove"] = removeHeaders
	}

	patch := map[string]interface{}{
		"plugins": map[string]interface{}{
			"response-rewrite": plugin,
		},
	}
	patchJSON, _ := json.Marshal(patch)

	if _, err := s.apisix.Patch(ctx, "routes", routeID, patchJSON); err != nil {
		s.logger.Warn("failed to patch route headers",
			zap.String("route_id", routeID), zap.Error(err))
	}
}

// --- Version Helpers ---

func incrementVersion(v string) string {
	if strings.HasPrefix(v, "v") {
		num, err := strconv.Atoi(v[1:])
		if err == nil {
			return fmt.Sprintf("v%d", num+1)
		}
	}
	return v + "-clone"
}

func clearAPISIXIDsFromDefinition(def json.RawMessage) json.RawMessage {
	var m map[string]interface{}
	if err := json.Unmarshal(def, &m); err != nil {
		return def
	}
	delete(m, "serviceId")
	if flows, ok := m["flows"].([]interface{}); ok {
		for _, f := range flows {
			if fm, ok := f.(map[string]interface{}); ok {
				delete(fm, "routeId")
				delete(fm, "routeIds")
			}
		}
	}
	result, _ := json.Marshal(m)
	return result
}

// --- Existing Helpers ---

func buildUpstream(endpoint map[string]interface{}) map[string]interface{} {
	upstream := map[string]interface{}{}

	for _, key := range []string{
		"type", "scheme", "nodes", "retries", "retry_timeout",
		"pass_host", "upstream_host", "timeout",
		"hash_on", "key", "keepalive_pool", "checks", "tls",
		"service_name", "discovery_type",
	} {
		if v, ok := endpoint[key]; ok && v != nil {
			upstream[key] = v
		}
	}

	if ph, ok := upstream["pass_host"]; ok && ph != "rewrite" {
		delete(upstream, "upstream_host")
	}

	if t, ok := upstream["type"]; ok && t != "chash" {
		delete(upstream, "hash_on")
		delete(upstream, "key")
	}

	return upstream
}

func extractID(respBody json.RawMessage) string {
	var resp struct {
		Value struct {
			ID string `json:"id"`
		} `json:"value"`
	}
	if err := json.Unmarshal(respBody, &resp); err == nil && resp.Value.ID != "" {
		return resp.Value.ID
	}

	var resp2 struct {
		Key string `json:"key"`
	}
	if err := json.Unmarshal(respBody, &resp2); err == nil {
		parts := splitKey(resp2.Key)
		if len(parts) > 0 {
			return parts[len(parts)-1]
		}
	}

	return ""
}

func splitKey(key string) []string {
	parts := []string{}
	current := ""
	for _, c := range key {
		if c == '/' {
			if current != "" {
				parts = append(parts, current)
			}
			current = ""
		} else {
			current += string(c)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}
	return parts
}

// updateDefinitionWithRouteIDs writes serviceId and per-flow routeId/routeIds into the definition JSON.
func updateDefinitionWithRouteIDs(definition json.RawMessage, serviceID string, flowMappings []flowRouteMapping) json.RawMessage {
	var defMap map[string]interface{}
	if err := json.Unmarshal(definition, &defMap); err != nil {
		return definition
	}

	defMap["serviceId"] = serviceID

	if flowsRaw, ok := defMap["flows"].([]interface{}); ok {
		for _, fm := range flowMappings {
			if fm.flowIndex < len(flowsRaw) {
				if flowMap, ok := flowsRaw[fm.flowIndex].(map[string]interface{}); ok {
					// Set routeIds map
					flowMap["routeIds"] = fm.routeIDs
					// Set primary routeId for backward compat (prefer "path", then first available)
					if pid, ok := fm.routeIDs["path"]; ok {
						flowMap["routeId"] = pid
					} else {
						for _, rid := range fm.routeIDs {
							flowMap["routeId"] = rid
							break
						}
					}
				}
			}
		}
	}

	updated, err := json.Marshal(defMap)
	if err != nil {
		return definition
	}
	return updated
}
