export interface User {
  id: string
  username: string
  email?: string
  display_name: string
  role_id: string
  role_name: string
  is_active: boolean
  avatar_url?: string
  totp_enabled: boolean
  last_login_at?: string
  created_at: string
  updated_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_at: string
  user: User
}

export interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  is_system: boolean
  created_at: string
  updated_at: string
}

export interface CreateUserRequest {
  username: string
  email?: string
  display_name: string
  password: string
  role_id: string
  is_active: boolean
}

export interface UpdateUserRequest {
  username: string
  email?: string
  display_name: string
  role_id: string
  is_active: boolean
}

export interface ResetPasswordRequest {
  new_password: string
}

export interface CreateRoleRequest {
  name: string
  description: string
  permissions: string[]
}

export interface UpdateRoleRequest {
  name: string
  description: string
  permissions: string[]
}

export interface AuditLog {
  id: string
  user_id: string
  user_name: string
  action: string
  resource_type: string
  resource_id?: string
  details: string
  ip_address: string
  user_agent: string
  status: string
  error_message?: string
  created_at: string
}
