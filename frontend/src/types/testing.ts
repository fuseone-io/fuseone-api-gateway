export interface TestStep {
  name: string
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS"
  url: string
  headers?: Record<string, string>
  body?: string
  assertions: Assertion[]
  extract_vars?: Record<string, string>
  delay_ms?: number
}

export interface Assertion {
  type: "status_code" | "header" | "body_json" | "body_contains" | "response_time"
  target: string
  operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "contains" | "matches"
  expected: string
}

export interface TestSuite {
  id: string
  name: string
  description: string
  api_id?: string
  steps: TestStep[]
  tags: string[]
  created_by?: string
  created_at: string
  updated_at: string
}

export interface StepResult {
  step_name: string
  step_index: number
  status: "passed" | "failed" | "error" | "skipped"
  status_code?: number
  response_time_ms: number
  response_body?: string
  headers?: Record<string, string>
  assertions: AssertionResult[]
  error?: string
  extracted_vars?: Record<string, string>
}

export interface AssertionResult {
  type: string
  target: string
  operator: string
  expected: string
  actual: string
  passed: boolean
  error?: string
}

export interface TestRun {
  id: string
  suite_id: string
  status: "pending" | "running" | "passed" | "failed" | "error"
  trigger_type: "manual" | "synthetic" | "ci"
  results: StepResult[]
  total_steps: number
  passed_steps: number
  failed_steps: number
  duration_ms: number
  started_at?: string
  finished_at?: string
  created_by?: string
  created_at: string
}

export interface SyntheticMonitor {
  id: string
  name: string
  description: string
  enabled: boolean
  suite_id: string
  interval_sec: number
  locations: string[]
  uptime_pct: number
  last_status: "unknown" | "up" | "down" | "degraded"
  last_run_at?: string
  last_run_id?: string
  consecutive_fail: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface SLADefinition {
  id: string
  name: string
  description: string
  api_id?: string
  availability_pct: number
  latency_p99_ms: number
  error_rate_pct: number
  eval_window: "7d" | "30d" | "90d"
  current_avail: number
  current_latency: number
  current_error: number
  budget_remaining: number
  compliance_status: "compliant" | "at_risk" | "breached"
  last_eval_at?: string
  created_by?: string
  created_at: string
  updated_at: string
}
