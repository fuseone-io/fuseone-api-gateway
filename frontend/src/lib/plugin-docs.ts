export interface PluginDoc {
  overview: string
  useCases: string[]
  bestPractices: string[]
  cautions: string[]
  examples: {
    title: string
    description: string
    config: Record<string, unknown>
  }[]
  relatedPlugins?: string[]
}

export const PLUGIN_DOCS: Record<string, PluginDoc> = {
  // ─── Authentication ───────────────────────────────────────────

  "key-auth": {
    overview:
      "API Key authentication validates requests by checking for a secret key in a header or query parameter. When a valid key is found, the request is associated with the consumer who owns that key, enabling per-consumer rate limiting, logging, and access control. This is the simplest authentication method and works well for server-to-server communication or internal APIs.",
    useCases: [
      "Authenticate internal microservices calling your API",
      "Provide API access to third-party integrations with unique keys per partner",
      "Quick authentication setup for development and staging environments",
      "Machine-to-machine communication where browser-based auth is unnecessary",
    ],
    bestPractices: [
      "Always use header-based keys instead of query parameters to avoid key leakage in access logs and browser history",
      "Rotate API keys periodically and provide a migration window for consumers",
      "Enable 'hide_credentials' to strip the key from requests forwarded to upstream services",
      "Combine with IP restriction for defense-in-depth security",
    ],
    cautions: [
      "API keys sent as query parameters will appear in access logs, proxy logs, and potentially browser history — use headers instead",
      "API keys alone do not provide the same security as JWT or OAuth2 — they are shared secrets without expiration by default",
      "If a key is compromised, you must manually revoke it and issue a new one to the consumer",
    ],
    examples: [
      {
        title: "Header-based API Key",
        description: "Authenticate using a custom header (recommended approach)",
        config: { header: "X-API-Key", hide_credentials: true },
      },
      {
        title: "Query Parameter API Key",
        description: "Authenticate using a query parameter (less secure, useful for webhooks)",
        config: { query: "api_key", hide_credentials: true },
      },
    ],
    relatedPlugins: ["consumer-restriction", "ip-restriction", "limit-count"],
  },

  "basic-auth": {
    overview:
      "HTTP Basic Authentication encodes a username and password in the Authorization header using Base64. While simple, it should always be used over HTTPS since credentials are only encoded, not encrypted. Basic Auth is well-supported by all HTTP clients and is ideal for simple internal services or admin endpoints.",
    useCases: [
      "Protect admin or management endpoints with simple credentials",
      "Integration with legacy systems that only support Basic Auth",
      "Quick authentication for internal dashboards behind a VPN",
    ],
    bestPractices: [
      "Always require HTTPS — Basic Auth credentials are Base64-encoded (not encrypted)",
      "Enable 'hide_credentials' to prevent the Authorization header from being forwarded to upstream",
      "Use strong, unique passwords for each consumer",
      "Consider JWT or OAuth2 for public-facing APIs instead",
    ],
    cautions: [
      "Credentials are sent with every request, increasing exposure risk compared to token-based auth",
      "Without HTTPS, credentials can be intercepted in plaintext",
      "Not suitable for browser-based applications where credentials would need to be stored client-side",
    ],
    examples: [
      {
        title: "Standard Basic Auth",
        description: "Basic configuration with credential hiding",
        config: { hide_credentials: true },
      },
    ],
    relatedPlugins: ["key-auth", "jwt-auth", "cors"],
  },

  "jwt-auth": {
    overview:
      "JWT (JSON Web Token) authentication validates tokens signed with a secret (HS256/HS512) or public key (RS256/ES256). The gateway verifies the token signature, checks expiration, and maps the token to a consumer. JWT is stateless and widely used for modern APIs, SPAs, and mobile applications.",
    useCases: [
      "Secure public-facing REST APIs for web and mobile applications",
      "Single Sign-On (SSO) integration where tokens are issued by an identity provider",
      "Stateless authentication for microservices architectures",
      "Per-consumer authorization with custom claims in the token payload",
    ],
    bestPractices: [
      "Use RS256 (asymmetric) for production — the gateway only needs the public key, reducing risk if compromised",
      "Set short token expiration times (15-60 minutes) and use refresh tokens for longer sessions",
      "Validate critical claims like 'iss' (issuer) and 'aud' (audience) to prevent token misuse across services",
      "Store secrets securely — never commit them to version control",
    ],
    cautions: [
      "HS256 uses a shared secret — if the gateway is compromised, tokens can be forged. Prefer RS256 for sensitive APIs",
      "JWT tokens cannot be revoked individually without a blocklist — plan for token expiration as the primary invalidation mechanism",
      "Large JWT payloads increase request size and latency since the token is sent with every request",
      "Clock skew between servers can cause valid tokens to be rejected — use the 'exp_leeway' setting",
    ],
    examples: [
      {
        title: "HS256 with Header",
        description: "Symmetric key authentication with token in Authorization header",
        config: {
          key: "consumer-key",
          secret: "my-secret-key",
          algorithm: "HS256",
          exp: 86400,
          base64_secret: false,
        },
      },
      {
        title: "RS256 with Public Key",
        description: "Asymmetric key authentication (recommended for production)",
        config: {
          key: "consumer-key",
          public_key: "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
          algorithm: "RS256",
          exp: 3600,
        },
      },
    ],
    relatedPlugins: ["openid-connect", "consumer-restriction", "cors"],
  },

  "hmac-auth": {
    overview:
      "HMAC authentication verifies request integrity and authenticity by computing a hash-based message authentication code over the request contents. The client signs the request using a shared secret, and the gateway verifies the signature. This prevents tampering and replay attacks when combined with timestamps.",
    useCases: [
      "Secure webhook endpoints where request integrity must be verified",
      "API-to-API communication requiring tamper-proof request verification",
      "Payment or financial APIs where request integrity is critical",
      "Integration with services that use HMAC-based signing (e.g., AWS Signature V4)",
    ],
    bestPractices: [
      "Always include a timestamp in the signed string to prevent replay attacks",
      "Use SHA-256 or SHA-512 as the hashing algorithm — avoid SHA-1 or MD5",
      "Set a reasonable clock skew tolerance (e.g., 300 seconds) to account for time differences",
      "Sign the request body in addition to headers for complete integrity verification",
    ],
    cautions: [
      "HMAC is more complex to implement on the client side compared to API keys or JWT",
      "Clock synchronization between client and server is critical — too much skew will cause authentication failures",
      "The shared secret must be distributed securely to each consumer",
    ],
    examples: [
      {
        title: "Standard HMAC Configuration",
        description: "HMAC with SHA-256 and 5-minute clock skew tolerance",
        config: {
          access_key: "my-access-key",
          secret_key: "my-secret-key",
          algorithm: "hmac-sha256",
          clock_skew: 300,
          signed_headers: ["date", "content-type"],
        },
      },
    ],
    relatedPlugins: ["key-auth", "jwt-auth"],
  },

  "openid-connect": {
    overview:
      "OpenID Connect (OIDC) integrates the gateway with any OIDC-compliant identity provider (Keycloak, Auth0, Okta, Azure AD, Google). It handles the full OAuth2 authorization code flow, token validation, and token introspection. This is the recommended approach for user-facing applications requiring enterprise-grade authentication.",
    useCases: [
      "SSO integration with corporate identity providers (Keycloak, Azure AD, Okta)",
      "Protect APIs accessed by web applications using OAuth2 authorization code flow",
      "Token introspection for opaque tokens issued by an external IdP",
      "Centralized authentication gateway for microservices",
    ],
    bestPractices: [
      "Use the discovery endpoint to auto-configure all IdP URLs — reduces configuration errors",
      "Enable 'bearer_only' mode for pure API gateways that don't need to initiate login flows",
      "Set 'ssl_verify' to true in production to validate the IdP's TLS certificate",
      "Configure appropriate scopes (e.g., 'openid profile email') to get the claims you need",
    ],
    cautions: [
      "The full authorization code flow requires the gateway to handle redirects — not suitable for all API architectures",
      "Token introspection adds latency since it makes an HTTP call to the IdP for each request — consider caching",
      "Session management in the gateway can increase memory usage under high traffic",
      "Ensure the redirect_uri matches exactly what is configured in the IdP — mismatches cause authentication failures",
    ],
    examples: [
      {
        title: "Keycloak Integration",
        description: "OIDC with auto-discovery and bearer-only mode for APIs",
        config: {
          client_id: "my-api",
          client_secret: "client-secret",
          discovery: "https://keycloak.example.com/realms/my-realm/.well-known/openid-configuration",
          bearer_only: true,
          realm: "my-realm",
          ssl_verify: true,
        },
      },
      {
        title: "Auth0 Integration",
        description: "OIDC with Auth0 using introspection",
        config: {
          client_id: "your-client-id",
          client_secret: "your-client-secret",
          discovery: "https://your-tenant.auth0.com/.well-known/openid-configuration",
          bearer_only: true,
          scope: "openid profile email",
        },
      },
    ],
    relatedPlugins: ["jwt-auth", "cors", "csrf"],
  },

  "forward-auth": {
    overview:
      "Forward Auth delegates authentication to an external HTTP service. For each incoming request, the gateway forwards headers to the auth service. If it returns 2xx, the request proceeds; otherwise, the auth service's response is returned to the client. This enables custom authentication logic without modifying the gateway.",
    useCases: [
      "Integrate custom authentication microservices with the gateway",
      "Implement complex authorization rules that go beyond what built-in plugins offer",
      "Use an external service like Authelia, Authentik, or a custom auth server",
      "Gradually migrate from legacy auth systems by wrapping them as forward-auth services",
    ],
    bestPractices: [
      "Keep the auth service fast (< 50ms response time) to minimize request latency",
      "Forward only necessary headers to the auth service to reduce payload size",
      "Implement health checks on the auth service to prevent cascading failures",
      "Cache auth decisions when possible to reduce load on the auth service",
    ],
    cautions: [
      "Every request goes through the external auth service — it becomes a critical dependency and potential bottleneck",
      "Network issues between the gateway and auth service will cause all requests to fail",
      "The auth service must be highly available — consider running multiple replicas",
    ],
    examples: [
      {
        title: "External Auth Service",
        description: "Forward auth headers to an external authentication service",
        config: {
          uri: "http://auth-service:9090/verify",
          request_headers: ["Authorization", "X-Forwarded-For"],
          upstream_headers: ["X-User-ID", "X-User-Role"],
          client_headers: ["X-Auth-Error"],
        },
      },
    ],
    relatedPlugins: ["jwt-auth", "openid-connect", "consumer-restriction"],
  },

  // ─── Security ─────────────────────────────────────────────────

  "ip-restriction": {
    overview:
      "IP Restriction controls access by allowing or denying requests based on the client's IP address. You can define a whitelist (only listed IPs are allowed) or a blacklist (listed IPs are blocked). It supports individual IPs, CIDR ranges, and IPv6 addresses.",
    useCases: [
      "Restrict admin endpoints to office or VPN IP ranges",
      "Block known malicious IP addresses or botnets",
      "Allow only specific partner IPs to access certain APIs",
      "Enforce geo-based access control using IP ranges",
    ],
    bestPractices: [
      "Use whitelist mode for maximum security — only explicitly allowed IPs can access the API",
      "Use CIDR notation for IP ranges instead of listing individual addresses (e.g., 10.0.0.0/8)",
      "Configure the gateway to trust the correct proxy headers (X-Forwarded-For, X-Real-IP) when behind a load balancer",
      "Combine with authentication for defense-in-depth — IP restriction alone is not sufficient",
    ],
    cautions: [
      "If the gateway is behind a load balancer or CDN, the client IP may be the proxy's IP — configure 'real_ip' plugin first",
      "Whitelist and blacklist are mutually exclusive — you can only use one per configuration",
      "IPv6 addresses must be specified in their full form or using standard notation",
      "Changing IP restrictions takes effect immediately — test changes carefully in staging first",
    ],
    examples: [
      {
        title: "Whitelist Office IPs",
        description: "Only allow requests from specific IP ranges",
        config: { whitelist: ["10.0.0.0/8", "192.168.1.0/24", "203.0.113.50"] },
      },
      {
        title: "Blacklist Known Bad IPs",
        description: "Block requests from specific IP addresses",
        config: { blacklist: ["198.51.100.0/24", "203.0.113.100"], message: "Access denied" },
      },
    ],
    relatedPlugins: ["consumer-restriction", "cors", "uri-blocker"],
  },

  "uri-blocker": {
    overview:
      "URI Blocker prevents access to specific URI paths by matching against a list of regular expression patterns. Any request whose URI matches a blocked pattern is immediately rejected with a configurable HTTP status code. This is useful for protecting sensitive endpoints or blocking known attack patterns.",
    useCases: [
      "Block access to internal management endpoints (e.g., /admin, /debug, /.env)",
      "Prevent directory traversal attacks by blocking patterns like '../'",
      "Hide internal endpoints that should not be exposed through the gateway",
      "Block known vulnerability scanning paths (e.g., /wp-admin, /phpmyadmin)",
    ],
    bestPractices: [
      "Use specific regex patterns rather than overly broad ones to avoid blocking legitimate requests",
      "Test regex patterns thoroughly before deploying — false positives can break valid API calls",
      "Combine with IP restriction for sensitive admin endpoints",
      "Return 404 instead of 403 to avoid revealing the existence of blocked endpoints",
    ],
    cautions: [
      "Complex regex patterns can impact performance under high traffic — keep patterns simple",
      "URL-encoded characters may bypass simple string matching — ensure patterns handle encoding",
      "Overly broad patterns like '.*admin.*' can accidentally block legitimate URLs",
    ],
    examples: [
      {
        title: "Block Admin Endpoints",
        description: "Prevent access to common admin and internal paths",
        config: {
          block_rules: ["^/admin", "^/debug", "^/\\.env", "^/\\.git"],
          rejected_code: 404,
        },
      },
    ],
    relatedPlugins: ["ip-restriction", "cors", "consumer-restriction"],
  },

  cors: {
    overview:
      "CORS (Cross-Origin Resource Sharing) controls which origins can access your API from a web browser. The gateway automatically handles preflight OPTIONS requests and adds the appropriate CORS headers to responses. This is essential for any API consumed by web applications running on different domains.",
    useCases: [
      "Allow your frontend application on app.example.com to call your API on api.example.com",
      "Support multiple frontend applications (web, mobile PWA) accessing the same API",
      "Enable third-party JavaScript SDKs to make cross-origin API calls",
      "Configure CORS headers for API marketplace integrations",
    ],
    bestPractices: [
      "Never use '*' for allow_origins in production when using credentials — browsers will reject the response",
      "List specific allowed origins instead of using wildcards for better security",
      "Set a reasonable max_age (e.g., 3600 seconds) to reduce preflight requests",
      "Only expose headers that the frontend actually needs via expose_headers",
    ],
    cautions: [
      "Using 'allow_credential: true' with 'allow_origins: *' is invalid and will be rejected by browsers",
      "Preflight (OPTIONS) requests add latency — tune max_age to cache preflight responses",
      "CORS is enforced by browsers, not by the server — server-to-server calls are not affected",
      "Misconfigured CORS is a common source of frontend bugs — test with actual browser requests",
    ],
    examples: [
      {
        title: "Single Origin with Credentials",
        description: "Allow a specific frontend to make authenticated requests",
        config: {
          allow_origins: "https://app.example.com",
          allow_methods: "GET,POST,PUT,DELETE,OPTIONS",
          allow_headers: "Authorization,Content-Type",
          allow_credential: true,
          max_age: 3600,
        },
      },
      {
        title: "Multiple Origins",
        description: "Allow requests from multiple frontend applications",
        config: {
          allow_origins: "https://app.example.com,https://admin.example.com",
          allow_methods: "**",
          allow_headers: "**",
          expose_headers: "X-Request-Id",
          max_age: 7200,
        },
      },
    ],
    relatedPlugins: ["csrf", "response-rewrite", "request-id"],
  },

  csrf: {
    overview:
      "CSRF (Cross-Site Request Forgery) protection prevents attackers from tricking authenticated users into making unintended requests. The plugin generates and validates CSRF tokens, ensuring that state-changing requests originate from your legitimate application. This is critical for any API that uses cookie-based authentication.",
    useCases: [
      "Protect form submissions and state-changing operations in web applications",
      "Add CSRF protection to APIs using cookie/session-based authentication",
      "Secure admin panels and dashboard backends against CSRF attacks",
    ],
    bestPractices: [
      "Use CSRF protection alongside cookie-based auth — token-based auth (JWT in headers) is inherently CSRF-safe",
      "Configure the token name to match your frontend framework's expectations",
      "Set the key to a strong, random secret value",
      "Only apply to state-changing methods (POST, PUT, DELETE) — GET requests should be safe by design",
    ],
    cautions: [
      "CSRF protection is not needed for APIs that only use Authorization header tokens (JWT, API Key)",
      "The CSRF token must be included by the frontend in every state-changing request",
      "Misconfigured CSRF can block legitimate requests — test thoroughly with your frontend",
    ],
    examples: [
      {
        title: "Standard CSRF Protection",
        description: "Protect state-changing endpoints with CSRF tokens",
        config: { name: "_csrf_token", key: "random-secret-key-here" },
      },
    ],
    relatedPlugins: ["cors", "openid-connect"],
  },

  "consumer-restriction": {
    overview:
      "Consumer Restriction limits which authenticated consumers or consumer groups can access a route. After authentication identifies the consumer, this plugin checks if they are in the allowed list. This enables fine-grained access control beyond simple authentication.",
    useCases: [
      "Restrict premium API endpoints to paying consumers only",
      "Create different access tiers (free, basic, premium) for API consumers",
      "Block specific consumers from accessing certain routes without revoking their credentials entirely",
      "Enforce service-level access control in a multi-tenant environment",
    ],
    bestPractices: [
      "Use consumer groups for scalable access management instead of listing individual consumers",
      "Combine with an authentication plugin (key-auth, jwt-auth) — this plugin requires an authenticated consumer",
      "Use meaningful consumer group names that map to your business tiers (e.g., 'premium', 'partner')",
    ],
    cautions: [
      "This plugin only works with authenticated requests — it requires an auth plugin to identify the consumer first",
      "Whitelist and blacklist types are mutually exclusive",
      "Changes take effect immediately — consumers will be blocked or unblocked in real-time",
    ],
    examples: [
      {
        title: "Allow Specific Consumers",
        description: "Only allow listed consumers to access this route",
        config: { type: "consumer_name", whitelist: ["partner-a", "partner-b"] },
      },
      {
        title: "Group-based Access",
        description: "Allow consumers in specific groups",
        config: { type: "consumer_group_id", whitelist: ["premium-tier", "enterprise"] },
      },
    ],
    relatedPlugins: ["key-auth", "jwt-auth", "ip-restriction"],
  },

  // ─── Traffic Control ──────────────────────────────────────────

  "limit-req": {
    overview:
      "Rate Limit uses the leaky bucket algorithm to control the rate of incoming requests. It smooths out bursty traffic by setting a maximum request rate and an optional burst capacity. Requests exceeding the limit are delayed or rejected. Rate limiting protects your upstream services from overload and ensures fair usage across consumers.",
    useCases: [
      "Protect backend services from traffic spikes and DDoS attempts",
      "Enforce fair usage across API consumers (e.g., 100 req/s per consumer)",
      "Implement different rate limits for free vs. premium API tiers",
      "Prevent a single client from monopolizing shared resources",
    ],
    bestPractices: [
      "Set rate limits based on your upstream's actual capacity, not arbitrary numbers",
      "Use 'remote_addr' as the key for anonymous APIs, and 'consumer_name' for authenticated APIs",
      "Configure burst to handle legitimate traffic spikes without rejecting requests",
      "Use Redis for rate limiting across multiple gateway nodes in a cluster",
    ],
    cautions: [
      "Without Redis, rate limits are per gateway node — total cluster throughput = limit x nodes",
      "Setting burst too low causes rejected requests during normal traffic variations",
      "The leaky bucket algorithm delays requests — high burst values can increase latency",
      "Ensure your Redis instance is fast and reliable — it becomes a critical dependency",
    ],
    examples: [
      {
        title: "Per-IP Rate Limiting",
        description: "Limit to 10 requests/second per client IP with burst of 20",
        config: { rate: 10, burst: 20, key_type: "var", key: "remote_addr", rejected_code: 429 },
      },
      {
        title: "Per-Consumer with Redis",
        description: "Shared rate limiting across cluster nodes using Redis",
        config: {
          rate: 50,
          burst: 100,
          key_type: "var",
          key: "consumer_name",
          policy: "redis",
          redis_host: "redis.internal",
          redis_port: 6379,
        },
      },
    ],
    relatedPlugins: ["limit-count", "limit-conn", "consumer-restriction"],
  },

  "limit-conn": {
    overview:
      "Concurrency Limit restricts the number of simultaneous connections to your upstream. Unlike rate limiting which controls request rate over time, this plugin controls how many requests can be processed concurrently. This is essential for protecting services with limited connection pools or long-running requests.",
    useCases: [
      "Protect database-backed services with limited connection pools",
      "Control concurrency for endpoints with expensive operations (report generation, file processing)",
      "Prevent thread/connection pool exhaustion on upstream servers",
      "Ensure fair resource allocation across consumers in a multi-tenant system",
    ],
    bestPractices: [
      "Set the connection limit based on your upstream's actual concurrency capacity",
      "Configure a reasonable burst to handle short spikes without rejecting requests",
      "Use 'default_conn_delay' to add backpressure instead of immediately rejecting excess requests",
      "Monitor rejected connections to tune limits based on real traffic patterns",
    ],
    cautions: [
      "Setting limits too low causes unnecessary rejections during normal traffic",
      "Long-running requests hold connections longer, reducing effective throughput",
      "Without Redis, limits are per gateway node — calculate cluster-wide limits accordingly",
    ],
    examples: [
      {
        title: "Connection Limit per IP",
        description: "Limit each client to 50 concurrent connections",
        config: {
          conn: 50,
          burst: 25,
          default_conn_delay: 0.1,
          key_type: "var",
          key: "remote_addr",
          rejected_code: 503,
        },
      },
    ],
    relatedPlugins: ["limit-req", "limit-count"],
  },

  "limit-count": {
    overview:
      "Request Quota limits the total number of requests a consumer can make within a fixed time window (e.g., 1000 requests per hour). Unlike rate limiting which controls request rate per second, this plugin enforces a total count over longer periods. It is commonly used for API billing and usage quotas.",
    useCases: [
      "Enforce API usage quotas for billing tiers (e.g., 10,000 requests/month for free plan)",
      "Implement daily or hourly request caps per consumer",
      "Comply with upstream API rate limits by capping total requests",
      "Protect shared resources from excessive use by a single consumer",
    ],
    bestPractices: [
      "Set time_window based on your billing cycle (3600 for hourly, 86400 for daily)",
      "Use Redis to share counters across multiple gateway nodes",
      "Return quota information in response headers so clients can track their usage",
      "Use consumer_name as the key for authenticated APIs to track per-consumer usage",
    ],
    cautions: [
      "Without Redis, each gateway node tracks counts independently — total allowed = count x nodes",
      "Fixed windows can cause thundering herd at window boundaries — consider using limit-req for smoother throttling",
      "Large time windows (e.g., monthly) with high counts require reliable Redis persistence",
    ],
    examples: [
      {
        title: "Hourly Quota per Consumer",
        description: "Allow 1000 requests per hour per consumer",
        config: {
          count: 1000,
          time_window: 3600,
          key_type: "var",
          key: "consumer_name",
          rejected_code: 429,
          rejected_msg: "API quota exceeded. Please upgrade your plan.",
        },
      },
      {
        title: "Daily Quota per IP with Redis",
        description: "Allow 10,000 requests per day per IP, shared across cluster",
        config: {
          count: 10000,
          time_window: 86400,
          key_type: "var",
          key: "remote_addr",
          policy: "redis",
          redis_host: "redis.internal",
          redis_port: 6379,
        },
      },
    ],
    relatedPlugins: ["limit-req", "limit-conn", "consumer-restriction"],
  },

  "traffic-split": {
    overview:
      "Traffic Split distributes incoming requests across multiple upstream groups based on configurable weights. This enables canary deployments, A/B testing, and gradual rollouts by sending a percentage of traffic to a new version while the majority continues to the stable version.",
    useCases: [
      "Canary deployments: send 5% of traffic to a new version for validation",
      "A/B testing: split traffic between different service implementations",
      "Gradual rollouts: progressively increase traffic to new versions",
      "Blue-green deployments with configurable traffic switching",
    ],
    bestPractices: [
      "Start with a small weight (1-5%) for canary deployments and increase gradually",
      "Monitor error rates and latency for each upstream group during splits",
      "Use conditional rules (based on headers, cookies) for targeted canary testing",
      "Have a quick rollback plan — set the canary weight to 0 to immediately stop traffic",
    ],
    cautions: [
      "Traffic split adds routing complexity — ensure monitoring covers all upstream groups",
      "Stateful applications may behave differently when the same user hits different versions",
      "Weight-based splitting is probabilistic — small request volumes may not distribute evenly",
    ],
    examples: [
      {
        title: "90/10 Canary Split",
        description: "Send 10% of traffic to a canary upstream",
        config: {
          rules: [
            {
              weighted_upstreams: [
                { upstream: { type: "roundrobin", nodes: { "stable:8080": 1 } }, weight: 90 },
                { upstream: { type: "roundrobin", nodes: { "canary:8080": 1 } }, weight: 10 },
              ],
            },
          ],
        },
      },
    ],
    relatedPlugins: ["proxy-rewrite", "fault-injection"],
  },

  "request-id": {
    overview:
      "Request ID generates a unique identifier for each request and adds it as a header. This enables end-to-end request tracing across microservices, making it easy to correlate logs, traces, and errors for a specific request. If a request already has an ID header, the existing value is preserved.",
    useCases: [
      "Enable distributed tracing across microservices",
      "Correlate gateway access logs with upstream application logs",
      "Support customer support by providing request IDs for incident investigation",
      "Include request IDs in error responses for debugging",
    ],
    bestPractices: [
      "Use the default 'X-Request-Id' header name for compatibility with most frameworks",
      "Forward the request ID to upstream services and include it in all log entries",
      "Include the request ID in error responses so clients can report it for debugging",
      "Use UUID v4 algorithm for globally unique IDs",
    ],
    cautions: [
      "If a client sends a malicious or very long request ID, it will be used as-is unless you configure include_in_response",
      "Ensure all upstream services propagate the request ID in their logs for full traceability",
    ],
    examples: [
      {
        title: "Standard Request ID",
        description: "Generate UUID-based request IDs",
        config: { header_name: "X-Request-Id", include_in_response: true, algorithm: "uuid" },
      },
    ],
    relatedPlugins: ["opentelemetry", "zipkin", "http-logger"],
  },

  "proxy-cache": {
    overview:
      "Proxy Cache stores upstream responses and serves them directly from the gateway for subsequent identical requests. This dramatically reduces upstream load and response latency for cacheable content. The cache supports TTL-based expiration and respects standard HTTP caching headers.",
    useCases: [
      "Cache frequently accessed, rarely changing API responses (e.g., product catalogs, configurations)",
      "Reduce upstream load for read-heavy APIs",
      "Improve response times for geographically distributed users",
      "Cache expensive query results to reduce database load",
    ],
    bestPractices: [
      "Only cache GET requests and responses that are safe to serve stale",
      "Set appropriate TTL values based on how frequently the data changes",
      "Include relevant query parameters in cache keys to avoid serving wrong responses",
      "Configure cache_bypass and no_cache conditions for authenticated or personalized content",
    ],
    cautions: [
      "Caching authenticated or personalized responses can leak data between users — always exclude auth-dependent responses",
      "Stale cache can serve outdated data — implement cache invalidation strategies",
      "Memory-based caching does not persist across gateway restarts",
      "Cache key design is critical — too broad and you get stale data, too narrow and cache hit rate drops",
    ],
    examples: [
      {
        title: "Cache GET Responses",
        description: "Cache successful GET responses for 5 minutes",
        config: {
          cache_strategy: "memory",
          cache_zone: "disk_cache_one",
          cache_key: ["$uri", "$request_method"],
          cache_http_status: [200, 301],
          cache_ttl: 300,
          hide_cache_headers: false,
        },
      },
    ],
    relatedPlugins: ["proxy-rewrite", "response-rewrite"],
  },

  // ─── Transformation ───────────────────────────────────────────

  "proxy-rewrite": {
    overview:
      "Proxy Rewrite modifies the request before it is forwarded to the upstream. You can change the URI path, host header, HTTP method, and add or remove headers. This is essential when the gateway's public API structure differs from the upstream service's actual paths.",
    useCases: [
      "Map public API paths to internal service paths (e.g., /api/v1/users → /users)",
      "Add internal headers required by upstream services (e.g., X-Internal-Service: gateway)",
      "Strip API versioning prefixes before forwarding to the upstream",
      "Change the Host header to match what the upstream expects",
    ],
    bestPractices: [
      "Use regex_uri for complex path transformations, plain uri for simple ones",
      "Add tracing headers (X-Request-Id, X-Forwarded-For) to help upstream services with debugging",
      "Keep transformations simple and well-documented — complex rewrites are hard to debug",
    ],
    cautions: [
      "Incorrect regex patterns can cause requests to be routed to wrong upstream paths",
      "Removing essential headers can break upstream service functionality",
      "URI rewriting happens before the request reaches the upstream — logging may show the original URI",
    ],
    examples: [
      {
        title: "Strip API Version Prefix",
        description: "Remove /api/v1 prefix before forwarding to upstream",
        config: { regex_uri: ["^/api/v1/(.*)", "/$1"] },
      },
      {
        title: "Add Internal Headers",
        description: "Add headers for upstream service routing",
        config: {
          uri: "/internal/endpoint",
          headers: { set: { "X-Gateway": "fuseone", "X-Env": "production" } },
        },
      },
    ],
    relatedPlugins: ["response-rewrite", "redirect", "grpc-transcode"],
  },

  "response-rewrite": {
    overview:
      "Response Rewrite modifies the response from the upstream before sending it to the client. You can change the HTTP status code, add or remove headers, and transform the response body. This is useful for standardizing API responses and hiding internal implementation details.",
    useCases: [
      "Standardize error response format across different upstream services",
      "Add security headers (HSTS, X-Content-Type-Options) to all responses",
      "Remove internal headers that should not be exposed to clients",
      "Transform response bodies to match your API's contract",
    ],
    bestPractices: [
      "Add security headers (Strict-Transport-Security, X-Frame-Options) at the gateway level",
      "Remove server identification headers (Server, X-Powered-By) to reduce information leakage",
      "Use body filters sparingly — they add processing overhead",
    ],
    cautions: [
      "Body rewriting requires buffering the entire response — this increases memory usage for large responses",
      "Complex body transformations can impact performance under high traffic",
      "Changing the status code hides the upstream's actual response status from client-side error handling",
    ],
    examples: [
      {
        title: "Add Security Headers",
        description: "Add standard security headers to all responses",
        config: {
          headers: {
            set: {
              "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
              "X-Content-Type-Options": "nosniff",
              "X-Frame-Options": "DENY",
            },
            remove: ["Server", "X-Powered-By"],
          },
        },
      },
    ],
    relatedPlugins: ["proxy-rewrite", "cors"],
  },

  "grpc-transcode": {
    overview:
      "gRPC Transcode converts HTTP/JSON requests into gRPC calls and vice versa. This allows clients to access gRPC services using standard REST APIs without needing a gRPC client. The plugin uses Protocol Buffer definitions to handle the conversion automatically.",
    useCases: [
      "Expose gRPC microservices as RESTful APIs for web and mobile clients",
      "Allow browser-based applications to call gRPC services without gRPC-Web",
      "Create a unified REST API gateway for a mix of REST and gRPC backend services",
      "Enable API testing tools (Postman, curl) to interact with gRPC services",
    ],
    bestPractices: [
      "Upload the .proto file definition to ensure correct transcoding",
      "Map gRPC methods to RESTful HTTP methods (GET, POST, PUT, DELETE) following HTTP API design guidelines",
      "Handle gRPC error codes to HTTP status code mapping explicitly",
    ],
    cautions: [
      "Streaming gRPC methods are not fully supported via REST transcoding",
      "Complex Protocol Buffer types (nested messages, oneofs) may require careful mapping",
      "Performance overhead exists for JSON <-> Protobuf serialization/deserialization",
    ],
    examples: [
      {
        title: "Basic gRPC Transcoding",
        description: "Transcode HTTP requests to a gRPC service",
        config: {
          proto_id: "1",
          service: "example.UserService",
          method: "GetUser",
        },
      },
    ],
    relatedPlugins: ["proxy-rewrite", "response-rewrite"],
  },

  "fault-injection": {
    overview:
      "Fault Injection deliberately introduces failures and delays into API requests for testing purposes. You can inject HTTP errors (abort) or add artificial latency (delay) to simulate upstream failures, slow networks, and degraded performance. This is essential for chaos engineering and resilience testing.",
    useCases: [
      "Test client error handling by simulating 500, 503, or timeout errors",
      "Validate circuit breaker behavior by injecting periodic failures",
      "Simulate slow networks to test client timeout configurations",
      "Chaos engineering: verify system resilience under adverse conditions",
    ],
    bestPractices: [
      "Use percentage-based injection to test with a subset of traffic",
      "Start with low fault percentages (1-5%) and increase gradually",
      "Always have a quick way to disable fault injection (e.g., feature flag)",
      "Monitor the impact on downstream services and user experience",
    ],
    cautions: [
      "Never enable fault injection in production without careful planning and monitoring",
      "High abort percentages can cause cascading failures in dependent services",
      "Delay injection increases resource consumption (connections held open longer)",
      "Ensure fault injection is disabled after testing — leftover faults cause outages",
    ],
    examples: [
      {
        title: "Inject 5% Server Errors",
        description: "Return 503 for 5% of requests to test client retry logic",
        config: {
          abort: { http_status: 503, body: "Service temporarily unavailable", percentage: 5 },
        },
      },
      {
        title: "Add Latency",
        description: "Add 2 seconds of delay to 10% of requests",
        config: { delay: { duration: 2, percentage: 10 } },
      },
    ],
    relatedPlugins: ["traffic-split", "proxy-cache"],
  },

  redirect: {
    overview:
      "Redirect sends HTTP redirect responses to clients, instructing them to make a new request to a different URI. This is useful for URL canonicalization, HTTP-to-HTTPS upgrades, and routing deprecated endpoints to new ones. The redirect happens at the gateway level without forwarding to the upstream.",
    useCases: [
      "Redirect HTTP traffic to HTTPS",
      "Redirect old API versions to new ones (e.g., /api/v1/users → /api/v2/users)",
      "URL canonicalization (e.g., trailing slash normalization)",
      "Redirect deprecated endpoints to their replacements",
    ],
    bestPractices: [
      "Use 301 (permanent) for SEO-important redirects and 302 (temporary) for transient ones",
      "Use 308 for permanent redirects that must preserve the HTTP method (POST stays POST)",
      "Test redirect chains — multiple consecutive redirects hurt performance and user experience",
    ],
    cautions: [
      "301 redirects are cached by browsers — incorrect ones are difficult to undo",
      "Redirect loops (A → B → A) cause infinite redirects and browser errors",
      "POST/PUT data may be lost with 301/302 — use 307/308 to preserve the HTTP method",
    ],
    examples: [
      {
        title: "HTTP to HTTPS",
        description: "Redirect all HTTP requests to HTTPS",
        config: { http_to_https: true },
      },
      {
        title: "Custom Redirect",
        description: "Redirect to a new URI with 301 status",
        config: { uri: "/new/path", ret_code: 301 },
      },
    ],
    relatedPlugins: ["proxy-rewrite", "response-rewrite"],
  },

  // ─── Observability ────────────────────────────────────────────

  prometheus: {
    overview:
      "Prometheus exports API metrics in Prometheus exposition format. The gateway collects request counts, latency histograms, upstream health, and bandwidth metrics. These can be scraped by a Prometheus server and visualized in Grafana dashboards. This is the most popular observability setup for cloud-native API gateways.",
    useCases: [
      "Monitor API request rates, error rates, and latency distributions",
      "Create Grafana dashboards for real-time API performance visibility",
      "Set up alerts for SLA violations (e.g., p99 latency > 500ms, error rate > 1%)",
      "Track upstream health and availability metrics",
    ],
    bestPractices: [
      "Enable per-route metrics to identify slow or error-prone endpoints",
      "Set up alerts on key SLI metrics: error rate, latency percentiles, and throughput",
      "Use label cardinality controls to prevent metric explosion from high-cardinality labels",
      "Configure appropriate scrape intervals (15-30 seconds) to balance resolution vs. load",
    ],
    cautions: [
      "High-cardinality labels (request IDs, user IDs) can cause memory issues in Prometheus",
      "Per-route metrics increase the number of time series — monitor Prometheus resource usage",
      "Prefer_name must be set to true if you want human-readable metric names",
    ],
    examples: [
      {
        title: "Enable Prometheus Metrics",
        description: "Export metrics with per-route details",
        config: { prefer_name: true },
      },
    ],
    relatedPlugins: ["opentelemetry", "zipkin", "request-id"],
  },

  "http-logger": {
    overview:
      "HTTP Logger sends access log data to an external HTTP endpoint as JSON payloads. Each log entry includes request/response details like URI, status code, latency, client IP, and headers. Logs are batched and sent asynchronously to minimize impact on request processing.",
    useCases: [
      "Send API access logs to a centralized logging platform (ELK, Loki, Datadog)",
      "Feed request data into analytics systems for API usage reporting",
      "Audit API access for compliance and security monitoring",
      "Stream request data to a custom webhook for real-time processing",
    ],
    bestPractices: [
      "Use batch processing (batch_max_size, buffer_duration) to reduce HTTP overhead",
      "Configure retry policies and timeouts to handle logging endpoint outages gracefully",
      "Exclude sensitive data (Authorization headers, request bodies) from logs",
      "Use async logging to minimize impact on request latency",
    ],
    cautions: [
      "Logging endpoint failures can cause log data loss — configure appropriate retry and buffer settings",
      "High traffic volumes generate significant log data — ensure your logging infrastructure can handle the throughput",
      "Including request/response bodies in logs can expose sensitive data and increase log volume dramatically",
    ],
    examples: [
      {
        title: "Log to HTTP Endpoint",
        description: "Send batched logs to a centralized logging service",
        config: {
          uri: "http://logging-service:8080/logs",
          batch_max_size: 100,
          buffer_duration: 10,
          max_retry_count: 3,
        },
      },
    ],
    relatedPlugins: ["kafka-logger", "syslog", "request-id"],
  },

  "kafka-logger": {
    overview:
      "Kafka Logger sends access log data to Apache Kafka topics. This enables high-throughput, durable log streaming that can be consumed by multiple downstream systems (analytics, monitoring, alerting). Kafka's partitioning ensures logs are distributed across brokers for scalability.",
    useCases: [
      "Stream API access logs to Kafka for real-time analytics processing",
      "Feed API data into event-driven architectures",
      "Decouple log collection from log processing — multiple consumers can read the same topic",
      "Build real-time dashboards and alerting from API traffic data",
    ],
    bestPractices: [
      "Use a dedicated Kafka topic for gateway logs to avoid mixing with application data",
      "Configure multiple brokers for high availability",
      "Set appropriate batch sizes to balance latency vs. throughput",
      "Use a schema (JSON with consistent fields) to make downstream processing reliable",
    ],
    cautions: [
      "Kafka cluster availability affects log delivery — configure broker failover",
      "High-volume APIs can produce substantial data — plan Kafka storage and retention accordingly",
      "Network issues between the gateway and Kafka can cause log buffering and increased memory usage",
    ],
    examples: [
      {
        title: "Log to Kafka",
        description: "Send access logs to a Kafka topic",
        config: {
          broker_list: { "kafka1:9092": 1, "kafka2:9092": 1 },
          kafka_topic: "api-gateway-logs",
          batch_max_size: 200,
          buffer_duration: 5,
        },
      },
    ],
    relatedPlugins: ["http-logger", "syslog", "opentelemetry"],
  },

  syslog: {
    overview:
      "Syslog sends access log data to a syslog server using TCP or UDP. This integrates the gateway with traditional infrastructure monitoring and SIEM (Security Information and Event Management) systems that consume syslog-formatted messages.",
    useCases: [
      "Integrate with enterprise SIEM systems (Splunk, QRadar, ArcSight)",
      "Send logs to existing syslog infrastructure (rsyslog, syslog-ng)",
      "Compliance logging where syslog format is required",
      "Forward logs to network monitoring tools",
    ],
    bestPractices: [
      "Use TCP for reliable log delivery — UDP can lose messages under high load",
      "Configure flush_limit to batch logs and reduce network overhead",
      "Set appropriate facility and severity levels for log categorization",
    ],
    cautions: [
      "UDP syslog can lose messages without notification — use TCP for critical logs",
      "Large log volumes over syslog can overwhelm the receiver — configure buffering",
      "Syslog format limitations may truncate long log entries",
    ],
    examples: [
      {
        title: "TCP Syslog",
        description: "Send logs to a syslog server over TCP",
        config: { host: "syslog.internal", port: 514, flush_limit: 4096, sock_type: "tcp" },
      },
    ],
    relatedPlugins: ["http-logger", "kafka-logger"],
  },

  zipkin: {
    overview:
      "Zipkin enables distributed tracing by generating and propagating trace spans across the API gateway. Each request gets a unique trace ID that follows it through all upstream services, enabling end-to-end latency analysis and dependency mapping. Traces are reported to a Zipkin-compatible collector.",
    useCases: [
      "Trace requests across microservices to identify latency bottlenecks",
      "Build service dependency maps from trace data",
      "Debug slow API responses by analyzing individual trace spans",
      "Monitor service-to-service communication patterns",
    ],
    bestPractices: [
      "Use sampling (e.g., 10% of requests) to reduce tracing overhead and storage costs",
      "Ensure all upstream services propagate trace context headers (B3 or W3C)",
      "Configure the sample_ratio based on traffic volume — higher traffic needs lower ratios",
      "Combine with request-id for complete request traceability",
    ],
    cautions: [
      "100% sampling on high-traffic APIs generates enormous amounts of trace data",
      "Tracing adds headers and processing overhead to every sampled request",
      "Zipkin collector must be highly available — collector downtime causes trace data loss",
    ],
    examples: [
      {
        title: "Zipkin Tracing",
        description: "Report traces to a Zipkin collector with 10% sampling",
        config: {
          endpoint: "http://zipkin:9411/api/v2/spans",
          sample_ratio: 0.1,
          service_name: "api-gateway",
        },
      },
    ],
    relatedPlugins: ["opentelemetry", "request-id", "prometheus"],
  },

  opentelemetry: {
    overview:
      "OpenTelemetry exports traces and metrics using the OTLP (OpenTelemetry Protocol) standard. This is the vendor-neutral, future-proof approach to observability, supporting backends like Jaeger, Tempo, Datadog, New Relic, and Honeycomb. OTel is rapidly becoming the industry standard for distributed tracing and metrics.",
    useCases: [
      "Send traces to any OTLP-compatible backend (Jaeger, Tempo, Datadog, etc.)",
      "Unified observability across heterogeneous services using the OpenTelemetry standard",
      "Correlate traces with metrics and logs using W3C Trace Context propagation",
      "Migrate from proprietary tracing to the open standard",
    ],
    bestPractices: [
      "Use OTLP/gRPC for efficient trace export — faster and more compact than HTTP/JSON",
      "Configure sampling strategies to control trace volume and cost",
      "Add resource attributes (service.name, deployment.environment) for better trace filtering",
      "Propagate W3C traceparent headers for cross-service trace correlation",
    ],
    cautions: [
      "OTLP collector must be reachable from the gateway — network issues cause trace data loss",
      "High sampling rates on high-traffic services can overwhelm the collector",
      "OpenTelemetry SDK adds some memory overhead for span buffering",
    ],
    examples: [
      {
        title: "OTLP gRPC Export",
        description: "Export traces to an OpenTelemetry Collector via gRPC",
        config: {
          trace_id_source: "x-request-id",
          resource: { "service.name": "api-gateway" },
          collector: { address: "otel-collector:4317", request_timeout: 3 },
          batch_span_processor: { max_export_batch_size: 200, scheduled_delay_in_millis: 5000 },
        },
      },
    ],
    relatedPlugins: ["zipkin", "prometheus", "request-id"],
  },
}
