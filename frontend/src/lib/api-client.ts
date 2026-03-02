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

  // Monitoring
  upstreamHealth: () =>
    request<{ data: import("@/types/apisix").UpstreamHealthChecker[] }>("/api/monitoring/upstream-health").then((r) => r.data),

  // Metrics
  metricsTimeSeries: (params: { route_ids?: string[]; range?: import("@/types/metrics").TimeRange; from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params.route_ids?.length) qs.set("route_ids", params.route_ids.join(","))
    if (params.from) {
      qs.set("from", params.from)
      if (params.to) qs.set("to", params.to)
    } else {
      qs.set("range", params.range || "1h")
    }
    return request<{ data: import("@/types/metrics").TimeSeriesPoint[] }>(`/api/metrics/timeseries?${qs}`).then((r) => r.data)
  },

  metricsSummary: (params?: { route_ids?: string[]; range?: import("@/types/metrics").TimeRange; from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.route_ids?.length) qs.set("route_ids", params.route_ids.join(","))
    if (params?.from) {
      qs.set("from", params.from)
      if (params.to) qs.set("to", params.to)
    } else {
      qs.set("range", params?.range || "24h")
    }
    return request<{ data: import("@/types/metrics").MetricsSummary }>(`/api/metrics/summary?${qs}`).then((r) => r.data)
  },

  metricsTopRoutes: (params?: { route_ids?: string[]; range?: import("@/types/metrics").TimeRange; from?: string; to?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.route_ids?.length) qs.set("route_ids", params.route_ids.join(","))
    if (params?.from) {
      qs.set("from", params.from)
      if (params.to) qs.set("to", params.to)
    } else {
      qs.set("range", params?.range || "24h")
    }
    if (params?.limit) qs.set("limit", String(params.limit))
    return request<{ data: import("@/types/metrics").TopRoute[] }>(`/api/metrics/top-routes?${qs}`).then((r) => r.data)
  },

  // Audit
  listAuditLogs: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : ""
    return request<{ data: import("@/types/auth").AuditLog[]; meta: { total: number; page: number; page_size: number } }>(`/api/audit${qs}`)
  },

  // API Definitions (draft/deploy)
  listApis: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : ""
    return request<{ data: import("@/types/api").ApiDefRecord[]; meta: { total: number; page: number; page_size: number } }>(`/api/apis${qs}`)
  },

  getApi: (id: string) =>
    request<{ data: import("@/types/api").ApiDefRecord }>(`/api/apis/${id}`).then((r) => r.data),

  createApi: (data: { name: string; description: string; definition: import("@/types/api").ApiDefinition }) =>
    request<{ data: import("@/types/api").ApiDefRecord }>("/api/apis", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  updateApi: (id: string, data: { name: string; description: string; definition: import("@/types/api").ApiDefinition }) =>
    request<{ data: import("@/types/api").ApiDefRecord }>(`/api/apis/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  deployApi: (id: string) =>
    request<{ data: import("@/types/api").ApiDefRecord }>(`/api/apis/${id}/deploy`, {
      method: "POST",
    }).then((r) => r.data),

  deleteApi: (id: string) =>
    request<{ data: unknown }>(`/api/apis/${id}`, { method: "DELETE" }),

  // API Versioning
  cloneApi: (id: string, data?: import("@/types/api").CloneApiRequest) =>
    request<{ data: import("@/types/api").ApiDefRecord }>(`/api/apis/${id}/clone`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    }).then((r) => r.data),

  getApiVersions: (id: string) =>
    request<{ data: import("@/types/api").ApiDefRecord[] }>(`/api/apis/${id}/versions`).then((r) => r.data),

  // API Lifecycle
  deprecateApi: (id: string, data?: import("@/types/api").DeprecateApiRequest) =>
    request<{ data: import("@/types/api").ApiDefRecord }>(`/api/apis/${id}/deprecate`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    }).then((r) => r.data),

  retireApi: (id: string) =>
    request<{ data: import("@/types/api").ApiDefRecord }>(`/api/apis/${id}/retire`, {
      method: "POST",
    }).then((r) => r.data),

  undeprecateApi: (id: string) =>
    request<{ data: import("@/types/api").ApiDefRecord }>(`/api/apis/${id}/undeprecate`, {
      method: "POST",
    }).then((r) => r.data),

  // Local Secrets
  listSecrets: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : ""
    return request<{ data: import("@/types/api").Secret[]; meta: { total: number; page: number; page_size: number } }>(`/api/secrets${qs}`)
  },

  createSecret: (data: { name: string; description?: string; value: string; tags?: string[] }) =>
    request<{ data: import("@/types/api").Secret }>("/api/secrets", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  updateSecret: (id: string, data: { description?: string; value?: string; tags?: string[] }) =>
    request<{ data: unknown }>(`/api/secrets/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteSecret: (id: string) =>
    request<{ data: unknown }>(`/api/secrets/${id}`, { method: "DELETE" }),

  // Secret Managers
  listSecretManagers: () =>
    request<{ data: import("@/types/api").SecretManager[] }>("/api/secret-managers").then((r) => r.data),

  createSecretManager: (data: { name: string; type: string; config: Record<string, unknown> }) =>
    request<{ data: import("@/types/api").SecretManager }>("/api/secret-managers", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  updateSecretManager: (id: string, data: { name?: string; config?: Record<string, unknown>; is_active?: boolean }) =>
    request<{ data: unknown }>(`/api/secret-managers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteSecretManager: (id: string) =>
    request<{ data: unknown }>(`/api/secret-managers/${id}`, { method: "DELETE" }),

  // Debug / Troubleshooting
  debugLogs: (params?: import("@/types/debug").DebugLogFilter) => {
    const qs = new URLSearchParams()
    if (params?.route_id) qs.set("route_id", params.route_id)
    if (params?.api_id) qs.set("api_id", params.api_id)
    if (params?.status_min) qs.set("status_min", String(params.status_min))
    if (params?.status_max) qs.set("status_max", String(params.status_max))
    if (params?.method) qs.set("method", params.method)
    if (params?.search) qs.set("search", params.search)
    if (params?.client_ip) qs.set("client_ip", params.client_ip)
    if (params?.consumer_name) qs.set("consumer_name", params.consumer_name)
    if (params?.latency_min) qs.set("latency_min", String(params.latency_min))
    if (params?.limit) qs.set("limit", String(params.limit))
    if (params?.offset) qs.set("offset", String(params.offset))
    const query = qs.toString()
    return request<{ data: import("@/types/debug").DebugLog[]; meta: { total: number; page: number; page_size: number } }>(`/api/debug/logs${query ? "?" + query : ""}`)
  },

  debugLog: (id: number) =>
    request<{ data: import("@/types/debug").DebugLog }>(`/api/debug/logs/${id}`).then((r) => r.data),

  debugToggle: (routeId: string, options?: import("@/types/debug").DebugToggleOptions) =>
    request<{ data: import("@/types/debug").DebugStatus }>(`/api/debug/toggle/${routeId}`, {
      method: "POST",
      ...(options ? { body: JSON.stringify(options) } : {}),
    }).then((r) => r.data),

  debugStatus: (routeId: string) =>
    request<{ data: import("@/types/debug").DebugStatus }>(`/api/debug/status/${routeId}`).then((r) => r.data),

  debugToggleApi: (apiId: string, options?: import("@/types/debug").DebugToggleOptions) =>
    request<{ data: import("@/types/debug").ApiDebugStatus }>(`/api/debug/toggle-api/${apiId}`, {
      method: "POST",
      ...(options ? { body: JSON.stringify(options) } : {}),
    }).then((r) => r.data),

  debugUpdateCapture: (apiId: string, options: import("@/types/debug").DebugToggleOptions) =>
    request<{ data: { api_id: string; include_req_body: boolean; include_resp_body: boolean } }>(`/api/debug/capture-api/${apiId}`, {
      method: "PATCH",
      body: JSON.stringify(options),
    }).then((r) => r.data),

  debugStatusApi: (apiId: string) =>
    request<{ data: import("@/types/debug").ApiDebugStatus }>(`/api/debug/status-api/${apiId}`).then((r) => r.data),

  debugActiveRoutes: () =>
    request<{ data: string[] }>("/api/debug/active-routes").then((r) => r.data),

  // Per-API monitoring
  apiUpstreamHealth: (apiId: string) =>
    request<{ data: import("@/types/apisix").UpstreamHealthChecker[] }>(`/api/apis/${apiId}/health`).then((r) => r.data),
}
