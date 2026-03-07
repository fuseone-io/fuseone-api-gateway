export interface WebhookSubscription {
  id: string
  event_api_id: string
  url: string
  secret: string
  description: string
  headers: Record<string, string>
  retry_policy: RetryPolicy
  is_active: boolean
  filter_expression: string
  circuit_breaker_threshold: number
  circuit_status: "closed" | "open" | "half-open"
  circuit_opened_at?: string
  consecutive_failures: number
  created_at: string
  updated_at: string
}

export interface RetryPolicy {
  max_attempts: number
  backoff_seconds: number[]
}

export interface WebhookDelivery {
  id: string
  subscription_id: string
  event_api_id: string
  kafka_partition: number
  kafka_offset: number
  status: "pending" | "success" | "failed"
  attempts: number
  last_status_code?: number
  last_error?: string
  next_retry_at?: string
  completed_at?: string
  created_at: string
}

export interface CreateWebhookRequest {
  url: string
  secret?: string
  description?: string
  headers?: Record<string, string>
  retry_policy?: RetryPolicy
  is_active?: boolean
  filter_expression?: string
  circuit_breaker_threshold?: number
}

export interface UpdateWebhookRequest {
  url?: string
  secret?: string
  description?: string
  headers?: Record<string, string>
  retry_policy?: RetryPolicy
  is_active?: boolean
  filter_expression?: string
  circuit_breaker_threshold?: number
}
