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
  routeId?: string // APISIX Route ID (set after first save)
  name: string // user-friendly name

  // Entrypoint (per-flow, maps to Route matching)
  entrypoint: {
    uri: string
    hosts: string[]
    methods: string[]
  }

  // Policies (per-flow, organized by phase)
  policies: PolicyInstance[]
}

// An API is a collection of flows sharing a common endpoint (upstream)
export interface ApiDefinition {
  id?: string // APISIX Service ID (for multi-flow APIs) or Route ID (legacy)
  name: string
  description: string
  status: "enabled" | "disabled"

  // Endpoint (shared, maps to APISIX Upstream on Service)
  endpoint: {
    nodes: { host: string; port: number; weight: number }[]
    type: "roundrobin" | "chash" | "ewma" | "least_conn"
    scheme: "http" | "https" | "grpc" | "grpcs"
    retries?: number
    timeout?: { connect: number; send: number; read: number }
    healthCheck?: {
      enabled: boolean
      path: string
      interval: number
    }
  }

  // Multiple flows, each maps to an APISIX Route
  flows: ApiFlow[]

  // APISIX Service ID (set after first save for multi-flow APIs)
  serviceId?: string

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

// Helper: get the first (or active) flow
export function getActiveFlow(api: ApiDefinition): ApiFlow | undefined {
  return api.flows[0]
}

// --- Conversion helpers ---

function buildUpstreamNodes(endpoint: ApiDefinition["endpoint"]): Record<string, number> {
  const nodes: Record<string, number> = {}
  for (const node of endpoint.nodes) {
    nodes[`${node.host}:${node.port}`] = node.weight
  }
  return nodes
}

function buildUpstreamChecks(endpoint: ApiDefinition["endpoint"]) {
  if (!endpoint.healthCheck?.enabled) return undefined
  return {
    active: {
      type: "http" as const,
      http_path: endpoint.healthCheck.path,
      healthy: { interval: endpoint.healthCheck.interval, successes: 2 },
      unhealthy: { interval: endpoint.healthCheck.interval, http_failures: 3 },
    },
  }
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
  rawNodes: Record<string, number> | { host: string; port: number; weight: number }[]
): { host: string; port: number; weight: number }[] {
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
  const rawNodes = (upstream.nodes || {}) as Record<string, number> | { host: string; port: number; weight: number }[]
  const checks = upstream.checks as Record<string, unknown> | undefined
  const activeCheck = checks?.active as Record<string, unknown> | undefined
  const healthy = activeCheck?.healthy as Record<string, unknown> | undefined

  return {
    nodes: parseNodes(rawNodes),
    type: (upstream.type as "roundrobin") || "roundrobin",
    scheme: (upstream.scheme as "http") || "http",
    retries: upstream.retries as number | undefined,
    timeout: upstream.timeout as { connect: number; send: number; read: number } | undefined,
    healthCheck: activeCheck
      ? {
          enabled: true,
          path: (activeCheck.http_path as string) || "/health",
          interval: (healthy?.interval as number) || 5,
        }
      : undefined,
  }
}

// Convert ApiDefinition to APISIX Service + N Routes
export function apiToAPISIX(api: ApiDefinition) {
  const nodes = buildUpstreamNodes(api.endpoint)

  const service = {
    name: api.name,
    desc: api.description,
    labels: api.labels,
    upstream: {
      type: api.endpoint.type,
      scheme: api.endpoint.scheme,
      nodes,
      retries: api.endpoint.retries,
      timeout: api.endpoint.timeout,
      checks: buildUpstreamChecks(api.endpoint),
    },
  }

  const routes = api.flows.map((flow) => ({
    flowId: flow.id,
    routeId: flow.routeId,
    data: {
      name: api.flows.length > 1 ? `${api.name} - ${flow.name}` : api.name,
      desc: api.description,
      uri: flow.entrypoint.uri,
      hosts: flow.entrypoint.hosts.length > 0 ? flow.entrypoint.hosts : undefined,
      methods: flow.entrypoint.methods.length > 0 ? flow.entrypoint.methods : undefined,
      status: api.status === "enabled" ? 1 : 0,
      plugins: buildPlugins(flow.policies),
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
