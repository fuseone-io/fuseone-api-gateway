export type LLMProvider = "openai" | "anthropic" | "google" | "groq"

export interface LLMConfig {
  id: string
  provider: LLMProvider
  model: string
  enabled: boolean
  daily_quota: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface LLMUsageSummary {
  provider: LLMProvider
  today_usage: number
  month_usage: number
  daily_quota: number
  quota_percent: number
}

export interface AIStatus {
  available: boolean
  provider?: string
  model?: string
}

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  context?: string
}

export interface ChatResponse {
  content: string
  tokens_in: number
  tokens_out: number
}

export interface GenerateAPIRequest {
  description: string
}

export interface GeneratedAPIConfig {
  name: string
  route: Record<string, unknown>
  upstream: Record<string, unknown>
  plugins: Record<string, unknown>
}
