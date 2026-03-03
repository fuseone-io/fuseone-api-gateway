export interface AITokenTimeSeries {
  ts: string
  requests: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_cost_usd: number
}

export interface AITokenSummary {
  total_requests: number
  total_prompt_tokens: number
  total_completion_tokens: number
  total_tokens: number
  total_cost_usd: number
  avg_tokens_per_request: number
  unique_providers: number
  unique_models: number
}

export interface TopProvider {
  provider: string
  requests: number
  total_tokens: number
  estimated_cost_usd: number
}

export interface TopModel {
  provider: string
  model: string
  requests: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_cost_usd: number
}

export interface CostModelEntry {
  prompt_per_1k: number
  completion_per_1k: number
}

// provider → model → pricing
export type CostModels = Record<string, Record<string, CostModelEntry>>
