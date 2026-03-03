export interface ServiceNode {
  id: string
  host: string
  port: number
  weight: number
  priority: number
  status: "healthy" | "unhealthy" | "unknown"
  metadata?: Record<string, string>
}

export interface MeshService {
  id: string
  name: string
  discovery_type: string
  upstream_id: string
  nodes: ServiceNode[]
  healthy_count: number
  unhealthy_count: number
  total_count: number
  routes: string[]
}

export interface ServiceDependency {
  source: string
  target: string
  type: "route" | "plugin_reference"
  label?: string
}

export interface MeshTopology {
  services: MeshService[]
  dependencies: ServiceDependency[]
}

export interface DiscoveryStatus {
  type: string
  status: "active" | "error" | "unknown"
  count: number
  details?: string
}

export interface MeshOverview {
  total_services: number
  healthy_nodes: number
  unhealthy_nodes: number
  discovery_types: DiscoveryStatus[]
}
