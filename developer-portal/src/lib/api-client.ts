const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("portal-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, headers: extraHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string>),
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      /* empty */
    }
    throw new ApiError(res.status, res.statusText, data);
  }

  if (res.status === 204) return undefined as T;

  const json = await res.json();

  // Backend wraps responses in {"data": ...} envelope — unwrap it
  if (json && typeof json === "object" && "data" in json) {
    return json.data as T;
  }

  return json as T;
}

export const portalApi = {
  // Public
  listAPIs: async (params?: { search?: string; category?: string; page?: number; page_size?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.category) qs.set("category", params.category);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.page_size) qs.set("page_size", String(params.page_size));
    const q = qs.toString();
    // This endpoint returns {data: [...], total: N, page: N} — non-standard envelope
    const res = await fetch(`${API_BASE}/api/portal/apis${q ? `?${q}` : ""}`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    const json = await res.json();
    return { apis: json.data || [], total: json.total || 0, page: json.page || 1 };
  },

  getAPI: (id: string) =>
    request<PortalApiDetail>(`/api/portal/apis/${id}`),

  getSpec: async (id: string) => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/api/portal/apis/${id}/spec`, { headers });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    const spec = await res.text();
    return { spec };
  },

  getCategories: async () => {
    const data = await request<string[]>("/api/portal/categories");
    // data is already unwrapped from envelope
    return { categories: Array.isArray(data) ? data : [] };
  },

  getStats: (id?: string) =>
    request<{ api_count: number; developer_count: number }>("/api/portal/stats"),

  // Auth
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const raw = await request<RawTokenResponse>("/api/portal/register", { method: "POST", body: data });
    return mapTokenResponse(raw);
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const raw = await request<RawTokenResponse>("/api/auth/login", { method: "POST", body: data });
    return mapTokenResponse(raw);
  },

  // Authenticated
  getProfile: () =>
    request<DeveloperProfile>("/api/portal/my/profile"),

  updateProfile: (data: UpdateProfileRequest) =>
    request<DeveloperProfile>("/api/portal/my/profile", { method: "PUT", body: data }),

  listMySubscriptions: async () => {
    const data = await request<PortalSubscription[]>("/api/portal/my/subscriptions");
    return { subscriptions: Array.isArray(data) ? data : [] };
  },

  subscribe: (apiId: string, data: { plan_id: string; notes?: string }) =>
    request<PortalSubscription>(`/api/portal/apis/${apiId}/subscribe`, { method: "POST", body: data }),
};

// Raw token response from backend (uses access_token, not token)
interface RawTokenResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    username: string;
    email?: string;
    display_name: string;
    role_name: string;
  };
}

function mapTokenResponse(raw: RawTokenResponse): AuthResponse {
  return {
    token: raw.access_token,
    refresh_token: raw.refresh_token,
    user: {
      id: raw.user.id,
      username: raw.user.username,
      email: raw.user.email || "",
      full_name: raw.user.display_name,
      role: raw.user.role_name,
    },
  };
}

// Types
export interface PortalApiSummary {
  id: string;
  name: string;
  description: string;
  version: string;
  lifecycle: string;
  categories: string[];
  has_docs: boolean;
  plan_count: number;
  created_at: string;
}

export interface PortalPlan {
  id: string;
  name: string;
  description: string;
  rate_limit: number;
  quota_day: number;
  quota_month: number;
}

export interface PortalApiDetail extends PortalApiSummary {
  openapi_spec: string;
  plans: PortalPlan[];
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  full_name: string;
  company?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  refresh_token: string;
  user: {
    id: string;
    username: string;
    email: string;
    full_name: string;
    role: string;
  };
}

export interface DeveloperProfile {
  id: string;
  username: string;
  email: string;
  full_name: string;
  company: string;
  active_subscriptions: number;
  total_keys: number;
  created_at: string;
}

export interface UpdateProfileRequest {
  full_name?: string;
  email?: string;
  company?: string;
}

export interface PortalSubscription {
  id: string;
  api_id: string;
  api_name: string;
  plan_id: string;
  plan_name: string;
  status: string;
  consumer_name: string;
  api_key: string;
  created_at: string;
}

export { ApiError };
