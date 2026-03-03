export interface APISIXRoute {
  id?: string
  name?: string
  desc?: string
  uri?: string
  uris?: string[]
  methods?: string[]
  host?: string
  hosts?: string[]
  remote_addr?: string
  remote_addrs?: string[]
  vars?: unknown[][]
  plugins?: Record<string, unknown>
  upstream?: APISIXUpstream
  upstream_id?: string
  service_id?: string
  plugin_config_id?: string
  timeout?: { connect: number; send: number; read: number }
  enable_websocket?: boolean
  status?: 0 | 1
  priority?: number
  labels?: Record<string, string>
  create_time?: number
  update_time?: number
}

export interface APISIXService {
  id?: string
  name?: string
  desc?: string
  upstream?: APISIXUpstream
  upstream_id?: string
  plugins?: Record<string, unknown>
  labels?: Record<string, string>
  enable_websocket?: boolean
  create_time?: number
  update_time?: number
}

export interface APISIXUpstream {
  id?: string
  name?: string
  desc?: string
  type?: "roundrobin" | "chash" | "ewma" | "least_conn"
  nodes?: Record<string, number> | { host: string; port: number; weight: number }[]
  service_name?: string
  discovery_type?: string
  hash_on?: string
  key?: string
  retries?: number
  retry_timeout?: number
  timeout?: { connect: number; send: number; read: number }
  scheme?: "http" | "https" | "grpc" | "grpcs" | "tcp" | "tls"
  checks?: {
    active?: {
      type?: string
      timeout?: number
      http_path?: string
      host?: string
      port?: number
      healthy?: { interval: number; successes: number }
      unhealthy?: { interval: number; http_failures: number }
    }
    passive?: {
      healthy?: { http_statuses: number[]; successes: number }
      unhealthy?: { http_statuses: number[]; http_failures: number }
    }
  }
  labels?: Record<string, string>
  create_time?: number
  update_time?: number
}

export interface APISIXConsumer {
  username: string
  desc?: string
  plugins?: Record<string, unknown>
  labels?: Record<string, string>
  group_id?: string
  create_time?: number
  update_time?: number
}

export interface APISIXConsumerGroup {
  id?: string
  desc?: string
  plugins?: Record<string, unknown>
  labels?: Record<string, string>
  create_time?: number
  update_time?: number
}

export interface APISIXSSL {
  id?: string
  cert: string
  key: string
  certs?: string[]
  keys?: string[]
  snis: string[]
  type?: "server" | "client"
  client?: {
    ca: string
    depth?: number
    skip_mtls_uri_regex?: string[]
  }
  ssl_protocols?: string[]
  labels?: Record<string, string>
  status?: 0 | 1
  validity_start?: number
  validity_end?: number
  create_time?: number
  update_time?: number
}

export interface APISIXGlobalRule {
  id?: string
  plugins: Record<string, unknown>
  labels?: Record<string, string>
  create_time?: number
  update_time?: number
}

export interface APISIXPluginConfig {
  id?: string
  desc?: string
  plugins: Record<string, unknown>
  labels?: Record<string, string>
  create_time?: number
  update_time?: number
}

export interface APISIXStreamRoute {
  id?: string
  name?: string
  desc?: string
  labels?: Record<string, string>
  remote_addr?: string
  server_addr?: string
  server_port?: number
  sni?: string
  upstream?: APISIXUpstream
  upstream_id?: string
  service_id?: string
  plugins?: Record<string, unknown>
  protocol?: {
    name: string
    conf?: Record<string, unknown>
  }
  create_time?: number
  update_time?: number
}

export interface APISIXNode {
  key: string
  value: unknown
  modifiedIndex?: number
  createdIndex?: number
}

export interface APISIXListResponse {
  list: APISIXNode[]
  total: number
}

export interface DashboardSummary {
  routes: number
  services: number
  upstreams: number
  consumers: number
  ssl_certs: number
  global_rules: number
  plugins: number
  stream_routes: number
  firing_alerts: number
  apisix_status: "healthy" | "degraded" | "unhealthy"
}

// Upstream Health (from APISIX Control API /v1/healthcheck)

export interface UpstreamHealthNode {
  ip: string
  port: number
  hostname?: string
  status: "healthy" | "unhealthy"
  counter: {
    http_failure: number
    success: number
    timeout_failure: number
    tcp_failure: number
  }
}

export interface UpstreamHealthChecker {
  name: string
  // APISIX returns {} (empty object) when no nodes checked, [] (array) when checked
  nodes: UpstreamHealthNode[] | Record<string, never>
  type: "http" | "https" | "tcp"
}
