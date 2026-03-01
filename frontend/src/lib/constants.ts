export const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as const

export const LOAD_BALANCER_TYPES = [
  { value: "roundrobin", label: "Round Robin" },
  { value: "chash", label: "Consistent Hashing" },
  { value: "ewma", label: "EWMA" },
  { value: "least_conn", label: "Least Connections" },
] as const

export const UPSTREAM_SCHEMES = [
  { value: "http", label: "HTTP" },
  { value: "https", label: "HTTPS" },
  { value: "grpc", label: "gRPC" },
  { value: "grpcs", label: "gRPCS" },
] as const

// Plugin categories mapped to APISIX execution phases
export type PluginPhase = "request" | "response" | "observability"

export interface PluginDefinition {
  name: string
  label: string
  description: string
  category: PluginCategory
  phase: PluginPhase
  icon: string // lucide icon name
}

export type PluginCategory =
  | "authentication"
  | "security"
  | "traffic"
  | "transformation"
  | "observability"

export const PLUGIN_CATEGORIES: { value: PluginCategory; label: string; color: string }[] = [
  { value: "authentication", label: "Authentication", color: "bg-blue-500" },
  { value: "security", label: "Security", color: "bg-red-500" },
  { value: "traffic", label: "Traffic Control", color: "bg-amber-500" },
  { value: "transformation", label: "Transformation", color: "bg-purple-500" },
  { value: "observability", label: "Observability", color: "bg-green-500" },
]

export const PLUGINS: PluginDefinition[] = [
  // Authentication (request phase)
  { name: "key-auth", label: "API Key", description: "Authenticate via API key header or query param", category: "authentication", phase: "request", icon: "Key" },
  { name: "basic-auth", label: "Basic Auth", description: "HTTP Basic Authentication", category: "authentication", phase: "request", icon: "Lock" },
  { name: "jwt-auth", label: "JWT", description: "JSON Web Token authentication", category: "authentication", phase: "request", icon: "ShieldCheck" },
  { name: "hmac-auth", label: "HMAC", description: "HMAC signature authentication", category: "authentication", phase: "request", icon: "Fingerprint" },
  { name: "openid-connect", label: "OpenID Connect", description: "OpenID Connect / OAuth2 authentication", category: "authentication", phase: "request", icon: "KeyRound" },
  { name: "forward-auth", label: "Forward Auth", description: "Forward authentication to external service", category: "authentication", phase: "request", icon: "ArrowRightLeft" },

  // Security (request phase)
  { name: "ip-restriction", label: "IP Restriction", description: "Allow or deny access by IP address", category: "security", phase: "request", icon: "Shield" },
  { name: "uri-blocker", label: "URI Blocker", description: "Block requests by URI pattern", category: "security", phase: "request", icon: "Ban" },
  { name: "cors", label: "CORS", description: "Cross-Origin Resource Sharing headers", category: "security", phase: "response", icon: "Globe" },
  { name: "csrf", label: "CSRF", description: "Cross-Site Request Forgery protection", category: "security", phase: "request", icon: "ShieldAlert" },
  { name: "consumer-restriction", label: "Consumer Restriction", description: "Restrict access to specific consumers", category: "security", phase: "request", icon: "UserX" },

  // Traffic Control (request phase)
  { name: "limit-req", label: "Rate Limit", description: "Limit request rate per time window", category: "traffic", phase: "request", icon: "Gauge" },
  { name: "limit-conn", label: "Concurrency Limit", description: "Limit concurrent connections", category: "traffic", phase: "request", icon: "Users" },
  { name: "limit-count", label: "Request Quota", description: "Limit total requests in a time window", category: "traffic", phase: "request", icon: "Hash" },
  { name: "traffic-split", label: "Traffic Split", description: "Split traffic between upstreams (canary)", category: "traffic", phase: "request", icon: "GitBranch" },
  { name: "request-id", label: "Request ID", description: "Add unique request ID header", category: "traffic", phase: "request", icon: "Fingerprint" },
  { name: "proxy-cache", label: "Proxy Cache", description: "Cache upstream responses", category: "traffic", phase: "request", icon: "Database" },

  // Transformation
  { name: "proxy-rewrite", label: "Proxy Rewrite", description: "Rewrite URI, host, or headers before proxying", category: "transformation", phase: "request", icon: "Replace" },
  { name: "response-rewrite", label: "Response Rewrite", description: "Rewrite response status, headers, or body", category: "transformation", phase: "response", icon: "FileOutput" },
  { name: "grpc-transcode", label: "gRPC Transcode", description: "Transcode HTTP requests to gRPC", category: "transformation", phase: "request", icon: "ArrowLeftRight" },
  { name: "fault-injection", label: "Fault Injection", description: "Inject delays or errors for testing", category: "transformation", phase: "request", icon: "Bug" },
  { name: "redirect", label: "Redirect", description: "HTTP redirect to another URI", category: "transformation", phase: "request", icon: "ExternalLink" },

  // Observability (log phase)
  { name: "prometheus", label: "Prometheus", description: "Export metrics to Prometheus", category: "observability", phase: "observability", icon: "BarChart3" },
  { name: "http-logger", label: "HTTP Logger", description: "Send access logs via HTTP", category: "observability", phase: "observability", icon: "Send" },
  { name: "kafka-logger", label: "Kafka Logger", description: "Send access logs to Kafka", category: "observability", phase: "observability", icon: "Radio" },
  { name: "syslog", label: "Syslog", description: "Send logs to syslog server", category: "observability", phase: "observability", icon: "FileText" },
  { name: "zipkin", label: "Zipkin", description: "Distributed tracing with Zipkin", category: "observability", phase: "observability", icon: "Network" },
  { name: "opentelemetry", label: "OpenTelemetry", description: "Export traces and metrics via OTLP", category: "observability", phase: "observability", icon: "Activity" },
]

export function getPluginsByPhase(phase: PluginPhase): PluginDefinition[] {
  return PLUGINS.filter((p) => p.phase === phase)
}

export function getPluginsByCategory(category: PluginCategory): PluginDefinition[] {
  return PLUGINS.filter((p) => p.category === category)
}

export function getPluginDef(name: string): PluginDefinition | undefined {
  return PLUGINS.find((p) => p.name === name)
}

export function getCategoryMeta(category: PluginCategory) {
  return PLUGIN_CATEGORIES.find((c) => c.value === category)
}
