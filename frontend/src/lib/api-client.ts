const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("access_token")
}

function setToken(token: string) {
  localStorage.setItem("access_token", token)
}

function setRefreshToken(token: string) {
  localStorage.setItem("refresh_token", token)
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("refresh_token")
}

function clearTokens() {
  localStorage.removeItem("access_token")
  localStorage.removeItem("refresh_token")
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  }

  if (token) {
    ;(headers as Record<string, string>)["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    clearTokens()
    if (typeof window !== "undefined") {
      window.location.href = "/login"
    }
    throw new Error("Unauthorized")
  }

  const data = await res.json()

  if (!res.ok) {
    const msg = data?.error?.message || `Request failed (${res.status})`
    throw new Error(msg)
  }

  return data
}

// Auth
export const api = {
  login: (username: string, password: string) =>
    request<{ data: import("@/types/auth").TokenResponse }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }).then((r) => {
      setToken(r.data.access_token)
      setRefreshToken(r.data.refresh_token)
      return r.data
    }),

  refresh: () => {
    const rt = getRefreshToken()
    if (!rt) throw new Error("No refresh token")
    return request<{ data: import("@/types/auth").TokenResponse }>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: rt }),
    }).then((r) => {
      setToken(r.data.access_token)
      setRefreshToken(r.data.refresh_token)
      return r.data
    })
  },

  logout: () => {
    const rt = getRefreshToken()
    clearTokens()
    if (rt) {
      return request("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: rt }),
      }).catch(() => {})
    }
  },

  me: () =>
    request<{ data: import("@/types/auth").User }>("/api/auth/me").then((r) => r.data),

  // Dashboard
  dashboardSummary: () =>
    request<{ data: import("@/types/apisix").DashboardSummary }>("/api/dashboard/summary").then((r) => r.data),

  // Generic APISIX resource methods
  listResource: (resource: string) =>
    request<{ data: import("@/types/apisix").APISIXListResponse }>(`/api/apisix/${resource}`).then((r) => r.data),

  getResource: (resource: string, id: string) =>
    request<{ data: unknown }>(`/api/apisix/${resource}/${id}`).then((r) => r.data),

  createResource: (resource: string, data: unknown) =>
    request<{ data: unknown }>(`/api/apisix/${resource}`, {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  updateResource: (resource: string, id: string, data: unknown) =>
    request<{ data: unknown }>(`/api/apisix/${resource}/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  deleteResource: (resource: string, id: string) =>
    request<{ data: unknown }>(`/api/apisix/${resource}/${id}`, {
      method: "DELETE",
    }),

  // Plugins
  listPlugins: () =>
    request<{ data: unknown }>("/api/apisix/plugins").then((r) => r.data),

  getPluginSchema: (name: string) =>
    request<{ data: unknown }>(`/api/apisix/plugins/${name}`).then((r) => r.data),

  // Audit
  listAuditLogs: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : ""
    return request<{ data: import("@/types/auth").AuditLog[]; meta: { total: number; page: number; page_size: number } }>(`/api/audit${qs}`)
  },
}
