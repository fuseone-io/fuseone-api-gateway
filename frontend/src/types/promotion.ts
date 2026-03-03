export interface PromotionRequest {
  id: string
  api_definition_id: string
  source_env_id: string
  target_env_id: string
  status: "pending" | "approved" | "rejected" | "deployed" | "failed"
  definition_snapshot: unknown
  diff_summary?: DiffResult
  requested_by: string
  reviewed_by?: string
  review_comment: string
  requested_at: string
  reviewed_at?: string
  deployed_at?: string
}

export interface CreatePromotionRequest {
  api_definition_id: string
  source_env_id: string
  target_env_id: string
}

export interface ReviewPromotionRequest {
  action: "approve" | "reject"
  comment?: string
}

export interface DiffResult {
  added?: DiffEntry[]
  removed?: DiffEntry[]
  changed?: DiffEntry[]
}

export interface DiffEntry {
  path: string
  old_value?: unknown
  new_value?: unknown
}
