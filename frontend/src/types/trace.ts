export interface TraceSpan {
  span_id: string
  parent_span_id?: string
  name: string
  kind: "client" | "server" | "internal"
  start_time_ns: number
  end_time_ns: number
  duration_ns: number
  status_code?: string
  attributes?: Record<string, string>
}

export interface RequestTrace {
  id: number
  trace_id: string
  root_span_id: string
  service_name: string
  route_id: string
  route_name: string
  method: string
  uri: string
  status_code: number
  duration_ns: number
  spans: TraceSpan[]
  attributes?: Record<string, unknown>
  created_at: string
}

export interface TraceListParams {
  route_id?: string
  api_id?: string
  method?: string
  status_min?: number
  status_max?: number
  min_duration_ms?: number
  max_duration_ms?: number
  search?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export interface TracingStatus {
  enabled: boolean
  sample_rate: number
  retention_days: number
}

export type AnalyticsBackendType = "postgresql" | "clickhouse" | "elasticsearch"
export type MetricsBackendType = AnalyticsBackendType | "prometheus" | "victoriametrics"

export interface ClickHouseSettings {
  addr: string
  database: string
  user: string
  password: string
}

export interface ElasticsearchSettings {
  addresses: string[]
  username: string
  password: string
  api_key: string
  index_prefix: string
}

export interface PrometheusSettings {
  url: string
  username: string
  password: string
}

export interface AnalyticsBackendSettings {
  type: AnalyticsBackendType
  clickhouse?: ClickHouseSettings
  elasticsearch?: ElasticsearchSettings
}

export interface BackendConfig {
  type: string
  clickhouse?: ClickHouseSettings
  elasticsearch?: ElasticsearchSettings
  prometheus?: PrometheusSettings
}

export interface AnalyticsBackendStatus {
  type: string
  trace_backend: string
  metrics_backend: string
}
