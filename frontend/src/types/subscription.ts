export interface Subscription {
  id: string
  consumer_username: string
  api_definition_id: string
  plan_id: string
  status: "pending" | "active" | "suspended" | "revoked"
  requested_by?: string
  approved_by?: string
  requested_at: string
  approved_at?: string
  revoked_at?: string
  notes: string
  created_at: string
  updated_at: string
}

export interface CreateSubscriptionRequest {
  consumer_username: string
  api_definition_id: string
  plan_id?: string
  notes?: string
}

export interface ReviewSubscriptionRequest {
  action: "approve" | "reject"
  notes?: string
}
