// Shared plugin registry — fetches all plugins from APISIX API,
// enriches with hardcoded metadata, and caches at module level.

import {
  PLUGINS,
  PLUGIN_CATEGORIES,
  type PluginCategory,
  type PluginPhase,
} from "@/lib/constants"
import { api } from "@/lib/api-client"

// --- Enriched plugin type ---

export interface EnrichedPlugin {
  name: string
  label: string
  description: string
  category: PluginCategory | null
  phase: PluginPhase | null
  icon: string | null
}

// --- Extra descriptions for plugins beyond the managed ones ---

const EXTRA_DESCRIPTIONS: Record<string, string> = {
  "authz-keycloak": "Authorization with Keycloak",
  "authz-casbin": "Authorization with Casbin",
  "wolf-rbac": "Role-based access control with Wolf",
  "ua-restriction": "Restrict access by User-Agent",
  "referer-restriction": "Restrict access by Referer header",
  "grpc-web": "Support gRPC-Web protocol",
  "echo": "Echo request back as response",
  "serverless-pre-function": "Run serverless functions before proxying",
  "serverless-post-function": "Run serverless functions after proxying",
  "batch-requests": "Batch multiple requests into one",
  "proxy-mirror": "Mirror traffic to another upstream",
  "skywalking": "Distributed tracing with SkyWalking",
  "datadog": "Send metrics to Datadog",
  "node-status": "Expose node status information",
  "tcp-logger": "Log requests to TCP endpoint",
  "udp-logger": "Log requests to UDP endpoint",
  "rocketmq-logger": "Log requests to RocketMQ",
  "file-logger": "Log requests to file",
  "sls-logger": "Log requests to Alibaba Cloud SLS",
  "google-cloud-logging": "Log requests to Google Cloud Logging",
  "loggly": "Log requests to Loggly",
  "splunk-hec-logging": "Log requests to Splunk HEC",
  "elasticsearch-logger": "Log requests to Elasticsearch",
  "clickhouse-logger": "Log requests to ClickHouse",
  "real-ip": "Dynamically determine client real IP",
  "ext-plugin-pre-req": "External plugin before request",
  "ext-plugin-post-req": "External plugin after request",
  "ext-plugin-post-resp": "External plugin after response",
  "gzip": "Compress responses with gzip",
  "api-breaker": "Circuit breaker for upstream protection",
  "mocking": "Mock API responses",
  "client-control": "Control client request behavior",
  "proxy-control": "Control proxy behavior",
  "workflow": "Complex condition-based workflow",
  "http-callout": "Call external services during request processing",
  "data-masking": "Redact PII from API response bodies",
  "threat-protection": "Detect and block payload-based attacks",
}

// --- Heuristic classification for unknown plugins ---

export function classifyPlugin(name: string): { category: PluginCategory | null; phase: PluginPhase | null } {
  let category: PluginCategory | null = null
  let phase: PluginPhase | null = null

  if (name.includes("auth") || name.includes("rbac") || name === "openid-connect") {
    category = "authentication"
    phase = "request"
  } else if (name.includes("restriction") || name === "cors" || name === "csrf" || name === "uri-blocker") {
    category = "security"
    phase = name === "cors" ? "response" : "request"
  } else if (name.includes("limit") || name.includes("traffic") || name.includes("cache") || name === "request-id" || name === "api-breaker" || name === "proxy-mirror" || name === "client-control" || name === "proxy-control") {
    category = "traffic"
    phase = "request"
  } else if (name.includes("rewrite") || name.includes("redirect") || name.includes("transcode") || name.includes("grpc") || name === "fault-injection" || name === "echo" || name === "mocking" || name.includes("serverless") || name === "batch-requests" || name === "workflow" || name === "gzip" || name === "real-ip") {
    category = "transformation"
    phase = name.includes("response") ? "response" : "request"
  } else if (name.includes("logger") || name.includes("log") || name === "prometheus" || name === "datadog" || name === "zipkin" || name === "skywalking" || name === "opentelemetry" || name === "node-status") {
    category = "observability"
    phase = "observability"
  }

  return { category, phase }
}

// --- Enrich a plugin name with metadata ---

export function enrichPlugin(name: string): EnrichedPlugin {
  const def = PLUGINS.find((p) => p.name === name)
  if (def) {
    return {
      name: def.name,
      label: def.label,
      description: def.description,
      category: def.category,
      phase: def.phase,
      icon: def.icon,
    }
  }

  const classified = classifyPlugin(name)
  return {
    name,
    label: name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
    description: EXTRA_DESCRIPTIONS[name] || "API Gateway plugin",
    category: classified.category,
    phase: classified.phase,
    icon: null,
  }
}

// --- Module-level cache ---

let pluginListCache: EnrichedPlugin[] | null = null
let fetchPromise: Promise<EnrichedPlugin[]> | null = null

export function getCachedPlugins(): EnrichedPlugin[] | null {
  return pluginListCache
}

export function getDefaultPlugins(): EnrichedPlugin[] {
  return PLUGINS.map((p) => enrichPlugin(p.name))
}

/**
 * Fetch all plugins from the APISIX API, enrich and cache them.
 * Returns cached result on subsequent calls.
 */
export async function fetchAllPlugins(): Promise<EnrichedPlugin[]> {
  if (pluginListCache) return pluginListCache

  // Deduplicate concurrent calls
  if (fetchPromise) return fetchPromise

  fetchPromise = api
    .listPlugins()
    .then((data) => {
      if (Array.isArray(data)) {
        const enriched = (data as string[]).map(enrichPlugin)
        enriched.sort((a, b) => {
          const aMgd = PLUGINS.some((p) => p.name === a.name) ? 0 : 1
          const bMgd = PLUGINS.some((p) => p.name === b.name) ? 0 : 1
          if (aMgd !== bMgd) return aMgd - bMgd
          return a.label.localeCompare(b.label)
        })
        pluginListCache = enriched
        return enriched
      }
      const fallback = getDefaultPlugins()
      pluginListCache = fallback
      return fallback
    })
    .catch(() => {
      const fallback = getDefaultPlugins()
      pluginListCache = fallback
      return fallback
    })
    .finally(() => {
      fetchPromise = null
    })

  return fetchPromise
}

// --- Filtered helpers ---

export function filterByPhase(plugins: EnrichedPlugin[], phase: PluginPhase): EnrichedPlugin[] {
  return plugins.filter((p) => p.phase === phase)
}

export function filterByCategory(plugins: EnrichedPlugin[], category: PluginCategory): EnrichedPlugin[] {
  return plugins.filter((p) => p.category === category)
}

export function groupByCategory(plugins: EnrichedPlugin[]) {
  const groups: { category: PluginCategory | "other"; label: string; color: string; plugins: EnrichedPlugin[] }[] = []
  for (const cat of PLUGIN_CATEGORIES) {
    const items = plugins.filter((p) => p.category === cat.value)
    if (items.length > 0) {
      groups.push({ category: cat.value, label: cat.label, color: cat.color, plugins: items })
    }
  }
  const uncategorized = plugins.filter((p) => p.category === null)
  if (uncategorized.length > 0) {
    groups.push({ category: "other", label: "Other", color: "bg-gray-500", plugins: uncategorized })
  }
  return groups
}
