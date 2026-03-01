// Plugin form definitions for typed configuration forms
// Each plugin gets a declarative form definition that the PluginFormRenderer
// uses to render proper typed fields instead of a raw JSON textarea.

// --- Type Definitions ---

export interface PluginFieldDef {
  key: string                    // JSON path in config (supports dot notation: "abort.http_status")
  label: string
  description?: string
  type: "string" | "number" | "integer" | "boolean" | "enum" | "password" | "string-array" | "text"
  required?: boolean
  defaultValue?: unknown
  placeholder?: string
  // For enum type
  options?: { value: string; label: string }[]
  // For number/integer type
  min?: number
  max?: number
  step?: number
  suffix?: string               // e.g., "req/s", "ms", "seconds"
  // Conditional rendering
  visibleWhen?: { field: string; value?: unknown; notValue?: unknown }
}

export interface PluginFieldGroup {
  title: string
  description?: string
  collapsible?: boolean
  defaultOpen?: boolean
  fields: PluginFieldDef[]
  visibleWhen?: { field: string; value?: unknown; notValue?: unknown }
}

export interface PluginFormDef {
  pluginName: string
  groups: PluginFieldGroup[]
}

// --- Shared Field Groups ---

const REDIS_FIELDS: PluginFieldGroup = {
  title: "Redis Configuration",
  collapsible: true,
  defaultOpen: false,
  visibleWhen: { field: "policy", value: "redis" },
  fields: [
    { key: "redis_host", label: "Host", type: "string", defaultValue: "127.0.0.1", placeholder: "127.0.0.1" },
    { key: "redis_port", label: "Port", type: "integer", defaultValue: 6379, min: 1, max: 65535 },
    { key: "redis_password", label: "Password", type: "password" },
    { key: "redis_database", label: "Database", type: "integer", defaultValue: 0, min: 0 },
    { key: "redis_timeout", label: "Timeout", type: "integer", defaultValue: 1000, suffix: "ms", min: 1 },
  ],
}

const REDIS_CLUSTER_FIELDS: PluginFieldGroup = {
  title: "Redis Cluster Configuration",
  collapsible: true,
  defaultOpen: false,
  visibleWhen: { field: "policy", value: "redis-cluster" },
  fields: [
    { key: "redis_cluster_nodes", label: "Cluster Nodes", type: "string-array", placeholder: "host:port" },
    { key: "redis_cluster_name", label: "Cluster Name", type: "string" },
    { key: "redis_cluster_password", label: "Cluster Password", type: "password" },
  ],
}

const REJECTED_FIELDS: PluginFieldDef[] = [
  { key: "rejected_code", label: "Rejected Status Code", type: "integer", defaultValue: 503, min: 200, max: 599 },
  { key: "rejected_msg", label: "Rejected Message", type: "string", placeholder: "Optional rejection body" },
]

// --- Plugin Form Definitions ---

// Authentication

const KEY_AUTH: PluginFormDef = {
  pluginName: "key-auth",
  groups: [
    {
      title: "Configuration",
      fields: [
        { key: "key", label: "API Key", type: "password", description: "The API key value. Leave empty to auto-generate." },
        { key: "header", label: "Header Name", type: "string", defaultValue: "apikey", placeholder: "apikey", description: "Header name to read the key from" },
        { key: "query", label: "Query Param", type: "string", placeholder: "apikey", description: "Query parameter name to read the key from" },
        { key: "hide_credentials", label: "Hide Credentials", type: "boolean", defaultValue: false, description: "Remove the auth header/param before proxying" },
      ],
    },
  ],
}

const BASIC_AUTH: PluginFormDef = {
  pluginName: "basic-auth",
  groups: [
    {
      title: "Credentials",
      fields: [
        { key: "username", label: "Username", type: "string", required: true },
        { key: "password", label: "Password", type: "password", required: true },
      ],
    },
    {
      title: "Options",
      fields: [
        { key: "hide_credentials", label: "Hide Credentials", type: "boolean", defaultValue: false, description: "Remove the Authorization header before proxying" },
      ],
    },
  ],
}

const JWT_AUTH: PluginFormDef = {
  pluginName: "jwt-auth",
  groups: [
    {
      title: "Token Settings",
      fields: [
        { key: "key", label: "Consumer Key", type: "string", required: true, description: "Unique key to identify the consumer" },
        { key: "secret", label: "Secret", type: "password", description: "Signing secret (for HS256/HS512)" },
        { key: "public_key", label: "Public Key", type: "password", description: "Public key PEM (for RS256/ES256). Supports secret reference.", visibleWhen: { field: "algorithm", notValue: "HS256" } },
        { key: "private_key", label: "Private Key", type: "password", description: "Private key PEM (for RS256/ES256). Supports secret reference.", visibleWhen: { field: "algorithm", notValue: "HS256" } },
        { key: "algorithm", label: "Algorithm", type: "enum", defaultValue: "HS256", options: [
          { value: "HS256", label: "HS256" },
          { value: "HS512", label: "HS512" },
          { value: "RS256", label: "RS256" },
          { value: "ES256", label: "ES256" },
        ]},
      ],
    },
    {
      title: "Validation",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "exp", label: "Expiration", type: "integer", defaultValue: 86400, suffix: "s", description: "Token expiration time" },
        { key: "base64_secret", label: "Base64 Secret", type: "boolean", defaultValue: false, description: "Secret is base64 encoded" },
        { key: "lifetime_grace_period", label: "Grace Period", type: "integer", defaultValue: 0, suffix: "s", description: "Extra time allowed after token expiry" },
        { key: "claims_to_verify", label: "Claims to Verify", type: "string-array", placeholder: "exp", description: "JWT claims to verify" },
      ],
    },
  ],
}

const HMAC_AUTH: PluginFormDef = {
  pluginName: "hmac-auth",
  groups: [
    {
      title: "Credentials",
      fields: [
        { key: "access_key", label: "Access Key", type: "string", required: true },
        { key: "secret_key", label: "Secret Key", type: "password", required: true },
        { key: "algorithm", label: "Algorithm", type: "enum", defaultValue: "hmac-sha256", options: [
          { value: "hmac-sha256", label: "HMAC-SHA256" },
          { value: "hmac-sha512", label: "HMAC-SHA512" },
        ]},
      ],
    },
    {
      title: "Options",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "clock_skew", label: "Clock Skew", type: "integer", defaultValue: 0, suffix: "s", description: "Allowed time difference" },
        { key: "signed_headers", label: "Signed Headers", type: "string-array", placeholder: "x-date", description: "Required signed headers" },
        { key: "keep_headers", label: "Keep Headers", type: "boolean", defaultValue: false, description: "Keep auth headers after verification" },
        { key: "encode_uri_params", label: "Encode URI Params", type: "boolean", defaultValue: true },
      ],
    },
  ],
}

const OPENID_CONNECT: PluginFormDef = {
  pluginName: "openid-connect",
  groups: [
    {
      title: "Provider",
      fields: [
        { key: "client_id", label: "Client ID", type: "string", required: true },
        { key: "client_secret", label: "Client Secret", type: "password", required: true },
        { key: "discovery", label: "Discovery URL", type: "string", required: true, placeholder: "https://idp.example.com/.well-known/openid-configuration", description: "OpenID Connect discovery endpoint" },
        { key: "realm", label: "Realm", type: "string", defaultValue: "apisix", description: "Realm for WWW-Authenticate header" },
      ],
    },
    {
      title: "Authentication Mode",
      fields: [
        { key: "bearer_only", label: "Bearer Only", type: "boolean", defaultValue: false, description: "Only accept bearer tokens (no redirect flow)" },
        { key: "scope", label: "Scope", type: "string", defaultValue: "openid", placeholder: "openid profile email" },
        { key: "token_endpoint_auth_method", label: "Auth Method", type: "enum", defaultValue: "client_secret_basic", options: [
          { value: "client_secret_basic", label: "Client Secret Basic" },
          { value: "client_secret_post", label: "Client Secret Post" },
          { value: "private_key_jwt", label: "Private Key JWT" },
        ]},
      ],
    },
    {
      title: "Redirect & Session",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "redirect_uri", label: "Redirect URI", type: "string", placeholder: "/callback", description: "OAuth2 redirect URI" },
        { key: "logout_path", label: "Logout Path", type: "string", defaultValue: "/logout" },
        { key: "post_logout_redirect_uri", label: "Post-Logout Redirect", type: "string", placeholder: "/" },
        { key: "ssl_verify", label: "Verify SSL", type: "boolean", defaultValue: true },
        { key: "timeout", label: "Timeout", type: "integer", defaultValue: 3, suffix: "s" },
        { key: "set_access_token_header", label: "Set Access Token Header", type: "boolean", defaultValue: true },
        { key: "set_id_token_header", label: "Set ID Token Header", type: "boolean", defaultValue: true },
        { key: "set_userinfo_header", label: "Set Userinfo Header", type: "boolean", defaultValue: true },
      ],
    },
    {
      title: "Introspection",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "introspection_endpoint", label: "Introspection Endpoint", type: "string", placeholder: "https://idp.example.com/introspect" },
        { key: "introspection_endpoint_auth_method", label: "Auth Method", type: "enum", defaultValue: "client_secret_basic", options: [
          { value: "client_secret_basic", label: "Client Secret Basic" },
          { value: "client_secret_post", label: "Client Secret Post" },
        ]},
      ],
    },
  ],
}

const FORWARD_AUTH: PluginFormDef = {
  pluginName: "forward-auth",
  groups: [
    {
      title: "Configuration",
      fields: [
        { key: "uri", label: "Auth Service URI", type: "string", required: true, placeholder: "http://auth-service:8080/verify", description: "URI of the external auth service" },
        { key: "request_method", label: "Request Method", type: "enum", defaultValue: "GET", options: [
          { value: "GET", label: "GET" },
          { value: "POST", label: "POST" },
        ]},
        { key: "request_headers", label: "Request Headers", type: "string-array", placeholder: "Authorization", description: "Headers to forward to auth service" },
        { key: "upstream_headers", label: "Upstream Headers", type: "string-array", placeholder: "X-User-Id", description: "Headers from auth response to set in upstream request" },
        { key: "client_headers", label: "Client Headers", type: "string-array", placeholder: "Location", description: "Headers from auth response to set in client response (on failure)" },
      ],
    },
    {
      title: "Options",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "timeout", label: "Timeout", type: "integer", defaultValue: 3000, suffix: "ms", min: 1 },
        { key: "keepalive", label: "Keepalive", type: "boolean", defaultValue: true },
        { key: "keepalive_timeout", label: "Keepalive Timeout", type: "integer", defaultValue: 60000, suffix: "ms" },
        { key: "keepalive_pool", label: "Keepalive Pool Size", type: "integer", defaultValue: 5 },
        { key: "status_on_error", label: "Status on Error", type: "integer", defaultValue: 403, min: 200, max: 599, description: "Status code to return when auth service is unavailable" },
      ],
    },
  ],
}

// Security

const IP_RESTRICTION: PluginFormDef = {
  pluginName: "ip-restriction",
  groups: [
    {
      title: "Access Control",
      fields: [
        { key: "_mode", label: "Mode", type: "enum", defaultValue: "whitelist", options: [
          { value: "whitelist", label: "Whitelist (allow only)" },
          { value: "blacklist", label: "Blacklist (deny only)" },
        ], description: "Choose whether to allow or deny the listed IPs" },
        { key: "whitelist", label: "Allowed IPs", type: "string-array", placeholder: "192.168.1.0/24", description: "IP addresses or CIDR ranges to allow", visibleWhen: { field: "_mode", value: "whitelist" } },
        { key: "blacklist", label: "Blocked IPs", type: "string-array", placeholder: "10.0.0.0/8", description: "IP addresses or CIDR ranges to deny", visibleWhen: { field: "_mode", value: "blacklist" } },
        { key: "message", label: "Rejection Message", type: "string", placeholder: "Your IP address is not allowed", description: "Custom message shown when access is denied" },
      ],
    },
  ],
}

const URI_BLOCKER: PluginFormDef = {
  pluginName: "uri-blocker",
  groups: [
    {
      title: "Configuration",
      fields: [
        { key: "block_rules", label: "Block Rules", type: "string-array", required: true, placeholder: "/admin.*", description: "Regex patterns of URIs to block" },
        ...REJECTED_FIELDS,
        { key: "case_insensitive", label: "Case Insensitive", type: "boolean", defaultValue: false },
      ],
    },
  ],
}

const CORS: PluginFormDef = {
  pluginName: "cors",
  groups: [
    {
      title: "Origins & Methods",
      fields: [
        { key: "allow_origins", label: "Allow Origins", type: "string", defaultValue: "*", placeholder: "https://example.com", description: "Comma-separated origins, or * for all" },
        { key: "allow_methods", label: "Allow Methods", type: "string", defaultValue: "*", placeholder: "GET,POST,PUT,DELETE", description: "Comma-separated HTTP methods" },
        { key: "allow_credential", label: "Allow Credentials", type: "boolean", defaultValue: false, description: "Set Access-Control-Allow-Credentials header" },
      ],
    },
    {
      title: "Headers & Cache",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "allow_headers", label: "Allow Headers", type: "string", defaultValue: "*", placeholder: "Content-Type,Authorization", description: "Comma-separated allowed request headers" },
        { key: "expose_headers", label: "Expose Headers", type: "string", placeholder: "X-Total-Count", description: "Headers exposed to the browser" },
        { key: "max_age", label: "Max Age", type: "integer", defaultValue: 5, suffix: "s", description: "How long preflight results can be cached" },
      ],
    },
  ],
}

const CSRF: PluginFormDef = {
  pluginName: "csrf",
  groups: [
    {
      title: "Configuration",
      fields: [
        { key: "name", label: "Cookie Name", type: "string", defaultValue: "apisix-csrf-token", description: "Name of the CSRF token cookie" },
        { key: "expires", label: "Token Expiry", type: "integer", defaultValue: 7200, suffix: "s" },
        { key: "key", label: "Signing Key", type: "password", required: true, description: "Key used to sign the CSRF token" },
      ],
    },
  ],
}

const CONSUMER_RESTRICTION: PluginFormDef = {
  pluginName: "consumer-restriction",
  groups: [
    {
      title: "Restriction",
      fields: [
        { key: "type", label: "Restriction Type", type: "enum", defaultValue: "consumer_name", options: [
          { value: "consumer_name", label: "Consumer Name" },
          { value: "consumer_group_id", label: "Consumer Group" },
          { value: "service_id", label: "Service ID" },
        ]},
        { key: "_mode", label: "Mode", type: "enum", defaultValue: "whitelist", options: [
          { value: "whitelist", label: "Whitelist (allow only)" },
          { value: "blacklist", label: "Blacklist (deny only)" },
        ]},
        { key: "whitelist", label: "Allowed", type: "string-array", placeholder: "consumer-name", visibleWhen: { field: "_mode", value: "whitelist" } },
        { key: "blacklist", label: "Blocked", type: "string-array", placeholder: "consumer-name", visibleWhen: { field: "_mode", value: "blacklist" } },
        ...REJECTED_FIELDS,
      ],
    },
  ],
}

// Traffic Control

const LIMIT_REQ: PluginFormDef = {
  pluginName: "limit-req",
  groups: [
    {
      title: "Rate Limiting",
      fields: [
        { key: "rate", label: "Rate", type: "number", required: true, min: 0, step: 0.1, suffix: "req/s", description: "Requests per second threshold" },
        { key: "burst", label: "Burst", type: "number", required: true, min: 0, description: "Excess requests allowed to be delayed" },
        { key: "key_type", label: "Key Type", type: "enum", defaultValue: "var", options: [
          { value: "var", label: "Single Variable" },
          { value: "var_combination", label: "Variable Combination" },
        ]},
        { key: "key", label: "Key", type: "string", required: true, defaultValue: "remote_addr", description: "NGINX variable for the rate limit key" },
        ...REJECTED_FIELDS,
      ],
    },
    {
      title: "Storage Policy",
      fields: [
        { key: "policy", label: "Policy", type: "enum", defaultValue: "local", options: [
          { value: "local", label: "Local (in-memory)" },
          { value: "redis", label: "Redis" },
          { value: "redis-cluster", label: "Redis Cluster" },
        ]},
      ],
    },
    REDIS_FIELDS,
    REDIS_CLUSTER_FIELDS,
  ],
}

const LIMIT_CONN: PluginFormDef = {
  pluginName: "limit-conn",
  groups: [
    {
      title: "Concurrency Limiting",
      fields: [
        { key: "conn", label: "Max Connections", type: "integer", required: true, min: 1, description: "Maximum concurrent connections" },
        { key: "burst", label: "Burst", type: "integer", required: true, min: 0, description: "Extra connections allowed to queue" },
        { key: "default_conn_delay", label: "Connection Delay", type: "number", required: true, min: 0, step: 0.001, suffix: "s", description: "Delay for burst connections" },
        { key: "key_type", label: "Key Type", type: "enum", defaultValue: "var", options: [
          { value: "var", label: "Single Variable" },
          { value: "var_combination", label: "Variable Combination" },
        ]},
        { key: "key", label: "Key", type: "string", required: true, defaultValue: "remote_addr" },
        { key: "rejected_code", label: "Rejected Status Code", type: "integer", defaultValue: 503, min: 200, max: 599 },
        { key: "only_use_default_delay", label: "Only Use Default Delay", type: "boolean", defaultValue: false },
      ],
    },
    {
      title: "Storage Policy",
      fields: [
        { key: "policy", label: "Policy", type: "enum", defaultValue: "local", options: [
          { value: "local", label: "Local (in-memory)" },
          { value: "redis", label: "Redis" },
          { value: "redis-cluster", label: "Redis Cluster" },
        ]},
      ],
    },
    REDIS_FIELDS,
    REDIS_CLUSTER_FIELDS,
  ],
}

const LIMIT_COUNT: PluginFormDef = {
  pluginName: "limit-count",
  groups: [
    {
      title: "Request Quota",
      fields: [
        { key: "count", label: "Request Count", type: "integer", required: true, min: 1, description: "Max number of requests in the time window" },
        { key: "time_window", label: "Time Window", type: "integer", required: true, min: 1, suffix: "s", description: "Duration of the counting window" },
        { key: "key_type", label: "Key Type", type: "enum", defaultValue: "var", options: [
          { value: "var", label: "Single Variable" },
          { value: "var_combination", label: "Variable Combination" },
        ]},
        { key: "key", label: "Key", type: "string", required: true, defaultValue: "remote_addr" },
        { key: "group", label: "Group", type: "string", placeholder: "shared-group", description: "Share counter across routes with the same group" },
        ...REJECTED_FIELDS,
        { key: "show_limit_quota_header", label: "Show Limit Headers", type: "boolean", defaultValue: true, description: "Include X-RateLimit-* headers in response" },
      ],
    },
    {
      title: "Storage Policy",
      fields: [
        { key: "policy", label: "Policy", type: "enum", defaultValue: "local", options: [
          { value: "local", label: "Local (in-memory)" },
          { value: "redis", label: "Redis" },
          { value: "redis-cluster", label: "Redis Cluster" },
        ]},
      ],
    },
    REDIS_FIELDS,
    REDIS_CLUSTER_FIELDS,
  ],
}

const TRAFFIC_SPLIT: PluginFormDef = {
  pluginName: "traffic-split",
  groups: [
    {
      title: "Traffic Split",
      description: "Route traffic to different upstreams based on weights or conditions. Use the JSON tab for advanced match rules.",
      fields: [
        { key: "rules", label: "Rules (JSON)", type: "text", required: true, placeholder: `[{
  "weighted_upstreams": [
    { "upstream": { "type": "roundrobin", "nodes": {"host:80": 1} }, "weight": 2 },
    { "weight": 1 }
  ]
}]`, description: "Array of rules with weighted_upstreams. Last entry with only weight uses the route's original upstream." },
      ],
    },
  ],
}

const REQUEST_ID: PluginFormDef = {
  pluginName: "request-id",
  groups: [
    {
      title: "Configuration",
      fields: [
        { key: "header_name", label: "Header Name", type: "string", defaultValue: "X-Request-Id", placeholder: "X-Request-Id" },
        { key: "include_in_response", label: "Include in Response", type: "boolean", defaultValue: true, description: "Add the request ID header to the response" },
        { key: "algorithm", label: "Algorithm", type: "enum", defaultValue: "uuid", options: [
          { value: "uuid", label: "UUID" },
          { value: "nanoid", label: "Nano ID" },
          { value: "range_id", label: "Range ID" },
        ]},
      ],
    },
  ],
}

const PROXY_CACHE: PluginFormDef = {
  pluginName: "proxy-cache",
  groups: [
    {
      title: "Cache Settings",
      fields: [
        { key: "cache_strategy", label: "Cache Strategy", type: "enum", defaultValue: "disk", options: [
          { value: "disk", label: "Disk" },
          { value: "memory", label: "Memory" },
        ]},
        { key: "cache_zone", label: "Cache Zone", type: "string", defaultValue: "disk_cache_one", description: "Name of the cache zone" },
        { key: "cache_key", label: "Cache Key", type: "string", defaultValue: "$host$request_uri", description: "NGINX variables for cache key" },
        { key: "cache_bypass", label: "Cache Bypass", type: "string", placeholder: "$arg_nocache", description: "NGINX variable — bypass cache when non-empty/non-zero" },
        { key: "cache_method", label: "Cache Methods", type: "string-array", placeholder: "GET", description: "HTTP methods to cache" },
        { key: "cache_http_status", label: "Cache Status Codes", type: "string-array", placeholder: "200", description: "HTTP status codes to cache" },
        { key: "hide_cache_headers", label: "Hide Cache Headers", type: "boolean", defaultValue: false },
        { key: "no_cache", label: "No Cache Condition", type: "string", placeholder: "$arg_skip_cache", description: "NGINX variable — skip caching when non-empty/non-zero" },
      ],
    },
    {
      title: "TTL Settings",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "cache_ttl", label: "Cache TTL", type: "integer", defaultValue: 300, suffix: "s", description: "Default cache time-to-live" },
      ],
    },
  ],
}

// Transformation

const PROXY_REWRITE: PluginFormDef = {
  pluginName: "proxy-rewrite",
  groups: [
    {
      title: "URI Rewrite",
      fields: [
        { key: "uri", label: "New URI", type: "string", placeholder: "/new/path", description: "Static URI replacement" },
        { key: "host", label: "New Host", type: "string", placeholder: "api.example.com", description: "Rewrite the Host header" },
        { key: "method", label: "Override Method", type: "enum", options: [
          { value: "", label: "No override" },
          { value: "GET", label: "GET" },
          { value: "POST", label: "POST" },
          { value: "PUT", label: "PUT" },
          { value: "DELETE", label: "DELETE" },
          { value: "PATCH", label: "PATCH" },
        ]},
      ],
    },
    {
      title: "Regex URI Rewrite",
      collapsible: true,
      defaultOpen: false,
      description: "Use regex patterns for dynamic URI rewriting",
      fields: [
        { key: "regex_uri.0", label: "Match Pattern", type: "string", placeholder: "^/api/(.*)", description: "Regex pattern to match" },
        { key: "regex_uri.1", label: "Replacement", type: "string", placeholder: "/$1", description: "Replacement template" },
      ],
    },
    {
      title: "Headers",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "headers.set", label: "Set Headers (JSON)", type: "text", placeholder: '{"X-Custom": "value"}', description: "Headers to set (overwrite existing)" },
        { key: "headers.add", label: "Add Headers (JSON)", type: "text", placeholder: '{"X-Extra": "value"}', description: "Headers to add (append)" },
        { key: "headers.remove", label: "Remove Headers", type: "string-array", placeholder: "X-Unwanted", description: "Headers to remove" },
      ],
    },
  ],
}

const RESPONSE_REWRITE: PluginFormDef = {
  pluginName: "response-rewrite",
  groups: [
    {
      title: "Response Override",
      fields: [
        { key: "status_code", label: "Status Code", type: "integer", min: 200, max: 599, placeholder: "200", description: "Override the response status code" },
        { key: "body", label: "Response Body", type: "text", placeholder: '{"message": "ok"}', description: "Override the response body" },
        { key: "body_base64", label: "Body is Base64", type: "boolean", defaultValue: false, description: "Body value is base64 encoded" },
      ],
    },
    {
      title: "Headers",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "headers.set", label: "Set Headers (JSON)", type: "text", placeholder: '{"X-Custom": "value"}', description: "Headers to set (overwrite existing)" },
        { key: "headers.add", label: "Add Headers (JSON)", type: "text", placeholder: '{"X-Extra": "value"}', description: "Headers to add (append)" },
        { key: "headers.remove", label: "Remove Headers", type: "string-array", placeholder: "X-Unwanted", description: "Headers to remove" },
      ],
    },
  ],
}

const GRPC_TRANSCODE: PluginFormDef = {
  pluginName: "grpc-transcode",
  groups: [
    {
      title: "gRPC Mapping",
      fields: [
        { key: "proto_id", label: "Proto ID", type: "string", required: true, description: "ID of the proto definition in the gateway" },
        { key: "service", label: "Service Name", type: "string", required: true, placeholder: "package.ServiceName", description: "Fully qualified gRPC service name" },
        { key: "method", label: "Method", type: "string", required: true, placeholder: "MethodName", description: "gRPC method to invoke" },
        { key: "deadline", label: "Deadline", type: "number", defaultValue: 0, suffix: "ms", description: "Request deadline (0 = no timeout)" },
      ],
    },
    {
      title: "Options",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "pb_option", label: "Protobuf Options", type: "string-array", description: "Protobuf serialization options" },
        { key: "show_status_in_body", label: "Show Status in Body", type: "boolean", defaultValue: false },
      ],
    },
  ],
}

const FAULT_INJECTION: PluginFormDef = {
  pluginName: "fault-injection",
  groups: [
    {
      title: "Abort (Error Injection)",
      collapsible: true,
      defaultOpen: true,
      fields: [
        { key: "abort.http_status", label: "HTTP Status", type: "integer", min: 200, max: 599, placeholder: "503", description: "Status code to return" },
        { key: "abort.body", label: "Response Body", type: "string", placeholder: "Service unavailable", description: "Body to return" },
        { key: "abort.percentage", label: "Percentage", type: "number", min: 0, max: 100, step: 0.1, suffix: "%", description: "Percentage of requests to abort" },
      ],
    },
    {
      title: "Delay (Latency Injection)",
      collapsible: true,
      defaultOpen: true,
      fields: [
        { key: "delay.duration", label: "Duration", type: "number", min: 0, step: 0.001, suffix: "s", description: "Delay duration" },
        { key: "delay.percentage", label: "Percentage", type: "number", min: 0, max: 100, step: 0.1, suffix: "%", description: "Percentage of requests to delay" },
      ],
    },
  ],
}

const REDIRECT: PluginFormDef = {
  pluginName: "redirect",
  groups: [
    {
      title: "Redirect",
      fields: [
        { key: "http_to_https", label: "HTTP → HTTPS", type: "boolean", defaultValue: false, description: "Redirect all HTTP requests to HTTPS" },
        { key: "uri", label: "Target URI", type: "string", placeholder: "/new-path", description: "Static redirect target (supports NGINX variables)" },
        { key: "ret_code", label: "Status Code", type: "enum", defaultValue: "302", options: [
          { value: "301", label: "301 Moved Permanently" },
          { value: "302", label: "302 Found" },
          { value: "303", label: "303 See Other" },
          { value: "307", label: "307 Temporary Redirect" },
          { value: "308", label: "308 Permanent Redirect" },
        ]},
        { key: "encode_uri", label: "Encode URI", type: "boolean", defaultValue: false, description: "Encode the URI before redirecting" },
      ],
    },
    {
      title: "Regex Redirect",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "regex_uri.0", label: "Match Pattern", type: "string", placeholder: "^/old/(.*)" },
        { key: "regex_uri.1", label: "Replacement", type: "string", placeholder: "/new/$1" },
      ],
    },
  ],
}

// Observability

const PROMETHEUS: PluginFormDef = {
  pluginName: "prometheus",
  groups: [
    {
      title: "Configuration",
      fields: [
        { key: "prefer_name", label: "Prefer Route Name", type: "boolean", defaultValue: false, description: "Use route name instead of URI in metrics labels" },
      ],
    },
  ],
}

const HTTP_LOGGER: PluginFormDef = {
  pluginName: "http-logger",
  groups: [
    {
      title: "Endpoint",
      fields: [
        { key: "uri", label: "Logger URI", type: "string", required: true, placeholder: "http://log-server:8080/logs", description: "HTTP endpoint to send logs" },
        { key: "auth_header", label: "Auth Header", type: "password", placeholder: "Bearer token...", description: "Authorization header for the log endpoint" },
        { key: "ssl_verify", label: "Verify SSL", type: "boolean", defaultValue: true, description: "Verify SSL certificate of the log endpoint" },
      ],
    },
    {
      title: "Batching & Retry",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "timeout", label: "Timeout", type: "integer", defaultValue: 3, suffix: "s" },
        { key: "batch_max_size", label: "Batch Max Size", type: "integer", defaultValue: 1000, min: 1, description: "Max entries per batch" },
        { key: "inactive_timeout", label: "Inactive Timeout", type: "integer", defaultValue: 5, suffix: "s", description: "Max time to wait before sending a partial batch" },
        { key: "buffer_duration", label: "Buffer Duration", type: "integer", defaultValue: 60, suffix: "s" },
        { key: "max_retry_count", label: "Max Retries", type: "integer", defaultValue: 0 },
        { key: "retry_delay", label: "Retry Delay", type: "integer", defaultValue: 1, suffix: "s" },
        { key: "concat_method", label: "Concat Method", type: "enum", defaultValue: "json", options: [
          { value: "json", label: "JSON" },
          { value: "new_line", label: "New Line" },
        ]},
      ],
    },
    {
      title: "Body Capture",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "include_req_body", label: "Include Request Body", type: "boolean", defaultValue: false, description: "Log the full request body" },
        { key: "include_req_body_expr", label: "Request Body Condition", type: "text", placeholder: '[["http_x_debug","==","true"]]', description: "Only capture request body when expression matches (lua-resty-expr)" },
        { key: "include_resp_body", label: "Include Response Body", type: "boolean", defaultValue: false, description: "Log the full response body" },
        { key: "include_resp_body_expr", label: "Response Body Condition", type: "text", placeholder: '[["http_x_debug","==","true"]]', description: "Only capture response body when expression matches (lua-resty-expr)" },
      ],
    },
  ],
}

const KAFKA_LOGGER: PluginFormDef = {
  pluginName: "kafka-logger",
  groups: [
    {
      title: "Kafka Connection",
      fields: [
        { key: "broker_list", label: "Brokers (JSON)", type: "text", required: true, placeholder: '[{"host":"kafka","port":9092}]', description: "Kafka broker addresses as JSON array of {host, port} objects" },
        { key: "kafka_topic", label: "Topic", type: "string", required: true, placeholder: "apisix-logs" },
        { key: "producer_type", label: "Producer Type", type: "enum", defaultValue: "async", options: [
          { value: "async", label: "Async" },
          { value: "sync", label: "Sync" },
        ]},
        { key: "required_acks", label: "Required Acks", type: "enum", defaultValue: "1", options: [
          { value: "0", label: "None (0)" },
          { value: "1", label: "Leader (1)" },
          { value: "-1", label: "All (-1)" },
        ]},
      ],
    },
    {
      title: "SASL Authentication",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "producer_sasl.mechanism", label: "SASL Mechanism", type: "enum", options: [
          { value: "", label: "None (disabled)" },
          { value: "PLAIN", label: "PLAIN" },
          { value: "SCRAM-SHA-256", label: "SCRAM-SHA-256" },
          { value: "SCRAM-SHA-512", label: "SCRAM-SHA-512" },
        ]},
        { key: "producer_sasl.user", label: "Username", type: "string", placeholder: "kafka-user" },
        { key: "producer_sasl.password", label: "Password", type: "password" },
      ],
    },
    {
      title: "Options",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "key", label: "Partition Key", type: "string", placeholder: "route_id", description: "Key for Kafka partitioning" },
        { key: "timeout", label: "Timeout", type: "integer", defaultValue: 3, suffix: "s" },
        { key: "batch_max_size", label: "Batch Max Size", type: "integer", defaultValue: 1000, min: 1 },
        { key: "include_req_body", label: "Include Request Body", type: "boolean", defaultValue: false },
        { key: "include_resp_body", label: "Include Response Body", type: "boolean", defaultValue: false },
        { key: "max_req_body_bytes", label: "Max Request Body Size", type: "integer", defaultValue: 524288, suffix: "bytes", description: "Max request body size to log (truncated beyond)" },
        { key: "max_resp_body_bytes", label: "Max Response Body Size", type: "integer", defaultValue: 524288, suffix: "bytes", description: "Max response body size to log (truncated beyond)" },
      ],
    },
  ],
}

const SYSLOG: PluginFormDef = {
  pluginName: "syslog",
  groups: [
    {
      title: "Syslog Server",
      fields: [
        { key: "host", label: "Host", type: "string", required: true, placeholder: "127.0.0.1" },
        { key: "port", label: "Port", type: "integer", required: true, defaultValue: 514, min: 1, max: 65535 },
        { key: "tls", label: "Use TLS", type: "boolean", defaultValue: false },
      ],
    },
    {
      title: "Options",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "flush_limit", label: "Flush Limit", type: "integer", defaultValue: 4096, suffix: "bytes" },
        { key: "drop_limit", label: "Drop Limit", type: "integer", defaultValue: 1048576, suffix: "bytes" },
        { key: "timeout", label: "Timeout", type: "integer", defaultValue: 3, suffix: "s" },
        { key: "sock_type", label: "Socket Type", type: "enum", defaultValue: "tcp", options: [
          { value: "tcp", label: "TCP" },
          { value: "udp", label: "UDP" },
        ]},
        { key: "batch_max_size", label: "Batch Max Size", type: "integer", defaultValue: 1000 },
        { key: "include_req_body", label: "Include Request Body", type: "boolean", defaultValue: false },
      ],
    },
  ],
}

const ZIPKIN: PluginFormDef = {
  pluginName: "zipkin",
  groups: [
    {
      title: "Zipkin",
      fields: [
        { key: "endpoint", label: "Collector Endpoint", type: "string", required: true, placeholder: "http://zipkin:9411/api/v2/spans", description: "Zipkin collector HTTP endpoint" },
        { key: "sample_ratio", label: "Sample Ratio", type: "number", required: true, defaultValue: 1, min: 0, max: 1, step: 0.01, description: "Sampling rate (0-1, 1 = 100%)" },
        { key: "service_name", label: "Service Name", type: "string", defaultValue: "APISIX", placeholder: "APISIX" },
        { key: "server_addr", label: "Server Address", type: "string", placeholder: "192.168.1.100", description: "Gateway node IP for span tags" },
      ],
    },
  ],
}

const OPENTELEMETRY: PluginFormDef = {
  pluginName: "opentelemetry",
  groups: [
    {
      title: "Configuration",
      description: "Most OpenTelemetry settings are configured globally. Per-route overrides:",
      fields: [
        { key: "sampler.name", label: "Sampler", type: "enum", defaultValue: "always_on", options: [
          { value: "always_on", label: "Always On" },
          { value: "always_off", label: "Always Off" },
          { value: "trace_id_ratio", label: "Trace ID Ratio" },
          { value: "parent_based_always_on", label: "Parent Based (Always On)" },
          { value: "parent_based_always_off", label: "Parent Based (Always Off)" },
          { value: "parent_based_trace_id_ratio", label: "Parent Based (Ratio)" },
        ]},
        { key: "sampler.options.fraction", label: "Sample Fraction", type: "number", min: 0, max: 1, step: 0.01, defaultValue: 1, description: "Sampling rate (0-1)", visibleWhen: { field: "sampler.name", value: "trace_id_ratio" } },
        { key: "additional_attributes", label: "Extra Attributes (JSON)", type: "text", placeholder: '["key","value"]', description: "Additional span attributes as JSON arrays" },
      ],
    },
  ],
}

// --- Additional Plugins ---

const API_BREAKER: PluginFormDef = {
  pluginName: "api-breaker",
  groups: [
    {
      title: "Circuit Breaker",
      fields: [
        { key: "break_response_code", label: "Break Response Code", type: "integer", required: true, defaultValue: 502, min: 200, max: 599, description: "Status code returned when circuit is open" },
        { key: "max_breaker_sec", label: "Max Break Duration", type: "integer", defaultValue: 300, suffix: "s", description: "Maximum time the circuit stays open (exponential backoff up to this)" },
        { key: "unhealthy.http_statuses", label: "Unhealthy Status Codes", type: "string-array", placeholder: "500", description: "Response codes that count as failures" },
        { key: "unhealthy.failures", label: "Failure Threshold", type: "integer", defaultValue: 3, min: 1, description: "Consecutive failures before opening circuit" },
      ],
    },
    {
      title: "Recovery",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "healthy.http_statuses", label: "Healthy Status Codes", type: "string-array", placeholder: "200", description: "Response codes that count as success (to close circuit)" },
        { key: "healthy.successes", label: "Success Threshold", type: "integer", defaultValue: 3, min: 1, description: "Consecutive successes before closing circuit" },
      ],
    },
  ],
}

const MOCKING: PluginFormDef = {
  pluginName: "mocking",
  groups: [
    {
      title: "Mock Response",
      fields: [
        { key: "response_status", label: "Status Code", type: "integer", defaultValue: 200, min: 100, max: 599, description: "HTTP status code to return" },
        { key: "content_type", label: "Content Type", type: "string", defaultValue: "application/json", placeholder: "application/json" },
        { key: "response_example", label: "Response Body", type: "text", placeholder: '{"message": "mock response"}', description: "Static response body to return" },
      ],
    },
    {
      title: "Options",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "delay", label: "Response Delay", type: "integer", defaultValue: 0, suffix: "ms", min: 0, description: "Simulated response delay" },
        { key: "response_schema", label: "JSON Schema", type: "text", placeholder: '{"type":"object","properties":{}}', description: "JSON Schema to auto-generate response (alternative to static body)" },
        { key: "with_mock_header", label: "Add Mock Header", type: "boolean", defaultValue: true, description: "Add X-Mock-By header to response" },
      ],
    },
  ],
}

const PROXY_MIRROR: PluginFormDef = {
  pluginName: "proxy-mirror",
  groups: [
    {
      title: "Mirror Settings",
      fields: [
        { key: "host", label: "Mirror Host", type: "string", required: true, placeholder: "http://debug-collector:9080", description: "Target host to mirror traffic to (include scheme)" },
        { key: "path", label: "Mirror Path", type: "string", placeholder: "/mirror", description: "Override URI path for mirrored requests" },
        { key: "sample_ratio", label: "Sample Ratio", type: "number", defaultValue: 1, min: 0.00001, max: 1, step: 0.01, description: "Percentage of requests to mirror (0-1)" },
      ],
    },
  ],
}

const CLIENT_CONTROL: PluginFormDef = {
  pluginName: "client-control",
  groups: [
    {
      title: "Client Controls",
      fields: [
        { key: "max_body_size", label: "Max Body Size", type: "integer", min: 0, suffix: "bytes", description: "Maximum request body size (0 = unlimited). Requests exceeding this get 413." },
      ],
    },
  ],
}

const REAL_IP: PluginFormDef = {
  pluginName: "real-ip",
  groups: [
    {
      title: "Configuration",
      fields: [
        { key: "source", label: "Source Header", type: "string", required: true, defaultValue: "http_x_forwarded_for", placeholder: "http_x_forwarded_for", description: "NGINX variable containing the real client IP" },
        { key: "trusted_addresses", label: "Trusted Addresses", type: "string-array", placeholder: "10.0.0.0/8", description: "Trusted proxy IP ranges (CIDR notation)" },
        { key: "recursive", label: "Recursive", type: "boolean", defaultValue: false, description: "Recursively search for the client IP in X-Forwarded-For" },
      ],
    },
  ],
}

const AUTHZ_KEYCLOAK: PluginFormDef = {
  pluginName: "authz-keycloak",
  groups: [
    {
      title: "Keycloak Server",
      fields: [
        { key: "token_endpoint", label: "Token Endpoint", type: "string", required: true, placeholder: "https://keycloak.example.com/realms/master/protocol/openid-connect/token", description: "Keycloak token endpoint URL" },
        { key: "discovery", label: "Discovery URL", type: "string", placeholder: "https://keycloak.example.com/realms/master/.well-known/uma2-configuration" },
        { key: "client_id", label: "Client ID", type: "string", required: true },
        { key: "client_secret", label: "Client Secret", type: "password" },
        { key: "grant_type", label: "Grant Type", type: "enum", defaultValue: "urn:ietf:params:oauth:grant-type:uma-ticket", options: [
          { value: "urn:ietf:params:oauth:grant-type:uma-ticket", label: "UMA Ticket" },
          { value: "client_credentials", label: "Client Credentials" },
        ]},
      ],
    },
    {
      title: "Policy & Permissions",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "policy_enforcement_mode", label: "Enforcement Mode", type: "enum", defaultValue: "ENFORCING", options: [
          { value: "ENFORCING", label: "Enforcing" },
          { value: "PERMISSIVE", label: "Permissive" },
        ]},
        { key: "permissions", label: "Permissions", type: "string-array", placeholder: "resource#scope", description: "Required permissions (resource#scope format)" },
        { key: "lazy_load_paths", label: "Lazy Load Paths", type: "boolean", defaultValue: false },
        { key: "http_method_as_scope", label: "HTTP Method as Scope", type: "boolean", defaultValue: false, description: "Use HTTP method (GET, POST...) as resource scope" },
      ],
    },
    {
      title: "Options",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "timeout", label: "Timeout", type: "integer", defaultValue: 3000, suffix: "ms" },
        { key: "ssl_verify", label: "Verify SSL", type: "boolean", defaultValue: true },
        { key: "keepalive", label: "Keepalive", type: "boolean", defaultValue: true },
        { key: "password_grant_token_generation_incoming_uri", label: "Token URI", type: "string", placeholder: "/api/token", description: "URI to trigger password grant token generation" },
      ],
    },
  ],
}

const WOLF_RBAC: PluginFormDef = {
  pluginName: "wolf-rbac",
  groups: [
    {
      title: "Wolf RBAC",
      fields: [
        { key: "server", label: "Wolf Server URL", type: "string", required: true, placeholder: "http://wolf-server:12180", description: "Wolf RBAC server address" },
        { key: "appid", label: "Application ID", type: "string", required: true, placeholder: "my-app", description: "Wolf application identifier" },
      ],
    },
    {
      title: "Options",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "header_prefix", label: "Header Prefix", type: "string", defaultValue: "X-", description: "Prefix for upstream auth headers" },
      ],
    },
  ],
}

const REQUEST_VALIDATION: PluginFormDef = {
  pluginName: "request-validation",
  groups: [
    {
      title: "Request Validation",
      fields: [
        { key: "header_schema", label: "Header Schema (JSON)", type: "text", placeholder: '{"type":"object","required":["Authorization"]}', description: "JSON Schema to validate request headers" },
        { key: "body_schema", label: "Body Schema (JSON)", type: "text", placeholder: '{"type":"object","required":["name"],"properties":{"name":{"type":"string"}}}', description: "JSON Schema to validate request body" },
        { key: "rejected_code", label: "Rejected Status Code", type: "integer", defaultValue: 400, min: 200, max: 599 },
        { key: "rejected_msg", label: "Rejected Message", type: "string", placeholder: "Request validation failed" },
      ],
    },
  ],
}

const BODY_TRANSFORMER: PluginFormDef = {
  pluginName: "body-transformer",
  groups: [
    {
      title: "Request Transformation",
      fields: [
        { key: "request.input_format", label: "Input Format", type: "enum", options: [
          { value: "", label: "Auto-detect" },
          { value: "json", label: "JSON" },
          { value: "xml", label: "XML" },
        ]},
        { key: "request.template", label: "Request Template", type: "text", placeholder: '{% if _body.name then %}{"fullName": "{{_body.name}}"}{% end %}', description: "Lua template for request body transformation" },
        { key: "request.template_is_base64", label: "Template is Base64", type: "boolean", defaultValue: false },
      ],
    },
    {
      title: "Response Transformation",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "response.input_format", label: "Input Format", type: "enum", options: [
          { value: "", label: "Auto-detect" },
          { value: "json", label: "JSON" },
          { value: "xml", label: "XML" },
        ]},
        { key: "response.template", label: "Response Template", type: "text", placeholder: '{"result": {{_body.data}}}', description: "Lua template for response body transformation" },
        { key: "response.template_is_base64", label: "Template is Base64", type: "boolean", defaultValue: false },
      ],
    },
  ],
}

const SERVERLESS_PRE_FUNCTION: PluginFormDef = {
  pluginName: "serverless-pre-function",
  groups: [
    {
      title: "Lua Functions",
      description: "Custom Lua code executed before built-in plugins. Each function runs in the specified phase.",
      fields: [
        { key: "phase", label: "Execution Phase", type: "enum", defaultValue: "access", options: [
          { value: "rewrite", label: "Rewrite" },
          { value: "access", label: "Access" },
          { value: "header_filter", label: "Header Filter" },
          { value: "body_filter", label: "Body Filter" },
          { value: "log", label: "Log" },
          { value: "before_proxy", label: "Before Proxy" },
        ]},
        { key: "functions", label: "Functions", type: "text", required: true, placeholder: '["return function(conf, ctx) ngx.log(ngx.WARN, \\"hello\\") end"]', description: "Array of Lua function strings to execute" },
      ],
    },
  ],
}

const SERVERLESS_POST_FUNCTION: PluginFormDef = {
  pluginName: "serverless-post-function",
  groups: [
    {
      title: "Lua Functions",
      description: "Custom Lua code executed after built-in plugins. Each function runs in the specified phase.",
      fields: [
        { key: "phase", label: "Execution Phase", type: "enum", defaultValue: "access", options: [
          { value: "rewrite", label: "Rewrite" },
          { value: "access", label: "Access" },
          { value: "header_filter", label: "Header Filter" },
          { value: "body_filter", label: "Body Filter" },
          { value: "log", label: "Log" },
          { value: "before_proxy", label: "Before Proxy" },
        ]},
        { key: "functions", label: "Functions", type: "text", required: true, placeholder: '["return function(conf, ctx) ngx.log(ngx.WARN, \\"hello\\") end"]', description: "Array of Lua function strings to execute" },
      ],
    },
  ],
}

const ELASTICSEARCH_LOGGER: PluginFormDef = {
  pluginName: "elasticsearch-logger",
  groups: [
    {
      title: "Elasticsearch Connection",
      fields: [
        { key: "endpoint_addr", label: "Endpoint URL", type: "string", required: true, placeholder: "http://elasticsearch:9200", description: "Elasticsearch endpoint address" },
        { key: "field.index", label: "Index", type: "string", required: true, defaultValue: "apisix", placeholder: "apisix-logs", description: "Elasticsearch index name" },
        { key: "field.type", label: "Type", type: "string", defaultValue: "collector", placeholder: "collector" },
      ],
    },
    {
      title: "Authentication",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "auth.username", label: "Username", type: "string" },
        { key: "auth.password", label: "Password", type: "password" },
      ],
    },
    {
      title: "Options",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "ssl_verify", label: "Verify SSL", type: "boolean", defaultValue: true },
        { key: "timeout", label: "Timeout", type: "integer", defaultValue: 10, suffix: "s" },
        { key: "batch_max_size", label: "Batch Max Size", type: "integer", defaultValue: 1000, min: 1 },
        { key: "include_req_body", label: "Include Request Body", type: "boolean", defaultValue: false },
        { key: "include_resp_body", label: "Include Response Body", type: "boolean", defaultValue: false },
      ],
    },
  ],
}

const CLICKHOUSE_LOGGER: PluginFormDef = {
  pluginName: "clickhouse-logger",
  groups: [
    {
      title: "ClickHouse Connection",
      fields: [
        { key: "endpoint_addr", label: "Endpoint URL", type: "string", required: true, placeholder: "http://clickhouse:8123", description: "ClickHouse HTTP endpoint" },
        { key: "database", label: "Database", type: "string", required: true, defaultValue: "default" },
        { key: "logtable", label: "Log Table", type: "string", required: true, defaultValue: "apisix_logs" },
        { key: "user", label: "Username", type: "string", required: true, defaultValue: "default" },
        { key: "password", label: "Password", type: "password" },
      ],
    },
    {
      title: "Options",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "ssl_verify", label: "Verify SSL", type: "boolean", defaultValue: true },
        { key: "timeout", label: "Timeout", type: "integer", defaultValue: 3, suffix: "s" },
        { key: "batch_max_size", label: "Batch Max Size", type: "integer", defaultValue: 1000, min: 1 },
        { key: "include_req_body", label: "Include Request Body", type: "boolean", defaultValue: false },
        { key: "include_resp_body", label: "Include Response Body", type: "boolean", defaultValue: false },
      ],
    },
  ],
}

const SKYWALKING: PluginFormDef = {
  pluginName: "skywalking",
  groups: [
    {
      title: "Configuration",
      fields: [
        { key: "sample_ratio", label: "Sample Ratio", type: "number", required: true, defaultValue: 1, min: 0.00001, max: 1, step: 0.01, description: "Sampling rate (0-1)" },
      ],
    },
  ],
}

const DATADOG: PluginFormDef = {
  pluginName: "datadog",
  groups: [
    {
      title: "Configuration",
      fields: [
        { key: "prefer_name", label: "Prefer Route Name", type: "boolean", defaultValue: true, description: "Use route name instead of ID in metrics tags" },
      ],
    },
  ],
}

const AWS_LAMBDA: PluginFormDef = {
  pluginName: "aws-lambda",
  groups: [
    {
      title: "Lambda Configuration",
      fields: [
        { key: "function_uri", label: "Function URI", type: "string", required: true, placeholder: "https://lambda.us-east-1.amazonaws.com/2015-03-31/functions/my-func/invocations", description: "Full Lambda invocation URL" },
        { key: "authorization.iam.accesskey", label: "Access Key", type: "password", required: true, description: "AWS IAM access key" },
        { key: "authorization.iam.secretkey", label: "Secret Key", type: "password", required: true, description: "AWS IAM secret key" },
        { key: "authorization.iam.aws_region", label: "AWS Region", type: "string", defaultValue: "us-east-1", placeholder: "us-east-1" },
      ],
    },
    {
      title: "Options",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "timeout", label: "Timeout", type: "integer", defaultValue: 3000, suffix: "ms" },
        { key: "ssl_verify", label: "Verify SSL", type: "boolean", defaultValue: true },
        { key: "keepalive", label: "Keepalive", type: "boolean", defaultValue: true },
        { key: "keepalive_timeout", label: "Keepalive Timeout", type: "integer", defaultValue: 60000, suffix: "ms" },
        { key: "keepalive_pool", label: "Keepalive Pool Size", type: "integer", defaultValue: 5 },
      ],
    },
  ],
}

const AZURE_FUNCTIONS: PluginFormDef = {
  pluginName: "azure-functions",
  groups: [
    {
      title: "Azure Functions",
      fields: [
        { key: "function_uri", label: "Function URI", type: "string", required: true, placeholder: "https://my-app.azurewebsites.net/api/my-func", description: "Azure Functions HTTP trigger URL" },
        { key: "authorization.apikey", label: "API Key", type: "password", description: "Azure function key for authentication" },
        { key: "authorization.clientid", label: "Client ID", type: "string", description: "Azure AD client ID for OAuth" },
      ],
    },
    {
      title: "Options",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "timeout", label: "Timeout", type: "integer", defaultValue: 3000, suffix: "ms" },
        { key: "ssl_verify", label: "Verify SSL", type: "boolean", defaultValue: true },
        { key: "keepalive", label: "Keepalive", type: "boolean", defaultValue: true },
      ],
    },
  ],
}

// --- AI Gateway Plugins ---

const AI_PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "gemini", label: "Google Gemini" },
  { value: "azure-openai", label: "Azure OpenAI" },
  { value: "vertex-ai", label: "Google Vertex AI" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "aimlapi", label: "AI/ML API" },
  { value: "openai-compatible", label: "OpenAI-Compatible" },
]

const AI_PROXY: PluginFormDef = {
  pluginName: "ai-proxy",
  groups: [
    {
      title: "LLM Provider",
      fields: [
        { key: "provider", label: "Provider", type: "enum", required: true, options: AI_PROVIDER_OPTIONS, description: "LLM service provider" },
        { key: "options.model", label: "Model", type: "string", placeholder: "gpt-4o, deepseek-chat, claude-sonnet-4-20250514...", description: "Model name to use" },
        { key: "override.endpoint", label: "Custom Endpoint", type: "string", placeholder: "https://my-llm.example.com/v1", description: "Custom endpoint URL (required for openai-compatible)", visibleWhen: { field: "provider", value: "openai-compatible" } },
      ],
    },
    {
      title: "Authentication",
      fields: [
        { key: "auth.header.Authorization", label: "Authorization Header", type: "password", description: "e.g. Bearer sk-xxx" },
        { key: "auth.header.api-key", label: "API Key Header", type: "password", description: "For Azure OpenAI or other providers that use api-key header" },
      ],
    },
    {
      title: "Vertex AI",
      collapsible: true,
      defaultOpen: false,
      visibleWhen: { field: "provider", value: "vertex-ai" },
      fields: [
        { key: "provider_conf.project_id", label: "GCP Project ID", type: "string", required: true },
        { key: "provider_conf.region", label: "GCP Region", type: "string", required: true, placeholder: "us-central1" },
        { key: "auth.gcp.service_account_json", label: "Service Account JSON", type: "password", description: "GCP service account key JSON content" },
      ],
    },
    {
      title: "Logging",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "logging.summaries", label: "Log Summaries", type: "boolean", defaultValue: false, description: "Log model, duration, request/response token counts" },
        { key: "logging.payloads", label: "Log Payloads", type: "boolean", defaultValue: false, description: "Log request and response payloads" },
      ],
    },
    {
      title: "Connection",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "timeout", label: "Timeout", type: "integer", defaultValue: 30000, suffix: "ms", min: 1, description: "Request timeout for LLM service" },
        { key: "keepalive", label: "Keepalive", type: "boolean", defaultValue: true },
        { key: "keepalive_timeout", label: "Keepalive Timeout", type: "integer", defaultValue: 60000, suffix: "ms", min: 1000 },
        { key: "keepalive_pool", label: "Pool Size", type: "integer", defaultValue: 30, min: 1 },
        { key: "ssl_verify", label: "Verify SSL", type: "boolean", defaultValue: true },
      ],
    },
  ],
}

const AI_PROXY_MULTI: PluginFormDef = {
  pluginName: "ai-proxy-multi",
  groups: [
    {
      title: "Load Balancing",
      fields: [
        { key: "balancer.algorithm", label: "Algorithm", type: "enum", defaultValue: "roundrobin", options: [
          { value: "roundrobin", label: "Round Robin" },
          { value: "chash", label: "Consistent Hashing" },
        ]},
        { key: "fallback_strategy", label: "Fallback Strategy", type: "enum", options: [
          { value: "instance_health_and_rate_limiting", label: "Health + Rate Limiting" },
          { value: "http_429", label: "HTTP 429 (Too Many Requests)" },
          { value: "http_5xx", label: "HTTP 5xx (Server Error)" },
        ], description: "When to fallback to the next LLM instance" },
      ],
    },
    {
      title: "LLM Instances",
      description: "Configure multiple LLM instances as JSON array. Each instance needs: name, provider, weight, auth.",
      fields: [
        { key: "instances", label: "Instances", type: "text", required: true, placeholder: `[
  {
    "name": "openai-primary",
    "provider": "openai",
    "weight": 3,
    "auth": { "header": { "Authorization": "Bearer sk-xxx" } },
    "options": { "model": "gpt-4o" }
  },
  {
    "name": "deepseek-fallback",
    "provider": "deepseek",
    "weight": 1,
    "auth": { "header": { "Authorization": "Bearer sk-yyy" } },
    "options": { "model": "deepseek-chat" }
  }
]` },
      ],
    },
    {
      title: "Logging",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "logging.summaries", label: "Log Summaries", type: "boolean", defaultValue: false, description: "Log model, duration, token counts" },
        { key: "logging.payloads", label: "Log Payloads", type: "boolean", defaultValue: false, description: "Log request and response payloads" },
      ],
    },
    {
      title: "Connection",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "timeout", label: "Timeout", type: "integer", defaultValue: 30000, suffix: "ms", min: 1 },
        { key: "keepalive", label: "Keepalive", type: "boolean", defaultValue: true },
        { key: "keepalive_timeout", label: "Keepalive Timeout", type: "integer", defaultValue: 60000, suffix: "ms", min: 1000 },
        { key: "keepalive_pool", label: "Pool Size", type: "integer", defaultValue: 30, min: 1 },
        { key: "ssl_verify", label: "Verify SSL", type: "boolean", defaultValue: true },
      ],
    },
  ],
}

const AI_PROMPT_GUARD: PluginFormDef = {
  pluginName: "ai-prompt-guard",
  groups: [
    {
      title: "Matching Behavior",
      fields: [
        { key: "match_all_roles", label: "Match All Roles", type: "boolean", defaultValue: false, description: "Check prompts from all roles, not just 'user'" },
        { key: "match_all_conversation_history", label: "Match Full History", type: "boolean", defaultValue: false, description: "Concatenate all messages for checking, not just the last" },
      ],
    },
    {
      title: "Allow Patterns",
      description: "Regex patterns the prompt must match (at least one). Leave empty to allow all.",
      fields: [
        { key: "allow_patterns", label: "Allow Patterns", type: "string-array", description: "Prompt must match at least one pattern to proceed" },
      ],
    },
    {
      title: "Deny Patterns",
      description: "Regex patterns that cause the request to be rejected.",
      fields: [
        { key: "deny_patterns", label: "Deny Patterns", type: "string-array", description: "If any pattern matches, the request is rejected" },
      ],
    },
  ],
}

const AI_REQUEST_REWRITE: PluginFormDef = {
  pluginName: "ai-request-rewrite",
  groups: [
    {
      title: "Rewrite Prompt",
      fields: [
        { key: "prompt", label: "Prompt", type: "text", required: true, placeholder: "You are a helpful assistant. Rewrite the user request to be more specific and structured.", description: "System prompt sent to the LLM to transform the request" },
      ],
    },
    {
      title: "LLM Provider",
      fields: [
        { key: "provider", label: "Provider", type: "enum", required: true, options: AI_PROVIDER_OPTIONS, description: "LLM service used for rewriting" },
        { key: "options.model", label: "Model", type: "string", placeholder: "gpt-4o-mini, deepseek-chat...", description: "Model name" },
        { key: "override.endpoint", label: "Custom Endpoint", type: "string", placeholder: "https://my-llm.example.com/v1", visibleWhen: { field: "provider", value: "openai-compatible" } },
      ],
    },
    {
      title: "Authentication",
      fields: [
        { key: "auth.header.Authorization", label: "Authorization Header", type: "password", description: "e.g. Bearer sk-xxx" },
        { key: "auth.header.api-key", label: "API Key Header", type: "password", description: "For providers using api-key header" },
      ],
    },
    {
      title: "Connection",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "timeout", label: "Timeout", type: "integer", defaultValue: 30000, suffix: "ms", min: 1, max: 60000 },
        { key: "keepalive", label: "Keepalive", type: "boolean", defaultValue: true },
        { key: "ssl_verify", label: "Verify SSL", type: "boolean", defaultValue: true },
      ],
    },
  ],
}

const AI_RATE_LIMITING: PluginFormDef = {
  pluginName: "ai-rate-limiting",
  groups: [
    {
      title: "Token Rate Limiting",
      fields: [
        { key: "limit", label: "Token Limit", type: "integer", required: true, min: 1, description: "Maximum tokens allowed per time window" },
        { key: "time_window", label: "Time Window", type: "integer", required: true, min: 1, suffix: "seconds", description: "Time interval for the token limit" },
        { key: "limit_strategy", label: "Limit Strategy", type: "enum", defaultValue: "total_tokens", options: [
          { value: "total_tokens", label: "Total Tokens" },
          { value: "prompt_tokens", label: "Prompt Tokens Only" },
          { value: "completion_tokens", label: "Completion Tokens Only" },
        ], description: "Which token type to count against the limit" },
      ],
    },
    {
      title: "Response",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "rejected_code", label: "Rejected Status Code", type: "integer", defaultValue: 503, description: "HTTP status code when limit is exceeded" },
        { key: "rejected_msg", label: "Rejected Message", type: "string", placeholder: "Token quota exceeded", description: "Response body when rejected" },
        { key: "show_limit_quota_header", label: "Show Rate Limit Headers", type: "boolean", defaultValue: true, description: "Include X-AI-RateLimit-* headers in response" },
      ],
    },
  ],
}

const AI_RAG: PluginFormDef = {
  pluginName: "ai-rag",
  groups: [
    {
      title: "Embeddings Provider (Azure OpenAI)",
      fields: [
        { key: "embeddings_provider.azure_openai.endpoint", label: "Azure OpenAI Endpoint", type: "string", required: true, placeholder: "https://my-resource.openai.azure.com/openai/deployments/text-embedding-ada-002/embeddings" },
        { key: "embeddings_provider.azure_openai.api_key", label: "Azure OpenAI API Key", type: "password", required: true },
      ],
    },
    {
      title: "Vector Search Provider (Azure AI Search)",
      fields: [
        { key: "vector_search_provider.azure_ai_search.endpoint", label: "Azure AI Search Endpoint", type: "string", required: true, placeholder: "https://my-search.search.windows.net/indexes/my-index/docs/search" },
        { key: "vector_search_provider.azure_ai_search.api_key", label: "Azure AI Search API Key", type: "password", required: true },
      ],
    },
  ],
}

const AI_AWS_CONTENT_MODERATION: PluginFormDef = {
  pluginName: "ai-aws-content-moderation",
  groups: [
    {
      title: "AWS Comprehend",
      fields: [
        { key: "comprehend.access_key_id", label: "Access Key ID", type: "password", required: true, description: "AWS IAM access key ID" },
        { key: "comprehend.secret_access_key", label: "Secret Access Key", type: "password", required: true, description: "AWS IAM secret access key" },
        { key: "comprehend.region", label: "AWS Region", type: "string", required: true, placeholder: "us-east-1" },
        { key: "comprehend.endpoint", label: "Custom Endpoint", type: "string", placeholder: "https://comprehend.us-east-1.amazonaws.com", description: "Override default Comprehend endpoint" },
      ],
    },
    {
      title: "Moderation Settings",
      fields: [
        { key: "moderation_threshold", label: "Default Threshold", type: "number", defaultValue: 0.5, min: 0, max: 1, step: 0.05, description: "Global toxicity threshold (0 = most strict, 1 = most permissive)" },
      ],
    },
    {
      title: "Category Thresholds",
      description: "Override the default threshold per category (0-1). Leave empty to use the global threshold.",
      collapsible: true,
      defaultOpen: false,
      fields: [
        { key: "moderation_categories.PROFANITY", label: "Profanity", type: "number", min: 0, max: 1, step: 0.05 },
        { key: "moderation_categories.HATE_SPEECH", label: "Hate Speech", type: "number", min: 0, max: 1, step: 0.05 },
        { key: "moderation_categories.INSULT", label: "Insult", type: "number", min: 0, max: 1, step: 0.05 },
        { key: "moderation_categories.HARASSMENT_OR_ABUSE", label: "Harassment / Abuse", type: "number", min: 0, max: 1, step: 0.05 },
        { key: "moderation_categories.SEXUAL", label: "Sexual Content", type: "number", min: 0, max: 1, step: 0.05 },
        { key: "moderation_categories.VIOLENCE_OR_THREAT", label: "Violence / Threat", type: "number", min: 0, max: 1, step: 0.05 },
      ],
    },
  ],
}

// --- Registry ---

export const PLUGIN_FORM_REGISTRY: Record<string, PluginFormDef> = {
  // Authentication
  "key-auth": KEY_AUTH,
  "basic-auth": BASIC_AUTH,
  "jwt-auth": JWT_AUTH,
  "hmac-auth": HMAC_AUTH,
  "openid-connect": OPENID_CONNECT,
  "forward-auth": FORWARD_AUTH,
  "authz-keycloak": AUTHZ_KEYCLOAK,
  "wolf-rbac": WOLF_RBAC,
  // Security
  "ip-restriction": IP_RESTRICTION,
  "uri-blocker": URI_BLOCKER,
  "cors": CORS,
  "csrf": CSRF,
  "consumer-restriction": CONSUMER_RESTRICTION,
  "request-validation": REQUEST_VALIDATION,
  // Traffic Control
  "limit-req": LIMIT_REQ,
  "limit-conn": LIMIT_CONN,
  "limit-count": LIMIT_COUNT,
  "traffic-split": TRAFFIC_SPLIT,
  "request-id": REQUEST_ID,
  "proxy-cache": PROXY_CACHE,
  "api-breaker": API_BREAKER,
  "proxy-mirror": PROXY_MIRROR,
  "client-control": CLIENT_CONTROL,
  "real-ip": REAL_IP,
  // Transformation
  "proxy-rewrite": PROXY_REWRITE,
  "response-rewrite": RESPONSE_REWRITE,
  "grpc-transcode": GRPC_TRANSCODE,
  "fault-injection": FAULT_INJECTION,
  "redirect": REDIRECT,
  "body-transformer": BODY_TRANSFORMER,
  "mocking": MOCKING,
  "serverless-pre-function": SERVERLESS_PRE_FUNCTION,
  "serverless-post-function": SERVERLESS_POST_FUNCTION,
  // Observability
  "prometheus": PROMETHEUS,
  "http-logger": HTTP_LOGGER,
  "kafka-logger": KAFKA_LOGGER,
  "elasticsearch-logger": ELASTICSEARCH_LOGGER,
  "clickhouse-logger": CLICKHOUSE_LOGGER,
  "syslog": SYSLOG,
  "zipkin": ZIPKIN,
  "opentelemetry": OPENTELEMETRY,
  "skywalking": SKYWALKING,
  "datadog": DATADOG,
  // Serverless
  "aws-lambda": AWS_LAMBDA,
  "azure-functions": AZURE_FUNCTIONS,
  // AI Gateway
  "ai-proxy": AI_PROXY,
  "ai-proxy-multi": AI_PROXY_MULTI,
  "ai-prompt-guard": AI_PROMPT_GUARD,
  "ai-request-rewrite": AI_REQUEST_REWRITE,
  "ai-rate-limiting": AI_RATE_LIMITING,
  "ai-rag": AI_RAG,
  "ai-aws-content-moderation": AI_AWS_CONTENT_MODERATION,
}
