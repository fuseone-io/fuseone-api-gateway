package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"

	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/model"
)

// MeshService aggregates APISIX Admin API data to build service mesh views.
// All data comes from APISIX upstreams, routes, and services — no database is required.
type MeshService struct {
	registry *APISIXClientRegistry
	logger   *zap.Logger
}

// NewMeshService creates a MeshService that reads from the APISIX Admin API
// via the client registry (environment-aware with fallback).
func NewMeshService(registry *APISIXClientRegistry, logger *zap.Logger) *MeshService {
	return &MeshService{
		registry: registry,
		logger:   logger,
	}
}

// ----- Internal APISIX data structures for JSON parsing -----

// apisixUpstream mirrors the APISIX upstream object fields we care about.
type apisixUpstream struct {
	ID             string          `json:"id"`
	Name           string          `json:"name,omitempty"`
	Desc           string          `json:"desc,omitempty"`
	Type           string          `json:"type,omitempty"` // roundrobin, chash, ewma, least_conn
	Nodes          json.RawMessage `json:"nodes,omitempty"`
	ServiceName    string          `json:"service_name,omitempty"`
	DiscoveryType  string          `json:"discovery_type,omitempty"`
	DiscoveryArgs  json.RawMessage `json:"discovery_args,omitempty"`
	Checks         json.RawMessage `json:"checks,omitempty"`
	PassHost       string          `json:"pass_host,omitempty"`
	UpstreamHost   string          `json:"upstream_host,omitempty"`
	Scheme         string          `json:"scheme,omitempty"`
	Labels         map[string]string `json:"labels,omitempty"`
}

// apisixRoute mirrors the APISIX route object fields we care about.
type apisixRoute struct {
	ID         string          `json:"id"`
	Name       string          `json:"name,omitempty"`
	Desc       string          `json:"desc,omitempty"`
	URI        string          `json:"uri,omitempty"`
	URIs       []string        `json:"uris,omitempty"`
	UpstreamID string          `json:"upstream_id,omitempty"`
	ServiceID  string          `json:"service_id,omitempty"`
	Upstream   json.RawMessage `json:"upstream,omitempty"`
	Plugins    json.RawMessage `json:"plugins,omitempty"`
}

// apisixService mirrors the APISIX service object fields we care about.
type apisixService struct {
	ID         string          `json:"id"`
	Name       string          `json:"name,omitempty"`
	UpstreamID string          `json:"upstream_id,omitempty"`
	Upstream   json.RawMessage `json:"upstream,omitempty"`
}

// ----- Fetch helpers -----

// fetchUpstreams lists all upstreams from the APISIX Admin API.
func (s *MeshService) fetchUpstreams(ctx context.Context, client *APISIXClient) ([]apisixUpstream, error) {
	result, err := client.List(ctx, "upstreams")
	if err != nil {
		return nil, fmt.Errorf("listing upstreams: %w", err)
	}

	upstreams := make([]apisixUpstream, 0, len(result.List))
	for _, node := range result.List {
		var u apisixUpstream
		if err := json.Unmarshal(node.Value, &u); err != nil {
			s.logger.Warn("failed to parse upstream", zap.String("key", node.Key), zap.Error(err))
			continue
		}
		// Extract ID from the etcd key if not embedded in the value.
		if u.ID == "" {
			u.ID = extractIDFromKey(node.Key)
		}
		upstreams = append(upstreams, u)
	}
	return upstreams, nil
}

// fetchRoutes lists all routes from the APISIX Admin API.
func (s *MeshService) fetchRoutes(ctx context.Context, client *APISIXClient) ([]apisixRoute, error) {
	result, err := client.List(ctx, "routes")
	if err != nil {
		return nil, fmt.Errorf("listing routes: %w", err)
	}

	routes := make([]apisixRoute, 0, len(result.List))
	for _, node := range result.List {
		var r apisixRoute
		if err := json.Unmarshal(node.Value, &r); err != nil {
			s.logger.Warn("failed to parse route", zap.String("key", node.Key), zap.Error(err))
			continue
		}
		if r.ID == "" {
			r.ID = extractIDFromKey(node.Key)
		}
		routes = append(routes, r)
	}
	return routes, nil
}

// fetchServices lists all APISIX service objects (not to be confused with MeshService).
func (s *MeshService) fetchServices(ctx context.Context, client *APISIXClient) ([]apisixService, error) {
	result, err := client.List(ctx, "services")
	if err != nil {
		return nil, fmt.Errorf("listing services: %w", err)
	}

	services := make([]apisixService, 0, len(result.List))
	for _, node := range result.List {
		var svc apisixService
		if err := json.Unmarshal(node.Value, &svc); err != nil {
			s.logger.Warn("failed to parse service", zap.String("key", node.Key), zap.Error(err))
			continue
		}
		if svc.ID == "" {
			svc.ID = extractIDFromKey(node.Key)
		}
		services = append(services, svc)
	}
	return services, nil
}

// fetchHealthChecks retrieves upstream health status from the Control API.
// Returns a map of checker name -> list of node statuses. Best-effort: returns empty on error.
func (s *MeshService) fetchHealthChecks(ctx context.Context, client *APISIXClient) map[string][]healthNode {
	body, err := client.GetUpstreamHealth(ctx)
	if err != nil {
		s.logger.Debug("control API health check unavailable", zap.Error(err))
		return nil
	}

	var checkers []healthChecker
	if err := json.Unmarshal(body, &checkers); err != nil {
		s.logger.Debug("failed to parse health checkers", zap.Error(err))
		return nil
	}

	result := make(map[string][]healthNode, len(checkers))
	for _, ch := range checkers {
		result[ch.Name] = ch.Nodes
	}
	return result
}

type healthChecker struct {
	Name  string       `json:"name"`
	Nodes []healthNode `json:"nodes"`
}

type healthNode struct {
	Host   string `json:"host"`
	Port   int    `json:"port"`
	Status string `json:"status"` // healthy, unhealthy
}

// ----- Public methods -----

// GetOverview returns aggregate statistics about the service mesh.
func (s *MeshService) GetOverview(ctx context.Context) (*model.MeshOverview, error) {
	client := s.registry.Fallback()

	var (
		upstreams []apisixUpstream
		healthMap map[string][]healthNode
		fetchErr  error
		wg        sync.WaitGroup
		mu        sync.Mutex
	)

	wg.Add(2)
	go func() {
		defer wg.Done()
		u, err := s.fetchUpstreams(ctx, client)
		mu.Lock()
		upstreams = u
		if err != nil {
			fetchErr = err
		}
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		h := s.fetchHealthChecks(ctx, client)
		mu.Lock()
		healthMap = h
		mu.Unlock()
	}()
	wg.Wait()

	if fetchErr != nil {
		return nil, fetchErr
	}

	overview := &model.MeshOverview{}
	overview.TotalServices = len(upstreams)

	// Tally nodes and discovery types
	discoveryMap := make(map[string]*model.DiscoveryStatus)

	for _, u := range upstreams {
		nodes := s.parseNodes(u)
		s.applyHealthStatus(nodes, healthMap, u.ID)

		for _, n := range nodes {
			switch n.Status {
			case "healthy":
				overview.HealthyNodes++
			case "unhealthy":
				overview.UnhealthyNodes++
			default:
				// unknown nodes count as healthy for overview purposes
				overview.HealthyNodes++
			}
		}

		dt := s.detectDiscoveryType(u)
		ds, ok := discoveryMap[dt]
		if !ok {
			ds = &model.DiscoveryStatus{
				Type:   dt,
				Status: "active",
			}
			discoveryMap[dt] = ds
		}
		ds.Count++
	}

	// Convert map to sorted slice
	types := make([]model.DiscoveryStatus, 0, len(discoveryMap))
	for _, ds := range discoveryMap {
		types = append(types, *ds)
	}
	sort.Slice(types, func(i, j int) bool {
		return types[i].Type < types[j].Type
	})
	overview.DiscoveryTypes = types

	return overview, nil
}

// ListServices returns all upstreams with discovery info, nodes, and cross-referenced routes.
func (s *MeshService) ListServices(ctx context.Context) ([]model.MeshService, error) {
	client := s.registry.Fallback()

	var (
		upstreams  []apisixUpstream
		routes     []apisixRoute
		services   []apisixService
		healthMap  map[string][]healthNode
		wg         sync.WaitGroup
		mu         sync.Mutex
		firstError error
	)

	wg.Add(4)
	go func() {
		defer wg.Done()
		u, err := s.fetchUpstreams(ctx, client)
		mu.Lock()
		upstreams = u
		if err != nil && firstError == nil {
			firstError = err
		}
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		r, err := s.fetchRoutes(ctx, client)
		mu.Lock()
		routes = r
		if err != nil && firstError == nil {
			firstError = err
		}
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		sv, err := s.fetchServices(ctx, client)
		mu.Lock()
		services = sv
		if err != nil && firstError == nil {
			firstError = err
		}
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		h := s.fetchHealthChecks(ctx, client)
		mu.Lock()
		healthMap = h
		mu.Unlock()
	}()
	wg.Wait()

	if firstError != nil {
		return nil, firstError
	}

	// Build route-to-upstream mapping (both direct upstream_id and via service_id -> upstream_id)
	routesByUpstream := s.buildRoutesByUpstream(routes, services)

	result := make([]model.MeshService, 0, len(upstreams))
	for _, u := range upstreams {
		ms := s.buildMeshService(u, routesByUpstream, healthMap)
		result = append(result, ms)
	}

	// Sort by name for consistent output
	sort.Slice(result, func(i, j int) bool {
		return result[i].Name < result[j].Name
	})

	return result, nil
}

// GetService returns detailed information for a single upstream/service.
func (s *MeshService) GetService(ctx context.Context, id string) (*model.MeshService, error) {
	client := s.registry.Fallback()

	// Fetch the specific upstream
	body, err := client.Get(ctx, "upstreams", id)
	if err != nil {
		return nil, fmt.Errorf("getting upstream %s: %w", id, err)
	}

	// The Get method returns the full APISIX single response
	var singleResp struct {
		Value json.RawMessage `json:"value"`
	}
	if err := json.Unmarshal(body, &singleResp); err != nil {
		// Might be the value directly (depends on APISIX version)
		singleResp.Value = body
	}

	valueBytes := singleResp.Value
	if valueBytes == nil {
		valueBytes = body
	}

	var u apisixUpstream
	if err := json.Unmarshal(valueBytes, &u); err != nil {
		return nil, fmt.Errorf("parsing upstream %s: %w", id, err)
	}
	if u.ID == "" {
		u.ID = id
	}

	// Fetch routes and services in parallel for cross-referencing
	var (
		routes    []apisixRoute
		aServices []apisixService
		healthMap map[string][]healthNode
		wg        sync.WaitGroup
		mu        sync.Mutex
	)

	wg.Add(3)
	go func() {
		defer wg.Done()
		r, err := s.fetchRoutes(ctx, client)
		if err != nil {
			s.logger.Warn("failed to fetch routes for service detail", zap.Error(err))
		}
		mu.Lock()
		routes = r
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		sv, err := s.fetchServices(ctx, client)
		if err != nil {
			s.logger.Warn("failed to fetch services for service detail", zap.Error(err))
		}
		mu.Lock()
		aServices = sv
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		h := s.fetchHealthChecks(ctx, client)
		mu.Lock()
		healthMap = h
		mu.Unlock()
	}()
	wg.Wait()

	routesByUpstream := s.buildRoutesByUpstream(routes, aServices)
	ms := s.buildMeshService(u, routesByUpstream, healthMap)

	return &ms, nil
}

// GetTopology builds a dependency graph by scanning routes -> upstreams -> services.
func (s *MeshService) GetTopology(ctx context.Context) (*model.MeshTopology, error) {
	client := s.registry.Fallback()

	var (
		upstreams  []apisixUpstream
		routes     []apisixRoute
		aServices  []apisixService
		healthMap  map[string][]healthNode
		wg         sync.WaitGroup
		mu         sync.Mutex
		firstError error
	)

	wg.Add(4)
	go func() {
		defer wg.Done()
		u, err := s.fetchUpstreams(ctx, client)
		mu.Lock()
		upstreams = u
		if err != nil && firstError == nil {
			firstError = err
		}
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		r, err := s.fetchRoutes(ctx, client)
		mu.Lock()
		routes = r
		if err != nil && firstError == nil {
			firstError = err
		}
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		sv, err := s.fetchServices(ctx, client)
		mu.Lock()
		aServices = sv
		if err != nil && firstError == nil {
			firstError = err
		}
		mu.Unlock()
	}()
	go func() {
		defer wg.Done()
		h := s.fetchHealthChecks(ctx, client)
		mu.Lock()
		healthMap = h
		mu.Unlock()
	}()
	wg.Wait()

	if firstError != nil {
		return nil, firstError
	}

	routesByUpstream := s.buildRoutesByUpstream(routes, aServices)

	// Build mesh services
	meshServices := make([]model.MeshService, 0, len(upstreams))
	for _, u := range upstreams {
		ms := s.buildMeshService(u, routesByUpstream, healthMap)
		meshServices = append(meshServices, ms)
	}
	sort.Slice(meshServices, func(i, j int) bool {
		return meshServices[i].Name < meshServices[j].Name
	})

	// Build dependency edges
	dependencies := s.buildDependencies(routes, aServices, upstreams)

	return &model.MeshTopology{
		Services:     meshServices,
		Dependencies: dependencies,
	}, nil
}

// GetDiscoveryStatus returns the status of each discovery type found in the configured upstreams.
func (s *MeshService) GetDiscoveryStatus(ctx context.Context) ([]model.DiscoveryStatus, error) {
	client := s.registry.Fallback()

	upstreams, err := s.fetchUpstreams(ctx, client)
	if err != nil {
		return nil, err
	}

	healthMap := s.fetchHealthChecks(ctx, client)

	discoveryMap := make(map[string]*model.DiscoveryStatus)
	for _, u := range upstreams {
		dt := s.detectDiscoveryType(u)

		ds, ok := discoveryMap[dt]
		if !ok {
			ds = &model.DiscoveryStatus{
				Type:   dt,
				Status: "active",
			}
			discoveryMap[dt] = ds
		}
		ds.Count++

		// Check if any nodes are unhealthy — mark discovery status accordingly
		nodes := s.parseNodes(u)
		s.applyHealthStatus(nodes, healthMap, u.ID)
		for _, n := range nodes {
			if n.Status == "unhealthy" {
				ds.Status = "degraded"
				ds.Details = "one or more nodes are unhealthy"
				break
			}
		}
	}

	result := make([]model.DiscoveryStatus, 0, len(discoveryMap))
	for _, ds := range discoveryMap {
		result = append(result, *ds)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Type < result[j].Type
	})

	return result, nil
}

// ----- Internal helpers -----

// buildMeshService converts an APISIX upstream into a model.MeshService with nodes and route references.
func (s *MeshService) buildMeshService(u apisixUpstream, routesByUpstream map[string][]string, healthMap map[string][]healthNode) model.MeshService {
	nodes := s.parseNodes(u)
	s.applyHealthStatus(nodes, healthMap, u.ID)

	healthy := 0
	unhealthy := 0
	for _, n := range nodes {
		switch n.Status {
		case "healthy":
			healthy++
		case "unhealthy":
			unhealthy++
		default:
			healthy++ // unknown counts as healthy
		}
	}

	name := u.Name
	if name == "" {
		name = u.Desc
	}
	if name == "" {
		name = "upstream-" + u.ID
	}

	routeIDs := routesByUpstream[u.ID]
	if routeIDs == nil {
		routeIDs = []string{}
	}

	return model.MeshService{
		ID:             u.ID,
		Name:           name,
		DiscoveryType:  s.detectDiscoveryType(u),
		Upstream:       u.ID,
		Nodes:          nodes,
		HealthyCount:   healthy,
		UnhealthyCount: unhealthy,
		TotalCount:     len(nodes),
		Routes:         routeIDs,
	}
}

// parseNodes extracts ServiceNode entries from an upstream's nodes field.
// APISIX supports two formats:
//   - Object: {"host:port": weight, ...}
//   - Array:  [{"host": "...", "port": 80, "weight": 1}, ...]
func (s *MeshService) parseNodes(u apisixUpstream) []model.ServiceNode {
	if u.Nodes == nil || len(u.Nodes) == 0 {
		// Discovery-based upstreams may have no static nodes
		if u.ServiceName != "" {
			return []model.ServiceNode{
				{
					ID:     u.ServiceName,
					Host:   u.ServiceName,
					Port:   0,
					Weight: 1,
					Status: "unknown",
					Metadata: map[string]string{
						"discovery": u.DiscoveryType,
						"service":   u.ServiceName,
					},
				},
			}
		}
		return []model.ServiceNode{}
	}

	// Try array format first: [{"host": "...", "port": 80, "weight": 1}]
	var nodeArray []struct {
		Host     string `json:"host"`
		Port     int    `json:"port"`
		Weight   int    `json:"weight"`
		Priority int    `json:"priority,omitempty"`
	}
	if err := json.Unmarshal(u.Nodes, &nodeArray); err == nil && len(nodeArray) > 0 {
		result := make([]model.ServiceNode, 0, len(nodeArray))
		for i, n := range nodeArray {
			result = append(result, model.ServiceNode{
				ID:       fmt.Sprintf("%s-%d", u.ID, i),
				Host:     n.Host,
				Port:     n.Port,
				Weight:   n.Weight,
				Priority: n.Priority,
				Status:   "unknown",
			})
		}
		return result
	}

	// Try object format: {"host:port": weight}
	var nodeMap map[string]json.Number
	if err := json.Unmarshal(u.Nodes, &nodeMap); err == nil && len(nodeMap) > 0 {
		result := make([]model.ServiceNode, 0, len(nodeMap))
		i := 0
		for addr, weightNum := range nodeMap {
			host, port := parseHostPort(addr)
			weight, _ := weightNum.Int64()
			if weight == 0 {
				weight = 1
			}
			result = append(result, model.ServiceNode{
				ID:     fmt.Sprintf("%s-%d", u.ID, i),
				Host:   host,
				Port:   port,
				Weight: int(weight),
				Status: "unknown",
			})
			i++
		}
		// Sort by host for deterministic output
		sort.Slice(result, func(a, b int) bool {
			if result[a].Host == result[b].Host {
				return result[a].Port < result[b].Port
			}
			return result[a].Host < result[b].Host
		})
		return result
	}

	s.logger.Debug("unable to parse upstream nodes", zap.String("upstream_id", u.ID))
	return []model.ServiceNode{}
}

// applyHealthStatus overlays Control API health check data onto parsed nodes.
func (s *MeshService) applyHealthStatus(nodes []model.ServiceNode, healthMap map[string][]healthNode, upstreamID string) {
	if healthMap == nil {
		return
	}

	// Health checker keys may be /apisix/routes/{id} or /apisix/upstreams/{id}
	// We try several key patterns.
	var healthNodes []healthNode
	for key, hn := range healthMap {
		if strings.Contains(key, "/"+upstreamID) {
			healthNodes = append(healthNodes, hn...)
		}
	}

	if len(healthNodes) == 0 {
		return
	}

	// Build a lookup: "host:port" -> status
	statusLookup := make(map[string]string, len(healthNodes))
	for _, hn := range healthNodes {
		key := fmt.Sprintf("%s:%d", hn.Host, hn.Port)
		statusLookup[key] = hn.Status
	}

	for i := range nodes {
		key := fmt.Sprintf("%s:%d", nodes[i].Host, nodes[i].Port)
		if status, ok := statusLookup[key]; ok {
			nodes[i].Status = status
		}
	}
}

// detectDiscoveryType determines what discovery mechanism an upstream uses.
func (s *MeshService) detectDiscoveryType(u apisixUpstream) string {
	if u.DiscoveryType != "" {
		return u.DiscoveryType
	}
	if u.ServiceName != "" {
		// Has a service name but no explicit discovery_type — likely DNS-based
		return "dns"
	}
	// Static nodes configuration
	return "static"
}

// buildRoutesByUpstream creates a map of upstream ID -> slice of route IDs that reference it.
// It resolves both direct upstream_id references in routes and indirect references via APISIX services.
func (s *MeshService) buildRoutesByUpstream(routes []apisixRoute, aServices []apisixService) map[string][]string {
	// First, map APISIX service ID -> upstream ID
	svcToUpstream := make(map[string]string, len(aServices))
	for _, svc := range aServices {
		if svc.UpstreamID != "" {
			svcToUpstream[svc.ID] = svc.UpstreamID
		}
		// If the service has an inline upstream, we skip it (no upstream_id to reference)
	}

	routesByUpstream := make(map[string][]string)
	for _, r := range routes {
		var upstreamID string

		if r.UpstreamID != "" {
			upstreamID = r.UpstreamID
		} else if r.ServiceID != "" {
			// Resolve through APISIX service
			upstreamID = svcToUpstream[r.ServiceID]
		}
		// Routes with inline upstream (r.Upstream != nil) are associated with
		// a virtual upstream; we skip them since there is no upstream resource to map to.

		if upstreamID != "" {
			routesByUpstream[upstreamID] = append(routesByUpstream[upstreamID], r.ID)
		}
	}

	return routesByUpstream
}

// buildDependencies creates directed edges for the topology graph.
// Edges flow from route -> service -> upstream to represent the request path.
func (s *MeshService) buildDependencies(routes []apisixRoute, aServices []apisixService, upstreams []apisixUpstream) []model.ServiceDependency {
	var deps []model.ServiceDependency
	seen := make(map[string]bool) // "source->target" dedup key

	// Build upstream name lookup
	upstreamNames := make(map[string]string, len(upstreams))
	for _, u := range upstreams {
		name := u.Name
		if name == "" {
			name = u.Desc
		}
		if name == "" {
			name = "upstream-" + u.ID
		}
		upstreamNames[u.ID] = name
	}

	// Build service name/upstream lookup
	svcNames := make(map[string]string, len(aServices))
	svcToUpstream := make(map[string]string, len(aServices))
	for _, svc := range aServices {
		name := svc.Name
		if name == "" {
			name = "service-" + svc.ID
		}
		svcNames[svc.ID] = name
		if svc.UpstreamID != "" {
			svcToUpstream[svc.ID] = svc.UpstreamID
		}
	}

	for _, r := range routes {
		routeName := r.Name
		if routeName == "" {
			routeName = r.URI
		}
		if routeName == "" && len(r.URIs) > 0 {
			routeName = r.URIs[0]
		}
		if routeName == "" {
			routeName = "route-" + r.ID
		}

		if r.UpstreamID != "" {
			// Direct route -> upstream
			edgeKey := routeName + "->" + upstreamNames[r.UpstreamID]
			if !seen[edgeKey] {
				deps = append(deps, model.ServiceDependency{
					Source: routeName,
					Target: upstreamNames[r.UpstreamID],
					Type:   "route",
					Label:  r.URI,
				})
				seen[edgeKey] = true
			}
		} else if r.ServiceID != "" {
			svcName := svcNames[r.ServiceID]
			if svcName == "" {
				svcName = "service-" + r.ServiceID
			}

			// Route -> APISIX service
			edgeKey := routeName + "->" + svcName
			if !seen[edgeKey] {
				deps = append(deps, model.ServiceDependency{
					Source: routeName,
					Target: svcName,
					Type:   "route",
					Label:  r.URI,
				})
				seen[edgeKey] = true
			}

			// APISIX service -> upstream
			if upstreamID, ok := svcToUpstream[r.ServiceID]; ok {
				edgeKey = svcName + "->" + upstreamNames[upstreamID]
				if !seen[edgeKey] {
					deps = append(deps, model.ServiceDependency{
						Source: svcName,
						Target: upstreamNames[upstreamID],
						Type:   "route",
					})
					seen[edgeKey] = true
				}
			}
		}

		// Scan plugins for proxy-rewrite or traffic-split references to other upstreams
		if r.Plugins != nil {
			pluginDeps := s.extractPluginDependencies(routeName, r.Plugins, upstreamNames)
			for _, pd := range pluginDeps {
				edgeKey := pd.Source + "->" + pd.Target
				if !seen[edgeKey] {
					deps = append(deps, pd)
					seen[edgeKey] = true
				}
			}
		}
	}

	// Sort for deterministic output
	sort.Slice(deps, func(i, j int) bool {
		if deps[i].Source == deps[j].Source {
			return deps[i].Target < deps[j].Target
		}
		return deps[i].Source < deps[j].Source
	})

	return deps
}

// extractPluginDependencies scans route plugins for upstream references (e.g., traffic-split).
func (s *MeshService) extractPluginDependencies(routeName string, pluginsRaw json.RawMessage, upstreamNames map[string]string) []model.ServiceDependency {
	var plugins map[string]json.RawMessage
	if err := json.Unmarshal(pluginsRaw, &plugins); err != nil {
		return nil
	}

	var deps []model.ServiceDependency

	// Check traffic-split plugin for weighted_upstreams
	if trafficSplit, ok := plugins["traffic-split"]; ok {
		var ts struct {
			Rules []struct {
				WeightedUpstreams []struct {
					UpstreamID string `json:"upstream_id"`
					Weight     int    `json:"weight"`
				} `json:"weighted_upstreams"`
			} `json:"rules"`
		}
		if err := json.Unmarshal(trafficSplit, &ts); err == nil {
			for _, rule := range ts.Rules {
				for _, wu := range rule.WeightedUpstreams {
					if wu.UpstreamID != "" {
						target := upstreamNames[wu.UpstreamID]
						if target == "" {
							target = "upstream-" + wu.UpstreamID
						}
						deps = append(deps, model.ServiceDependency{
							Source: routeName,
							Target: target,
							Type:   "plugin_reference",
							Label:  fmt.Sprintf("traffic-split (weight: %d)", wu.Weight),
						})
					}
				}
			}
		}
	}

	return deps
}

// ----- Utility functions -----

// extractIDFromKey pulls the last path segment from an etcd key like "/apisix/upstreams/123".
func extractIDFromKey(key string) string {
	parts := strings.Split(key, "/")
	if len(parts) > 0 {
		return parts[len(parts)-1]
	}
	return key
}

// parseHostPort splits "host:port" into separate values.
// If no port is present, returns port 0.
func parseHostPort(addr string) (string, int) {
	// Handle IPv6: [::1]:8080
	if strings.HasPrefix(addr, "[") {
		if idx := strings.LastIndex(addr, "]:"); idx != -1 {
			host := addr[1:idx]
			portStr := addr[idx+2:]
			port := 0
			fmt.Sscanf(portStr, "%d", &port)
			return host, port
		}
		return strings.Trim(addr, "[]"), 0
	}

	// Standard IPv4 or hostname: host:port
	idx := strings.LastIndex(addr, ":")
	if idx == -1 {
		return addr, 0
	}

	host := addr[:idx]
	portStr := addr[idx+1:]
	port := 0
	fmt.Sscanf(portStr, "%d", &port)
	return host, port
}
