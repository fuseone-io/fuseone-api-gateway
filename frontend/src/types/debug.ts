export interface DebugLog {
  id: number
  route_id: string
  service_id: string
  consumer_name: string
  req_method: string
  req_uri: string
  req_headers: Record<string, string> | null
  req_body: string | null
  req_size: number
  client_ip: string
  resp_status: number
  resp_headers: Record<string, string> | null
  resp_body: string | null
  resp_size: number
  latency_total: number
  latency_upstream: number | null
  latency_gateway: number | null
  upstream_addr: string
  request_time: string
  created_at: string
}

export interface DebugLogFilter {
  route_id?: string
  api_id?: string
  status_min?: number
  status_max?: number
  method?: string
  search?: string
  client_ip?: string
  consumer_name?: string
  latency_min?: number
  limit?: number
  offset?: number
}

export interface DebugStatus {
  route_id: string
  enabled: boolean
  include_req_body: boolean
  include_resp_body: boolean
}

export interface ApiDebugStatus {
  api_id: string
  enabled: boolean
  include_req_body: boolean
  include_resp_body: boolean
  routes: { route_id: string; enabled: boolean }[]
}

export interface DebugToggleOptions {
  include_req_body?: boolean
  include_resp_body?: boolean
}
