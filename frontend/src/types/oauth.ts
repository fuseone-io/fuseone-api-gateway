export interface OAuthProvider {
  id: string
  provider: string
  display_name: string
  client_id: string
  has_secret: boolean
  scopes: string[]
  extra_config: Record<string, string>
  auto_create_users: boolean
  default_role_id?: string
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export interface CreateOAuthProviderRequest {
  provider: string
  display_name: string
  client_id: string
  client_secret: string
  scopes?: string[]
  extra_config?: Record<string, string>
  auto_create_users?: boolean
  default_role_id?: string
  is_enabled?: boolean
}

export interface UpdateOAuthProviderRequest {
  display_name?: string
  client_id?: string
  client_secret?: string
  scopes?: string[]
  extra_config?: Record<string, string>
  auto_create_users?: boolean
  default_role_id?: string
  is_enabled?: boolean
}

export interface PublicOAuthProvider {
  provider: string
  display_name: string
}
