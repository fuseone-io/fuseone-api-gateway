export interface EventApi {
  id: string
  name: string
  description: string
  slug: string
  kafka_connection_id: string
  topic_name: string
  rest_produce: boolean
  rest_consume: boolean
  sse_enabled: boolean
  websocket_enabled: boolean
  webhook_enabled: boolean
  context_path: string
  apisix_route_ids: string[]
  apisix_plugins: Record<string, unknown>
  consumer_group_prefix: string
  auto_offset_reset: string
  schema_validation: boolean
  status: string
  deployed_at?: string
  deployed_by?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CreateEventApiRequest {
  name: string
  description?: string
  slug: string
  kafka_connection_id: string
  topic_name: string
  rest_produce?: boolean
  rest_consume?: boolean
  sse_enabled?: boolean
  websocket_enabled?: boolean
  webhook_enabled?: boolean
  context_path?: string
  apisix_plugins?: Record<string, unknown>
  consumer_group_prefix?: string
  auto_offset_reset?: string
}

export interface EventApiMetricsRow {
  ts: string
  produce_total: number
  produce_errors: number
  produce_latency_avg: number
  consume_total: number
  consume_messages: number
  sse_connections: number
  sse_messages: number
  ws_connections: number
  ws_messages_in: number
  ws_messages_out: number
  webhook_total: number
  webhook_success: number
  webhook_failed: number
}

export interface EventApiMetricsSummary {
  produce_total: number
  produce_errors: number
  produce_latency_avg: number
  consume_total: number
  consume_messages: number
  sse_connections: number
  sse_messages: number
  ws_connections: number
  ws_messages_in: number
  ws_messages_out: number
  webhook_total: number
  webhook_success: number
  webhook_failed: number
}

export interface ConsumerGroupInfo {
  group_id: string
  state: string
  members: number
  total_lag: number
  partitions?: PartitionLagInfo[]
}

export interface PartitionLagInfo {
  partition: number
  current_offset: number
  log_end_offset: number
  lag: number
  member_id?: string
}

export interface UpdateEventApiRequest {
  name?: string
  description?: string
  slug?: string
  kafka_connection_id?: string
  topic_name?: string
  rest_produce?: boolean
  rest_consume?: boolean
  sse_enabled?: boolean
  websocket_enabled?: boolean
  webhook_enabled?: boolean
  context_path?: string
  apisix_plugins?: Record<string, unknown>
  consumer_group_prefix?: string
  auto_offset_reset?: string
  schema_validation?: boolean
}

export interface EventSchema {
  id: string
  event_api_id: string
  version: number
  schema_type: string
  schema_content: Record<string, unknown>
  description: string
  is_active: boolean
  created_at: string
}

export interface EventApiPermission {
  id: string
  event_api_id: string
  consumer_name: string
  can_produce: boolean
  can_consume: boolean
  can_stream: boolean
  rate_limit: number
  rate_window_sec: number
  created_at: string
  updated_at: string
}

export interface UpsertPermissionRequest {
  consumer_name: string
  can_produce?: boolean
  can_consume?: boolean
  can_stream?: boolean
  rate_limit?: number
  rate_window_sec?: number
}
