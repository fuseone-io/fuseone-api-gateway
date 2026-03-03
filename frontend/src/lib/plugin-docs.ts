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

  // ─── FuseOne Custom Plugins ─────────────────────────────────

  "http-callout": {
    overview:
      "HTTP Callout makes HTTP(S) calls to external services during API request processing. This enables request enrichment (adding user metadata from a profile service), external authorization (calling a custom auth endpoint), data validation (verifying input against a business rules engine), and webhook notifications (fire-and-forget calls to notification services). The callout response can be cached and fields can be extracted via JSONPath and injected into the upstream request headers. Built-in SSRF protection blocks callouts to private IP ranges.",
    useCases: [
      "Call an external authorization service to validate tokens or check permissions before allowing the request",
      "Enrich requests by fetching user profile data, account tier, or company metadata from an internal service",
      "Send webhook notifications to Slack, Teams, or custom endpoints on specific API calls",
      "Validate request data against an external business rules engine before proxying to the upstream",
    ],
    bestPractices: [
      "Set separate connect/read/send timeouts to match the external service profile — use short connect_timeout (1s) and longer read_timeout (5s) for slow services",
      "Use caching (cache_ttl) for enrichment callouts that return slowly-changing data like user profiles",
      "Use fire-and-forget mode for webhook notifications to avoid blocking the main request flow",
      "Use exit_on_status for 'best effort' callouts where connection failures are acceptable but specific HTTP rejections (401, 403) must block the request",
      "Use exit_on_error for critical callouts (like authorization) where any failure should block the request",
    ],
    cautions: [
      "Callouts add latency to every request — use caching or fire-and-forget to minimize impact",
      "SSRF protection is enforced by default — callouts to private IPs (10.x, 172.16.x, 192.168.x) are blocked",
      "exit_on_error and exit_on_status serve different purposes: exit_on_error stops on ALL errors (connection + HTTP), exit_on_status stops ONLY on specific HTTP status codes and silently ignores connection/timeout errors",
      "External service downtime will cause request failures if exit_on_error is enabled — configure appropriate error_status and error_message",
    ],
    examples: [
      {
        title: "External Authorization (strict)",
        description: "Validate tokens via an external auth service — reject on any failure including service downtime",
        config: {
          uri: "http://auth-service:8080/validate",
          method: "POST",
          body: "{\"token\": \"$http_authorization\"}",
          connect_timeout: 1000,
          read_timeout: 3000,
          exit_on_error: true,
          error_status: 401,
          error_message: "Authentication failed",
          extract: [
            { source: "$.user_id", target_header: "X-User-Id" },
            { source: "$.roles", target_header: "X-User-Roles" },
          ],
        },
      },
      {
        title: "Best-Effort Validation (exit_on_status)",
        description: "Call a validation service — only block on explicit rejection (422, 403). If the service is down or times out, continue the flow.",
        config: {
          uri: "http://validation-service:8080/check",
          method: "POST",
          body: "{\"payload\": \"$request_body\"}",
          connect_timeout: 2000,
          read_timeout: 5000,
          exit_on_status: [422, 403],
          error_status: 422,
          error_message: "Validation rejected",
        },
      },
      {
        title: "Request Enrichment with Cache",
        description: "Fetch user tier from a profile service, cache the result for 5 minutes",
        config: {
          uri: "http://user-service:8080/profile/$http_x_user_id",
          method: "GET",
          cache_ttl: 300,
          extract: [{ source: "$.tier", target_header: "X-User-Tier" }],
        },
      },
      {
        title: "Slack Webhook (Fire-and-Forget)",
        description: "Notify a Slack channel without waiting for the response",
        config: {
          uri: "https://hooks.slack.com/services/xxx/yyy/zzz",
          method: "POST",
          body: "{\"text\": \"API call: $request_uri\"}",
          fire_and_forget: true,
        },
      },
    ],
    relatedPlugins: ["forward-auth", "proxy-rewrite", "serverless-pre-function", "api-composition"],
  },

  "api-composition": {
    overview:
      "API Composition orchestrates multiple backend HTTP calls and aggregates their responses into a single unified response. It supports sequential execution (where each step can use results from previous steps) and parallel execution (for independent calls). Each step can extract data via JSONPath and make it available to subsequent steps or the response template. Built-in SSRF protection, configurable timeouts, and per-step error handling (skip, abort, or fallback) make it production-ready for service composition patterns.",
    useCases: [
      "Aggregate data from multiple microservices into a single BFF (Backend-for-Frontend) response",
      "Call a user service and an orders service in parallel, then merge results",
      "Implement an orchestration pattern where step 2 depends on the result of step 1",
      "Build a composite API endpoint that enriches data from multiple sources",
      "Create a gateway-level aggregation layer without writing custom backend code",
    ],
    bestPractices: [
      "Use parallel execution when steps are independent for better performance",
      "Set appropriate timeouts for each step based on the target service SLA",
      "Use 'skip' error handling for non-critical enrichment steps",
      "Use 'abort' error handling for steps that are essential to the response",
      "Keep step IDs descriptive (e.g., 'get_user', 'fetch_orders') for readable response templates",
    ],
    cautions: [
      "Each step adds latency — keep the number of steps reasonable (2-5)",
      "Parallel execution uses nginx threads which have pool limits",
      "Response template uses simple variable substitution, not full Lua templating",
      "SSRF protection blocks calls to private IPs by default",
    ],
    examples: [
      {
        title: "Parallel: User + Orders aggregation",
        description: "Fetch user profile and orders simultaneously, merge into one response",
        config: {
          steps: [
            { id: "user", uri: "http://user-svc:8080/api/users/$http_x_user_id", method: "GET", timeout: 3000, extract: [], on_error: "abort" },
            { id: "orders", uri: "http://order-svc:8080/api/orders?user_id=$http_x_user_id", method: "GET", timeout: 5000, extract: [], on_error: "skip" },
          ],
          execution: "parallel",
          response_template: '{"user": $ctx.user, "orders": $ctx.orders}',
          response_status: 200,
        },
      },
      {
        title: "Sequential: Enrich with external data",
        description: "Get product, then fetch reviews using the product category",
        config: {
          steps: [
            { id: "product", uri: "http://catalog-svc/api/products/$uri_arg_id", method: "GET", timeout: 3000, extract: [{ source: "$.category", target: "category" }], on_error: "abort" },
            { id: "reviews", uri: "http://review-svc/api/reviews?category=$ctx.category", method: "GET", timeout: 3000, extract: [], on_error: "fallback", fallback_value: "[]" },
          ],
          execution: "sequential",
          response_template: '{"product": $ctx.product, "reviews": $ctx.reviews}',
          response_status: 200,
        },
      },
    ],
    relatedPlugins: ["http-callout", "serverless-pre-function", "proxy-rewrite"],
  },

  "data-masking": {
    overview:
      "Data Masking redacts sensitive data (PII) from API response bodies before they reach the client. It supports multiple masking strategies including full replacement, partial masking, SHA-256 hashing, and specialized email/phone formats. Fields are targeted using JSONPath expressions, supporting nested objects and arrays. This plugin is critical for LGPD and GDPR compliance when APIs expose personal data that should be partially or fully hidden from certain consumers.",
    useCases: [
      "Mask CPF, credit card numbers, and other PII in responses to comply with LGPD/GDPR",
      "Partially reveal email addresses (j***@example.com) while protecting full addresses",
      "Hash sensitive fields with SHA-256 for data correlation without exposing actual values",
      "Mask phone numbers in API responses while keeping country code and last digits visible",
    ],
    bestPractices: [
      "Use 'partial' strategy for fields where partial visibility aids user experience (e.g., last 4 digits of a card)",
      "Use 'hash' strategy when downstream systems need to correlate records without seeing actual values",
      "Place data-masking before any logging plugins in the execution order to avoid logging unmasked PII",
      "Test masking rules with debug mode to verify the correct fields are being targeted",
    ],
    cautions: [
      "This plugin only processes JSON responses — non-JSON responses pass through unmodified",
      "Body buffering is required, which adds memory overhead for large response bodies",
      "Masking rules with array wildcards ($.data[*].field) iterate over all array elements, which may impact performance on very large arrays",
    ],
    examples: [
      {
        title: "LGPD Compliance",
        description: "Mask CPF, email, and password fields in customer data responses",
        config: {
          rules: [
            { path: "$.cpf", strategy: "partial", visible_chars: 3 },
            { path: "$.data[*].email", strategy: "email" },
            { path: "$.password", strategy: "full", replacement: "[REDACTED]" },
          ],
        },
      },
      {
        title: "Credit Card Masking",
        description: "Show only last 4 digits of credit card numbers",
        config: {
          rules: [
            { path: "$.credit_card", strategy: "partial", visible_chars: 4 },
            { path: "$.data[*].card_number", strategy: "partial", visible_chars: 4 },
          ],
        },
      },
      {
        title: "Hash for Correlation",
        description: "Replace sensitive IDs with SHA-256 hashes for analytics without PII exposure",
        config: {
          rules: [
            { path: "$.user_id", strategy: "hash" },
            { path: "$.data[*].document_id", strategy: "hash" },
          ],
        },
      },
    ],
    relatedPlugins: ["response-rewrite", "body-transformer", "threat-protection"],
  },

  "threat-protection": {
    overview:
      "Threat Protection defends APIs against payload-based attacks by enforcing structural limits on JSON requests and detecting injection patterns. It validates JSON depth, array sizes, object entries, and string lengths to prevent resource exhaustion attacks. It also scans request query parameters, headers, and body for SQL injection and XSS patterns. Detected threats can be rejected with a 403 response or logged for monitoring without blocking the request.",
    useCases: [
      "Protect APIs from SQL injection attacks in query parameters and request bodies",
      "Block cross-site scripting (XSS) payloads in API inputs",
      "Prevent resource exhaustion from deeply nested JSON or oversized arrays",
      "Enforce maximum request body sizes beyond what basic size limits offer",
    ],
    bestPractices: [
      "Start with 'log' action mode to identify false positives before switching to 'reject'",
      "Enable scan_query and scan_body by default, but only enable scan_headers if your API processes user-controlled headers",
      "Set JSON structural limits based on your actual API schema — overly restrictive limits may break legitimate requests",
      "Combine with request-validation for schema-level enforcement and threat-protection for injection defense",
    ],
    cautions: [
      "SQL injection patterns may cause false positives on legitimate text containing SQL-like keywords — test with real traffic first",
      "XSS detection scans for common patterns but is not a WAF replacement — use dedicated WAF for comprehensive web protection",
      "Body scanning only works for text-based content types — binary payloads are not scanned",
    ],
    examples: [
      {
        title: "Standard API Protection",
        description: "Default protection with SQL injection and XSS detection enabled",
        config: {
          json: {
            max_depth: 20,
            max_array_length: 1000,
            max_body_size: 1048576,
          },
          injection: {
            sql_injection: true,
            xss: true,
            scan_query: true,
            scan_body: true,
          },
          action: "reject",
        },
      },
      {
        title: "Strict Protection for Public APIs",
        description: "Tight limits for publicly exposed APIs that handle untrusted input",
        config: {
          json: {
            max_depth: 5,
            max_array_length: 100,
            max_object_entries: 50,
            max_string_length: 10000,
            max_body_size: 524288,
          },
          injection: {
            sql_injection: true,
            xss: true,
            scan_headers: true,
            scan_query: true,
            scan_body: true,
          },
          action: "reject",
        },
      },
      {
        title: "Monitor Mode (Log Only)",
        description: "Detect threats without blocking requests — useful for initial rollout",
        config: {
          injection: {
            sql_injection: true,
            xss: true,
            scan_query: true,
            scan_body: true,
          },
          action: "log",
        },
      },
    ],
    relatedPlugins: ["request-validation", "ip-restriction", "uri-blocker", "data-masking"],
  },

  // ─── AI Gateway ─────────────────────────────────────────────

  "ai-proxy": {
    overview:
      "AI Proxy routes requests to Large Language Model providers using the OpenAI-compatible chat completions format. It translates a unified request format into provider-specific API calls, so your consumers use one standard interface regardless of the backend LLM. Supports streaming (SSE), token counting, and automatic response normalization.",
    useCases: [
      "Expose a single API endpoint that routes to OpenAI, Anthropic, Gemini, or DeepSeek behind the scenes",
      "Centralize LLM API key management — consumers never see the provider key",
      "Switch LLM providers without changing client code",
      "Enable token-based rate limiting and cost tracking by placing the proxy in front of all LLM calls",
      "Run local models via Ollama or vLLM through the same gateway interface",
    ],
    bestPractices: [
      "Store API keys in the Secrets manager and reference them via $secret:// variables instead of hardcoding",
      "Enable 'logging.summaries' to track token usage per route without logging sensitive prompt content",
      "Set a reasonable timeout (30-120s) — LLM responses can be slow for large prompts",
      "Use SSL verification in production to prevent MITM attacks on LLM API calls",
      "Pair with ai-rate-limiting to prevent token budget overruns",
    ],
    cautions: [
      "API keys are stored in APISIX configuration — use the Secrets manager for production deployments",
      "Streaming responses (SSE) may not work with all observability plugins that buffer the full response",
      "Some providers (Vertex AI, Bedrock) require additional authentication configuration beyond simple API keys",
      "Token counts in response headers are estimates and may differ slightly from provider billing",
    ],
    examples: [
      {
        title: "OpenAI GPT-4o",
        description: "Route to OpenAI with API key authentication",
        config: {
          provider: "openai",
          options: { model: "gpt-4o" },
          auth: { header: { Authorization: "Bearer sk-..." } },
          logging: { summaries: true },
        },
      },
      {
        title: "Anthropic Claude",
        description: "Route to Anthropic Claude with the x-api-key header",
        config: {
          provider: "anthropic",
          options: { model: "claude-sonnet-4-20250514" },
          auth: { header: { "x-api-key": "sk-ant-..." } },
        },
      },
      {
        title: "Local Ollama",
        description: "Route to a self-hosted Ollama instance for private LLM inference",
        config: {
          provider: "openai-compatible",
          options: { model: "llama3" },
          override: { endpoint: "http://ollama:11434/v1" },
          ssl_verify: false,
        },
      },
    ],
    relatedPlugins: ["ai-proxy-multi", "ai-rate-limiting", "ai-prompt-guard"],
  },

  "ai-proxy-multi": {
    overview:
      "AI Multi-LLM load balances requests across multiple LLM instances with automatic failover. It supports weighted round-robin and consistent hashing algorithms, allowing you to distribute traffic across providers or models based on cost, speed, or reliability. When an instance fails or returns rate-limit errors, traffic is automatically shifted to healthy instances.",
    useCases: [
      "Distribute AI traffic across multiple OpenAI instances to avoid per-account rate limits",
      "Set up a primary provider (e.g., GPT-4o) with a fallback (e.g., Claude) for high availability",
      "A/B test different models by routing a percentage of traffic to each",
      "Route to cheaper models for low-priority requests and premium models for high-priority ones",
      "Gradually migrate from one LLM provider to another with weighted traffic shifting",
    ],
    bestPractices: [
      "Start with 'instance_health_and_rate_limiting' fallback strategy — it handles both crashes and HTTP 429 errors",
      "Assign higher weights to your primary provider and lower weights to fallback instances",
      "Monitor per-instance token usage in the AI Dashboard to optimize weight distribution",
      "Use consistent hashing (chash) when you need the same user to always hit the same model for cache efficiency",
      "Test failover behavior by temporarily removing one instance's API key",
    ],
    cautions: [
      "Different LLM providers may return slightly different response formats — test all instances with your client",
      "Fallback adds latency — the first request must fail before the next instance is tried",
      "Consistent hashing requires a hash key (e.g., consumer name) — without it, it behaves like round-robin",
      "Weight changes take effect immediately and may cause traffic spikes on newly weighted instances",
    ],
    examples: [
      {
        title: "Primary + Fallback",
        description: "GPT-4o as primary with Claude as fallback on errors",
        config: {
          balancer: { algorithm: "roundrobin" },
          fallback: { strategy: "instance_health_and_rate_limiting" },
          instances: [
            { name: "primary-openai", provider: "openai", weight: 80, auth: { header: { Authorization: "Bearer sk-..." } }, options: { model: "gpt-4o" } },
            { name: "fallback-claude", provider: "anthropic", weight: 20, auth: { header: { "x-api-key": "sk-ant-..." } }, options: { model: "claude-sonnet-4-20250514" } },
          ],
        },
      },
      {
        title: "Multi-Instance Load Balancing",
        description: "Spread traffic across three OpenAI accounts to avoid rate limits",
        config: {
          balancer: { algorithm: "roundrobin" },
          instances: [
            { name: "openai-1", provider: "openai", weight: 34, auth: { header: { Authorization: "Bearer sk-1..." } }, options: { model: "gpt-4o" } },
            { name: "openai-2", provider: "openai", weight: 33, auth: { header: { Authorization: "Bearer sk-2..." } }, options: { model: "gpt-4o" } },
            { name: "openai-3", provider: "openai", weight: 33, auth: { header: { Authorization: "Bearer sk-3..." } }, options: { model: "gpt-4o" } },
          ],
        },
      },
    ],
    relatedPlugins: ["ai-proxy", "ai-rate-limiting", "traffic-split"],
  },

  "ai-prompt-guard": {
    overview:
      "Prompt Guard filters LLM prompts using regex allow/deny patterns to prevent prompt injection, data exfiltration, and misuse. It inspects the 'messages' array in chat completion requests and can block or allow based on pattern matching. Patterns are applied to user messages, system prompts, or the full conversation history.",
    useCases: [
      "Block prompt injection attempts that try to override system instructions",
      "Prevent users from requesting harmful, illegal, or off-topic content",
      "Enforce that prompts include required context (e.g., a specific system prefix)",
      "Filter out PII patterns (SSN, credit card numbers) from being sent to external LLMs",
      "Create topic guardrails that restrict the LLM to specific domains",
    ],
    bestPractices: [
      "Start with deny patterns for known attack vectors: 'ignore previous', 'system prompt', 'jailbreak'",
      "Use allow patterns sparingly — they require ALL messages to match, which can be overly restrictive",
      "Enable 'match_all_conversation_history' to scan the entire conversation, not just the latest message",
      "Test patterns against real conversation examples before deploying to production",
      "Combine with ai-aws-content-moderation for ML-based detection that catches patterns regex can't",
    ],
    cautions: [
      "Regex patterns alone cannot catch all prompt injection techniques — use as one layer of defense",
      "Overly broad deny patterns may block legitimate requests (e.g., blocking 'ignore' may affect normal conversation)",
      "Allow patterns with 'match_all_roles' will also check system messages, which may not match your patterns",
      "Pattern matching adds latency proportional to the number of patterns and message length",
    ],
    examples: [
      {
        title: "Block Prompt Injection",
        description: "Deny common prompt injection phrases",
        config: {
          deny_patterns: [
            "ignore (all |any )?previous",
            "disregard (your |all )?instructions",
            "you are now",
            "act as (a |an )?",
            "system prompt",
            "jailbreak",
          ],
          match_all_conversation_history: true,
        },
      },
      {
        title: "PII Filter",
        description: "Block requests containing SSN or credit card patterns",
        config: {
          deny_patterns: [
            "\\d{3}-\\d{2}-\\d{4}",
            "\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}",
          ],
          match_all_roles: false,
        },
      },
    ],
    relatedPlugins: ["ai-proxy", "ai-aws-content-moderation", "ai-request-rewrite"],
  },

  "ai-request-rewrite": {
    overview:
      "AI Request Rewrite transforms incoming requests using LLM-powered prompts before they reach the upstream. It sends the original request through a configured LLM with a system prompt that instructs the model to rewrite, summarize, translate, or restructure the input. The LLM's response replaces the original request body.",
    useCases: [
      "Automatically translate user prompts to English before sending to an English-only LLM",
      "Summarize long input documents to fit within model context limits",
      "Normalize different input formats into a standard schema expected by the upstream",
      "Add safety wrappers or context to user prompts before they reach the main LLM",
      "Implement prompt templating where user input is embedded into a structured prompt",
    ],
    bestPractices: [
      "Use a fast, cheap model (e.g., gpt-4o-mini) for rewrites to minimize latency and cost overhead",
      "Keep the rewrite system prompt concise — it runs on every request and adds to token costs",
      "Set a short timeout (5-10s) for the rewrite LLM to avoid blocking the main request too long",
      "Test the rewrite output thoroughly — LLM rewrites are non-deterministic and may occasionally alter meaning",
    ],
    cautions: [
      "Every request pays double LLM cost — once for the rewrite, once for the main model",
      "Rewrite adds significant latency (1-5s typical) since it makes an extra LLM call",
      "The rewrite model may occasionally produce unexpected output that breaks downstream processing",
      "Sensitive data in the request will be sent to the rewrite LLM provider — ensure compliance",
    ],
    examples: [
      {
        title: "Prompt Translation",
        description: "Translate all user messages to English before the main LLM",
        config: {
          prompt: "Translate the following user message to English. Return ONLY the translated text, nothing else.",
          provider: "openai",
          options: { model: "gpt-4o-mini" },
          auth: { header: { Authorization: "Bearer sk-..." } },
          timeout: 5000,
        },
      },
    ],
    relatedPlugins: ["ai-proxy", "ai-prompt-guard"],
  },

  "ai-rate-limiting": {
    overview:
      "AI Rate Limiting enforces token-based rate limits on LLM requests, preventing budget overruns and ensuring fair usage across consumers. Unlike traditional request-count rate limiting, it counts prompt tokens, completion tokens, or total tokens to accurately reflect LLM resource consumption. Limits are applied per consumer or per route.",
    useCases: [
      "Set a daily token budget per consumer to prevent cost overruns",
      "Enforce fair usage across teams sharing a single LLM gateway",
      "Differentiate rate plans — free tier gets 10K tokens/hour, premium gets 1M",
      "Protect against runaway scripts that make excessive LLM calls",
      "Implement token quotas that align with your LLM provider billing limits",
    ],
    bestPractices: [
      "Use 'total_tokens' strategy for simple budget enforcement",
      "Use 'prompt_tokens' strategy when you want to limit input size regardless of output",
      "Set time windows that match your billing cycle (e.g., 24h for daily budgets)",
      "Enable rate limit headers so clients can track their remaining quota",
      "Pair with ai-proxy logging to correlate token usage with specific requests",
    ],
    cautions: [
      "Token counting relies on response headers from the LLM provider — if the upstream doesn't report tokens, limiting won't work",
      "Rate limits are approximate — streaming responses may report final token counts after the response is already sent",
      "Very short time windows (< 1 minute) may not be accurate due to counter synchronization across APISIX workers",
      "The rejected response code and message should be informative so clients can implement retry-after logic",
    ],
    examples: [
      {
        title: "Daily Token Budget",
        description: "Limit each consumer to 100K total tokens per day",
        config: {
          limit: 100000,
          time_window: 86400,
          limit_strategy: "total_tokens",
          rejected_code: 429,
          rejected_msg: "Token quota exceeded. Resets daily.",
        },
      },
      {
        title: "Hourly Prompt Limit",
        description: "Limit prompt tokens to 50K per hour to control input costs",
        config: {
          limit: 50000,
          time_window: 3600,
          limit_strategy: "prompt_tokens",
          show_limit_quota_header: true,
        },
      },
    ],
    relatedPlugins: ["ai-proxy", "ai-proxy-multi", "limit-count"],
  },

  "ai-rag": {
    overview:
      "AI RAG (Retrieval-Augmented Generation) enriches LLM prompts with relevant context from a vector database before sending them to the model. It generates embeddings from the user's query, searches a vector index for similar documents, and injects the retrieved context into the system prompt. This dramatically improves LLM response accuracy for domain-specific questions.",
    useCases: [
      "Build a knowledge base chatbot that answers questions from your documentation",
      "Enhance customer support AI with product-specific information from your database",
      "Create an internal assistant that can reference company policies and procedures",
      "Improve code generation by providing relevant code examples from your codebase",
    ],
    bestPractices: [
      "Use a dedicated embeddings model (e.g., text-embedding-3-small) — it's cheaper and faster than using a chat model for embeddings",
      "Index your documents in chunks of 512-1024 tokens for optimal retrieval granularity",
      "Set a reasonable top_k (3-5 results) to provide enough context without overwhelming the model's context window",
      "Test retrieval quality separately from generation quality to identify which component needs improvement",
    ],
    cautions: [
      "Currently supports Azure OpenAI for embeddings and Azure AI Search for vector search — other providers planned",
      "RAG adds latency for embedding generation and vector search (typically 200-500ms)",
      "Retrieved context consumes tokens from the model's context window — very long documents may hit limits",
      "Embedding quality depends on the model used — ensure your embedding model matches your use case language",
    ],
    examples: [
      {
        title: "Azure RAG Pipeline",
        description: "Connect to Azure OpenAI embeddings and Azure AI Search",
        config: {
          embeddings: {
            source: "azure_openai",
            azure_openai: {
              endpoint: "https://my-oai.openai.azure.com",
              api_key: "...",
            },
          },
          vector_search: {
            source: "azure_ai_search",
            azure_ai_search: {
              endpoint: "https://my-search.search.windows.net",
              api_key: "...",
            },
          },
        },
      },
    ],
    relatedPlugins: ["ai-proxy", "ai-prompt-guard"],
  },

  "ai-aws-content-moderation": {
    overview:
      "Content Moderation uses AWS Comprehend to analyze LLM prompts and responses for harmful content. It detects profanity, hate speech, insults, harassment, sexual content, and violence using ML-based classification. You can set per-category confidence thresholds and block requests that exceed them.",
    useCases: [
      "Filter user prompts for harmful content before they reach the LLM",
      "Ensure LLM responses don't contain inappropriate content before returning to users",
      "Meet compliance requirements for content safety in regulated industries",
      "Protect your brand by preventing the AI from generating offensive outputs",
    ],
    bestPractices: [
      "Start with a moderate default threshold (0.7) and adjust per category based on your requirements",
      "Set lower thresholds for HATE_SPEECH and VIOLENCE_OR_THREAT (0.5) to catch borderline content",
      "Set higher thresholds for PROFANITY (0.8) to avoid false positives on casual language",
      "Test with real examples from your domain to calibrate thresholds appropriately",
      "Use in combination with ai-prompt-guard for layered defense (regex + ML)",
    ],
    cautions: [
      "AWS Comprehend calls add latency (100-300ms) and cost to every request",
      "Moderation is not perfect — some harmful content may pass, and some benign content may be flagged",
      "Requires valid AWS credentials with access to the Comprehend API",
      "Content moderation works best in English — accuracy may vary for other languages",
    ],
    examples: [
      {
        title: "Standard Content Filter",
        description: "Moderate with balanced thresholds across all categories",
        config: {
          access_key: "AKIA...",
          secret_key: "...",
          region: "us-east-1",
          default_threshold: 0.7,
        },
      },
      {
        title: "Strict Moderation",
        description: "Low thresholds for a child-safe application",
        config: {
          access_key: "AKIA...",
          secret_key: "...",
          region: "us-east-1",
          default_threshold: 0.5,
          categories: {
            PROFANITY: 0.4,
            HATE_SPEECH: 0.3,
            SEXUAL: 0.3,
            VIOLENCE_OR_THREAT: 0.3,
          },
        },
      },
    ],
    relatedPlugins: ["ai-prompt-guard", "ai-proxy"],
  },

  // ─── GraphQL ────────────────────────────────────────────────

  "degraphql": {
    overview:
      "The DeGraphQL plugin converts RESTful API endpoints into GraphQL queries behind the scenes. You define a GraphQL query template on a route, and the plugin transforms incoming REST requests (with path/query parameters) into GraphQL queries that are sent to your upstream GraphQL server. The response is returned as a standard REST JSON response. This lets you expose a clean REST API to consumers while leveraging an existing GraphQL backend.",
    useCases: [
      "Expose a simplified REST facade over a complex GraphQL backend",
      "Let mobile or IoT clients consume a REST endpoint instead of constructing GraphQL queries",
      "Create resource-specific REST endpoints (GET /users/:id) backed by GraphQL resolvers",
      "Gradually migrate from GraphQL to REST (or vice versa) without client changes",
    ],
    bestPractices: [
      "Keep GraphQL query templates simple and focused on one resource or operation",
      "Use variables in the template to map REST path/query parameters to GraphQL arguments",
      "Add caching (proxy-cache) on top for read-heavy endpoints to reduce upstream load",
      "Combine with graphql-depth-limit on the upstream to protect against crafted queries",
    ],
    cautions: [
      "The plugin sends the full GraphQL query to the upstream — ensure the upstream enforces its own auth and rate limits",
      "Complex GraphQL responses with deeply nested data may not map cleanly to REST conventions",
      "Error handling differs between REST and GraphQL; the plugin returns GraphQL errors as-is in the response body",
    ],
    examples: [
      {
        title: "REST-to-GraphQL User Lookup",
        description: "Convert GET /users/:id into a GraphQL query",
        config: {
          query: "query($id: ID!) { user(id: $id) { id name email } }",
          variables: ["id"],
        },
      },
      {
        title: "Product List Endpoint",
        description: "Convert GET /products?category=X into a filtered GraphQL query",
        config: {
          query: "query($category: String) { products(filter: { category: $category }) { id name price } }",
          variables: ["category"],
        },
      },
    ],
    relatedPlugins: ["graphql-depth-limit", "graphql-complexity", "proxy-cache"],
  },

  "graphql-depth-limit": {
    overview:
      "The GraphQL Depth Limit plugin protects your GraphQL upstream from deeply nested queries that can cause excessive resource consumption and potential denial-of-service. It scans the incoming GraphQL query body, counts the maximum brace nesting depth, and rejects (or logs) queries that exceed the configured threshold. This is a lightweight, first-line defense that runs before the query reaches your resolver layer.",
    useCases: [
      "Prevent deeply nested query attacks on public-facing GraphQL APIs",
      "Enforce consistent query depth limits across all GraphQL routes",
      "Log deep queries in audit mode before switching to enforcement",
      "Protect backend resolvers from exponential data loading on nested relationships",
    ],
    bestPractices: [
      "Start with a generous limit (e.g., 10-15) and monitor logs to find the real maximum depth your legitimate queries use",
      "Use 'log' action initially to discover deep queries without breaking existing clients",
      "Combine with graphql-complexity for a more nuanced cost-based protection",
      "Set different limits for different routes if some APIs have naturally deeper schemas",
    ],
    cautions: [
      "The depth calculation uses brace counting, which is a heuristic — fragments or aliased fields may produce different depth than expected",
      "Very low limits (< 3) may block legitimate queries that use standard nested patterns like { user { posts { title } } }",
      "This plugin only analyzes the query string in the JSON body — GET-based GraphQL queries (query parameter) are not analyzed",
    ],
    examples: [
      {
        title: "Standard Depth Limit",
        description: "Reject queries deeper than 10 levels",
        config: { max_depth: 10, action: "reject" },
      },
      {
        title: "Audit Mode",
        description: "Log deep queries without blocking (for initial rollout)",
        config: { max_depth: 8, action: "log" },
      },
      {
        title: "Strict Public API",
        description: "Very strict limit for public-facing GraphQL endpoint",
        config: { max_depth: 5, action: "reject" },
      },
    ],
    relatedPlugins: ["graphql-complexity", "graphql-allowlist", "graphql-introspection-guard"],
  },

  "graphql-complexity": {
    overview:
      "The GraphQL Complexity plugin performs cost-based analysis on incoming GraphQL queries. Each field selection is assigned a cost (configurable per field or using a default), and list arguments like 'first' or 'limit' act as multipliers. If the total estimated cost exceeds the configured maximum, the request is rejected or logged. This provides more nuanced protection than depth limiting alone, catching queries that are wide rather than deep.",
    useCases: [
      "Prevent expensive queries that fetch large lists of nested objects (e.g., users { posts { comments } } with first: 1000)",
      "Assign higher costs to computationally expensive fields (e.g., full-text search, aggregations)",
      "Enforce fair usage across API consumers by limiting query complexity",
      "Protect against GraphQL query-based denial of service without a full AST parser",
    ],
    bestPractices: [
      "Map your most expensive resolvers to higher field_costs values (database joins, external API calls, aggregations)",
      "Start with a high max_complexity and monitor actual query costs in logs before tightening",
      "Use the 'log' action during rollout to understand your query cost distribution",
      "Combine with depth limiting for defense in depth — complexity catches wide queries, depth catches deep ones",
    ],
    cautions: [
      "The complexity calculation is heuristic-based (field name scanning) rather than full AST parsing — it may over- or under-count in edge cases",
      "Fragment spreads and inline fragments may not be perfectly accounted for in the cost calculation",
      "The list_size_argument detection looks for the first match in the query, not necessarily the one closest to each field",
    ],
    examples: [
      {
        title: "Basic Complexity Limit",
        description: "Default cost per field, reject above 1000 total",
        config: { max_complexity: 1000, default_field_cost: 1, action: "reject" },
      },
      {
        title: "Weighted Field Costs",
        description: "Assign higher costs to expensive fields",
        config: {
          max_complexity: 500,
          default_field_cost: 1,
          field_costs: { search: 10, analytics: 20, export: 50 },
          list_size_argument: "first",
          action: "reject",
        },
      },
      {
        title: "Audit Mode with Low Threshold",
        description: "Log all queries exceeding a low threshold to learn usage patterns",
        config: { max_complexity: 200, default_field_cost: 1, action: "log" },
      },
    ],
    relatedPlugins: ["graphql-depth-limit", "graphql-allowlist", "limit-count"],
  },

  "graphql-allowlist": {
    overview:
      "The GraphQL Allowlist plugin enforces persisted queries by only allowing pre-registered GraphQL operations. Each incoming query is normalized (whitespace collapsed), hashed (MD5), and checked against a configured list of allowed hashes. Unknown queries are either rejected (in enforce mode) or logged (in audit mode). This is the strongest defense against arbitrary query abuse, ensuring only known, reviewed queries can execute.",
    useCases: [
      "Lock down a production GraphQL API to only allow queries used by your own frontend",
      "Prevent arbitrary data exfiltration through crafted GraphQL queries",
      "Implement a 'query review' workflow where new queries must be explicitly approved before deployment",
      "Audit which queries are being used before switching to enforcement mode",
    ],
    bestPractices: [
      "Start with enforce=false to discover all queries in use, then build the allowlist from logs",
      "Automate hash generation in your CI/CD pipeline — extract queries from frontend code and generate hashes",
      "The rejection response includes the query hash, making it easy to add new queries to the allowlist",
      "Combine with graphql-introspection-guard to prevent schema discovery alongside query restriction",
    ],
    cautions: [
      "Adding this plugin with enforce=true immediately blocks all queries not in the list — roll out carefully",
      "Query normalization only collapses whitespace — semantically equivalent queries with different field order will have different hashes",
      "The MD5 hash is used for performance, not security — it is not cryptographically resistant to collision attacks",
    ],
    examples: [
      {
        title: "Audit Mode (Discover Queries)",
        description: "Log unknown queries without blocking — use to build your initial allowlist",
        config: {
          enforce: false,
          allowed_queries: [],
        },
      },
      {
        title: "Enforced Allowlist",
        description: "Only allow known queries, reject everything else",
        config: {
          enforce: true,
          allowed_queries: [
            { name: "GetCurrentUser", hash: "a1b2c3d4e5f6..." },
            { name: "ListProducts", hash: "f6e5d4c3b2a1..." },
            { name: "CreateOrder", hash: "1a2b3c4d5e6f..." },
          ],
        },
      },
    ],
    relatedPlugins: ["graphql-introspection-guard", "graphql-depth-limit", "graphql-complexity"],
  },

  "graphql-introspection-guard": {
    overview:
      "The GraphQL Introspection Guard blocks introspection queries (__schema, __type) from reaching your upstream GraphQL server. Introspection is essential during development but exposes your entire schema to potential attackers in production. This plugin detects introspection fields in the query body and rejects or logs the request. An optional bypass list allows specific named operations to still perform introspection (e.g., for internal monitoring tools).",
    useCases: [
      "Block schema discovery on public-facing GraphQL APIs",
      "Allow introspection only from internal tooling by using the operation name bypass list",
      "Gradually disable introspection by starting in log mode",
      "Comply with security policies that require schema opacity in production",
    ],
    bestPractices: [
      "Always enable this plugin on production routes — introspection is one of the first things attackers try",
      "Use the allowed_operation_names bypass for known internal tools that need schema access",
      "Deploy in 'log' mode first to identify any legitimate introspection usage before blocking",
      "Combine with graphql-allowlist for maximum protection — block both schema discovery and arbitrary queries",
    ],
    cautions: [
      "Blocking introspection will break GraphQL IDE tools (GraphiQL, Apollo Explorer) for developers — ensure dev environments don't have this enabled",
      "The detection is regex-based (__schema|__type) — it may match inside string literals in rare edge cases",
      "This does not prevent schema discovery through other means (error messages, field suggestion errors)",
    ],
    examples: [
      {
        title: "Block All Introspection",
        description: "Reject any query containing __schema or __type",
        config: { block_introspection: true, action: "reject" },
      },
      {
        title: "Allow Internal Tooling",
        description: "Block introspection except for specific named operations",
        config: {
          block_introspection: true,
          allowed_operation_names: ["InternalSchemaCheck", "MonitoringIntrospection"],
          action: "reject",
        },
      },
      {
        title: "Audit Mode",
        description: "Log introspection attempts without blocking",
        config: { block_introspection: true, action: "log" },
      },
    ],
    relatedPlugins: ["graphql-allowlist", "graphql-depth-limit", "graphql-complexity"],
  },
}
