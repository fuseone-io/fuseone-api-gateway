export interface TimeSeriesPoint {
  ts: string
  requests_total: number
  status_2xx: number
  status_3xx: number
  status_4xx: number
  status_5xx: number
  latency_p50: number
  latency_p95: number
  latency_p99: number
  bandwidth_ingress: number
  bandwidth_egress: number
}

export interface MetricsSummary {
  total_requests: number
  avg_latency_ms: number
  error_rate: number
  total_bandwidth_ingress: number
  total_bandwidth_egress: number
  status_2xx: number
  status_3xx: number
  status_4xx: number
  status_5xx: number
}

export interface TopRoute {
  route_id: string
  route_name: string
  requests_total: number
  avg_latency_ms: number
  error_rate: number
  bandwidth_ingress: number
  bandwidth_egress: number
}

export type TimeRange = "1h" | "6h" | "24h" | "7d"

export type DateRangeValue =
  | { type: "preset"; preset: TimeRange }
  | { type: "custom"; from: Date; to: Date }
