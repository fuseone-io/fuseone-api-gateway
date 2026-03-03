package model

// ServiceNode represents a single backend node within an upstream.
type ServiceNode struct {
	ID       string            `json:"id"`
	Host     string            `json:"host"`
	Port     int               `json:"port"`
	Weight   int               `json:"weight"`
	Priority int               `json:"priority"`
	Status   string            `json:"status"` // healthy, unhealthy, unknown
	Metadata map[string]string `json:"metadata,omitempty"`
}

// MeshService represents an upstream with its discovered nodes and route references.
type MeshService struct {
	ID             string        `json:"id"`
	Name           string        `json:"name"`
	DiscoveryType  string        `json:"discovery_type"` // dns, consul, nacos, eureka, kubernetes
	Upstream       string        `json:"upstream_id"`
	Nodes          []ServiceNode `json:"nodes"`
	HealthyCount   int           `json:"healthy_count"`
	UnhealthyCount int           `json:"unhealthy_count"`
	TotalCount     int           `json:"total_count"`
	Routes         []string      `json:"routes"` // route IDs that reference this upstream
}

// ServiceDependency represents a directed edge between two services in the topology graph.
type ServiceDependency struct {
	Source string `json:"source"` // upstream/service name
	Target string `json:"target"` // upstream/service name
	Type   string `json:"type"`   // route, plugin_reference
	Label  string `json:"label,omitempty"`
}

// MeshTopology is the complete service dependency graph.
type MeshTopology struct {
	Services     []MeshService       `json:"services"`
	Dependencies []ServiceDependency `json:"dependencies"`
}

// DiscoveryStatus reports the health of a service discovery mechanism.
type DiscoveryStatus struct {
	Type    string `json:"type"`    // dns, consul, nacos, etc.
	Status  string `json:"status"`  // active, error, unknown
	Count   int    `json:"count"`   // number of services discovered
	Details string `json:"details,omitempty"`
}

// MeshOverview provides aggregate statistics about the service mesh.
type MeshOverview struct {
	TotalServices  int               `json:"total_services"`
	HealthyNodes   int               `json:"healthy_nodes"`
	UnhealthyNodes int               `json:"unhealthy_nodes"`
	DiscoveryTypes []DiscoveryStatus `json:"discovery_types"`
}
