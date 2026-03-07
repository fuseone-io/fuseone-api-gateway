package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

// EventApiDeployer manages APISIX route creation for Event APIs.
type EventApiDeployer struct {
	repo         *repository.EventApiRepository
	registry     *APISIXClientRegistry
	upstreamNode string // host:port for APISIX upstream (e.g. "event-gateway:8090")
	logger       *zap.Logger
}

// NewEventApiDeployer creates a new EventApiDeployer.
// eventGatewayURL is the full URL (e.g. "http://event-gateway:8090"); the host:port
// is extracted for use as the APISIX upstream node.
func NewEventApiDeployer(repo *repository.EventApiRepository, registry *APISIXClientRegistry, eventGatewayURL string, logger *zap.Logger) *EventApiDeployer {
	node := "event-gateway:8090" // fallback
	if u, err := url.Parse(eventGatewayURL); err == nil && u.Host != "" {
		node = u.Host
	}
	return &EventApiDeployer{repo: repo, registry: registry, upstreamNode: node, logger: logger}
}

// Deploy creates APISIX routes for the Event API, pointing to the Event Gateway upstream.
func (d *EventApiDeployer) Deploy(ctx context.Context, id uuid.UUID, envID uuid.UUID, deployedBy *uuid.UUID) (*model.EventApi, error) {
	ea, err := d.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if ea == nil {
		return nil, fmt.Errorf("event api not found")
	}

	client, err := d.registry.GetClient(ctx, envID)
	if err != nil {
		return nil, fmt.Errorf("resolving APISIX client: %w", err)
	}

	// Clean up existing routes if any
	var oldRouteIDs []string
	if ea.APISIXRouteIDs != nil {
		json.Unmarshal(ea.APISIXRouteIDs, &oldRouteIDs)
	}
	for _, rid := range oldRouteIDs {
		if delErr := client.Delete(ctx, "routes", rid); delErr != nil {
			d.logger.Warn("failed to delete old APISIX route", zap.String("id", rid), zap.Error(delErr))
		}
	}

	// Parse user-configured plugins (auth, rate-limit, etc.)
	var userPlugins map[string]interface{}
	if ea.APISIXPlugins != nil {
		json.Unmarshal(ea.APISIXPlugins, &userPlugins)
	}
	if userPlugins == nil {
		userPlugins = map[string]interface{}{}
	}

	// Build routes for each enabled protocol
	var routeIDs []string
	basePath := strings.TrimRight(ea.ContextPath, "/")

	// Event Gateway upstream
	upstream := map[string]interface{}{
		"type": "roundrobin",
		"nodes": map[string]int{
			d.upstreamNode: 1,
		},
	}

	labels := map[string]string{
		"_fuseone_event_api":    ea.ID.String(),
		"_fuseone_managed_by":   "event-api-deployer",
	}

	// REST Produce: POST {context_path}/{slug}/produce
	if ea.RestProduce {
		routeID, err := d.createRoute(ctx, client, routeCreateParams{
			name:     fmt.Sprintf("event-api:%s:produce", ea.Slug),
			uri:      fmt.Sprintf("%s/%s/produce", basePath, ea.Slug),
			methods:  []string{"POST"},
			upstream: upstream,
			labels:   labels,
			rewriteURI: fmt.Sprintf("/topics/%s/produce", ea.Slug),
			plugins:  userPlugins,
		})
		if err != nil {
			return nil, fmt.Errorf("creating produce route: %w", err)
		}
		routeIDs = append(routeIDs, routeID)
	}

	// REST Consume: POST {context_path}/{slug}/consume
	if ea.RestConsume {
		routeID, err := d.createRoute(ctx, client, routeCreateParams{
			name:     fmt.Sprintf("event-api:%s:consume", ea.Slug),
			uri:      fmt.Sprintf("%s/%s/consume", basePath, ea.Slug),
			methods:  []string{"POST"},
			upstream: upstream,
			labels:   labels,
			rewriteURI: fmt.Sprintf("/topics/%s/consume", ea.Slug),
			plugins:  userPlugins,
		})
		if err != nil {
			return nil, fmt.Errorf("creating consume route: %w", err)
		}
		routeIDs = append(routeIDs, routeID)
	}

	// SSE Stream: GET {context_path}/{slug}/stream
	if ea.SSEEnabled {
		ssePlugins := copyPlugins(userPlugins)
		// Extended timeout for SSE connections
		sseUpstream := map[string]interface{}{
			"type": "roundrobin",
			"nodes": map[string]int{
				d.upstreamNode: 1,
			},
			"timeout": map[string]int{
				"connect": 6,
				"send":    3600,
				"read":    3600,
			},
		}

		routeID, err := d.createRoute(ctx, client, routeCreateParams{
			name:     fmt.Sprintf("event-api:%s:stream", ea.Slug),
			uri:      fmt.Sprintf("%s/%s/stream", basePath, ea.Slug),
			methods:  []string{"GET"},
			upstream: sseUpstream,
			labels:   labels,
			rewriteURI: fmt.Sprintf("/topics/%s/stream", ea.Slug),
			plugins:  ssePlugins,
		})
		if err != nil {
			return nil, fmt.Errorf("creating stream route: %w", err)
		}
		routeIDs = append(routeIDs, routeID)
	}

	// WebSocket: GET {context_path}/{slug}/ws (Phase 2)
	if ea.WebsocketEnabled {
		wsPlugins := copyPlugins(userPlugins)
		wsUpstream := map[string]interface{}{
			"type": "roundrobin",
			"nodes": map[string]int{
				d.upstreamNode: 1,
			},
			"timeout": map[string]int{
				"connect": 6,
				"send":    3600,
				"read":    3600,
			},
		}

		routeID, err := d.createRoute(ctx, client, routeCreateParams{
			name:        fmt.Sprintf("event-api:%s:ws", ea.Slug),
			uri:         fmt.Sprintf("%s/%s/ws", basePath, ea.Slug),
			methods:     []string{"GET"},
			upstream:    wsUpstream,
			labels:      labels,
			rewriteURI:  fmt.Sprintf("/topics/%s/ws", ea.Slug),
			plugins:     wsPlugins,
			enableWS:    true,
		})
		if err != nil {
			return nil, fmt.Errorf("creating websocket route: %w", err)
		}
		routeIDs = append(routeIDs, routeID)
	}

	// Save route IDs and update status
	routeIDsJSON, _ := json.Marshal(routeIDs)
	if err := d.repo.UpdateDeployState(ctx, id, routeIDsJSON, "active", deployedBy); err != nil {
		return nil, fmt.Errorf("updating deploy state: %w", err)
	}

	return d.repo.GetByID(ctx, id)
}

// Undeploy removes APISIX routes and resets the Event API to draft status.
func (d *EventApiDeployer) Undeploy(ctx context.Context, id uuid.UUID, envID uuid.UUID) (*model.EventApi, error) {
	ea, err := d.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if ea == nil {
		return nil, fmt.Errorf("event api not found")
	}

	client, err := d.registry.GetClient(ctx, envID)
	if err != nil {
		return nil, fmt.Errorf("resolving APISIX client: %w", err)
	}

	// Delete all APISIX routes
	var routeIDs []string
	if ea.APISIXRouteIDs != nil {
		json.Unmarshal(ea.APISIXRouteIDs, &routeIDs)
	}
	for _, rid := range routeIDs {
		if delErr := client.Delete(ctx, "routes", rid); delErr != nil {
			d.logger.Warn("failed to delete APISIX route on undeploy", zap.String("id", rid), zap.Error(delErr))
		}
	}

	if err := d.repo.ClearDeployState(ctx, id); err != nil {
		return nil, fmt.Errorf("clearing deploy state: %w", err)
	}

	return d.repo.GetByID(ctx, id)
}

type routeCreateParams struct {
	name       string
	uri        string
	methods    []string
	upstream   map[string]interface{}
	labels     map[string]string
	rewriteURI string
	plugins    map[string]interface{}
	enableWS   bool
}

func (d *EventApiDeployer) createRoute(ctx context.Context, client *APISIXClient, p routeCreateParams) (string, error) {
	plugins := copyPlugins(p.plugins)

	// Inject proxy-rewrite to map public path to Event Gateway internal path
	plugins["proxy-rewrite"] = map[string]interface{}{
		"uri": p.rewriteURI,
	}

	route := map[string]interface{}{
		"name":     p.name,
		"uri":      p.uri,
		"methods":  p.methods,
		"upstream": p.upstream,
		"labels":   p.labels,
		"plugins":  plugins,
		"status":   1,
	}

	if p.enableWS {
		route["enable_websocket"] = true
	}

	data, _ := json.Marshal(route)
	respBody, err := client.Create(ctx, "routes", data)
	if err != nil {
		return "", err
	}

	return extractID(respBody), nil
}

func copyPlugins(src map[string]interface{}) map[string]interface{} {
	dst := make(map[string]interface{}, len(src))
	for k, v := range src {
		dst[k] = v
	}
	return dst
}
