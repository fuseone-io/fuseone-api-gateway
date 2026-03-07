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

function getActiveEnvironmentId(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|;\s*)active_environment_id=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
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

  const envId = getActiveEnvironmentId()
  if (envId) {
    ;(headers as Record<string, string>)["X-Environment-ID"] = envId
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
  login: (username: string, password: string, totp_code?: string) =>
    request<{ data: import("@/types/auth").TokenResponse }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, ...(totp_code ? { totp_code } : {}) }),
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

  // Profile
  updateProfile: (data: import("@/types/auth").UpdateProfileRequest) =>
    request<{ data: import("@/types/auth").User }>("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  changePassword: (data: import("@/types/auth").ChangePasswordRequest) =>
    request<{ data: { message: string } }>("/api/auth/profile/password", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  totpSetup: () =>
    request<{ data: import("@/types/auth").TOTPSetupResponse }>("/api/auth/totp/setup", {
      method: "POST",
    }).then((r) => r.data),

  totpEnable: (code: string) =>
    request<{ data: { message: string } }>("/api/auth/totp/enable", {
      method: "POST",
      body: JSON.stringify({ code }),
    }).then((r) => r.data),

  totpDisable: (password: string) =>
    request<{ data: { message: string } }>("/api/auth/totp/disable", {
      method: "POST",
      body: JSON.stringify({ password }),
    }).then((r) => r.data),

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

  reloadPlugins: () =>
    request<{ data: { message: string } }>("/api/apisix/plugins/reload", { method: "PUT" }).then((r) => r.data),

  // Monitoring
  upstreamHealth: () =>
    request<{ data: import("@/types/apisix").UpstreamHealthChecker[] }>("/api/monitoring/upstream-health").then((r) => r.data),

  // Metrics
  metricsTimeSeries: (params: { route_ids?: string[]; consumer_names?: string[]; range?: import("@/types/metrics").TimeRange; from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params.route_ids?.length) qs.set("route_ids", params.route_ids.join(","))
    if (params.consumer_names?.length) qs.set("consumer_names", params.consumer_names.join(","))
    if (params.from) {
      qs.set("from", params.from)
      if (params.to) qs.set("to", params.to)
    } else {
      qs.set("range", params.range || "1h")
    }
    return request<{ data: import("@/types/metrics").TimeSeriesPoint[] }>(`/api/metrics/timeseries?${qs}`).then((r) => r.data)
  },

  metricsSummary: (params?: { route_ids?: string[]; consumer_names?: string[]; range?: import("@/types/metrics").TimeRange; from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.route_ids?.length) qs.set("route_ids", params.route_ids.join(","))
    if (params?.consumer_names?.length) qs.set("consumer_names", params.consumer_names.join(","))
    if (params?.from) {
      qs.set("from", params.from)
      if (params.to) qs.set("to", params.to)
    } else {
      qs.set("range", params?.range || "24h")
    }
    return request<{ data: import("@/types/metrics").MetricsSummary }>(`/api/metrics/summary?${qs}`).then((r) => r.data)
  },

  metricsTopRoutes: (params?: { route_ids?: string[]; consumer_names?: string[]; range?: import("@/types/metrics").TimeRange; from?: string; to?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.route_ids?.length) qs.set("route_ids", params.route_ids.join(","))
    if (params?.consumer_names?.length) qs.set("consumer_names", params.consumer_names.join(","))
    if (params?.from) {
      qs.set("from", params.from)
      if (params.to) qs.set("to", params.to)
    } else {
      qs.set("range", params?.range || "24h")
    }
    if (params?.limit) qs.set("limit", String(params.limit))
    return request<{ data: import("@/types/metrics").TopRoute[] }>(`/api/metrics/top-routes?${qs}`).then((r) => r.data)
  },

  metricsTopConsumers: (params?: { route_ids?: string[]; consumer_names?: string[]; range?: import("@/types/metrics").TimeRange; from?: string; to?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.route_ids?.length) qs.set("route_ids", params.route_ids.join(","))
    if (params?.consumer_names?.length) qs.set("consumer_names", params.consumer_names.join(","))
    if (params?.from) {
      qs.set("from", params.from)
      if (params.to) qs.set("to", params.to)
    } else {
      qs.set("range", params?.range || "24h")
    }
    if (params?.limit) qs.set("limit", String(params.limit))
    return request<{ data: import("@/types/metrics").TopConsumer[] }>(`/api/metrics/top-consumers?${qs}`).then((r) => r.data)
  },

  // AI Metrics
  aiMetricsTimeSeries: (params?: { range?: import("@/types/metrics").TimeRange; from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) {
      qs.set("from", params.from)
      if (params.to) qs.set("to", params.to)
    } else {
      qs.set("range", params?.range || "1h")
    }
    return request<{ data: import("@/types/ai-metrics").AITokenTimeSeries[] }>(`/api/ai/metrics/timeseries?${qs}`).then((r) => r.data)
  },

  aiMetricsSummary: (params?: { range?: import("@/types/metrics").TimeRange; from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) {
      qs.set("from", params.from)
      if (params.to) qs.set("to", params.to)
    } else {
      qs.set("range", params?.range || "24h")
    }
    return request<{ data: import("@/types/ai-metrics").AITokenSummary }>(`/api/ai/metrics/summary?${qs}`).then((r) => r.data)
  },

  aiTopProviders: (params?: { range?: import("@/types/metrics").TimeRange; from?: string; to?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) {
      qs.set("from", params.from)
      if (params.to) qs.set("to", params.to)
    } else {
      qs.set("range", params?.range || "24h")
    }
    if (params?.limit) qs.set("limit", String(params.limit))
    return request<{ data: import("@/types/ai-metrics").TopProvider[] }>(`/api/ai/metrics/top-providers?${qs}`).then((r) => r.data)
  },

  aiTopModels: (params?: { range?: import("@/types/metrics").TimeRange; from?: string; to?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.from) {
      qs.set("from", params.from)
      if (params.to) qs.set("to", params.to)
    } else {
      qs.set("range", params?.range || "24h")
    }
    if (params?.limit) qs.set("limit", String(params.limit))
    return request<{ data: import("@/types/ai-metrics").TopModel[] }>(`/api/ai/metrics/top-models?${qs}`).then((r) => r.data)
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

  // API Deployments
  listApiDeployments: (id: string) =>
    request<{ data: import("@/types/api").ApiDeployment[] }>(`/api/apis/${id}/deployments`).then((r) => r.data),

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

  // Alerts
  listAlertRules: () =>
    request<{ data: import("@/types/alert").AlertRule[] }>("/api/alerts/rules").then((r) => r.data),

  getAlertRule: (id: string) =>
    request<{ data: import("@/types/alert").AlertRule }>(`/api/alerts/rules/${id}`).then((r) => r.data),

  createAlertRule: (data: import("@/types/alert").CreateAlertRuleRequest) =>
    request<{ data: import("@/types/alert").AlertRule }>("/api/alerts/rules", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  updateAlertRule: (id: string, data: import("@/types/alert").UpdateAlertRuleRequest) =>
    request<{ data: import("@/types/alert").AlertRule }>(`/api/alerts/rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  deleteAlertRule: (id: string) =>
    request<{ data: unknown }>(`/api/alerts/rules/${id}`, { method: "DELETE" }),

  acknowledgeAlert: (id: string) =>
    request<{ data: unknown }>(`/api/alerts/rules/${id}/ack`, { method: "POST" }),

  listAlertEvents: (params?: { rule_id?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.rule_id) qs.set("rule_id", params.rule_id)
    if (params?.limit) qs.set("limit", String(params.limit))
    const query = qs.toString()
    return request<{ data: import("@/types/alert").AlertEvent[] }>(`/api/alerts/events${query ? "?" + query : ""}`).then((r) => r.data)
  },

  alertFiringCount: () =>
    request<{ data: { count: number } }>("/api/alerts/firing-count").then((r) => r.data.count),

  // Reports (CSV downloads via fetch → blob)
  downloadReport: async (path: string, filename: string) => {
    const token = getToken()
    const headers: HeadersInit = {}
    if (token) headers["Authorization"] = `Bearer ${token}`
    const res = await fetch(`${BASE_URL}${path}`, { headers })
    if (!res.ok) throw new Error(`Report download failed (${res.status})`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  },

  reportUsageCSV: (params: { range?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params.from) { qs.set("from", params.from); if (params.to) qs.set("to", params.to) }
    else if (params.range) qs.set("range", params.range)
    return api.downloadReport(`/api/reports/usage/csv?${qs}`, `usage-report.csv`)
  },

  reportConsumerCSV: (params: { range?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params.from) { qs.set("from", params.from); if (params.to) qs.set("to", params.to) }
    else if (params.range) qs.set("range", params.range)
    return api.downloadReport(`/api/reports/consumers/csv?${qs}`, `consumer-report.csv`)
  },

  reportTimeSeriesCSV: (params: { range?: string; from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params.from) { qs.set("from", params.from); if (params.to) qs.set("to", params.to) }
    else if (params.range) qs.set("range", params.range)
    return api.downloadReport(`/api/reports/timeseries/csv?${qs}`, `timeseries-report.csv`)
  },

  // Notification Contacts
  listNotificationContacts: () =>
    request<{ data: import("@/types/notification-contact").NotificationContact[] }>("/api/notification-contacts").then((r) => r.data),

  createNotificationContact: (data: import("@/types/notification-contact").CreateNotificationContactRequest) =>
    request<{ data: import("@/types/notification-contact").NotificationContact }>("/api/notification-contacts", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  updateNotificationContact: (id: string, data: import("@/types/notification-contact").UpdateNotificationContactRequest) =>
    request<{ data: import("@/types/notification-contact").NotificationContact }>(`/api/notification-contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  deleteNotificationContact: (id: string) =>
    request<{ data: unknown }>(`/api/notification-contacts/${id}`, { method: "DELETE" }),

  testNotificationContact: (id: string) =>
    request<{ data: { message: string } }>(`/api/notification-contacts/${id}/test`, { method: "POST" }).then((r) => r.data),

  // Promotions
  listPromotions: (params?: { status?: string; api_definition_id?: string }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set("status", params.status)
    if (params?.api_definition_id) qs.set("api_definition_id", params.api_definition_id)
    const query = qs.toString()
    return request<{ data: import("@/types/promotion").PromotionRequest[] }>(`/api/promotions${query ? "?" + query : ""}`).then((r) => r.data)
  },

  getPromotion: (id: string) =>
    request<{ data: import("@/types/promotion").PromotionRequest }>(`/api/promotions/${id}`).then((r) => r.data),

  createPromotion: (data: import("@/types/promotion").CreatePromotionRequest) =>
    request<{ data: import("@/types/promotion").PromotionRequest }>("/api/promotions", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  reviewPromotion: (id: string, data: import("@/types/promotion").ReviewPromotionRequest) =>
    request<{ data: import("@/types/promotion").PromotionRequest }>(`/api/promotions/${id}/review`, {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  executePromotion: (id: string) =>
    request<{ data: import("@/types/promotion").PromotionRequest }>(`/api/promotions/${id}/execute`, {
      method: "POST",
    }).then((r) => r.data),

  // Environments
  listEnvironments: () =>
    request<{ data: import("@/types/environment").Environment[] }>("/api/environments").then((r) => r.data),

  createEnvironment: (data: import("@/types/environment").CreateEnvironmentRequest) =>
    request<{ data: import("@/types/environment").Environment }>("/api/environments", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  updateEnvironment: (id: string, data: import("@/types/environment").UpdateEnvironmentRequest) =>
    request<{ data: import("@/types/environment").Environment }>(`/api/environments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  deleteEnvironment: (id: string) =>
    request<{ data: unknown }>(`/api/environments/${id}`, { method: "DELETE" }),

  setDefaultEnvironment: (id: string) =>
    request<{ data: import("@/types/environment").Environment }>(`/api/environments/${id}/set-default`, {
      method: "POST",
    }).then((r) => r.data),

  testEnvironmentConnection: (id: string) =>
    request<{ data: import("@/types/environment").TestConnectionResult }>(`/api/environments/${id}/test-connection`, {
      method: "POST",
    }).then((r) => r.data),

  getEnvironmentHealth: (id: string) =>
    request<{ data: import("@/types/environment").GatewayHealth }>(`/api/environments/${id}/health`).then((r) => r.data),

  // Users
  listUsers: (params?: { search?: string; page?: number; page_size?: number }) => {
    const qs = new URLSearchParams()
    if (params?.search) qs.set("search", params.search)
    if (params?.page) qs.set("page", String(params.page))
    if (params?.page_size) qs.set("page_size", String(params.page_size))
    const query = qs.toString()
    return request<{ data: import("@/types/auth").User[]; total: number }>(`/api/users${query ? "?" + query : ""}`)
  },

  getUser: (id: string) =>
    request<{ data: import("@/types/auth").User }>(`/api/users/${id}`).then((r) => r.data),

  createUser: (data: import("@/types/auth").CreateUserRequest) =>
    request<{ data: import("@/types/auth").User }>("/api/users", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  updateUser: (id: string, data: import("@/types/auth").UpdateUserRequest) =>
    request<{ data: import("@/types/auth").User }>(`/api/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  resetPassword: (id: string, data: import("@/types/auth").ResetPasswordRequest) =>
    request<{ data: { message: string } }>(`/api/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  deleteUser: (id: string) =>
    request<{ data: unknown }>(`/api/users/${id}`, { method: "DELETE" }),

  // Roles
  listRoles: () =>
    request<{ data: import("@/types/auth").Role[] }>("/api/roles").then((r) => r.data),

  getRole: (id: string) =>
    request<{ data: import("@/types/auth").Role }>(`/api/roles/${id}`).then((r) => r.data),

  createRole: (data: import("@/types/auth").CreateRoleRequest) =>
    request<{ data: import("@/types/auth").Role }>("/api/roles", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  updateRole: (id: string, data: import("@/types/auth").UpdateRoleRequest) =>
    request<{ data: import("@/types/auth").Role }>(`/api/roles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  deleteRole: (id: string) =>
    request<{ data: unknown }>(`/api/roles/${id}`, { method: "DELETE" }),

  // System Settings
  getSetting: (key: string) =>
    request<{ data: unknown }>(`/api/settings/${key}`).then((r) => r.data),

  updateSetting: (key: string, value: unknown) =>
    request<{ data: unknown }>(`/api/settings/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }).then((r) => r.data),

  // Subscriptions
  listSubscriptions: (params?: { consumer_username?: string; api_definition_id?: string; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.consumer_username) qs.set("consumer_username", params.consumer_username)
    if (params?.api_definition_id) qs.set("api_definition_id", params.api_definition_id)
    if (params?.status) qs.set("status", params.status)
    const query = qs.toString()
    return request<{ data: import("@/types/subscription").Subscription[] }>(`/api/subscriptions${query ? "?" + query : ""}`).then((r) => r.data)
  },

  getSubscription: (id: string) =>
    request<{ data: import("@/types/subscription").Subscription }>(`/api/subscriptions/${id}`).then((r) => r.data),

  createSubscription: (data: import("@/types/subscription").CreateSubscriptionRequest) =>
    request<{ data: import("@/types/subscription").Subscription }>("/api/subscriptions", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  reviewSubscription: (id: string, data: import("@/types/subscription").ReviewSubscriptionRequest) =>
    request<{ data: import("@/types/subscription").Subscription }>(`/api/subscriptions/${id}/review`, {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  suspendSubscription: (id: string) =>
    request<{ data: import("@/types/subscription").Subscription }>(`/api/subscriptions/${id}/suspend`, {
      method: "POST",
    }).then((r) => r.data),

  revokeSubscription: (id: string, notes?: string) =>
    request<{ data: import("@/types/subscription").Subscription }>(`/api/subscriptions/${id}/revoke`, {
      method: "POST",
      body: JSON.stringify({ notes: notes || "" }),
    }).then((r) => r.data),

  // OAuth Providers (admin)
  listOAuthProviders: () =>
    request<{ data: import("@/types/oauth").OAuthProvider[] }>("/api/oauth/providers").then((r) => r.data),

  getOAuthProvider: (id: string) =>
    request<{ data: import("@/types/oauth").OAuthProvider }>(`/api/oauth/providers/${id}`).then((r) => r.data),

  createOAuthProvider: (data: import("@/types/oauth").CreateOAuthProviderRequest) =>
    request<{ data: import("@/types/oauth").OAuthProvider }>("/api/oauth/providers", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  updateOAuthProvider: (id: string, data: import("@/types/oauth").UpdateOAuthProviderRequest) =>
    request<{ data: import("@/types/oauth").OAuthProvider }>(`/api/oauth/providers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  deleteOAuthProvider: (id: string) =>
    request<{ data: unknown }>(`/api/oauth/providers/${id}`, { method: "DELETE" }),

  // OAuth Auth (public - no token required)
  listEnabledOAuthProviders: () =>
    request<{ data: import("@/types/oauth").PublicOAuthProvider[] }>("/api/auth/oauth/providers").then((r) => r.data),

  oauthAuthorize: (provider: string, redirectUri: string) =>
    request<{ data: { url: string; state: string } }>(`/api/auth/oauth/${provider}/authorize?redirect_uri=${encodeURIComponent(redirectUri)}`).then((r) => r.data),

  oauthCallback: (provider: string, code: string, state: string, redirectUri: string) =>
    request<{ data: import("@/types/auth").TokenResponse }>(`/api/auth/oauth/${provider}/callback`, {
      method: "POST",
      body: JSON.stringify({ code, state, redirect_uri: redirectUri }),
    }).then((r) => {
      setToken(r.data.access_token)
      setRefreshToken(r.data.refresh_token)
      return r.data
    }),

  // Portal Settings (admin)
  getPortalSettings: (apiId: string) =>
    request<{ data: { portal_visible: boolean; portal_categories: string[]; openapi_spec: string } }>(`/api/apis/${apiId}/portal`).then((r) => r.data),

  updatePortalSettings: (apiId: string, data: { portal_visible?: boolean; portal_categories?: string[]; openapi_spec?: string }) =>
    request<{ data: unknown }>(`/api/apis/${apiId}/portal`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Testing - Suites
  listTestSuites: () =>
    request<{ data: import("@/types/testing").TestSuite[] }>("/api/testing/suites").then((r) => r.data),

  getTestSuite: (id: string) =>
    request<{ data: import("@/types/testing").TestSuite }>(`/api/testing/suites/${id}`).then((r) => r.data),

  createTestSuite: (data: { name: string; description: string; api_id?: string; steps: import("@/types/testing").TestStep[]; tags: string[] }) =>
    request<{ data: import("@/types/testing").TestSuite }>("/api/testing/suites", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  updateTestSuite: (id: string, data: { name: string; description: string; api_id?: string; steps: import("@/types/testing").TestStep[]; tags: string[] }) =>
    request<{ data: import("@/types/testing").TestSuite }>(`/api/testing/suites/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  deleteTestSuite: (id: string) =>
    request<{ data: unknown }>(`/api/testing/suites/${id}`, { method: "DELETE" }),

  // Testing - Runs
  listTestRuns: (suiteId: string) =>
    request<{ data: import("@/types/testing").TestRun[] }>(`/api/testing/runs?suite_id=${suiteId}`).then((r) => r.data),

  runTestSuite: (suiteId: string) =>
    request<{ data: import("@/types/testing").TestRun }>(`/api/testing/suites/${suiteId}/run`, {
      method: "POST",
    }).then((r) => r.data),

  // Testing - Synthetic Monitors
  listSyntheticMonitors: () =>
    request<{ data: import("@/types/testing").SyntheticMonitor[] }>("/api/testing/monitors").then((r) => r.data),

  createSyntheticMonitor: (data: { name: string; description: string; suite_id: string; interval_sec: number; locations: string[]; notify_contact_ids?: string[] }) =>
    request<{ data: import("@/types/testing").SyntheticMonitor }>("/api/testing/monitors", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  updateSyntheticMonitor: (id: string, data: Record<string, unknown>) =>
    request<{ data: import("@/types/testing").SyntheticMonitor }>(`/api/testing/monitors/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  toggleSyntheticMonitor: (id: string, enabled: boolean) =>
    request<{ data: import("@/types/testing").SyntheticMonitor }>(`/api/testing/monitors/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }).then((r) => r.data),

  deleteSyntheticMonitor: (id: string) =>
    request<{ data: unknown }>(`/api/testing/monitors/${id}`, { method: "DELETE" }),

  // Testing - SLA Definitions
  listSLADefinitions: () =>
    request<{ data: import("@/types/testing").SLADefinition[] }>("/api/testing/slas").then((r) => r.data),

  createSLADefinition: (data: { name: string; description: string; api_id?: string; availability_pct: number; latency_p99_ms: number; error_rate_pct: number; eval_window: "7d" | "30d" | "90d" }) =>
    request<{ data: import("@/types/testing").SLADefinition }>("/api/testing/slas", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.data),

  deleteSLADefinition: (id: string) =>
    request<{ data: unknown }>(`/api/testing/slas/${id}`, { method: "DELETE" }),

  // Service Mesh
  getMeshOverview: () =>
    request<{ data: import("@/types/mesh").MeshOverview }>("/api/mesh/overview").then((r) => r.data),

  listMeshServices: () =>
    request<{ data: import("@/types/mesh").MeshService[] }>("/api/mesh/services").then((r) => r.data),

  getMeshService: (id: string) =>
    request<{ data: import("@/types/mesh").MeshService }>(`/api/mesh/services/${id}`).then((r) => r.data),

  getMeshTopology: () =>
    request<{ data: import("@/types/mesh").MeshTopology }>("/api/mesh/topology").then((r) => r.data),

  getMeshDiscoveryStatus: () =>
    request<{ data: import("@/types/mesh").DiscoveryStatus[] }>("/api/mesh/discovery-status").then((r) => r.data),

  // Kafka
  listKafkaConnections: () =>
    request<{ data: import("@/types/kafka").KafkaConnection[] }>("/api/kafka/connections"),

  getKafkaConnection: (id: string) =>
    request<{ data: import("@/types/kafka").KafkaConnection }>(`/api/kafka/connections/${id}`),

  createKafkaConnection: (data: Partial<import("@/types/kafka").KafkaConnection>) =>
    request<{ data: import("@/types/kafka").KafkaConnection }>("/api/kafka/connections", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateKafkaConnection: (id: string, data: Partial<import("@/types/kafka").KafkaConnection>) =>
    request<{ data: import("@/types/kafka").KafkaConnection }>(`/api/kafka/connections/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteKafkaConnection: (id: string) =>
    request<void>(`/api/kafka/connections/${id}`, { method: "DELETE" }),

  listKafkaTopics: (connectionId: string) =>
    request<{ data: string[] }>(`/api/kafka/${connectionId}/topics`),

  getKafkaTopic: (connectionId: string, topic: string) =>
    request<{ data: import("@/types/kafka").KafkaTopic }>(`/api/kafka/${connectionId}/topics/${topic}`),

  produceKafkaMessage: (connectionId: string, topic: string, data: import("@/types/kafka").ProduceRequest) =>
    request<{ data: unknown }>(`/api/kafka/${connectionId}/topics/${topic}/produce`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  consumeKafkaMessages: (connectionId: string, topic: string, data: import("@/types/kafka").ConsumeRequest) =>
    request<{ data: import("@/types/kafka").KafkaMessage[] }>(`/api/kafka/${connectionId}/topics/${topic}/consume`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listKafkaConsumerGroups: (connectionId: string) =>
    request<{ data: import("@/types/kafka").ConsumerGroupInfo[] }>(`/api/kafka/${connectionId}/consumer-groups`),

  // Event APIs
  listEventApis: () =>
    request<{ data: import("@/types/event-api").EventApi[] }>("/api/kafka/event-apis"),

  getEventApi: (id: string) =>
    request<{ data: import("@/types/event-api").EventApi }>(`/api/kafka/event-apis/${id}`),

  createEventApi: (data: import("@/types/event-api").CreateEventApiRequest) =>
    request<{ data: import("@/types/event-api").EventApi }>("/api/kafka/event-apis", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateEventApi: (id: string, data: import("@/types/event-api").UpdateEventApiRequest) =>
    request<{ data: import("@/types/event-api").EventApi }>(`/api/kafka/event-apis/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteEventApi: (id: string) =>
    request<void>(`/api/kafka/event-apis/${id}`, { method: "DELETE" }),

  deployEventApi: (id: string) =>
    request<{ data: import("@/types/event-api").EventApi }>(`/api/kafka/event-apis/${id}/deploy`, {
      method: "POST",
    }),

  undeployEventApi: (id: string) =>
    request<{ data: import("@/types/event-api").EventApi }>(`/api/kafka/event-apis/${id}/undeploy`, {
      method: "POST",
    }),

  // Webhook Subscriptions
  listWebhooks: (eventApiId: string) =>
    request<{ data: import("@/types/webhook").WebhookSubscription[] }>(`/api/kafka/event-apis/${eventApiId}/webhooks`),

  getWebhook: (eventApiId: string, whId: string) =>
    request<{ data: import("@/types/webhook").WebhookSubscription }>(`/api/kafka/event-apis/${eventApiId}/webhooks/${whId}`),

  createWebhook: (eventApiId: string, data: import("@/types/webhook").CreateWebhookRequest) =>
    request<{ data: import("@/types/webhook").WebhookSubscription }>(`/api/kafka/event-apis/${eventApiId}/webhooks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateWebhook: (eventApiId: string, whId: string, data: import("@/types/webhook").UpdateWebhookRequest) =>
    request<{ data: import("@/types/webhook").WebhookSubscription }>(`/api/kafka/event-apis/${eventApiId}/webhooks/${whId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteWebhook: (eventApiId: string, whId: string) =>
    request<void>(`/api/kafka/event-apis/${eventApiId}/webhooks/${whId}`, { method: "DELETE" }),

  listWebhookDeliveries: (eventApiId: string, whId: string, limit?: number) =>
    request<{ data: import("@/types/webhook").WebhookDelivery[] }>(
      `/api/kafka/event-apis/${eventApiId}/webhooks/${whId}/deliveries${limit ? `?limit=${limit}` : ""}`
    ),

  resetWebhookCircuitBreaker: (eventApiId: string, whId: string) =>
    request<{ ok: boolean }>(`/api/kafka/event-apis/${eventApiId}/webhooks/${whId}/reset-circuit`, {
      method: "POST",
    }),

  retryWebhookDelivery: (eventApiId: string, whId: string, dlvId: string) =>
    request<{ ok: boolean }>(`/api/kafka/event-apis/${eventApiId}/webhooks/${whId}/deliveries/${dlvId}/retry`, {
      method: "POST",
    }),

  // Event API Permissions (per-topic access control)
  listPermissions: (eventApiId: string) =>
    request<{ data: import("@/types/event-api").EventApiPermission[] }>(`/api/kafka/event-apis/${eventApiId}/permissions`),

  upsertPermission: (eventApiId: string, data: import("@/types/event-api").UpsertPermissionRequest) =>
    request<{ data: import("@/types/event-api").EventApiPermission }>(`/api/kafka/event-apis/${eventApiId}/permissions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deletePermission: (eventApiId: string, permId: string) =>
    request<void>(`/api/kafka/event-apis/${eventApiId}/permissions/${permId}`, { method: "DELETE" }),

  // Event Gateway Metrics
  getEventApiMetrics: (eventApiId: string, range_?: string) =>
    request<{ data: import("@/types/event-api").EventApiMetricsRow[] }>(
      `/api/kafka/event-apis/${eventApiId}/metrics${range_ ? `?range=${range_}` : ""}`
    ).then((r) => r.data),

  getEventApiMetricsSummary: (eventApiId: string, range_?: string) =>
    request<{ data: import("@/types/event-api").EventApiMetricsSummary }>(
      `/api/kafka/event-apis/${eventApiId}/metrics/summary${range_ ? `?range=${range_}` : ""}`
    ).then((r) => r.data),

  // Consumer Groups
  listConsumerGroups: (eventApiId: string) =>
    request<{ data: import("@/types/event-api").ConsumerGroupInfo[] }>(
      `/api/kafka/event-apis/${eventApiId}/consumer-groups`
    ).then((r) => r.data),

  describeConsumerGroup: (eventApiId: string, groupId: string) =>
    request<{ data: import("@/types/event-api").ConsumerGroupInfo }>(
      `/api/kafka/event-apis/${eventApiId}/consumer-groups/${encodeURIComponent(groupId)}`
    ).then((r) => r.data),

  resetConsumerGroupOffsets: (eventApiId: string, groupId: string, strategy: string) =>
    request<{ ok: boolean }>(
      `/api/kafka/event-apis/${eventApiId}/consumer-groups/${encodeURIComponent(groupId)}/reset`,
      { method: "POST", body: JSON.stringify({ strategy }) }
    ),

  // Event Schemas
  listSchemas: (eventApiId: string) =>
    request<{ data: import("@/types/event-api").EventSchema[] }>(
      `/api/kafka/event-apis/${eventApiId}/schemas`
    ).then((r) => r.data),

  getSchemaVersion: (eventApiId: string, version: number) =>
    request<{ data: import("@/types/event-api").EventSchema }>(
      `/api/kafka/event-apis/${eventApiId}/schemas/${version}`
    ).then((r) => r.data),

  createSchema: (eventApiId: string, data: { schema_content: Record<string, unknown>; description?: string; is_active?: boolean }) =>
    request<{ data: import("@/types/event-api").EventSchema }>(
      `/api/kafka/event-apis/${eventApiId}/schemas`,
      { method: "POST", body: JSON.stringify(data) }
    ).then((r) => r.data),

  deactivateSchema: (eventApiId: string, version: number) =>
    request<{ ok: boolean }>(
      `/api/kafka/event-apis/${eventApiId}/schemas/${version}`,
      { method: "DELETE" }
    ),

  // Request Tracing
  listTraces: (params?: import("@/types/trace").TraceListParams) => {
    const qs = new URLSearchParams()
    if (params?.route_id) qs.set("route_id", params.route_id)
    if (params?.api_id) qs.set("api_id", params.api_id)
    if (params?.method) qs.set("method", params.method)
    if (params?.status_min) qs.set("status_min", String(params.status_min))
    if (params?.status_max) qs.set("status_max", String(params.status_max))
    if (params?.min_duration_ms) qs.set("min_duration_ms", String(params.min_duration_ms))
    if (params?.max_duration_ms) qs.set("max_duration_ms", String(params.max_duration_ms))
    if (params?.search) qs.set("search", params.search)
    if (params?.from) qs.set("from", params.from)
    if (params?.to) qs.set("to", params.to)
    if (params?.limit) qs.set("limit", String(params.limit))
    if (params?.offset) qs.set("offset", String(params.offset))
    const query = qs.toString()
    return request<{ data: import("@/types/trace").RequestTrace[]; meta: { total: number; page: number; page_size: number } }>(`/api/tracing/traces${query ? "?" + query : ""}`)
  },

  getTrace: (traceId: string) =>
    request<{ data: import("@/types/trace").RequestTrace }>(`/api/tracing/traces/${traceId}`).then((r) => r.data),

  getTracingStatus: () =>
    request<{ data: import("@/types/trace").TracingStatus }>("/api/tracing/status").then((r) => r.data),

  updateTracingSettings: (settings: Partial<import("@/types/trace").TracingStatus>) =>
    request<{ data: import("@/types/trace").TracingStatus }>("/api/tracing/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }).then((r) => r.data),

  testClickHouseConnection: (params: { addr: string; database: string; user: string; password: string }) =>
    request<{ data: { ok: boolean; message: string } }>("/api/settings/clickhouse/test", {
      method: "POST",
      body: JSON.stringify(params),
    }).then((r) => r.data),

  testElasticsearchConnection: (params: { addresses: string[]; username: string; password: string; api_key: string }) =>
    request<{ data: { ok: boolean; message: string } }>("/api/settings/elasticsearch/test", {
      method: "POST",
      body: JSON.stringify(params),
    }).then((r) => r.data),

  switchAnalyticsBackend: (settings: import("@/types/trace").AnalyticsBackendSettings) =>
    request<{ data: { type: string; message: string } }>("/api/settings/analytics-backend/switch", {
      method: "POST",
      body: JSON.stringify(settings),
    }).then((r) => r.data),

  switchTraceBackend: (config: import("@/types/trace").BackendConfig) =>
    request<{ data: { trace_backend: string; message: string } }>("/api/settings/trace-backend/switch", {
      method: "POST",
      body: JSON.stringify(config),
    }).then((r) => r.data),

  switchMetricsBackend: (config: import("@/types/trace").BackendConfig) =>
    request<{ data: { metrics_backend: string; message: string } }>("/api/settings/metrics-backend/switch", {
      method: "POST",
      body: JSON.stringify(config),
    }).then((r) => r.data),

  testPrometheusConnection: (params: { url: string; username: string; password: string }) =>
    request<{ data: { ok: boolean; message: string } }>("/api/settings/prometheus/test", {
      method: "POST",
      body: JSON.stringify(params),
    }).then((r) => r.data),

  getAnalyticsBackendStatus: () =>
    request<{ data: import("@/types/trace").AnalyticsBackendStatus }>("/api/settings/analytics-backend/status").then((r) => r.data),

  // LLM / AI assistant
  listLLMConfigs: () =>
    request<{ data: import("@/types/llm").LLMConfig[] }>("/api/settings/llm-configs").then((r) => r.data ?? []),

  getLLMUsage: () =>
    request<{ data: import("@/types/llm").LLMUsageSummary[] }>("/api/settings/llm-configs/usage").then((r) => r.data ?? []),

  upsertLLMConfig: (provider: string, payload: { model: string; api_key: string; enabled: boolean; daily_quota: number }) =>
    request<{ data: import("@/types/llm").LLMConfig }>(`/api/settings/llm-configs/${provider}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }).then((r) => r.data),

  deleteLLMConfig: (provider: string) =>
    request<void>(`/api/settings/llm-configs/${provider}`, { method: "DELETE" }),

  checkAIStatus: () =>
    request<{ data: import("@/types/llm").AIStatus }>("/api/ai/status").then((r) => r.data),

  sendChat: (payload: import("@/types/llm").ChatRequest) =>
    request<{ data: import("@/types/llm").ChatResponse }>("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then((r) => r.data),

  sendChatStream: async (
    payload: import("@/types/llm").ChatRequest,
    onChunk: (chunk: string) => void,
  ): Promise<{ tokens_in?: number; tokens_out?: number }> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
    const response = await fetch(`${BASE_URL}/api/ai/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const text = await response.text()
      let message = "Request failed"
      try { message = JSON.parse(text)?.error?.message || message } catch { /* ignore */ }
      throw new Error(message)
    }
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let tokenData: { tokens_in?: number; tokens_out?: number } = {}
    let currentEvent = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim()
        } else if (line.startsWith("data:")) {
          const data = line.slice(5).trim()
          try {
            const parsed = JSON.parse(data)
            if (currentEvent === "chunk" && parsed.content) {
              onChunk(parsed.content)
            } else if (currentEvent === "done") {
              tokenData = parsed
            } else if (currentEvent === "error") {
              throw new Error(parsed.message || "LLM error")
            }
          } catch (e) {
            if (!(e instanceof SyntaxError)) throw e
          }
          currentEvent = ""
        }
      }
    }
    return tokenData
  },

  generateAPI: (description: string) =>
    request<{ data: import("@/types/llm").GeneratedAPIConfig }>("/api/ai/generate-api", {
      method: "POST",
      body: JSON.stringify({ description }),
    }).then((r) => r.data),

  // Backup & Restore
  getBackupConfig: () =>
    request<{ data: Record<string, unknown> | null }>("/api/backup/config").then((r) => r.data),

  saveBackupConfig: (config: Record<string, unknown>) =>
    request<{ data: Record<string, unknown> }>("/api/backup/configure", {
      method: "POST",
      body: JSON.stringify(config),
    }).then((r) => r.data),

  testBackupConnection: () =>
    request<{ data: { ok: boolean; message: string } }>("/api/backup/test-connection", {
      method: "POST",
    }).then((r) => r.data),

  createBackup: () =>
    request<{ data: { commit_sha: string; message: string } }>("/api/backup/create", {
      method: "POST",
    }).then((r) => r.data),

  getBackupHistory: () =>
    request<{ data: Array<{ sha: string; message: string; date: string; author: string }> }>("/api/backup/history").then((r) => r.data),

  previewRestore: (sha: string) =>
    request<{ data: { added: string[]; modified: string[]; deleted: string[] } }>(`/api/backup/restore/${sha}/preview`).then((r) => r.data),

  restoreBackup: (sha: string, dryRun?: boolean) =>
    request<{ data: { message: string; applied: number } }>("/api/backup/restore", {
      method: "POST",
      body: JSON.stringify({ sha, dry_run: dryRun }),
    }).then((r) => r.data),
}
