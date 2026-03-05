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

export interface GatewayHealth {
  available: boolean
  message?: string
  latency_ms?: number
  connections?: {
    active?: number
    reading?: number
    writing?: number
    waiting?: number
    accepted?: number
    handled?: number
  }
  etcd_reachable?: boolean
  shared_memory?: {
    capacity_mb: number
    used_mb: number
    free_mb: number
    used_pct: number
  }
  node?: {
    hostname: string
    version: string
  }
  total_requests?: number
}
