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
  | "ai"

export const PLUGIN_CATEGORIES: { value: PluginCategory; label: string; color: string }[] = [
  { value: "authentication", label: "Authentication", color: "bg-blue-500" },
  { value: "security", label: "Security", color: "bg-red-500" },
  { value: "traffic", label: "Traffic Control", color: "bg-amber-500" },
  { value: "transformation", label: "Transformation", color: "bg-purple-500" },
  { value: "observability", label: "Observability", color: "bg-green-500" },
  { value: "ai", label: "AI Gateway", color: "bg-cyan-500" },
]

export const PLUGINS: PluginDefinition[] = [
  // Authentication (request phase)
  { name: "key-auth", label: "API Key", description: "Authenticate via API key header or query param", category: "authentication", phase: "request", icon: "Key" },
  { name: "basic-auth", label: "Basic Auth", description: "HTTP Basic Authentication", category: "authentication", phase: "request", icon: "Lock" },
  { name: "jwt-auth", label: "JWT", description: "JSON Web Token authentication", category: "authentication", phase: "request", icon: "ShieldCheck" },
  { name: "hmac-auth", label: "HMAC", description: "HMAC signature authentication", category: "authentication", phase: "request", icon: "Fingerprint" },
  { name: "openid-connect", label: "OpenID Connect", description: "OpenID Connect / OAuth2 authentication", category: "authentication", phase: "request", icon: "KeyRound" },
  { name: "forward-auth", label: "Forward Auth", description: "Forward authentication to external service", category: "authentication", phase: "request", icon: "ArrowRightLeft" },
  { name: "authz-keycloak", label: "Keycloak Auth", description: "Keycloak UMA resource-level authorization", category: "authentication", phase: "request", icon: "ShieldCheck" },
  { name: "wolf-rbac", label: "Wolf RBAC", description: "Role-based access control via Wolf server", category: "authentication", phase: "request", icon: "ShieldCheck" },
  { name: "ldap-auth", label: "LDAP Auth", description: "Authenticate against LDAP directory server", category: "authentication", phase: "request", icon: "Server" },
  { name: "authz-casbin", label: "Casbin RBAC", description: "Policy-based access control via Casbin", category: "authentication", phase: "request", icon: "Scale" },
  { name: "authz-casdoor", label: "Casdoor SSO", description: "Single sign-on via Casdoor identity platform", category: "authentication", phase: "request", icon: "LogIn" },
  { name: "cas-auth", label: "CAS Auth", description: "Central Authentication Service (CAS) SSO", category: "authentication", phase: "request", icon: "KeyRound" },
  { name: "opa", label: "OPA", description: "Policy authorization via Open Policy Agent", category: "authentication", phase: "request", icon: "Scale" },

  // Security (request phase)
  { name: "ip-restriction", label: "IP Restriction", description: "Allow or deny access by IP address", category: "security", phase: "request", icon: "Shield" },
  { name: "uri-blocker", label: "URI Blocker", description: "Block requests by URI pattern", category: "security", phase: "request", icon: "Ban" },
  { name: "cors", label: "CORS", description: "Cross-Origin Resource Sharing headers", category: "security", phase: "response", icon: "Globe" },
  { name: "csrf", label: "CSRF", description: "Cross-Site Request Forgery protection", category: "security", phase: "request", icon: "ShieldAlert" },
  { name: "consumer-restriction", label: "Consumer Restriction", description: "Restrict access to specific consumers", category: "security", phase: "request", icon: "UserX" },
  { name: "request-validation", label: "Request Validation", description: "Validate request headers and body with JSON Schema", category: "security", phase: "request", icon: "CheckSquare" },
  { name: "ua-restriction", label: "User-Agent Filter", description: "Allow or deny access by User-Agent header", category: "security", phase: "request", icon: "Monitor" },
  { name: "referer-restriction", label: "Referer Filter", description: "Allow or deny access by Referer header", category: "security", phase: "request", icon: "Link" },

  // Traffic Control (request phase)
  { name: "limit-req", label: "Rate Limit", description: "Limit request rate per time window", category: "traffic", phase: "request", icon: "Gauge" },
  { name: "limit-conn", label: "Concurrency Limit", description: "Limit concurrent connections", category: "traffic", phase: "request", icon: "Users" },
  { name: "limit-count", label: "Request Quota", description: "Limit total requests in a time window", category: "traffic", phase: "request", icon: "Hash" },
  { name: "traffic-split", label: "Traffic Split", description: "Split traffic between upstreams (canary)", category: "traffic", phase: "request", icon: "GitBranch" },
  { name: "request-id", label: "Request ID", description: "Add unique request ID header", category: "traffic", phase: "request", icon: "Fingerprint" },
  { name: "proxy-cache", label: "Proxy Cache", description: "Cache upstream responses", category: "traffic", phase: "request", icon: "Database" },
  { name: "api-breaker", label: "Circuit Breaker", description: "Circuit breaker to protect unhealthy upstreams", category: "traffic", phase: "request", icon: "Zap" },
  { name: "proxy-mirror", label: "Traffic Mirror", description: "Mirror traffic to a secondary upstream", category: "traffic", phase: "request", icon: "Copy" },
  { name: "client-control", label: "Client Control", description: "Control client request constraints", category: "traffic", phase: "request", icon: "SlidersHorizontal" },
  { name: "real-ip", label: "Real IP", description: "Detect real client IP from proxy headers", category: "traffic", phase: "request", icon: "MapPin" },
  { name: "workflow", label: "Workflow", description: "Conditional actions based on matching rules", category: "traffic", phase: "request", icon: "Workflow" },

  // Transformation
  { name: "proxy-rewrite", label: "Proxy Rewrite", description: "Rewrite URI, host, or headers before proxying", category: "transformation", phase: "request", icon: "Replace" },
  { name: "response-rewrite", label: "Response Rewrite", description: "Rewrite response status, headers, or body", category: "transformation", phase: "response", icon: "FileOutput" },
  { name: "grpc-transcode", label: "gRPC Transcode", description: "Transcode HTTP requests to gRPC", category: "transformation", phase: "request", icon: "ArrowLeftRight" },
  { name: "fault-injection", label: "Fault Injection", description: "Inject delays or errors for testing", category: "transformation", phase: "request", icon: "Bug" },
  { name: "redirect", label: "Redirect", description: "HTTP redirect to another URI", category: "transformation", phase: "request", icon: "ExternalLink" },
  { name: "body-transformer", label: "Body Transformer", description: "Transform request/response body with Lua templates", category: "transformation", phase: "request", icon: "Wand2" },
  { name: "mocking", label: "Mock Response", description: "Return mock responses without hitting upstream", category: "transformation", phase: "request", icon: "FlaskConical" },
  { name: "serverless-pre-function", label: "Serverless Pre", description: "Execute custom Lua code before proxying", category: "transformation", phase: "request", icon: "Code" },
  { name: "serverless-post-function", label: "Serverless Post", description: "Execute custom Lua code after proxying", category: "transformation", phase: "response", icon: "Code" },
  { name: "aws-lambda", label: "AWS Lambda", description: "Proxy requests to AWS Lambda functions", category: "transformation", phase: "request", icon: "Cloud" },
  { name: "azure-functions", label: "Azure Functions", description: "Proxy requests to Azure Functions", category: "transformation", phase: "request", icon: "Cloud" },
  { name: "openwhisk", label: "OpenWhisk", description: "Proxy requests to Apache OpenWhisk actions", category: "transformation", phase: "request", icon: "Cloud" },
  { name: "gzip", label: "Gzip", description: "Compress response body with gzip", category: "transformation", phase: "response", icon: "FileArchive" },
  { name: "grpc-web", label: "gRPC-Web", description: "Enable gRPC-Web protocol for browser clients", category: "transformation", phase: "request", icon: "ArrowLeftRight" },

  // Observability (log phase)
  { name: "prometheus", label: "Prometheus", description: "Export metrics to Prometheus", category: "observability", phase: "observability", icon: "BarChart3" },
  { name: "http-logger", label: "HTTP Logger", description: "Send access logs via HTTP", category: "observability", phase: "observability", icon: "Send" },
  { name: "kafka-logger", label: "Kafka Logger", description: "Send access logs to Kafka", category: "observability", phase: "observability", icon: "Radio" },
  { name: "syslog", label: "Syslog", description: "Send logs to syslog server", category: "observability", phase: "observability", icon: "FileText" },
  { name: "zipkin", label: "Zipkin", description: "Distributed tracing with Zipkin", category: "observability", phase: "observability", icon: "Network" },
  { name: "opentelemetry", label: "OpenTelemetry", description: "Export traces and metrics via OTLP", category: "observability", phase: "observability", icon: "Activity" },
  { name: "elasticsearch-logger", label: "Elasticsearch Logger", description: "Send access logs to Elasticsearch", category: "observability", phase: "observability", icon: "Search" },
  { name: "clickhouse-logger", label: "ClickHouse Logger", description: "Send access logs to ClickHouse", category: "observability", phase: "observability", icon: "Database" },
  { name: "skywalking", label: "SkyWalking", description: "Distributed tracing with Apache SkyWalking", category: "observability", phase: "observability", icon: "Satellite" },
  { name: "datadog", label: "Datadog", description: "Export metrics to Datadog", category: "observability", phase: "observability", icon: "BarChart3" },
  { name: "skywalking-logger", label: "SkyWalking Logger", description: "Send access logs to SkyWalking OAP", category: "observability", phase: "observability", icon: "Satellite" },
  { name: "tcp-logger", label: "TCP Logger", description: "Send access logs via TCP", category: "observability", phase: "observability", icon: "Cable" },
  { name: "udp-logger", label: "UDP Logger", description: "Send access logs via UDP", category: "observability", phase: "observability", icon: "Cable" },
  { name: "rocketmq-logger", label: "RocketMQ Logger", description: "Send access logs to Apache RocketMQ", category: "observability", phase: "observability", icon: "Radio" },
  { name: "google-cloud-logging", label: "Google Cloud Logging", description: "Send logs to Google Cloud Logging", category: "observability", phase: "observability", icon: "Cloud" },
  { name: "splunk-hec-logging", label: "Splunk HEC", description: "Send logs to Splunk via HTTP Event Collector", category: "observability", phase: "observability", icon: "Search" },
  { name: "loggly", label: "Loggly", description: "Send logs to Loggly via syslog", category: "observability", phase: "observability", icon: "FileText" },
  { name: "sls-logger", label: "Alibaba SLS", description: "Send logs to Alibaba Cloud Log Service", category: "observability", phase: "observability", icon: "Cloud" },
  { name: "tencent-cloud-cls", label: "Tencent CLS", description: "Send logs to Tencent Cloud Log Service", category: "observability", phase: "observability", icon: "Cloud" },
  { name: "file-logger", label: "File Logger", description: "Write access logs to local file", category: "observability", phase: "observability", icon: "FileText" },

  // AI Gateway (request phase)
  { name: "ai-proxy", label: "AI Proxy", description: "Proxy requests to LLMs (OpenAI, DeepSeek, Claude, Gemini)", category: "ai", phase: "request", icon: "Bot" },
  { name: "ai-proxy-multi", label: "AI Multi-LLM", description: "Load balance across multiple LLM instances with failover", category: "ai", phase: "request", icon: "Layers" },
  { name: "ai-prompt-guard", label: "Prompt Guard", description: "Filter prompts with allow/deny regex patterns", category: "ai", phase: "request", icon: "ShieldAlert" },
  { name: "ai-request-rewrite", label: "AI Request Rewrite", description: "Transform requests using LLM-powered prompts", category: "ai", phase: "request", icon: "Sparkles" },
  { name: "ai-rate-limiting", label: "AI Rate Limit", description: "Token-based rate limiting for LLM requests", category: "ai", phase: "request", icon: "Gauge" },
  { name: "ai-rag", label: "AI RAG", description: "Retrieval-Augmented Generation with vector search", category: "ai", phase: "request", icon: "BookOpen" },
  { name: "ai-aws-content-moderation", label: "Content Moderation", description: "Moderate LLM content via AWS Comprehend", category: "ai", phase: "request", icon: "Eye" },
]

/**
 * Plugins that don't make sense as global rules in APISIX:
 * - Authentication: per-consumer/per-route, not global
 * - proxy-rewrite, grpc-transcode, redirect: need route-specific context
 * - traffic-split: needs specific upstreams
 * - consumer-restriction: needs consumer context
 */
export const GLOBAL_POLICY_EXCLUDED_PLUGINS = [
  "key-auth", "basic-auth", "jwt-auth", "hmac-auth", "openid-connect", "forward-auth",
  "authz-keycloak", "wolf-rbac", "ldap-auth", "authz-casbin", "authz-casdoor", "cas-auth", "opa",
  "proxy-rewrite", "grpc-transcode", "redirect", "traffic-split", "consumer-restriction",
] as const

/** Auth plugins used for consumer/application credential configuration */
export const AUTH_PLUGINS = ["key-auth", "basic-auth", "jwt-auth", "hmac-auth"] as const

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
