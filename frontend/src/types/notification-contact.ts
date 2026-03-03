export interface NotificationContact {
  id: string
  name: string
  type: "webhook" | "slack" | "teams" | "email"
  config: Record<string, unknown>
  enabled: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateNotificationContactRequest {
  name: string
  type: NotificationContact["type"]
  config: Record<string, unknown>
  enabled?: boolean
}

export interface UpdateNotificationContactRequest {
  name?: string
  type?: NotificationContact["type"]
  config?: Record<string, unknown>
  enabled?: boolean
}
