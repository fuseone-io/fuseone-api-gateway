export interface AlertChannel {
  type: "webhook" | "slack" | "teams" | "email"
  config: Record<string, unknown>
}

export interface AlertRule {
  id: string
  name: string
  description: string
  enabled: boolean
  rule_type: "error_rate" | "latency_p99" | "traffic_drop" | "token_budget" | "cost_budget"
  scope_type: "global" | "route" | "consumer"
  scope_ids: string[]
  threshold: number
  eval_window: "1m" | "5m" | "15m" | "30m" | "1h"
  channels: AlertChannel[]
  state: "ok" | "firing" | "acknowledged"
  last_eval: string | null
  fired_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AlertEvent {
  id: number
  rule_id: string
  event_type: "fired" | "resolved" | "acknowledged"
  message: string
  value: number | null
  threshold: number | null
  acked_by: string | null
  created_at: string
}

export interface CreateAlertRuleRequest {
  name: string
  description?: string
  enabled?: boolean
  rule_type: AlertRule["rule_type"]
  scope_type?: AlertRule["scope_type"]
  scope_ids?: string[]
  threshold: number
  eval_window?: AlertRule["eval_window"]
  channels?: AlertChannel[]
}

export interface UpdateAlertRuleRequest {
  name?: string
  description?: string
  enabled?: boolean
  rule_type?: AlertRule["rule_type"]
  scope_type?: AlertRule["scope_type"]
  scope_ids?: string[]
  threshold?: number
  eval_window?: AlertRule["eval_window"]
  channels?: AlertChannel[]
}
