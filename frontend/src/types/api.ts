// Unified "API" abstraction that maps to APISIX Service + N Routes + Upstream + Plugins

import { getPluginDef } from "@/lib/constants"

// --- Secrets ---

export interface Secret {
  id: string
  name: string
  description: string
  tags: string[]
  created_by?: string
  created_at: string
  updated_at: string
}

export interface SecretManager {
  id: string
  name: string
  type: "vault" | "aws" | "gcp" | "env"
  config: Record<string, unknown>
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

// A single flow within an API — maps to 1 APISIX Route
export interface ApiFlow {
  id: string // client-side UUID for tracking
  routeId?: string // APISIX Route ID (primary, e.g. path-based)
  routeIds?: Record<string, string> // additional route IDs by strategy: { path, header, default }
  name: string // user-friendly name
  description?: string // optional comment/description

  // Entrypoint (per-flow, maps to Route matching)
  entrypoint: {
    uri: string
    hosts: string[]
    methods: string[]
  }

  // Policies (per-flow, organized by phase)
  policies: PolicyInstance[]

  // Policy Template (APISIX plugin_config reference)
  policyTemplateId?: string   // APISIX plugin_config ID
  policyTemplateName?: string // Cached display name (from desc)
}

// An API is a collection of flows sharing a common endpoint (upstream)
export interface ApiDefinition {
  id?: string // APISIX Service ID (for multi-flow APIs) or Route ID (legacy)
  name: string
  description: string
  status: "enabled" | "disabled"

  // Endpoint (shared, maps to APISIX Upstream on Service)
  endpoint: {
    // Basic
    nodes: { host: string; port: number; weight: number; priority?: number }[]
    type: "roundrobin" | "chash" | "ewma" | "least_conn"
    scheme: "http" | "https" | "grpc" | "grpcs"
    retries?: number
    retry_timeout?: number

    // Host Header
    pass_host?: "pass" | "node" | "rewrite"
    upstream_host?: string

    // Timeouts
    timeout?: { connect: number; send: number; read: number }

    // Consistent Hashing (when type=chash)
    hash_on?: "vars" | "header" | "cookie" | "consumer" | "vars_combinations"
    key?: string

    // Keepalive Pool
    keepalive_pool?: { size: number; idle_timeout: number; requests: number }

    // Health Checks (full APISIX model)
    checks?: {
      active?: {
        type: "http" | "https" | "tcp"
        http_path?: string
        host?: string
        port?: number
        timeout?: number
        concurrency?: number
        https_verify_certificate?: boolean
        req_headers?: string[]
        healthy?: { interval?: number; successes?: number; http_statuses?: number[] }
        unhealthy?: { interval?: number; http_failures?: number; tcp_failures?: number; timeouts?: number; http_statuses?: number[] }
      }
      passive?: {
        type?: "http" | "https" | "tcp"
        healthy?: { successes?: number; http_statuses?: number[] }
        unhealthy?: { http_failures?: number; tcp_failures?: number; timeouts?: number; http_statuses?: number[] }
      }
    }

    // TLS/mTLS
    tls?: { client_cert?: string; client_key?: string; client_cert_id?: string }

    // Service Discovery (alternative to nodes)
    service_name?: string
    discovery_type?: string
  }

  // Multiple flows, each maps to an APISIX Route
  flows: ApiFlow[]

  // APISIX Service ID (set after first save for multi-flow APIs)
  serviceId?: string

  // Virtual hosts (API-level, applies to all routes)
  hosts?: string[] // e.g. ["api.fuseone.io", "*.internal.io"]

  // Context path & version routing
  context_path?: string // base path, e.g. "/payments"
  routing_mode?: RoutingMode // how version is routed
  is_default_version?: boolean // fallback when no version header

  // Metadata
  labels?: Record<string, string>
  created_at?: number
  updated_at?: number
}

export interface PolicyInstance {
  id: string // unique within this flow (for drag ordering)
  name: string // APISIX plugin name
  phase: "request" | "response" | "observability"
  enabled: boolean
  config: Record<string, unknown>
}

// --- API Definition Record (PostgreSQL draft/deploy) ---

export type LifecycleStatus = "draft" | "active" | "deprecated" | "retired"
export type RoutingMode = "none" | "path" | "header" | "both"

export interface ApiDefRecord {
  id: string
  name: string
  description: string
  definition: ApiDefinition
  sync_status: "draft" | "synced" | "out_of_sync"
  apisix_service_id?: string
  apisix_route_ids?: string[]
  deployed_at?: string
  created_by?: string
  created_at: string
  updated_at: string
  // Versioning
  version: string
  api_group_id: string
  cloned_from_id?: string
  // Lifecycle
  lifecycle_status: LifecycleStatus
  sunset_date?: string
}

export interface CloneApiRequest {
  version?: string
}

export interface DeprecateApiRequest {
  sunset_date?: string // ISO 8601
}

// Helper: get the first (or active) flow
export function getActiveFlow(api: ApiDefinition): ApiFlow | undefined {
  return api.flows[0]
}

// --- Conversion helpers ---

function buildUpstreamNodes(
  endpoint: ApiDefinition["endpoint"]
): Record<string, number> | { host: string; port: number; weight: number; priority?: number }[] {
  // Use array format if any node has priority set
  const hasPriority = endpoint.nodes.some((n) => n.priority != null && n.priority !== 0)
  if (hasPriority) {
    return endpoint.nodes.map((n) => {
      const node: { host: string; port: number; weight: number; priority?: number } = {
        host: n.host,
        port: n.port,
        weight: n.weight,
      }
      if (n.priority != null) node.priority = n.priority
      return node
    })
  }
  // Legacy object format
  const nodes: Record<string, number> = {}
  for (const node of endpoint.nodes) {
    nodes[`${node.host}:${node.port}`] = node.weight
  }
  return nodes
}

/** Strip undefined values from an object (shallow) */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v
  }
  return result as Partial<T>
}

function buildPlugins(policies: PolicyInstance[]): Record<string, unknown> | undefined {
  const plugins: Record<string, unknown> = {}
  for (const policy of policies) {
    if (policy.enabled) {
      plugins[policy.name] = policy.config
    }
  }
  return Object.keys(plugins).length > 0 ? plugins : undefined
}

function parseNodes(
  rawNodes: Record<string, number> | { host: string; port: number; weight: number; priority?: number }[]
): { host: string; port: number; weight: number; priority?: number }[] {
  if (Array.isArray(rawNodes)) return rawNodes
  return Object.entries(rawNodes).map(([addr, weight]) => {
    const [host, portStr] = addr.split(":")
    return { host, port: parseInt(portStr || "80"), weight }
  })
}

function parsePlugins(plugins: Record<string, Record<string, unknown>>): PolicyInstance[] {
  return Object.entries(plugins).map(([name, config]) => {
    const def = getPluginDef(name)
    return {
      id: crypto.randomUUID(),
      name,
      phase: def?.phase || "request",
      enabled: true,
      config: config || {},
    }
  })
}

function parseEndpoint(upstream: Record<string, unknown>): ApiDefinition["endpoint"] {
  const rawNodes = (upstream.nodes || {}) as
    | Record<string, number>
    | { host: string; port: number; weight: number; priority?: number }[]

  return {
    nodes: parseNodes(rawNodes),
    type: (upstream.type as "roundrobin") || "roundrobin",
    scheme: (upstream.scheme as "http") || "http",
    retries: upstream.retries as number | undefined,
    retry_timeout: upstream.retry_timeout as number | undefined,
    pass_host: upstream.pass_host as "pass" | "node" | "rewrite" | undefined,
    upstream_host: upstream.upstream_host as string | undefined,
    timeout: upstream.timeout as { connect: number; send: number; read: number } | undefined,
    hash_on: upstream.hash_on as "vars" | "header" | "cookie" | "consumer" | "vars_combinations" | undefined,
    key: upstream.key as string | undefined,
    keepalive_pool: upstream.keepalive_pool as { size: number; idle_timeout: number; requests: number } | undefined,
    checks: upstream.checks as ApiDefinition["endpoint"]["checks"],
    tls: upstream.tls as { client_cert?: string; client_key?: string; client_cert_id?: string } | undefined,
    service_name: upstream.service_name as string | undefined,
    discovery_type: upstream.discovery_type as string | undefined,
  }
}

// Convert ApiDefinition to APISIX Service + N Routes
export function apiToAPISIX(api: ApiDefinition) {
  const ep = api.endpoint
  const nodes = buildUpstreamNodes(ep)

  const upstream = stripUndefined({
    type: ep.type,
    scheme: ep.scheme,
    nodes,
    retries: ep.retries,
    retry_timeout: ep.retry_timeout,
    pass_host: ep.pass_host,
    upstream_host: ep.pass_host === "rewrite" ? ep.upstream_host : undefined,
    timeout: ep.timeout,
    hash_on: ep.type === "chash" ? ep.hash_on : undefined,
    key: ep.type === "chash" ? ep.key : undefined,
    keepalive_pool: ep.keepalive_pool,
    checks: ep.checks,
    tls: ep.tls,
    service_name: ep.service_name,
    discovery_type: ep.discovery_type,
  })

  const service = {
    name: api.name,
    desc: api.description,
    labels: api.labels,
    upstream,
  }

  const routes = api.flows.map((flow) => ({
    flowId: flow.id,
    routeId: flow.routeId,
    data: {
      name: api.flows.length > 1 ? `${api.name} - ${flow.name}` : api.name,
      desc: api.description,
      uri: flow.entrypoint.uri,
      hosts: flow.entrypoint.hosts.length > 0 ? flow.entrypoint.hosts : (api.hosts && api.hosts.length > 0 ? api.hosts : undefined),
      methods: flow.entrypoint.methods.length > 0 ? flow.entrypoint.methods : undefined,
      status: api.status === "enabled" ? 1 : 0,
      plugins: buildPlugins(flow.policies),
      plugin_config_id: flow.policyTemplateId || undefined,
      service_id: api.serviceId as string | undefined,
      labels: { ...api.labels, _fuseone_api: api.serviceId || "" } as Record<string, string>,
    },
  }))

  return { service, routes }
}

// Convert single APISIX Route (with inline upstream) to ApiDefinition
// Used for backward-compat (legacy single-route APIs without Service)
export function apisixToApi(route: Record<string, unknown>): ApiDefinition {
  const upstream = (route.upstream || {}) as Record<string, unknown>
  const plugins = (route.plugins || {}) as Record<string, Record<string, unknown>>

  return {
    id: route.id as string,
    name: (route.name as string) || "",
    description: (route.desc as string) || "",
    status: route.status === 1 ? "enabled" : "disabled",
    endpoint: parseEndpoint(upstream),
    flows: [
      {
        id: crypto.randomUUID(),
        routeId: route.id as string,
        name: "Default Flow",
        entrypoint: {
          uri: (route.uri as string) || "",
          hosts: (route.hosts as string[]) || (route.host ? [route.host as string] : []),
          methods: (route.methods as string[]) || [],
        },
        policies: parsePlugins(plugins),
        policyTemplateId: route.plugin_config_id as string | undefined,
      },
    ],
    serviceId: route.service_id as string | undefined,
    labels: route.labels as Record<string, string> | undefined,
    created_at: route.create_time as number | undefined,
    updated_at: route.update_time as number | undefined,
  }
}

// Convert APISIX Service + its Routes into a multi-flow ApiDefinition
export function apisixServiceToApi(
  service: Record<string, unknown>,
  routes: Record<string, unknown>[]
): ApiDefinition {
  const upstream = (service.upstream || {}) as Record<string, unknown>

  const flows: ApiFlow[] = routes.map((route) => {
    const plugins = (route.plugins || {}) as Record<string, Record<string, unknown>>
    return {
      id: crypto.randomUUID(),
      routeId: route.id as string,
      name: (route.name as string) || "Flow",
      entrypoint: {
        uri: (route.uri as string) || "",
        hosts: (route.hosts as string[]) || (route.host ? [route.host as string] : []),
        methods: (route.methods as string[]) || [],
      },
      policies: parsePlugins(plugins),
      policyTemplateId: route.plugin_config_id as string | undefined,
    }
  })

  // Ensure at least one flow
  if (flows.length === 0) {
    flows.push({
      id: crypto.randomUUID(),
      name: "Default Flow",
      entrypoint: { uri: "", hosts: [], methods: [] },
      policies: [],
    })
  }

  return {
    id: service.id as string,
    name: (service.name as string) || "",
    description: (service.desc as string) || "",
    status: "enabled",
    endpoint: parseEndpoint(upstream),
    flows,
    serviceId: service.id as string,
    labels: service.labels as Record<string, string> | undefined,
    created_at: service.create_time as number | undefined,
    updated_at: service.update_time as number | undefined,
  }
}
