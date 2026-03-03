export interface Environment {
  id: string
  name: string
  slug: string
  description: string
  color: string
  sort_order: number
  is_default: boolean
  admin_url: string
  control_url: string
  metrics_url: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CreateEnvironmentRequest {
  name: string
  slug: string
  description?: string
  color?: string
  admin_url: string
  api_key?: string
  control_url?: string
  metrics_url?: string
}

export interface UpdateEnvironmentRequest {
  name?: string
  slug?: string
  description?: string
  color?: string
  admin_url?: string
  api_key?: string
  control_url?: string
  metrics_url?: string
}

export interface TestConnectionResult {
  success: boolean
  message: string
  latency_ms?: number
}
