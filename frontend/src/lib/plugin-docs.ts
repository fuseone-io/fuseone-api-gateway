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

  "authz-keycloak": {
    overview:
      "Keycloak Authorization integrates the gateway with Keycloak's authorization services to enforce fine-grained access control. It validates JWT tokens issued by Keycloak and checks realm roles, client roles, and resource permissions using Keycloak's Protection API. This plugin is ideal when you already use Keycloak as your identity provider and want centralized policy management.",
    useCases: [
      "Enforce realm-level and client-level role checks on API routes",
      "Leverage Keycloak's UMA (User-Managed Access) for resource-based authorization",
      "Centralize access policies in Keycloak and enforce them at the gateway layer",
      "Protect microservices with Keycloak-issued JWTs without adding authorization logic to each service",
    ],
    bestPractices: [
      "Use the discovery endpoint to auto-configure token and authorization endpoints from Keycloak's realm metadata",
      "Prefer lazy loading of grants ('lazy_load_paths: true') to avoid performance overhead on routes that don't require fine-grained authorization",
      "Set 'ssl_verify' to true in production to ensure the gateway validates Keycloak's TLS certificate",
      "Use client roles for service-specific access and realm roles for cross-service permissions",
    ],
    cautions: [
      "Keycloak must be reachable from the gateway — network issues will cause all protected requests to fail",
      "Enabling resource-level permission checks (UMA) adds latency due to the round-trip to Keycloak's authorization endpoint",
      "Token audience ('aud') must include the client_id configured in this plugin, otherwise authorization will be rejected",
      "Complex Keycloak policies (e.g., time-based, aggregate) can be difficult to debug at the gateway level",
    ],
    examples: [
      {
        title: "Basic Keycloak JWT Validation",
        description: "Validate Keycloak tokens and enforce client role requirements",
        config: {
          client_id: "my-api-client",
          client_secret: "client-secret-here",
          discovery: "https://keycloak.example.com/realms/my-realm/.well-known/uma2-configuration",
          bearer_only: true,
          realm: "my-realm",
          ssl_verify: true,
        },
      },
      {
        title: "Resource-based Authorization (UMA)",
        description: "Check fine-grained resource permissions via Keycloak's Protection API",
        config: {
          client_id: "my-api-client",
          client_secret: "client-secret-here",
          discovery: "https://keycloak.example.com/realms/my-realm/.well-known/uma2-configuration",
          bearer_only: true,
          policy_enforcement_mode: "ENFORCING",
          permissions: ["resource-name#scope-read", "resource-name#scope-write"],
          lazy_load_paths: true,
          ssl_verify: true,
        },
      },
    ],
    relatedPlugins: ["openid-connect", "jwt-auth", "consumer-restriction"],
  },

  "wolf-rbac": {
    overview:
      "Wolf RBAC integrates with wolf-server, a role-based access control platform, to manage user authentication and permission checks. The plugin redirects unauthenticated requests to wolf-server for login and validates session tokens on subsequent requests. It is suited for organizations already using wolf-server as their RBAC backend.",
    useCases: [
      "Add role-based access control to APIs using an existing wolf-server deployment",
      "Centralize user and permission management through wolf-server's admin console",
      "Protect internal APIs with wolf's user-role-permission model",
    ],
    bestPractices: [
      "Deploy wolf-server as a highly available service since every auth check depends on it",
      "Use the appid field to isolate permissions per application or API group",
      "Keep wolf-server close to the gateway (same network) to minimize authentication latency",
    ],
    cautions: [
      "Wolf-server is a niche RBAC platform — ensure your team can maintain and operate it",
      "Every request requires a round-trip to wolf-server, adding latency compared to local JWT validation",
      "Limited community adoption means fewer resources for troubleshooting compared to mainstream solutions",
    ],
    examples: [
      {
        title: "Wolf RBAC Integration",
        description: "Authenticate users and check permissions via wolf-server",
        config: {
          server: "http://wolf-server:12180",
          appid: "my-api-app",
          header_prefix: "X-",
        },
      },
    ],
    relatedPlugins: ["forward-auth", "authz-keycloak", "authz-casbin"],
  },

  "ldap-auth": {
    overview:
      "LDAP Authentication validates user credentials against an LDAP directory server or Microsoft Active Directory. The plugin extracts Basic Auth credentials from the request and performs an LDAP bind to verify the username and password. This is the standard approach for integrating APIs with corporate directory services.",
    useCases: [
      "Authenticate API users against a corporate Active Directory",
      "Protect internal APIs with existing LDAP/AD credentials — no separate API keys needed",
      "Integrate the gateway with enterprise identity infrastructure without deploying an IdP",
      "Enforce directory-based access control for on-premise API deployments",
    ],
    bestPractices: [
      "Always use LDAPS (port 636) or STARTTLS to encrypt credentials in transit",
      "Use a service account (bind DN) with read-only permissions for user lookups",
      "Set a reasonable search scope and base DN to minimize LDAP query time",
      "Enable 'hide_credentials' to prevent Basic Auth headers from being forwarded upstream",
    ],
    cautions: [
      "LDAP bind is performed on every request, adding latency — consider adding caching or combining with JWT for session management",
      "Misconfigured base DN or user DN template will cause all authentication to fail silently",
      "If the LDAP server is unreachable, all protected routes become inaccessible — ensure high availability",
      "LDAP credentials are sent as Basic Auth (Base64) — HTTPS is mandatory to protect them in transit",
    ],
    examples: [
      {
        title: "Active Directory Authentication",
        description: "Authenticate users against a corporate AD using LDAPS",
        config: {
          ldap_uri: "ldaps://ad.example.com:636",
          base_dn: "ou=Users,dc=example,dc=com",
          uid: "sAMAccountName",
          use_tls: true,
          hide_credentials: true,
        },
      },
      {
        title: "OpenLDAP Integration",
        description: "Authenticate against an OpenLDAP directory server",
        config: {
          ldap_uri: "ldap://ldap.internal:389",
          base_dn: "ou=people,dc=example,dc=org",
          uid: "uid",
          use_tls: false,
          hide_credentials: true,
        },
      },
    ],
    relatedPlugins: ["basic-auth", "openid-connect", "forward-auth"],
  },

  "authz-casbin": {
    overview:
      "Casbin Authorization enforces access control policies defined using Casbin's flexible model language. Casbin supports ACL, RBAC, ABAC, and more complex authorization models. Policies can be stored in files or external adapters (databases, etcd). This plugin is ideal for teams that need customizable, model-driven access control without writing code.",
    useCases: [
      "Implement fine-grained RBAC with hierarchical role inheritance",
      "Enforce ABAC policies based on request attributes (method, path, headers)",
      "Centralize authorization rules in a policy file or database adapter",
      "Create multi-tenant access control models with per-tenant policies",
    ],
    bestPractices: [
      "Start with a simple RBAC model and evolve to more complex models as needed",
      "Store policies in a database adapter for dynamic updates without gateway restarts",
      "Use Casbin's built-in model editor to validate your model before deploying",
      "Combine with an authentication plugin that sets the username or role in a header",
    ],
    cautions: [
      "Casbin's model language has a learning curve — invest time in understanding matchers and effect rules",
      "Policy evaluation performance depends on the number of rules — monitor latency with large policy sets",
      "Model and policy files must be accessible to the gateway — use absolute paths or config maps in Kubernetes",
    ],
    examples: [
      {
        title: "RBAC Authorization Model",
        description: "Enforce role-based access using Casbin's RBAC model",
        config: {
          model_path: "/conf/casbin/model.conf",
          policy_path: "/conf/casbin/policy.csv",
          username: "user",
        },
      },
      {
        title: "Request-based ACL",
        description: "Control access based on HTTP method and path",
        config: {
          model_path: "/conf/casbin/restful_model.conf",
          policy_path: "/conf/casbin/restful_policy.csv",
          username: "user",
        },
      },
    ],
    relatedPlugins: ["authz-keycloak", "wolf-rbac", "consumer-restriction"],
  },

  "authz-casdoor": {
    overview:
      "Casdoor Authentication integrates the gateway with Casdoor, an open-source SSO and identity platform. The plugin implements the OAuth2 authorization code flow with Casdoor, handling login redirects, token exchange, and session management. It is designed for organizations using Casdoor as their centralized identity and access management solution.",
    useCases: [
      "Add SSO authentication to APIs using an existing Casdoor deployment",
      "Implement OAuth2 login flows for web applications behind the gateway",
      "Centralize user management, MFA, and social login through Casdoor's admin console",
      "Protect APIs with Casdoor-issued tokens in multi-application environments",
    ],
    bestPractices: [
      "Configure the callback URL in Casdoor to match the gateway's redirect endpoint exactly",
      "Use HTTPS for all Casdoor communication to protect tokens and credentials",
      "Set appropriate token expiration times in Casdoor to balance security and usability",
      "Leverage Casdoor's built-in social login providers instead of configuring them separately",
    ],
    cautions: [
      "Casdoor must be reachable from both the gateway and the end user's browser — plan network routing accordingly",
      "Session state is managed by the gateway, increasing memory usage under high concurrency",
      "The callback URL must be registered in Casdoor — mismatches will silently fail the login flow",
    ],
    examples: [
      {
        title: "Casdoor SSO Integration",
        description: "Implement OAuth2 authorization code flow with Casdoor",
        config: {
          endpoint_addr: "https://casdoor.example.com",
          client_id: "my-api-app-id",
          client_secret: "my-api-app-secret",
          callback_url: "https://api.example.com/callback",
        },
      },
    ],
    relatedPlugins: ["openid-connect", "authz-keycloak", "forward-auth"],
  },

  "cas-auth": {
    overview:
      "CAS Authentication implements the Central Authentication Service (CAS) protocol for single sign-on. The plugin redirects unauthenticated users to the CAS server login page and validates service tickets upon return. CAS is commonly used in university and enterprise environments that standardized on the CAS protocol.",
    useCases: [
      "Integrate APIs with a university or enterprise CAS server for single sign-on",
      "Protect web applications behind the gateway with CAS-based authentication",
      "Migrate legacy CAS-authenticated services to an API gateway architecture",
    ],
    bestPractices: [
      "Ensure the CAS server URL uses HTTPS to protect ticket exchange",
      "Configure the service URL to match the route exposed by the gateway exactly",
      "Use CAS 3.0 protocol (serviceValidate) instead of CAS 1.0 for richer attribute support",
      "Implement a logout endpoint that calls CAS single logout (SLO) to invalidate sessions globally",
    ],
    cautions: [
      "CAS is a redirect-based protocol — it is not suitable for pure API-to-API communication",
      "Service ticket validation requires a round-trip to the CAS server for every new session",
      "The CAS protocol does not define scopes or claims like OIDC — attribute release must be configured server-side",
    ],
    examples: [
      {
        title: "CAS Server Integration",
        description: "Authenticate users via CAS protocol with ticket validation",
        config: {
          idp_uri: "https://cas.example.edu/cas",
          cas_callback_uri: "/cas/callback",
          logout_uri: "/cas/logout",
        },
      },
    ],
    relatedPlugins: ["openid-connect", "forward-auth", "authz-casdoor"],
  },

  opa: {
    overview:
      "Open Policy Agent (OPA) authorization sends incoming request metadata to an OPA server for policy evaluation. OPA uses the Rego policy language to make allow/deny decisions based on request attributes such as method, path, headers, and user identity. This decouples authorization logic from the gateway, enabling policy-as-code workflows.",
    useCases: [
      "Implement complex authorization rules that go beyond simple RBAC (e.g., time-based, geo-based, attribute-based)",
      "Enforce organization-wide policies consistently across multiple services via a shared OPA server",
      "Enable policy-as-code workflows where authorization rules are versioned in Git",
      "Create dynamic authorization that adapts based on external data sources loaded into OPA",
    ],
    bestPractices: [
      "Keep OPA policies focused and modular — use packages to organize rules by domain",
      "Pre-load static data into OPA bundles instead of fetching it at evaluation time for better performance",
      "Deploy OPA as a sidecar alongside the gateway to minimize network latency",
      "Test policies thoroughly with OPA's built-in test framework before deploying to production",
    ],
    cautions: [
      "Every request triggers an HTTP call to OPA — this adds latency, especially if OPA is not co-located with the gateway",
      "Rego has a steep learning curve — plan for team training and policy review processes",
      "OPA must be highly available since the gateway depends on it for every authorization decision",
      "Complex policies with deep recursion or large data sets can slow down evaluation time",
    ],
    examples: [
      {
        title: "Basic OPA Authorization",
        description: "Send request details to OPA and enforce the policy decision",
        config: {
          host: "http://opa:8181",
          policy: "gateway/allow",
          with_route: true,
          with_consumer: true,
        },
      },
      {
        title: "OPA with Custom Input",
        description: "Include additional request metadata in the OPA input document",
        config: {
          host: "http://opa:8181",
          policy: "gateway/authz/allow",
          with_route: true,
          with_service: true,
          with_consumer: true,
          keepalive: true,
          keepalive_timeout: 60000,
          keepalive_pool: 5,
        },
      },
    ],
    relatedPlugins: ["authz-casbin", "authz-keycloak", "forward-auth"],
  },

  "multi-auth": {
    overview:
      "Multi Auth allows you to configure multiple authentication methods on a single route, trying each one in order until one succeeds. This enables flexible authentication where different consumers may use different auth mechanisms (e.g., some use API keys while others use JWT). If all configured methods fail, the request is rejected.",
    useCases: [
      "Support both API key and JWT authentication on the same endpoint during a migration period",
      "Allow internal services to use Basic Auth while external clients use OAuth2/OIDC",
      "Enable gradual migration from one authentication method to another without breaking existing consumers",
      "Serve multiple client types (mobile apps with JWT, server integrations with API keys) from the same API",
    ],
    bestPractices: [
      "Order auth methods from most common to least common for faster authentication on average",
      "Use multi-auth as a transitional tool — consolidate to a single auth method when possible",
      "Ensure each auth plugin in the chain has 'hide_credentials' enabled to avoid leaking credentials upstream",
      "Monitor which auth method succeeds most often to understand your consumer base",
    ],
    cautions: [
      "Each failed auth attempt adds latency — minimize the number of methods in the chain",
      "Error messages may be confusing since only the last failure is returned to the client",
      "All auth methods must be configured on the consumer — multi-auth only tries them in order, it doesn't create new auth contexts",
    ],
    examples: [
      {
        title: "API Key + JWT Fallback",
        description: "Try API key first, then JWT authentication",
        config: {
          auth_plugins: ["key-auth", "jwt-auth"],
        },
      },
      {
        title: "Three-Method Authentication",
        description: "Support API key, JWT, and Basic Auth on the same route",
        config: {
          auth_plugins: ["key-auth", "jwt-auth", "basic-auth"],
        },
      },
    ],
    relatedPlugins: ["key-auth", "jwt-auth", "basic-auth", "openid-connect"],
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

  "request-validation": {
    overview:
      "Request Validation enforces JSON Schema validation on incoming request bodies and headers before they reach the upstream service. If the request does not conform to the defined schema, it is rejected with a detailed error message. This prevents malformed or malicious payloads from reaching your backend and serves as a first line of defense for data integrity.",
    useCases: [
      "Validate that POST/PUT request bodies conform to a strict JSON schema",
      "Enforce required headers and their formats before forwarding requests",
      "Reject oversized or structurally invalid payloads at the gateway level",
      "Document and enforce API contracts directly in the gateway configuration",
    ],
    bestPractices: [
      "Define schemas with explicit 'required' fields and 'additionalProperties: false' to reject unexpected data",
      "Keep schemas focused — validate structure at the gateway and business rules in the backend",
      "Use descriptive error messages in the schema so clients understand why validation failed",
      "Version your schemas alongside your API definitions for traceability",
    ],
    cautions: [
      "Complex JSON Schema validation adds processing time — avoid deeply nested schemas on high-throughput routes",
      "The plugin only validates JSON payloads — form-encoded, XML, or binary bodies are not supported",
      "Overly strict schemas can cause false rejections — test with real client payloads before deploying",
      "Schema errors are returned to the client, which may leak internal structure details — review error messages carefully",
    ],
    examples: [
      {
        title: "Validate Request Body",
        description: "Enforce a JSON schema on the request body for a user creation endpoint",
        config: {
          body_schema: {
            type: "object",
            required: ["username", "email"],
            properties: {
              username: { type: "string", minLength: 3, maxLength: 64 },
              email: { type: "string", pattern: "^\\S+@\\S+\\.\\S+$" },
              age: { type: "integer", minimum: 0, maximum: 150 },
            },
            additionalProperties: false,
          },
        },
      },
      {
        title: "Validate Required Headers",
        description: "Ensure required headers are present and match expected patterns",
        config: {
          header_schema: {
            type: "object",
            required: ["Content-Type"],
            properties: {
              "Content-Type": { type: "string", enum: ["application/json"] },
            },
          },
        },
      },
    ],
    relatedPlugins: ["uri-blocker", "cors", "fault-injection"],
  },

  "ua-restriction": {
    overview:
      "User-Agent Restriction filters incoming requests based on the User-Agent header value. You can define an allowlist of permitted User-Agent patterns or a denylist of blocked patterns using regular expressions. This is useful for blocking bots, scrapers, and outdated clients while allowing legitimate traffic through.",
    useCases: [
      "Block known web scrapers and malicious bots from accessing your API",
      "Restrict API access to specific client applications by their User-Agent string",
      "Deny access from outdated or vulnerable HTTP client versions",
      "Allow only mobile app user agents to access mobile-specific API endpoints",
    ],
    bestPractices: [
      "Use denylist mode to block known bad actors rather than allowlist mode, which is brittle against legitimate UA variations",
      "Combine with rate limiting for defense-in-depth — UA headers can be easily spoofed",
      "Use regex patterns to match UA families rather than exact strings (e.g., 'curl/.*' instead of 'curl/7.68.0')",
      "Log blocked requests to identify false positives and refine your patterns",
    ],
    cautions: [
      "User-Agent headers can be trivially spoofed — do not rely on UA restriction as the sole security measure",
      "Overly broad regex patterns (e.g., '.*bot.*') may block legitimate clients like Googlebot or monitoring services",
      "An empty or missing User-Agent header may bypass restrictions unless explicitly handled",
      "Allowlist and denylist are mutually exclusive — you cannot use both in the same configuration",
    ],
    examples: [
      {
        title: "Block Known Bots and Scrapers",
        description: "Deny access from common scraping tools and bad bots",
        config: {
          denylist: [
            "Scrapy",
            "HTTrack",
            "python-requests/.*",
            "Go-http-client/.*",
          ],
          message: "Access denied: client not allowed",
        },
      },
      {
        title: "Allow Only Specific Clients",
        description: "Restrict access to approved mobile app user agents",
        config: {
          allowlist: [
            "MyApp-iOS/.*",
            "MyApp-Android/.*",
          ],
          message: "Access restricted to approved clients",
        },
      },
    ],
    relatedPlugins: ["ip-restriction", "referer-restriction", "consumer-restriction"],
  },

  "referer-restriction": {
    overview:
      "Referer Restriction filters requests based on the HTTP Referer header, allowing or denying access based on the referring domain. This plugin helps ensure that your API is only called from authorized web pages or applications. It is commonly used to prevent hotlinking and restrict API access to known frontend origins.",
    useCases: [
      "Prevent hotlinking of API resources from unauthorized websites",
      "Restrict API calls to requests originating from your own web application",
      "Add an extra layer of origin validation alongside CORS headers",
      "Block requests from known phishing or scraping domains",
    ],
    bestPractices: [
      "Use wildcard patterns (e.g., '*.example.com') to allow all subdomains of a trusted domain",
      "Combine with CORS for comprehensive origin control — Referer restriction alone is not sufficient",
      "Handle missing Referer headers explicitly with the 'bypass_missing' option for API clients that don't send Referer",
      "Keep the allowlist short and specific to minimize pattern matching overhead",
    ],
    cautions: [
      "The Referer header can be spoofed — do not rely on it as the sole access control mechanism",
      "Many privacy-focused browsers and extensions strip or modify the Referer header, which may block legitimate users",
      "Server-to-server API calls typically do not include a Referer header — use 'bypass_missing: true' to allow them",
      "HTTPS-to-HTTP transitions cause browsers to omit the Referer header by default",
    ],
    examples: [
      {
        title: "Allow Specific Domains",
        description: "Only allow requests referred from your own domains",
        config: {
          whitelist: [
            "*.example.com",
            "example.com",
          ],
          bypass_missing: true,
          message: "Access denied: invalid referer",
        },
      },
      {
        title: "Block Specific Domains",
        description: "Block requests from known unauthorized referrers",
        config: {
          blacklist: [
            "*.competitor.com",
            "scraper-site.net",
          ],
          message: "Access denied",
        },
      },
    ],
    relatedPlugins: ["cors", "ua-restriction", "ip-restriction"],
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

  "api-breaker": {
    overview:
      "API Breaker implements the circuit breaker pattern to protect upstream services from cascading failures. It monitors upstream error rates and, when failures exceed a configurable threshold, 'opens' the circuit to return errors immediately without forwarding requests. After a cooldown period, the circuit enters a 'half-open' state where a limited number of test requests are allowed through to check if the upstream has recovered.",
    useCases: [
      "Prevent cascading failures when an upstream service becomes unhealthy or unresponsive",
      "Provide fast failure responses instead of making clients wait for upstream timeouts",
      "Automatically recover traffic flow once an upstream service stabilizes",
      "Protect shared infrastructure from one degraded service consuming all available connections",
    ],
    bestPractices: [
      "Set failure thresholds based on your upstream's normal error baseline — too sensitive triggers false positives",
      "Configure an appropriate max_breaker_sec to balance between quick recovery and giving the upstream time to heal",
      "Return meaningful break_response_body messages so clients understand the service is temporarily unavailable",
      "Combine with health checks and retry mechanisms for a comprehensive resilience strategy",
    ],
    cautions: [
      "If the failure threshold is too low, transient errors can trip the breaker unnecessarily",
      "The circuit breaker state is per gateway node — in a cluster, each node tracks failures independently",
      "Long max_breaker_sec values keep the circuit open too long, delaying recovery even after the upstream is healthy",
    ],
    examples: [
      {
        title: "Standard Circuit Breaker",
        description: "Open the circuit after 3 consecutive 500/502/503 errors, require 2 successes to close",
        config: {
          unhealthy: { http_statuses: [500, 502, 503], failures: 3 },
          healthy: { http_statuses: [200], successes: 2 },
          break_response_code: 502,
          break_response_body: "{\"error\": \"Service temporarily unavailable. The circuit breaker is open.\"}",
          max_breaker_sec: 300,
        },
      },
      {
        title: "Aggressive Breaker for Critical Path",
        description: "Trip the circuit quickly on any server error to protect downstream consumers",
        config: {
          unhealthy: { http_statuses: [500, 502, 503, 504], failures: 1 },
          healthy: { http_statuses: [200, 201], successes: 3 },
          break_response_code: 503,
          break_response_body: "{\"error\": \"Upstream is temporarily down. Please retry later.\"}",
          max_breaker_sec: 60,
        },
      },
    ],
    relatedPlugins: ["limit-conn", "limit-req", "traffic-split"],
  },

  "client-control": {
    overview:
      "Client Control restricts client request properties at the gateway level, most notably the maximum allowed request body size. This prevents oversized payloads from reaching your upstream services, protecting against memory exhaustion and denial-of-service attacks that use large request bodies.",
    useCases: [
      "Enforce a maximum upload size for file upload endpoints",
      "Prevent abuse through excessively large JSON or XML payloads",
      "Protect upstream services with limited memory from processing oversized requests",
      "Apply different body size limits per route based on endpoint requirements",
    ],
    bestPractices: [
      "Set max_body_size based on the largest legitimate payload your endpoint should accept",
      "Apply stricter limits to endpoints that do not handle file uploads",
      "Combine with rate limiting for a comprehensive abuse prevention strategy",
      "Return clear error messages so clients know the exact size limit they exceeded",
    ],
    cautions: [
      "Setting the limit too low will reject legitimate requests — analyze your actual payload sizes before configuring",
      "This plugin only controls the request body size — it does not limit header sizes or query string lengths",
      "Binary file uploads may need significantly higher limits than JSON API endpoints",
    ],
    examples: [
      {
        title: "Limit Request Body to 1 MB",
        description: "Reject requests with bodies larger than 1 megabyte",
        config: { max_body_size: 1048576 },
      },
      {
        title: "Small Payload Limit for JSON APIs",
        description: "Restrict JSON API endpoints to 100 KB payloads",
        config: { max_body_size: 102400 },
      },
    ],
    relatedPlugins: ["limit-req", "limit-count", "limit-conn"],
  },

  "proxy-control": {
    overview:
      "Proxy Control configures how the gateway proxies requests to upstream services, including connection timeouts, read/send timeouts, and request buffering behavior. This gives fine-grained control over the proxying behavior per route, overriding global gateway defaults for specific endpoints that need different timeout or buffering settings.",
    useCases: [
      "Increase timeouts for long-running API calls like report generation or file processing",
      "Disable request buffering for streaming endpoints that need low-latency pass-through",
      "Set aggressive timeouts for health check or lightweight endpoints to fail fast",
      "Tune proxy behavior per route to match the upstream service's response characteristics",
    ],
    bestPractices: [
      "Set timeouts based on the actual response time of your upstream service plus a reasonable margin",
      "Use shorter timeouts for read-heavy endpoints and longer ones for write or processing endpoints",
      "Monitor timeout errors to identify routes that need adjustment",
      "Disable request buffering only when necessary, as buffering improves gateway throughput under load",
    ],
    cautions: [
      "Very long timeouts can cause connection exhaustion under high load — balance between user experience and resource usage",
      "Disabling request buffering means the upstream receives data as the client sends it, which can cause issues with retries",
      "Timeout values are in seconds — ensure you do not accidentally set millisecond values",
    ],
    examples: [
      {
        title: "Extended Timeouts for Long Requests",
        description: "Allow up to 5 minutes for report generation endpoints",
        config: { request_buffering: true, connection_timeout: 5, send_timeout: 300, read_timeout: 300 },
      },
      {
        title: "Fast-Fail for Health Checks",
        description: "Short timeouts for lightweight health check endpoints",
        config: { connection_timeout: 2, send_timeout: 5, read_timeout: 5 },
      },
    ],
    relatedPlugins: ["client-control", "proxy-rewrite", "proxy-cache"],
  },

  mocking: {
    overview:
      "Mocking returns predefined responses directly from the gateway without forwarding the request to any upstream service. This is ideal for API prototyping, contract-first development, and testing scenarios where the backend is not yet available. You can define the response status code, content type, body, and even simulate network delay.",
    useCases: [
      "Prototype new API endpoints before the backend implementation is ready",
      "Enable frontend development teams to work in parallel with backend teams using mock responses",
      "Simulate specific response scenarios for integration testing (error states, edge cases)",
      "Provide placeholder responses for deprecated endpoints during migration periods",
    ],
    bestPractices: [
      "Use response_schema with JSON Schema for dynamic mock generation that closely resembles real data",
      "Set a small delay value to simulate realistic network latency during development",
      "Document which routes are mocked so teams know when to switch to real upstream services",
      "Use response_example for static, predictable responses and response_schema for varied test data",
    ],
    cautions: [
      "Mocked routes will never reach the upstream — ensure you remove or disable mocking before deploying to production",
      "Mock responses do not validate request payloads, so clients may develop incorrect assumptions about the real API",
      "High delay values can cause client timeouts during testing — keep delays realistic",
    ],
    examples: [
      {
        title: "Static JSON Mock",
        description: "Return a fixed JSON response for a user endpoint",
        config: {
          response_status: 200,
          content_type: "application/json",
          response_example: "{\"id\": 1, \"name\": \"John Doe\", \"email\": \"john@example.com\"}",
        },
      },
      {
        title: "Mock with Delay and Schema",
        description: "Return a schema-generated response with simulated latency",
        config: {
          delay: 500,
          response_status: 200,
          content_type: "application/json",
          response_schema: {
            type: "object",
            properties: {
              id: { type: "integer" },
              name: { type: "string" },
              status: { type: "string", enum: ["active", "inactive"] },
            },
          },
        },
      },
    ],
    relatedPlugins: ["fault-injection", "proxy-rewrite"],
  },

  workflow: {
    overview:
      "Workflow enables conditional plugin execution based on request attributes using match rules. It evaluates conditions against request variables (URI, headers, query parameters, IP) and applies corresponding plugin actions only when the conditions are met. This allows you to create sophisticated routing logic without duplicating route definitions.",
    useCases: [
      "Apply different rate limits based on the request path (e.g., stricter limits for write endpoints)",
      "Route requests to different upstreams based on header values or query parameters",
      "Apply authentication plugins selectively based on request characteristics",
      "Implement complex business logic like applying different policies for internal vs. external clients",
    ],
    bestPractices: [
      "Order rules from most specific to most general — the first matching rule is applied",
      "Use clear, well-documented conditions in vars to make rule logic easy to understand and maintain",
      "Test each rule independently before combining them into a workflow",
      "Keep the number of rules manageable — excessive rules increase evaluation overhead and complexity",
    ],
    cautions: [
      "Only the first matching rule is executed — overlapping conditions may cause unexpected behavior",
      "Complex rule sets are difficult to debug — use logging to verify which rules are triggering",
      "Incorrect vars syntax can silently fail, causing no rules to match",
      "Performance degrades slightly with a large number of rules due to sequential evaluation",
    ],
    examples: [
      {
        title: "Path-Based Rate Limiting",
        description: "Apply stricter rate limits to write endpoints and relaxed limits to read endpoints",
        config: {
          rules: [
            {
              case: [["uri", "~~", "^/api/v1/(create|update|delete)"]],
              actions: [["limit-count", { count: 100, time_window: 60, rejected_code: 429 }]],
            },
            {
              case: [["uri", "~~", "^/api/v1/(list|get)"]],
              actions: [["limit-count", { count: 1000, time_window: 60, rejected_code: 429 }]],
            },
          ],
        },
      },
    ],
    relatedPlugins: ["traffic-split", "limit-count", "limit-req"],
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

  "body-transformer": {
    overview:
      "Body Transformer converts request and response bodies between different formats such as JSON to XML, XML to JSON, or custom template-based transformations. It uses configurable templates to define how the body should be restructured, enabling seamless integration between services that speak different data formats without modifying either the client or the upstream.",
    useCases: [
      "Convert JSON requests to XML for legacy SOAP/XML-based upstream services",
      "Transform XML responses from legacy backends into JSON for modern frontend clients",
      "Restructure request or response payloads to match differing API contracts between consumers and producers",
      "Normalize data formats across a heterogeneous microservices architecture",
    ],
    bestPractices: [
      "Keep transformation templates simple and well-documented to ease maintenance",
      "Test templates thoroughly with edge cases such as empty arrays, null values, and deeply nested objects",
      "Use request transformations to adapt client payloads and response transformations to normalize upstream outputs",
      "Monitor transformation errors and set up fallback responses for malformed input",
    ],
    cautions: [
      "Complex templates increase processing time and memory usage — benchmark under realistic load",
      "Transformation errors can produce malformed output that breaks downstream consumers",
      "Large request or response bodies are fully buffered in memory during transformation",
      "Template syntax errors are only caught at runtime, so validate templates before deploying",
    ],
    examples: [
      {
        title: "JSON to XML Request Transformation",
        description: "Convert incoming JSON payloads to XML before forwarding to a SOAP upstream",
        config: {
          request: {
            input_format: "json",
            template: "<?xml version=\"1.0\"?><root><name>{{name}}</name><value>{{value}}</value></root>",
          },
        },
      },
      {
        title: "XML to JSON Response Transformation",
        description: "Convert XML responses from the upstream into JSON for modern API clients",
        config: {
          response: {
            input_format: "xml",
            template: "{\"result\": \"{{root.result}}\", \"status\": \"{{root.status}}\"}",
          },
        },
      },
    ],
    relatedPlugins: ["proxy-rewrite", "response-rewrite", "grpc-transcode"],
  },

  "grpc-web": {
    overview:
      "gRPC-Web enables browser-based clients to communicate with gRPC upstream services through the API gateway. Since browsers cannot use native gRPC due to HTTP/2 framing limitations, gRPC-Web acts as a translation layer that accepts gRPC-Web protocol requests from the browser and converts them into standard gRPC calls to the upstream. This eliminates the need for a separate Envoy proxy or gRPC-Web proxy sidecar.",
    useCases: [
      "Allow web applications built with React, Angular, or Vue to call gRPC backend services directly",
      "Eliminate the need for a separate gRPC-Web proxy (like Envoy) in front of gRPC services",
      "Provide a unified gateway for both REST and gRPC-Web traffic",
      "Enable progressive migration from REST to gRPC without breaking browser-based clients",
    ],
    bestPractices: [
      "Ensure your upstream gRPC service is accessible via HTTP/2 from the gateway",
      "Use the gRPC-Web text format (application/grpc-web-text) for better compatibility with browser debugging tools",
      "Combine with CORS plugin to allow cross-origin gRPC-Web requests from browser applications",
    ],
    cautions: [
      "Server-side streaming works, but bidirectional streaming is not supported by the gRPC-Web protocol",
      "Large binary payloads over gRPC-Web are less efficient than native gRPC due to Base64 encoding in text mode",
      "Ensure CORS headers are properly configured — browsers enforce strict cross-origin policies for gRPC-Web",
    ],
    examples: [
      {
        title: "Enable gRPC-Web Support",
        description: "Enable gRPC-Web protocol translation with default settings",
        config: {},
      },
    ],
    relatedPlugins: ["grpc-transcode", "cors", "proxy-rewrite"],
  },

  gzip: {
    overview:
      "Gzip compresses HTTP response bodies before sending them to clients, significantly reducing bandwidth usage and improving transfer times for text-based content. The plugin selectively compresses responses based on MIME type and minimum size thresholds, and automatically sets the appropriate Content-Encoding headers. Most modern browsers and HTTP clients support gzip decompression transparently.",
    useCases: [
      "Reduce bandwidth costs for APIs that return large JSON or XML responses",
      "Improve response times for clients on slow or metered network connections",
      "Compress HTML, CSS, and JavaScript responses served through the gateway",
      "Optimize API performance for mobile clients with limited bandwidth",
    ],
    bestPractices: [
      "Only compress text-based MIME types (JSON, XML, HTML, CSS, JS) — binary formats like images and video are already compressed",
      "Set min_length to avoid compressing tiny responses where the overhead exceeds the savings (1024 bytes is a good starting point)",
      "Use a moderate compression level (4-6) for the best balance between CPU usage and compression ratio",
      "Enable the Vary: Accept-Encoding header to ensure caches store compressed and uncompressed versions separately",
    ],
    cautions: [
      "Compression adds CPU overhead — under very high throughput, it can become a bottleneck if the compression level is too high",
      "Do not compress already-compressed formats (images, video, gzip archives) — it wastes CPU and may increase response size",
      "Streaming responses cannot be compressed efficiently since the full body must be buffered",
    ],
    examples: [
      {
        title: "Compress JSON and XML Responses",
        description: "Enable gzip for common API response types with balanced compression",
        config: {
          types: ["application/json", "application/xml", "text/plain", "text/html"],
          min_length: 1024,
          comp_level: 6,
          http_version: 1.1,
          vary: true,
        },
      },
    ],
    relatedPlugins: ["response-rewrite", "proxy-cache"],
  },

  "real-ip": {
    overview:
      "Real IP extracts the true client IP address from proxy headers when the API gateway sits behind a load balancer, CDN, or reverse proxy. By default, the gateway sees the IP of the last proxy rather than the original client. This plugin parses headers like X-Forwarded-For or X-Real-IP and uses trusted address lists to determine the actual client IP, which is critical for accurate rate limiting, access control, and logging.",
    useCases: [
      "Obtain the real client IP for accurate per-IP rate limiting when behind a load balancer",
      "Enable IP-based access control (allowlists/blocklists) with the correct client address",
      "Ensure access logs record the true client IP instead of the proxy or CDN address",
      "Support geolocation-based routing using the actual client IP",
    ],
    bestPractices: [
      "Always configure trusted_addresses with the CIDR ranges of your known proxies and load balancers",
      "Enable recursive mode when requests pass through multiple proxy layers to walk the X-Forwarded-For chain correctly",
      "Use X-Forwarded-For as the source when behind standard load balancers (AWS ALB, nginx, HAProxy)",
      "Verify the extracted IP by checking gateway access logs after configuration",
    ],
    cautions: [
      "Without proper trusted_addresses, a malicious client can spoof the X-Forwarded-For header to bypass IP-based restrictions",
      "Misconfigured trusted addresses may cause the gateway to use a proxy IP instead of the real client IP",
      "If your CDN or load balancer uses a non-standard header for the real IP, configure the source parameter accordingly",
    ],
    examples: [
      {
        title: "Extract Real IP Behind a Load Balancer",
        description: "Trust the local network and CDN ranges, extract real IP from X-Forwarded-For",
        config: {
          source: "http_x_forwarded_for",
          trusted_addresses: ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"],
          recursive: true,
        },
      },
    ],
    relatedPlugins: ["ip-restriction", "limit-req", "limit-count"],
  },

  "proxy-mirror": {
    overview:
      "Proxy Mirror copies incoming traffic to a secondary upstream for shadow testing, analysis, or monitoring without affecting the primary request-response flow. The mirrored request is sent asynchronously and its response is discarded, ensuring zero impact on the client experience. This is invaluable for testing new service versions with real production traffic before switching over.",
    useCases: [
      "Test a new version of a service with real production traffic without risking client-facing impact",
      "Send shadow traffic to a staging environment for performance benchmarking",
      "Mirror requests to a logging or analytics service for deep traffic inspection",
      "Validate data pipeline changes by comparing outputs from the primary and mirrored upstream",
    ],
    bestPractices: [
      "Start with a low sample_ratio (0.01 to 0.1) and increase gradually to control load on the mirror target",
      "Ensure the mirror upstream can handle the mirrored load — it receives the same traffic volume (multiplied by sample_ratio)",
      "Monitor the mirror upstream independently — failures there should never affect primary traffic",
      "Use path rewriting if the mirror upstream expects a different URL structure",
    ],
    cautions: [
      "Mirrored requests include the full request body — sensitive data will be sent to the mirror target",
      "The mirror upstream receives real production data — ensure it has appropriate security and access controls",
      "A sample_ratio of 1.0 doubles your total outbound traffic, which can impact network bandwidth and costs",
      "Mirror request failures are silently ignored — monitor the mirror upstream separately to detect issues",
    ],
    examples: [
      {
        title: "Mirror 10% of Traffic to Staging",
        description: "Send 10% of production traffic to a staging environment for shadow testing",
        config: {
          host: "http://staging-api.internal:8080",
          sample_ratio: 0.1,
        },
      },
      {
        title: "Full Traffic Mirror for Analytics",
        description: "Mirror all traffic to an analytics service for deep inspection",
        config: {
          host: "http://analytics-collector.internal:9090",
          path: "/mirror/ingest",
          sample_ratio: 1.0,
        },
      },
    ],
    relatedPlugins: ["traffic-split", "proxy-rewrite", "fault-injection"],
  },

  "batch-requests": {
    overview:
      "Batch Requests allows clients to combine multiple API calls into a single HTTP request. The gateway splits the batch into individual sub-requests, executes them in parallel against the upstream, and returns all responses combined in a single response body. This reduces network round-trips and improves performance for clients that need to make many related API calls.",
    useCases: [
      "Reduce network round-trips for mobile applications on slow connections",
      "Aggregate multiple data fetches (user profile, settings, notifications) into one call on page load",
      "Optimize API calls from frontend applications that need data from several endpoints simultaneously",
      "Reduce latency for dashboard pages that aggregate data from multiple services",
    ],
    bestPractices: [
      "Set reasonable limits on the maximum number of sub-requests per batch to prevent abuse",
      "Ensure individual sub-requests have their own authentication and authorization checks",
      "Monitor batch request sizes to identify clients that could benefit from a dedicated aggregation endpoint",
      "Use batch requests for read-heavy operations — avoid batching write operations that need transactional guarantees",
    ],
    cautions: [
      "A single slow sub-request delays the entire batch response — consider timeouts per sub-request",
      "Error handling is complex — clients must inspect each sub-response individually for failures",
      "Large batches can cause high memory usage on the gateway as all sub-responses are buffered",
      "Batch requests bypass connection-level rate limiting since multiple logical requests share one connection",
    ],
    examples: [
      {
        title: "Enable Batch Requests",
        description: "Allow up to 10 sub-requests per batch",
        config: {},
      },
    ],
    relatedPlugins: ["proxy-cache", "limit-count"],
  },

  echo: {
    overview:
      "Echo returns the incoming request back to the client as the response, optionally including request headers, body, and other metadata. This is primarily a development and debugging tool that lets you inspect exactly what the gateway receives, including any transformations applied by other plugins in the pipeline.",
    useCases: [
      "Debug request transformations by seeing the exact request the gateway received after plugin processing",
      "Verify that proxy-rewrite, headers, and body transformations are applied correctly",
      "Create a simple health check endpoint that confirms the gateway is processing requests",
      "Test authentication and authorization plugins by inspecting the request context after auth processing",
    ],
    bestPractices: [
      "Only enable echo on development or debugging routes — never expose it in production",
      "Use echo in combination with proxy-rewrite to verify URI and header transformations",
      "Combine with auth plugins to inspect the consumer context attached to the request",
    ],
    cautions: [
      "Echo exposes request details including headers and body — this can leak sensitive information like auth tokens",
      "Never enable on production routes — it bypasses the upstream entirely",
      "The echo plugin returns the request as seen by the gateway, not as sent by the client (post-plugin transformations)",
    ],
    examples: [
      {
        title: "Echo Full Request",
        description: "Return all request details including headers and body",
        config: { before_body: "--- Request Echo ---\n", after_body: "\n--- End Echo ---" },
      },
    ],
    relatedPlugins: ["mocking", "proxy-rewrite", "fault-injection"],
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

  datadog: {
    overview:
      "Datadog sends API metrics and logs to Datadog's monitoring platform via the DogStatsD protocol. The plugin collects request counts, latency, status codes, and bandwidth metrics, then forwards them as StatsD-formatted datagrams to a local Datadog Agent. This provides seamless integration with Datadog's dashboards, alerting, and APM without requiring application-level instrumentation.",
    useCases: [
      "Monitor API gateway performance in Datadog alongside infrastructure and application metrics",
      "Create unified Datadog dashboards combining gateway metrics with upstream service APM data",
      "Set up Datadog monitors and alerts for API latency spikes, error rate increases, or traffic anomalies",
      "Track per-route and per-consumer metrics using Datadog's tagging and filtering capabilities",
    ],
    bestPractices: [
      "Run a Datadog Agent as a sidecar or DaemonSet so the gateway can send metrics to localhost with minimal latency",
      "Use the 'namespace' option to prefix all gateway metrics (e.g., 'apisix.') for easy filtering in Datadog dashboards",
      "Add constant_tags for environment, cluster, and region to enable multi-dimensional metric filtering",
      "Enable prefer_name to use human-readable route names instead of numeric IDs in metric tags",
    ],
    cautions: [
      "DogStatsD uses UDP by default — metrics can be lost under extreme network pressure or if the agent is down",
      "High-cardinality tags (unique request IDs, user IDs) cause metric explosion and increase Datadog costs significantly",
      "The Datadog Agent must be reachable from the gateway node — verify connectivity in containerized environments",
    ],
    examples: [
      {
        title: "Basic Datadog Integration",
        description: "Send gateway metrics to a local Datadog Agent with environment tags",
        config: {
          prefer_name: true,
          host: "127.0.0.1",
          port: 8125,
          namespace: "apisix",
          constant_tags: ["env:production", "service:api-gateway", "region:us-east-1"],
        },
      },
    ],
    relatedPlugins: ["prometheus", "opentelemetry", "http-logger"],
  },

  "file-logger": {
    overview:
      "File Logger writes API access logs directly to a file on the gateway node's local filesystem. Each log entry contains request and response metadata in JSON format, making it suitable for local debugging, compliance archival, or feeding into file-based log collectors like Filebeat or Fluentd. The log format is fully customizable via a JSON template.",
    useCases: [
      "Write access logs to disk for local debugging or troubleshooting without external dependencies",
      "Feed log files into Filebeat, Fluentd, or Logstash for centralized log aggregation",
      "Maintain a local audit trail of API requests for compliance and forensics",
      "Use as a fallback logging mechanism when network-based loggers are unavailable",
    ],
    bestPractices: [
      "Configure log rotation (via logrotate or similar) to prevent disk space exhaustion on the gateway node",
      "Use a custom log_format to include only the fields you need — reduces disk I/O and storage costs",
      "Write logs to a dedicated partition or volume to isolate log I/O from gateway operations",
      "Combine with a file shipper (Filebeat, Promtail) to forward logs to a central platform",
    ],
    cautions: [
      "Logs are stored locally — if the gateway node fails, unshipped logs may be lost",
      "High-traffic APIs can generate very large log files quickly — always configure log rotation",
      "Enabling include_resp_body dramatically increases log volume and may capture sensitive response data",
      "File I/O under heavy load can impact gateway performance — use async I/O or a RAM-backed filesystem for high-throughput scenarios",
    ],
    examples: [
      {
        title: "Local File Logging",
        description: "Write access logs to a local file with a custom format",
        config: {
          path: "/var/log/apisix/access.log",
          log_format: {
            host: "$host",
            client_ip: "$remote_addr",
            timestamp: "$time_iso8601",
            method: "$request_method",
            uri: "$uri",
            status: "$status",
            latency: "$latency",
          },
          include_resp_body: false,
        },
      },
    ],
    relatedPlugins: ["http-logger", "tcp-logger", "udp-logger"],
  },

  "clickhouse-logger": {
    overview:
      "ClickHouse Logger sends API access logs to a ClickHouse database via its HTTP interface. ClickHouse is a columnar database optimized for real-time analytics on large datasets, making it ideal for storing and querying high-volume API logs. Logs are inserted as rows into a configurable table, enabling SQL-based analytics on request patterns, latency distributions, and error rates.",
    useCases: [
      "Store API access logs in ClickHouse for high-performance analytical queries on traffic patterns",
      "Build real-time API analytics dashboards using ClickHouse's fast aggregation capabilities",
      "Perform ad-hoc SQL analysis on API usage — top endpoints, slowest routes, error distributions",
      "Maintain a long-term, cost-effective log archive with ClickHouse's efficient columnar compression",
    ],
    bestPractices: [
      "Design your ClickHouse log table with appropriate partitioning (e.g., by day) and an ORDER BY key matching your most common queries",
      "Use batch inserts (buffer_duration, batch_max_size) to reduce HTTP overhead and improve ClickHouse insert performance",
      "Enable ssl_verify in production to protect log data in transit between the gateway and ClickHouse",
      "Set reasonable timeouts to prevent gateway threads from blocking if ClickHouse is slow or unreachable",
    ],
    cautions: [
      "ClickHouse HTTP interface must be accessible from the gateway — firewall rules and authentication must be configured",
      "Very high insert rates without batching can degrade ClickHouse performance — always use buffered batch inserts",
      "Ensure the log table schema matches the fields being sent — schema mismatches cause silent insert failures",
    ],
    examples: [
      {
        title: "Log to ClickHouse",
        description: "Send access logs to a ClickHouse database with authentication",
        config: {
          endpoint_addr: "http://clickhouse-server:8123",
          database: "api_logs",
          logtable: "access_log",
          user: "logger",
          password: "secure-password",
          timeout: 5,
          ssl_verify: false,
        },
      },
    ],
    relatedPlugins: ["elasticsearch-logger", "kafka-logger", "http-logger"],
  },

  "elasticsearch-logger": {
    overview:
      "Elasticsearch Logger sends API access logs to an Elasticsearch or OpenSearch cluster via the bulk API. Each log entry is indexed as a document, enabling full-text search, complex aggregations, and Kibana/OpenSearch Dashboards visualizations. This is the standard choice for teams already using the ELK (Elasticsearch, Logstash, Kibana) stack for log management.",
    useCases: [
      "Index API access logs in Elasticsearch for full-text search and Kibana dashboard visualization",
      "Integrate with an existing ELK/OpenSearch stack for unified log management across all services",
      "Perform complex aggregations on API traffic — percentile latencies, geographic distributions, error patterns",
      "Enable security teams to investigate API access patterns using Kibana's discovery and alerting features",
    ],
    bestPractices: [
      "Use date-based index patterns (e.g., 'api-logs-2024.01.15') via index templates for efficient lifecycle management",
      "Configure Index Lifecycle Management (ILM) policies to automatically roll over, shrink, and delete old log indices",
      "Enable authentication and ssl_verify in production to protect log data in transit and at rest",
      "Tune batch_max_size and buffer_duration to balance insert latency against bulk API efficiency",
    ],
    cautions: [
      "Elasticsearch cluster must be properly sized — high-volume API logging can consume significant disk and memory",
      "Mapping conflicts (e.g., a field sent as both string and number) cause indexing failures — use strict index templates",
      "Network timeouts between the gateway and Elasticsearch can cause log buffering and potential data loss",
      "High-cardinality fields (unique IDs) increase index size — avoid indexing fields that are never searched",
    ],
    examples: [
      {
        title: "Log to Elasticsearch",
        description: "Send access logs to an Elasticsearch cluster with authentication",
        config: {
          endpoint_addr: "http://elasticsearch:9200",
          field: { index: "api-gateway-logs", type: "logs" },
          auth: { username: "elastic", password: "changeme" },
          ssl_verify: false,
          timeout: 10,
        },
      },
    ],
    relatedPlugins: ["clickhouse-logger", "http-logger", "kafka-logger"],
  },

  "google-cloud-logging": {
    overview:
      "Google Cloud Logging sends API access logs to Google Cloud's Logging service (formerly Stackdriver). Logs are written to a configurable log ID within a GCP project, enabling integration with Cloud Monitoring alerts, Log Router sinks, BigQuery exports, and the Logs Explorer. Authentication uses a GCP service account with appropriate IAM permissions.",
    useCases: [
      "Centralize API gateway logs in Google Cloud Logging alongside other GCP service logs",
      "Route gateway logs to BigQuery via Log Router sinks for long-term analytics and reporting",
      "Set up Cloud Monitoring alerts based on gateway log patterns (error spikes, unusual traffic)",
      "Integrate with Google Cloud's operations suite for unified observability across GKE-hosted services",
    ],
    bestPractices: [
      "Use a dedicated service account with the minimal 'roles/logging.logWriter' IAM role",
      "Set a descriptive log_id (e.g., 'api-gateway-access') to distinguish gateway logs from other sources in Logs Explorer",
      "Configure the resource.type to match your deployment (e.g., 'k8s_container' for GKE, 'gce_instance' for Compute Engine)",
      "Use Log Router exclusion filters to drop verbose low-value logs and reduce Cloud Logging costs",
    ],
    cautions: [
      "Service account credentials (private_key) are sensitive — store them securely and never commit to version control",
      "Cloud Logging ingestion costs can be significant at high traffic volumes — configure exclusion filters for noisy routes",
      "Network latency to the Cloud Logging API may vary — configure appropriate timeouts for non-GCP deployments",
    ],
    examples: [
      {
        title: "Log to Google Cloud Logging",
        description: "Send access logs to a GCP project using service account authentication",
        config: {
          auth_config: {
            project_id: "my-gcp-project-123",
            private_key: "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
            client_email: "api-gateway-logger@my-gcp-project-123.iam.gserviceaccount.com",
          },
          resource: { type: "global" },
          log_id: "api-gateway-access",
        },
      },
    ],
    relatedPlugins: ["http-logger", "sls-logger", "tencent-cloud-cls"],
  },

  loggly: {
    overview:
      "Loggly sends API access logs to the Loggly SaaS logging platform via its HTTP Events API. Loggly provides real-time log search, dashboards, and alerting with minimal infrastructure management. The plugin authenticates using a customer token and supports custom log formatting, severity levels, and tagging for easy log categorization.",
    useCases: [
      "Send API access logs to Loggly for cloud-hosted log search and analysis without managing log infrastructure",
      "Use Loggly's dynamic field explorer to analyze API traffic patterns and troubleshoot issues",
      "Set up Loggly alerts for API error rate spikes, unusual traffic volumes, or specific error patterns",
      "Tag logs by environment, service, or team for multi-dimensional log filtering in Loggly",
    ],
    bestPractices: [
      "Use meaningful tags (environment, service name, version) to organize and filter logs in the Loggly dashboard",
      "Set the severity level appropriately to enable severity-based filtering and alerting",
      "Customize log_format to include only relevant fields — reduces ingestion volume and improves search performance",
      "Configure retention policies in Loggly to manage storage costs for high-volume APIs",
    ],
    cautions: [
      "The customer_token is a secret — store it securely and avoid exposing it in configuration management systems",
      "Loggly has ingestion rate limits on lower-tier plans — verify your plan supports your API's traffic volume",
      "Network connectivity to Loggly's HTTP endpoint is required — logs are lost if the gateway cannot reach Loggly",
    ],
    examples: [
      {
        title: "Log to Loggly",
        description: "Send access logs to Loggly with custom tags and severity",
        config: {
          customer_token: "your-loggly-customer-token",
          severity: "INFO",
          tags: ["api-gateway", "production", "us-east"],
        },
      },
    ],
    relatedPlugins: ["http-logger", "splunk-hec-logging", "elasticsearch-logger"],
  },

  "rocketmq-logger": {
    overview:
      "RocketMQ Logger sends API access logs to Apache RocketMQ, a distributed messaging platform designed for high throughput and low latency. Logs are published as messages to a configurable topic, enabling real-time stream processing by downstream consumers. RocketMQ's built-in message ordering, retry mechanisms, and dead-letter queues make it a reliable transport for mission-critical log data.",
    useCases: [
      "Stream API access logs to RocketMQ for real-time processing by downstream analytics consumers",
      "Integrate with existing RocketMQ-based event pipelines in organizations standardized on the Apache ecosystem",
      "Decouple log collection from log storage — multiple consumer groups can independently process the same log stream",
      "Leverage RocketMQ's message ordering to preserve request sequence for audit and replay scenarios",
    ],
    bestPractices: [
      "Use a dedicated topic for gateway logs to isolate log traffic from application messages",
      "Configure multiple nameservers for high availability in production deployments",
      "Use message tags to categorize logs (e.g., by route, status code range, or consumer) for selective consumption",
      "Enable TLS (use_tls) when sending logs across untrusted networks",
    ],
    cautions: [
      "RocketMQ nameservers and brokers must be reachable from the gateway — verify network connectivity",
      "Large message payloads (e.g., with request/response bodies) may exceed RocketMQ's default max message size",
      "Timeout values that are too low can cause message send failures under brief network congestion",
    ],
    examples: [
      {
        title: "Log to RocketMQ",
        description: "Send access logs to a RocketMQ cluster with TLS enabled",
        config: {
          nameserver_list: ["rocketmq-ns1:9876", "rocketmq-ns2:9876"],
          topic: "api-gateway-logs",
          key: "gateway",
          tag: "access-log",
          timeout: 3,
          use_tls: true,
        },
      },
    ],
    relatedPlugins: ["kafka-logger", "http-logger", "tcp-logger"],
  },

  skywalking: {
    overview:
      "SkyWalking integrates the API gateway with Apache SkyWalking for distributed tracing and service topology analysis. The plugin generates trace segments for each request, correlating gateway processing with upstream service spans. SkyWalking's topology map, trace detail view, and service metrics provide deep visibility into request flows across microservice architectures.",
    useCases: [
      "Trace API requests end-to-end through the gateway and upstream services using SkyWalking's distributed tracing",
      "Visualize service dependency topology and identify critical paths in the SkyWalking dashboard",
      "Analyze request latency breakdowns to pinpoint whether delays occur at the gateway, network, or upstream level",
      "Monitor gateway health and throughput using SkyWalking's built-in service metrics and alerting",
    ],
    bestPractices: [
      "Use sample_ratio to control trace volume — start with 0.1 (10%) for high-traffic services and adjust based on analysis needs",
      "Set a descriptive service_name that matches your SkyWalking service naming convention for consistent topology mapping",
      "Use unique service_instance_name per gateway node to distinguish traffic distribution across instances",
      "Ensure upstream services propagate SkyWalking trace context headers (sw8) for complete end-to-end traces",
    ],
    cautions: [
      "High sample ratios (approaching 1.0) on high-traffic APIs generate enormous trace data and can overwhelm the SkyWalking OAP",
      "The SkyWalking OAP server must be reachable via gRPC — network issues cause trace data loss",
      "Tracing adds processing overhead to every sampled request — benchmark the performance impact before enabling in production",
    ],
    examples: [
      {
        title: "SkyWalking Distributed Tracing",
        description: "Enable SkyWalking tracing with 10% sampling",
        config: {
          sample_ratio: 0.1,
          endpoint_addr: "http://skywalking-oap:12800",
          service_name: "api-gateway",
          service_instance_name: "gateway-node-01",
        },
      },
    ],
    relatedPlugins: ["skywalking-logger", "zipkin", "opentelemetry"],
  },

  "skywalking-logger": {
    overview:
      "SkyWalking Logger sends API access logs to Apache SkyWalking's OAP (Observability Analysis Platform) server for centralized log analysis. Unlike the tracing plugin, this plugin focuses on structured access log collection, which SkyWalking correlates with trace data to provide unified log-trace views. This enables clicking from a trace span directly to the related log entries in the SkyWalking UI.",
    useCases: [
      "Correlate API access logs with distributed traces in SkyWalking's unified log-trace view",
      "Centralize gateway logs in SkyWalking alongside application logs from instrumented services",
      "Use SkyWalking's log analysis language (LAL) to parse, tag, and alert on gateway log patterns",
      "Build log-based dashboards and alerts in SkyWalking for gateway operational monitoring",
    ],
    bestPractices: [
      "Use the same service_name and service_instance_name as the SkyWalking tracing plugin for consistent correlation",
      "Customize log_format to include fields relevant to your analysis — avoid logging unnecessary data",
      "Configure appropriate timeouts to prevent gateway threads from blocking on OAP connectivity issues",
      "Combine with the skywalking tracing plugin for full log-trace correlation in the SkyWalking UI",
    ],
    cautions: [
      "The SkyWalking OAP server must be reachable from the gateway — connectivity issues cause log data loss",
      "High-volume logging can strain the OAP server's storage backend — configure appropriate retention policies",
      "Enabling log_format with response bodies can significantly increase log volume and OAP storage requirements",
    ],
    examples: [
      {
        title: "SkyWalking Log Collection",
        description: "Send access logs to SkyWalking OAP for log-trace correlation",
        config: {
          endpoint_addr: "http://skywalking-oap:12800",
          service_name: "api-gateway",
          service_instance_name: "gateway-node-01",
          log_format: {
            host: "$host",
            uri: "$uri",
            status: "$status",
            latency: "$latency",
            client_ip: "$remote_addr",
          },
          timeout: 5,
        },
      },
    ],
    relatedPlugins: ["skywalking", "http-logger", "opentelemetry"],
  },

  "sls-logger": {
    overview:
      "SLS Logger sends API access logs to Alibaba Cloud Log Service (SLS), a fully managed log analysis platform. Logs are sent to a specified project and logstore using Alibaba Cloud access keys for authentication. SLS provides real-time log search, dashboards, alerting, and machine learning-based anomaly detection, making it the native choice for API gateways deployed on Alibaba Cloud.",
    useCases: [
      "Centralize API gateway logs in Alibaba Cloud SLS alongside other cloud service logs",
      "Use SLS query and analysis capabilities to monitor API traffic patterns, errors, and performance",
      "Set up SLS alerts for API anomalies — error spikes, latency degradation, or unusual access patterns",
      "Feed gateway logs into SLS machine learning features for automated anomaly detection",
    ],
    bestPractices: [
      "Use a dedicated logstore for gateway logs to isolate them from application logs and enable independent retention policies",
      "Create SLS indices on frequently queried fields (status, URI, client_ip) for fast log search",
      "Use RAM (Resource Access Management) roles instead of static access keys when running on Alibaba Cloud ECS or ACK",
      "Configure appropriate timeout values to prevent blocking under network instability",
    ],
    cautions: [
      "Access key credentials (access_key_id, access_key_secret) are sensitive — store them securely using secrets management",
      "SLS ingestion costs scale with log volume — configure log format to exclude unnecessary fields and reduce data size",
      "The SLS endpoint must be reachable from the gateway — internal endpoints are faster and cheaper for Alibaba Cloud deployments",
    ],
    examples: [
      {
        title: "Log to Alibaba Cloud SLS",
        description: "Send access logs to an SLS logstore with access key authentication",
        config: {
          host: "us-east-1.log.aliyuncs.com",
          port: 443,
          project: "api-gateway-logs",
          logstore: "access-log",
          access_key_id: "your-access-key-id",
          access_key_secret: "your-access-key-secret",
          timeout: 5,
        },
      },
    ],
    relatedPlugins: ["google-cloud-logging", "tencent-cloud-cls", "http-logger"],
  },

  "splunk-hec-logging": {
    overview:
      "Splunk HEC Logging sends API access logs to Splunk via the HTTP Event Collector (HEC) endpoint. HEC is Splunk's recommended method for programmatic log ingestion, providing token-based authentication, TLS encryption, and acknowledgment-based delivery guarantees. Logs are indexed in Splunk where they can be searched, visualized, and correlated with other data sources using SPL (Search Processing Language).",
    useCases: [
      "Index API gateway logs in Splunk for enterprise-grade search, alerting, and compliance reporting",
      "Integrate gateway logs with existing Splunk SIEM workflows for security monitoring and incident response",
      "Create Splunk dashboards for API traffic analysis — request volumes, error trends, and latency distributions",
      "Correlate gateway logs with application and infrastructure logs already in Splunk for end-to-end troubleshooting",
    ],
    bestPractices: [
      "Use a dedicated HEC token for the API gateway to enable per-source access control and auditing in Splunk",
      "Set source and sourcetype to descriptive values (e.g., source: 'api-gateway', sourcetype: 'apisix:access') for easy SPL filtering",
      "Route gateway logs to a dedicated Splunk index with appropriate retention policies to manage storage costs",
      "Enable ssl_verify in production to ensure log data is encrypted in transit to the HEC endpoint",
    ],
    cautions: [
      "The HEC token is a secret — store it securely and rotate it periodically",
      "Splunk license costs are based on daily ingestion volume — high-traffic APIs can generate significant log data",
      "HEC endpoint availability is critical — configure retries and buffering to handle brief Splunk outages",
      "Including request/response bodies in logs dramatically increases ingestion volume and license consumption",
    ],
    examples: [
      {
        title: "Log to Splunk HEC",
        description: "Send access logs to Splunk via HTTP Event Collector",
        config: {
          endpoint: {
            uri: "https://splunk-hec.internal:8088/services/collector",
            token: "your-hec-token-here",
          },
          ssl_verify: true,
          source: "api-gateway",
          sourcetype: "apisix:access",
          index: "api_logs",
        },
      },
    ],
    relatedPlugins: ["http-logger", "elasticsearch-logger", "kafka-logger"],
  },

  "tcp-logger": {
    overview:
      "TCP Logger sends API access logs to a TCP server as newline-delimited JSON messages. TCP provides reliable, ordered delivery with connection management and retry logic, making it suitable for feeding logs into systems that accept TCP input (Logstash TCP input, Fluentd TCP input, custom log aggregators). Logs can be batched for efficiency and the connection supports optional TLS encryption.",
    useCases: [
      "Send logs to Logstash via its TCP input plugin for processing and forwarding to Elasticsearch",
      "Feed logs into Fluentd's TCP input for flexible log routing and transformation",
      "Stream logs to a custom TCP-based log aggregator or analytics service",
      "Deliver logs reliably to systems that don't support HTTP-based log ingestion",
    ],
    bestPractices: [
      "Enable TLS for log transport across untrusted networks to protect sensitive request data",
      "Configure batch_max_size and buffer_duration to balance delivery latency against connection efficiency",
      "Use a custom log_format to include only the fields your downstream system needs",
      "Set appropriate timeout values to prevent connection hangs from blocking the logging pipeline",
    ],
    cautions: [
      "TCP connections are stateful — a receiving server restart causes temporary log delivery failures until reconnection",
      "Large batch sizes can cause memory pressure if the TCP connection is slow or congested",
      "TLS adds connection overhead — connection reuse (keep-alive) is important for high-throughput scenarios",
    ],
    examples: [
      {
        title: "TCP Logger to Logstash",
        description: "Send batched access logs to a Logstash TCP input with TLS",
        config: {
          host: "logstash.internal",
          port: 5044,
          tls: true,
          tls_options: { ssl_verify: true },
          timeout: 5,
          log_format: {
            host: "$host",
            uri: "$uri",
            method: "$request_method",
            status: "$status",
            latency: "$latency",
          },
          batch_max_size: 100,
        },
      },
    ],
    relatedPlugins: ["udp-logger", "http-logger", "file-logger"],
  },

  "tencent-cloud-cls": {
    overview:
      "Tencent Cloud CLS sends API access logs to Tencent Cloud Log Service (CLS), a fully managed log platform for real-time collection, storage, search, and analysis. Logs are sent to a specified CLS topic using Tencent Cloud API credentials for authentication. CLS provides full-text and key-value search, dashboards, and alerting, making it the native logging solution for API gateways deployed on Tencent Cloud.",
    useCases: [
      "Centralize API gateway logs in Tencent Cloud CLS alongside other cloud service logs",
      "Use CLS search and analysis to monitor API traffic, debug errors, and track performance trends",
      "Configure CLS alarm policies for real-time alerting on API error rates, latency thresholds, or traffic anomalies",
      "Feed gateway logs into CLS data processing pipelines for ETL and downstream analytics",
    ],
    bestPractices: [
      "Use a dedicated CLS topic for gateway logs to isolate retention, indexing, and access policies",
      "Enable index configuration on frequently queried fields (status, URI, client_ip) for fast search performance",
      "Use CAM (Cloud Access Management) sub-accounts with minimal permissions instead of root account credentials",
      "Configure sample_ratio to reduce log volume on extremely high-traffic routes while maintaining statistical significance",
    ],
    cautions: [
      "API credentials (secret_id, secret_key) are sensitive — use Tencent Cloud's secrets manager or environment variables",
      "CLS ingestion and storage costs scale with volume — configure log format and sampling to manage costs",
      "Including request bodies (include_req_body) significantly increases log volume and may capture sensitive user data",
    ],
    examples: [
      {
        title: "Log to Tencent Cloud CLS",
        description: "Send access logs to a CLS topic with request body sampling",
        config: {
          cls_host: "ap-guangzhou.cls.tencentcs.com",
          cls_topic: "api-gateway-access-logs-topic-id",
          secret_id: "your-tencent-secret-id",
          secret_key: "your-tencent-secret-key",
          sample_ratio: 1,
          include_req_body: false,
        },
      },
    ],
    relatedPlugins: ["sls-logger", "google-cloud-logging", "http-logger"],
  },

  "udp-logger": {
    overview:
      "UDP Logger sends API access logs to a UDP server as newline-delimited JSON datagrams. UDP is a fire-and-forget protocol with minimal overhead, making it the fastest logging transport option. While UDP does not guarantee delivery, its simplicity and low latency make it suitable for high-throughput scenarios where occasional log loss is acceptable, such as metrics aggregation or development environments.",
    useCases: [
      "Send logs to a UDP-based log collector (Logstash UDP input, syslog-ng) for lightweight log aggregation",
      "High-throughput logging where minimal latency impact on requests is the priority over guaranteed delivery",
      "Stream logs to a local StatsD-compatible aggregator for real-time metrics extraction from log data",
      "Development and testing environments where simple, fast log collection is preferred over reliability",
    ],
    bestPractices: [
      "Use UDP logging only when occasional message loss is acceptable — prefer TCP or HTTP loggers for critical audit logs",
      "Keep log messages small to avoid UDP fragmentation (stay under the network MTU, typically 1500 bytes)",
      "Customize log_format to include only essential fields — smaller payloads reduce the chance of UDP fragmentation",
      "Run the UDP receiver on the same network segment as the gateway to minimize packet loss",
    ],
    cautions: [
      "UDP does not guarantee delivery — logs can be silently lost due to network congestion, buffer overflow, or receiver downtime",
      "UDP datagrams exceeding the network MTU are fragmented, increasing the chance of data loss",
      "No connection state means there is no backpressure — the gateway will continue sending even if the receiver is down",
      "Including request bodies (include_req_body) can easily exceed UDP MTU limits and cause fragmentation",
    ],
    examples: [
      {
        title: "UDP Logger to Logstash",
        description: "Send access logs to a Logstash UDP input for lightweight collection",
        config: {
          host: "logstash.internal",
          port: 5045,
          timeout: 3,
          log_format: {
            host: "$host",
            uri: "$uri",
            method: "$request_method",
            status: "$status",
            latency: "$latency",
          },
          include_req_body: false,
        },
      },
    ],
    relatedPlugins: ["tcp-logger", "syslog", "http-logger"],
  },

  "node-status": {
    overview:
      "Node Status exposes an internal endpoint that returns the current status of the gateway node, including active connections, total requests handled, and request processing statistics. This is useful for monitoring the health and load of individual gateway nodes in a cluster.",
    useCases: [
      "Monitor individual gateway node health in a multi-node cluster",
      "Feed node metrics into custom monitoring dashboards",
      "Implement load-balancer health checks based on gateway node status",
      "Troubleshoot performance issues by comparing node-level statistics",
    ],
    bestPractices: [
      "Restrict access to the node-status endpoint using IP restriction to internal monitoring systems only",
      "Poll node status at regular intervals and alert on anomalies like high connection counts",
      "Use in conjunction with Prometheus for comprehensive gateway monitoring",
      "Compare statistics across nodes to identify uneven load distribution",
    ],
    cautions: [
      "The status endpoint exposes internal server metrics — never make it publicly accessible",
      "Node status shows per-node data, not cluster-wide aggregates — aggregate externally for global view",
      "High-frequency polling of node-status can itself add load to the gateway",
    ],
    examples: [
      {
        title: "Enable Node Status",
        description: "Expose node status on the default internal endpoint",
        config: {},
      },
    ],
    relatedPlugins: ["prometheus", "opentelemetry", "datadog"],
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

  // ─── Serverless & Functions ──────────────────────────────────

  "aws-lambda": {
    overview:
      "Forwards incoming API requests to AWS Lambda functions, enabling a fully serverless backend architecture. The gateway invokes the specified Lambda function via the AWS API using IAM credentials and returns the function's response directly to the client. This plugin turns the API Gateway into a unified entry point for Lambda-based microservices without needing API Gateway (AWS) in front of them.",
    useCases: [
      "Expose AWS Lambda functions as REST API endpoints through a single gateway",
      "Build a serverless backend where all business logic lives in Lambda and the gateway handles auth, rate limiting, and observability",
      "Migrate monolithic APIs to serverless incrementally by routing specific paths to Lambda functions",
      "Invoke cross-region Lambda functions from a centralized API Gateway",
    ],
    bestPractices: [
      "Use IAM roles with least-privilege policies — grant only lambda:InvokeFunction on the specific function ARN",
      "Set a reasonable timeout that accounts for Lambda cold starts (typically 3-10 seconds for cold, under 1 second for warm)",
      "Enable keepalive to reuse connections to the AWS API endpoint and reduce latency on subsequent invocations",
      "Always enable ssl_verify in production to prevent man-in-the-middle attacks on the AWS API calls",
    ],
    cautions: [
      "AWS Lambda cold starts can add significant latency (100ms to several seconds) — factor this into your gateway timeout settings",
      "IAM access keys stored in plugin configuration are sensitive — use environment-based secrets management where possible",
      "Lambda has a 6 MB response payload limit for synchronous invocations — large responses will be truncated or fail",
      "Cross-region invocations add network latency — deploy Lambda functions in the same region as your gateway when possible",
    ],
    examples: [
      {
        title: "Basic Lambda Invocation",
        description: "Route requests to a Lambda function with IAM authentication",
        config: {
          function_uri: "arn:aws:lambda:us-east-1:123456789012:function:my-api-handler",
          authorization: {
            iam: {
              accesskey: "AKIAIOSFODNN7EXAMPLE",
              secretkey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
              aws_region: "us-east-1",
            },
          },
          timeout: 10000,
          keepalive: true,
          ssl_verify: true,
        },
      },
      {
        title: "Cross-Region Lambda with Extended Timeout",
        description: "Invoke a Lambda function in a different region with a longer timeout for heavy processing",
        config: {
          function_uri: "arn:aws:lambda:eu-west-1:123456789012:function:data-processor",
          authorization: {
            iam: {
              accesskey: "AKIAIOSFODNN7EXAMPLE",
              secretkey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
              aws_region: "eu-west-1",
            },
          },
          timeout: 30000,
          keepalive: true,
          ssl_verify: true,
        },
      },
    ],
    relatedPlugins: ["azure-functions", "openwhisk", "serverless-pre-function"],
  },

  "azure-functions": {
    overview:
      "Routes incoming API requests to Azure Functions, providing a serverless compute backend managed by Microsoft Azure. The gateway forwards the request to the specified function URI, authenticating via an API key, and streams the function's response back to the client. This allows teams using Azure infrastructure to expose their serverless functions through a centralized API Gateway with full policy enforcement.",
    useCases: [
      "Expose Azure Functions as managed API endpoints with authentication, rate limiting, and monitoring",
      "Build event-driven microservices on Azure while keeping a unified API surface through the gateway",
      "Migrate legacy APIs to Azure Functions incrementally by routing individual endpoints",
      "Combine Azure Functions with on-premise upstreams in a hybrid architecture managed by a single gateway",
    ],
    bestPractices: [
      "Store the Azure Functions API key securely — rotate it regularly and avoid committing it to version control",
      "Set the timeout higher than your function's expected execution time to account for cold starts on Consumption plans",
      "Enable keepalive to maintain persistent connections to the Azure Functions host, reducing connection setup overhead",
      "Use ssl_verify in production to ensure secure communication with the Azure Functions endpoint",
    ],
    cautions: [
      "Azure Functions on the Consumption plan have cold start latency (several seconds for .NET, less for Node.js) — set timeouts accordingly",
      "The API key provides full access to the function — if compromised, an attacker can invoke the function directly bypassing the gateway",
      "Azure Functions have execution time limits (5 minutes default on Consumption plan) — long-running operations should use Durable Functions instead",
    ],
    examples: [
      {
        title: "Basic Azure Function",
        description: "Route API requests to an Azure Function with API key authentication",
        config: {
          function_uri: "https://my-function-app.azurewebsites.net/api/process-order",
          authorization: {
            apikey: "aGVsbG8td29ybGQtZnVuY3Rpb24ta2V5LWV4YW1wbGU=",
          },
          timeout: 10000,
          keepalive: true,
          ssl_verify: true,
        },
      },
      {
        title: "Azure Function with Extended Timeout",
        description: "Invoke a data-processing function that requires more time to complete",
        config: {
          function_uri: "https://analytics-functions.azurewebsites.net/api/generate-report",
          authorization: {
            apikey: "cmVwb3J0LWdlbmVyYXRvci1rZXktZXhhbXBsZQ==",
          },
          timeout: 60000,
          keepalive: true,
          ssl_verify: true,
        },
      },
    ],
    relatedPlugins: ["aws-lambda", "openwhisk", "serverless-pre-function"],
  },

  openwhisk: {
    overview:
      "Invokes Apache OpenWhisk serverless actions as the backend for API routes. OpenWhisk is an open-source, distributed serverless platform that executes functions in response to events. This plugin allows the gateway to trigger OpenWhisk actions by name, passing the request payload and returning the action result to the client, making it ideal for teams running self-hosted or IBM Cloud Functions-based serverless infrastructure.",
    useCases: [
      "Expose OpenWhisk actions as RESTful API endpoints through a centralized gateway",
      "Build serverless APIs on IBM Cloud Functions with enterprise-grade traffic management at the gateway layer",
      "Run a self-hosted serverless platform with OpenWhisk and manage all API access through the gateway",
      "Orchestrate multi-action workflows by chaining gateway routes to different OpenWhisk actions",
    ],
    bestPractices: [
      "Use the 'result' option set to true to return only the action result (not the full activation record) for cleaner API responses",
      "Keep service tokens secure and rotate them periodically — they grant invocation access to your OpenWhisk namespace",
      "Set appropriate timeouts based on your action's expected execution time — OpenWhisk actions have a default 60-second limit",
      "Enable ssl_verify when communicating with remote OpenWhisk deployments to ensure encrypted and authenticated connections",
    ],
    cautions: [
      "OpenWhisk cold starts can be significant depending on the runtime — Java and .NET runtimes are slower to initialize than Node.js or Python",
      "The service_token grants access to all actions in the namespace — use separate namespaces for different security domains",
      "If 'result' is set to false, the response will include OpenWhisk activation metadata which may expose internal infrastructure details",
    ],
    examples: [
      {
        title: "Basic OpenWhisk Action",
        description: "Invoke a serverless action and return only the result",
        config: {
          api_host: "https://openwhisk.example.com",
          service_token: "3a9e2b1c-7d4f-4e8a-b5c6-1f2e3d4a5b6c:mySecretPassphrase",
          namespace: "production",
          action: "process-payment",
          result: true,
          timeout: 15000,
          ssl_verify: true,
        },
      },
      {
        title: "IBM Cloud Functions",
        description: "Route to an action hosted on IBM Cloud Functions",
        config: {
          api_host: "https://us-south.functions.cloud.ibm.com",
          service_token: "iam-api-key:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          namespace: "my-org_my-space",
          action: "data-enrichment",
          result: true,
          timeout: 30000,
          ssl_verify: true,
        },
      },
    ],
    relatedPlugins: ["aws-lambda", "azure-functions", "serverless-pre-function"],
  },

  "serverless-pre-function": {
    overview:
      "Executes custom Lua code before the request is processed by other plugins in the pipeline. This gives you full programmatic control over request preprocessing — you can inspect and modify headers, rewrite URIs, implement custom authentication logic, make dynamic routing decisions, or inject metadata. The Lua functions run in the APISIX sandbox with access to the Nginx and APISIX APIs, making this one of the most powerful extensibility points available.",
    useCases: [
      "Implement custom authentication schemes that are not covered by built-in auth plugins",
      "Dynamically rewrite request URIs or headers based on business logic before routing",
      "Add request metadata or correlation IDs that downstream plugins and services depend on",
      "Perform request validation or transformation that is too complex for declarative plugin configuration",
    ],
    bestPractices: [
      "Keep Lua functions short and focused — complex logic should live in dedicated custom plugins, not inline code",
      "Use the 'rewrite' or 'access' phase for request modifications; use 'header_filter' or 'body_filter' only when you must modify the response",
      "Always handle errors gracefully with pcall() to prevent unhandled Lua errors from crashing the request pipeline",
      "Log sparingly in hot-path functions — excessive logging in the 'rewrite' phase can significantly impact throughput",
    ],
    cautions: [
      "Lua code runs with elevated privileges inside the gateway — a bug or infinite loop can block the entire worker process",
      "There is no syntax validation at configuration time — a Lua syntax error will only surface at request time and may cause 500 errors",
      "Inline Lua code is harder to version-control, test, and review than dedicated plugins — use this for quick fixes and prototyping, not permanent logic",
      "The 'body_filter' phase may be called multiple times for chunked responses — ensure your function handles partial data correctly",
    ],
    examples: [
      {
        title: "Add Correlation ID",
        description: "Inject a unique request ID header before processing if one is not already present",
        config: {
          phase: "rewrite",
          functions: [
            "return function(conf, ctx) local headers = ngx.req.get_headers(); if not headers['X-Correlation-ID'] then ngx.req.set_header('X-Correlation-ID', ngx.var.request_id) end end",
          ],
        },
      },
      {
        title: "Custom IP Allowlist with Dynamic Rules",
        description: "Check the client IP against a dynamically loaded allowlist before allowing access",
        config: {
          phase: "access",
          functions: [
            "return function(conf, ctx) local blocked_cidrs = {'10.0.0.0/8', '172.16.0.0/12'}; local ip = ngx.var.remote_addr; for _, cidr in ipairs(blocked_cidrs) do if ngx.re.match(ip, cidr) then ngx.exit(403) end end end",
          ],
        },
      },
    ],
    relatedPlugins: ["serverless-post-function", "ext-plugin-pre-req", "ext-plugin-post-resp"],
  },

  "serverless-post-function": {
    overview:
      "Executes custom Lua code after the request has been processed by other plugins and/or the upstream response has been received. This plugin is the counterpart to serverless-pre-function and is ideal for response modification, custom logging, cleanup tasks, or injecting response headers. Like its counterpart, the Lua functions run in the APISIX sandbox with full access to the Nginx and APISIX APIs.",
    useCases: [
      "Add custom response headers (e.g., cache status, processing time, server version) after upstream processing",
      "Implement custom access logging with business-specific fields that the built-in logging plugins don't support",
      "Perform cleanup or notification tasks after a response has been sent to the client",
      "Modify or redact sensitive data from upstream responses before they reach the client",
    ],
    bestPractices: [
      "Use the 'header_filter' phase to modify response headers and the 'body_filter' phase for response body changes",
      "For logging-only logic, use the 'log' phase to avoid adding latency to the response path",
      "Keep body_filter functions idempotent — they may be invoked multiple times for chunked transfer encoding",
      "Test your Lua code thoroughly in a staging environment before deploying to production — runtime errors can break responses",
    ],
    cautions: [
      "Modifying the response body in the 'body_filter' phase requires careful handling of chunked responses — the function is called for each chunk",
      "Errors in post-functions can corrupt responses that have already started streaming to the client",
      "The 'log' phase runs after the response is sent — you cannot modify the response in this phase, only perform side effects",
      "Inline Lua code is not covered by standard CI/CD pipelines — establish a review process for any production Lua snippets",
    ],
    examples: [
      {
        title: "Add Processing Time Header",
        description: "Inject a header with the total gateway processing time into every response",
        config: {
          phase: "header_filter",
          functions: [
            "return function(conf, ctx) local start = ctx.var.request_time or 0; ngx.header['X-Gateway-Time'] = tostring(ngx.now() - ngx.req.start_time()) .. 's' end",
          ],
        },
      },
      {
        title: "Custom Access Log",
        description: "Log request metadata to a custom destination after the response is sent",
        config: {
          phase: "log",
          functions: [
            "return function(conf, ctx) local log_data = {method = ngx.req.get_method(), uri = ngx.var.uri, status = ngx.status, latency = ngx.var.request_time}; ngx.log(ngx.NOTICE, require('cjson').encode(log_data)) end",
          ],
        },
      },
    ],
    relatedPlugins: ["serverless-pre-function", "ext-plugin-pre-req", "ext-plugin-post-resp"],
  },

  // ─── External Plugins (Runner) ────────────────────────────────

  "ext-plugin-pre-req": {
    overview:
      "External Plugin Pre-Request sends the request to an external plugin runner process (written in Python, Java, Go, or any language) before it reaches the upstream. The runner can inspect and modify the request, implement custom logic, and return the modified request back to the gateway. This enables writing gateway plugins in languages other than Lua.",
    useCases: [
      "Implement complex request processing logic in Python, Java, or Go instead of Lua",
      "Integrate ML models or AI services for request classification or content analysis before routing",
      "Reuse existing business logic libraries that are available in your team's primary language",
      "Build custom authentication or authorization that requires calling external services or databases",
    ],
    bestPractices: [
      "Deploy the plugin runner as a sidecar on the same host to minimize network latency",
      "Use Unix domain sockets instead of TCP for runner communication to reduce overhead",
      "Implement timeouts in your runner to prevent slow processing from blocking the gateway",
      "Keep the runner stateless for horizontal scaling — store state in external stores like Redis",
    ],
    cautions: [
      "Every request incurs IPC overhead to communicate with the runner process — this adds latency compared to native Lua plugins",
      "The runner must be highly available — if it crashes, requests will fail or timeout",
      "Debugging is harder since the plugin logic runs in a separate process from the gateway",
      "The runner protocol has serialization overhead for request/response data transfer",
    ],
    examples: [
      {
        title: "Python Plugin Runner",
        description: "Send requests to a Python-based plugin runner for custom processing",
        config: {
          conf: [{ name: "my-python-plugin", value: "{\"threshold\": 100}" }],
        },
      },
    ],
    relatedPlugins: ["ext-plugin-post-req", "ext-plugin-post-resp", "serverless-pre-function"],
  },

  "ext-plugin-post-req": {
    overview:
      "External Plugin Post-Request sends the request to an external plugin runner after the request phase plugins have executed but before the request is forwarded to the upstream. This allows external plugins to make final modifications based on the context established by earlier plugins (e.g., after authentication has identified the consumer).",
    useCases: [
      "Apply custom transformation logic after authentication has identified the consumer",
      "Enrich the request with data from external services based on the authenticated user",
      "Implement custom routing decisions that depend on the full plugin pipeline context",
      "Run post-auth business rules that need access to consumer metadata set by auth plugins",
    ],
    bestPractices: [
      "Use this instead of ext-plugin-pre-req when your logic depends on auth plugin results",
      "Keep processing lightweight to avoid adding excessive latency after the auth phase",
      "Log runner errors and set up alerting to detect runner process failures quickly",
    ],
    cautions: [
      "Same IPC overhead as ext-plugin-pre-req — adds latency to every request",
      "Runs after auth but before upstream — errors here will prevent the request from reaching upstream",
      "Runner must handle concurrent requests efficiently as the gateway processes requests in parallel",
    ],
    examples: [
      {
        title: "Post-Auth Enrichment",
        description: "Enrich requests with consumer-specific data after authentication",
        config: {
          conf: [{ name: "request-enricher", value: "{\"add_consumer_metadata\": true}" }],
        },
      },
    ],
    relatedPlugins: ["ext-plugin-pre-req", "ext-plugin-post-resp", "serverless-post-function"],
  },

  "ext-plugin-post-resp": {
    overview:
      "External Plugin Post-Response sends the upstream response to an external plugin runner before returning it to the client. The runner can inspect and modify the response headers, body, and status code. This is useful for response transformation, content filtering, or custom logging that requires processing in a language other than Lua.",
    useCases: [
      "Filter or redact sensitive data from upstream responses using a Python or Java library",
      "Transform response formats (e.g., XML to JSON) using mature libraries in your preferred language",
      "Implement custom response caching logic that integrates with your existing cache infrastructure",
      "Enrich responses with additional data from external services before returning to the client",
    ],
    bestPractices: [
      "Process responses in streaming mode when possible to avoid buffering large response bodies in memory",
      "Set strict timeouts for runner processing to prevent slow responses from hanging client connections",
      "Use this sparingly — response modification adds latency that directly impacts user experience",
    ],
    cautions: [
      "The entire response body may need to be buffered in memory for the runner to process it — watch for memory issues with large responses",
      "Adds latency to every response — the client waits while the runner processes the response",
      "If the runner fails, the gateway must decide whether to return the original response or an error — plan your error strategy",
      "Streaming responses cannot be modified after they start being sent to the client",
    ],
    examples: [
      {
        title: "Response Content Filter",
        description: "Send responses through an external content filter for PII redaction",
        config: {
          conf: [{ name: "pii-filter", value: "{\"scan_fields\": [\"email\", \"phone\", \"ssn\"]}" }],
        },
      },
    ],
    relatedPlugins: ["ext-plugin-pre-req", "ext-plugin-post-req", "serverless-post-function"],
  },

  // ─── Utility ──────────────────────────────────────────────────

  inspect: {
    overview:
      "Inspect is a debugging plugin that dumps the full request and response context at a specific phase in the plugin pipeline. It outputs detailed information about headers, body, URI, upstream selection, and plugin chain state to the gateway error log. This is invaluable for troubleshooting complex plugin interactions.",
    useCases: [
      "Debug unexpected behavior in a plugin chain by inspecting the request state at each phase",
      "Verify that authentication plugins correctly set consumer metadata before downstream plugins execute",
      "Troubleshoot proxy-rewrite or body-transformer by checking intermediate request state",
      "Diagnose routing issues by examining the selected upstream and route context",
    ],
    bestPractices: [
      "Only enable on specific routes during active debugging — never leave it enabled in production",
      "Check the gateway error log (not access log) for the inspect output",
      "Use in combination with a specific route filter to limit log volume",
      "Remove the plugin as soon as debugging is complete to avoid log pollution",
    ],
    cautions: [
      "Outputs sensitive data (headers, tokens, request bodies) to the error log — ensure logs are secured",
      "Generates significant log volume under traffic — enable only on low-traffic routes or specific requests",
      "May slightly increase latency as it serializes the full request/response context",
    ],
    examples: [
      {
        title: "Inspect Request Phase",
        description: "Dump request context to error log for debugging",
        config: {},
      },
    ],
    relatedPlugins: ["echo", "serverless-pre-function", "node-status"],
  },

  "example-plugin": {
    overview:
      "Example Plugin is a reference implementation included with the API Gateway that demonstrates the plugin development pattern. It serves as a template and learning tool for developers who want to create custom plugins. In practice, it simply passes requests through without modification.",
    useCases: [
      "Use as a starting template when developing a new custom Lua plugin",
      "Study the plugin lifecycle phases (rewrite, access, header_filter, body_filter, log)",
      "Test plugin configuration mechanics without any side effects",
      "Verify that the plugin loading infrastructure is working correctly",
    ],
    bestPractices: [
      "Do not enable in production — it serves no functional purpose beyond being a reference",
      "Copy and rename it as the starting point for your custom plugin development",
      "Read its source code alongside the plugin development documentation",
    ],
    cautions: [
      "This plugin has no functional behavior — enabling it has no effect on traffic",
      "Do not modify the original example-plugin — copy it to create new plugins",
    ],
    examples: [
      {
        title: "Enable Example Plugin",
        description: "Load the example plugin (no-op, for reference only)",
        config: {},
      },
    ],
    relatedPlugins: ["serverless-pre-function", "serverless-post-function"],
  },

  "public-api": {
    overview:
      "Public API exposes an internal plugin's API endpoint as a public route on the gateway. Some plugins (like batch-requests or jwt-auth) have internal endpoints that are not accessible by default. This plugin allows you to create a route that forwards to those internal plugin APIs, making them available to external clients.",
    useCases: [
      "Expose the batch-requests endpoint so clients can send batch API calls",
      "Make the jwt-auth token signing endpoint available for clients to obtain tokens",
      "Expose plugin health check or status endpoints to external monitoring systems",
      "Create public access to internal plugin APIs that need to be called directly by clients",
    ],
    bestPractices: [
      "Always protect public-api routes with authentication — exposing internal APIs without auth is a security risk",
      "Only expose the specific plugin APIs that clients genuinely need access to",
      "Use IP restriction in addition to authentication to limit access to known clients",
      "Document which internal APIs you expose so other teams know they are available",
    ],
    cautions: [
      "Exposing internal plugin APIs increases your attack surface — carefully evaluate what you make public",
      "Some internal APIs may return sensitive information about gateway configuration or state",
      "The plugin URI must match exactly the internal API path — mismatches will return 404",
      "Without proper auth, anyone can call the exposed internal API",
    ],
    examples: [
      {
        title: "Expose Batch Requests API",
        description: "Make the batch-requests pipeline endpoint publicly accessible",
        config: { uri: "/apisix/batch-requests" },
      },
      {
        title: "Expose JWT Sign Endpoint",
        description: "Allow clients to request JWT tokens via a public route",
        config: { uri: "/apisix/plugin/jwt/sign" },
      },
    ],
    relatedPlugins: ["batch-requests", "jwt-auth"],
  },
}
