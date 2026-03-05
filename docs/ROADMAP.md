# FuseOne API Gateway -- Implementation Roadmap

> Last updated: 2026-03-03

## Vision

Transform FuseOne from an APISIX dashboard into a **full-lifecycle API management platform** that competes with Sensedia, Gravitee, and Kong Enterprise on features while remaining open-source and APISIX-native.

---

## Phase 0 -- Foundation ✅

### Completed
- [x] API CRUD with visual flow editor (routes, policies, upstream)
- [x] Policy gallery with categorized plugins and documentation
- [x] Policy templates (save/apply/reuse across APIs)
- [x] API lifecycle management (draft → active → deprecated → retired)
- [x] API versioning with clone capability
- [x] Context path + virtual host routing
- [x] Applications & Plans (consumer management with credentials)
- [x] Global Policies
- [x] SSL/Certificate management (including mTLS)
- [x] Stream Routes (TCP/UDP proxy)
- [x] Policy Catalog with detailed documentation per plugin
- [x] Session persistence (draft recovery on refresh)
- [x] RBAC with JWT auth
- [x] Audit logging
- [x] User management (CRUD, invitations, role assignment)
- [x] Role & permissions management (custom roles, RBAC)
- [x] OAuth/SSO authentication (Google, Microsoft, GitHub, Okta, Generic OIDC)
- [x] Settings: General, Gateway Connection, Notifications, Environments
- [x] Subscriptions management (approve/reject/suspend/revoke)

---

## Phase 1 -- Troubleshooting & Observability ✅

**Goal**: Match Sensedia's troubleshooting experience. This is the #1 competitive gap.

### 1.1 Log Collection Infrastructure
- [x] Create `debug_logs` PostgreSQL table with TTL (auto-delete after 48h)
- [x] Backend handler: `POST /internal/debug-logs` to receive `http-logger` batches from APISIX
- [x] Backend API: `GET /api/debug/logs?route_id=X&status=5xx&limit=50`
- [x] SSE endpoint: `GET /api/debug/logs/stream` for real-time feed
- [x] Configure APISIX `http-logger` plugin pointing to our backend

### 1.2 Debug Toggle Per-Route
- [x] UI toggle button on each API/route: "Enable Debug"
- [x] When ON: PATCH route in APISIX to add `http-logger` with `include_req_body` + `include_resp_body`
- [x] Conditional body capture using `X-FuseOne-Debug` header expression
- [x] When OFF: remove debug logger from route
- [x] Visual indicator in sidebar/flow when debug is active

### 1.3 Live Traffic Feed
- [x] Real-time traffic table: Time | Method | Path | Status | Latency | [View]
- [x] Filters: route, status code range, method, latency threshold, text search
- [x] Color-coded status (green 2xx, yellow 3xx, red 4xx/5xx)
- [x] Auto-scroll with pause capability

### 1.4 Request Detail View
- [x] Headers tab: request + response headers in formatted table
- [x] Body tab: syntax-highlighted JSON/XML with copy button
- [x] Timing waterfall: `|== APISIX (Xms) ==|==== Upstream (Yms) ====|`
- [x] Plugins executed list (from `Apisix-Plugins` debug header)
- [x] cURL export button (reproduce the request)

### 1.5 Prometheus Metrics Dashboard
- [x] Backend scraper for `http://apisix:9091/apisix/prometheus/metrics`
- [x] Parse Prometheus exposition format → JSON API
- [x] Latency charts: p50, p95, p99 per route (from `apisix_http_latency`)
- [x] Error rate chart: 4xx/5xx over time (from `apisix_http_status`)
- [x] Requests/sec chart (from `apisix_http_requests_total`)
- [x] Bandwidth chart: ingress/egress (from `apisix_bandwidth`)

### 1.6 Upstream Health Monitor
- [x] Proxy APISIX Control API `GET :9090/v1/healthcheck`
- [x] Display upstream nodes with health status (green/red)
- [x] Success/failure counters per node
- [x] Last check timestamp
- [x] Auto-refresh every 10 seconds

---

## Phase 2 -- Custom Plugins ✅

**Goal**: Build essential custom APISIX plugins that close critical gaps vs Gravitee/Sensedia.

### 2.1 Plugin Infrastructure
- [x] Create `custom-plugins/` directory in repo root
- [x] Update `docker-compose.yml` to volume-mount `custom-plugins:/opt/custom-plugins:ro`
- [x] Update `apisix-config.yaml` with `extra_lua_path: "/opt/custom-plugins/?.lua"`
- [x] Pre-register all custom plugin names in `config.yaml` `plugins` list
- [x] Add hot-reload endpoint in Go backend: `POST /api/admin/plugins/reload`
- [x] Create `Dockerfile.apisix` for production builds with baked-in plugins
- [x] Document plugin development workflow in `docs/CUSTOM-PLUGINS.md`

### 2.2 HTTP Callout Plugin (`http-callout`)
- [x] Lua plugin: make HTTP(S) calls to external services during request processing
- [x] Configuration: url, method, headers, body (with variable substitution)
- [x] Response handling: extract fields via JSONPath, inject into headers/context
- [x] Error handling: exit_on_error, error_status, fallback behavior
- [x] Fire-and-forget mode for async notifications
- [x] Timeout configuration with sensible defaults (3s)
- [x] Register in FuseOne UI policy gallery under "Transformation" category
- [x] Write plugin documentation with use case examples

### 2.3 Data Masking Plugin (`data-masking`)
- [x] Lua plugin: redact sensitive fields in response bodies
- [x] Configuration: JSONPath patterns to mask (e.g., `$.cpf`, `$.credit_card`)
- [x] Masking strategies: full redact (`***`), partial (`***1234`), hash (SHA-256)
- [x] Configurable per content-type (JSON, XML)
- [x] Works on response phase (before sending to client)
- [x] LGPD/GDPR compliance focus
- [x] Register in FuseOne UI policy gallery under "Security" category

### 2.4 Threat Protection Plugin (`threat-protection`)
- [x] Lua plugin: protect against payload-based attacks
- [x] JSON protection: max depth, max array size, max string length, max object entries
- [x] Injection detection: SQL injection patterns, XSS patterns in body
- [x] Request size limits (beyond what `client-control` offers)
- [x] Configurable action: reject (403) or sanitize
- [x] Register in FuseOne UI policy gallery under "Security" category

---

## Phase 3 -- Analytics & Monitoring ✅

**Goal**: Built-in analytics without requiring external Grafana.

### 3.1 Analytics Dashboard
- [x] Overview page: total requests, avg latency, error rate, top APIs
- [x] Per-API analytics: traffic, latency percentiles, error breakdown
- [x] Per-Application analytics: usage by consumer/app
- [x] Time range selector: 1h, 6h, 24h, 7d, 30d, custom
- [x] Charts: line (time-series), bar (top-N), pie (status distribution)

### 3.2 Alerting System
- [x] Configurable alert rules: error rate > X%, latency p99 > Yms, traffic drop > Z%
- [x] Alert channels: email, webhook (Slack/Discord/Teams)
- [x] Alert history with acknowledgment
- [x] Per-API or global alert scope

### 3.3 API Usage Reports
- [x] Exportable reports (CSV, PDF) for billing/governance
- [x] Per-application usage breakdown
- [x] Plan quota usage tracking
- [x] Historical trend analysis

---

## Phase 4 -- Multi-Environment & Governance ✅

**Goal**: Support enterprise deployment workflows.

### 4.1 Environment Management
- [x] Define environments: development, staging, production (configurable)
- [x] Each environment points to a different APISIX cluster
- [x] API configurations stored per-environment in PostgreSQL
- [x] Environment switcher in the dashboard header

### 4.2 Promotion Workflows
- [x] Promote API configuration from env A → env B
- [x] Diff view before promotion (what will change)
- [x] Approval workflow: request → review → approve/reject
- [x] Audit trail for all promotions
- [x] Rollback capability

### 4.3 API Revision Diff
- [x] Side-by-side diff of API configurations between versions
- [x] Highlight changes: added/removed/modified policies, routes, upstream config
- [x] One-click rollback to any previous revision

---

## Phase 5 -- Developer Portal ✅

**Goal**: Self-service portal for API consumers. Separate frontend application.

> See [ROADMAP-DEVELOPER-PORTAL.md](./ROADMAP-DEVELOPER-PORTAL.md) for detailed plan.

### Key Features
- [x] Landing page with modern design
- [x] API catalog with search and filtering
- [x] Interactive API documentation (OpenAPI rendering + try-it)
- [x] Developer self-registration
- [x] API subscription with plan selection
- [x] Credential management (API keys)
- [x] Developer usage dashboard
- [x] Admin portal visibility toggle + spec upload

---

## Phase 6 -- Advanced Features ✅

**Goal**: Differentiation features with rich custom editors in the flow editor.

### 6.1 API Composition / Orchestration
- [x] Visual editor to call multiple backends from a single endpoint
- [x] Response aggregation with field mapping
- [x] Parallel and sequential call patterns
- [x] Custom `api-composition.lua` APISIX plugin with SSRF protection

### 6.2 Custom Scripting IDE
- [x] In-browser Lua editor for `serverless-pre-function` / `serverless-post-function`
- [x] Syntax highlighting, autocompletion (CodeMirror 6)
- [x] Phase selector (rewrite, access, header_filter, body_filter, log, before_proxy)
- [x] Script library with 12 pre-built Lua snippets

### 6.3 API Mocking (Polished)
- [x] Visual mock response builder with multiple profiles
- [x] Dynamic responses based on request parameters
- [x] Integrated into API design workflow (mock before backend is ready)
- [x] Response headers editor, delay slider, format button

### 6.4 REST-to-SOAP Templates
- [x] Pre-built body-transformer templates for SOAP integration (5 templates)
- [x] Visual SOAP envelope builder with live preview
- [x] WSDL import with operation extraction

---

## Phase 7 -- AI Gateway ✅

**Goal**: First-class AI/LLM gateway capabilities with visual editors, token tracking, and cost management.

### 7.1 LLM Routing
- [x] Rich visual editor for `ai-proxy` plugin (provider cards, model picker, auth, streaming)
- [x] Rich visual editor for `ai-proxy-multi` plugin (instance list, weight sliders, fallback strategies)
- [x] Multi-model routing (OpenAI, Anthropic, Gemini, DeepSeek, Ollama, etc.)
- [x] Fallback chains between providers (health-based, HTTP 429, HTTP 5xx)
- [x] Cost-based routing via weighted balancing

### 7.2 Prompt Guard Rails
- [x] Plugin documentation for `ai-prompt-guard` (input validation, prompt injection detection)
- [x] Plugin documentation for `ai-aws-content-moderation` (output filtering via AWS Comprehend)
- [x] Plugin documentation for `ai-request-rewrite` (request transformation via LLM)
- [x] All 7 AI plugins documented with best practices, use cases, and examples

### 7.3 Token Tracking & Cost Management
- [x] Database schema for multi-resolution AI token metrics (1m, 1h, 1d rollup)
- [x] AI metrics scraper consuming APISIX Prometheus metrics (`apisix_ai_llm_*`)
- [x] AI Dashboard page with token/cost charts, top providers, top models
- [x] Configurable cost models per provider/model ($/1K tokens)
- [x] Token budget and cost budget alert rule types
- [x] Per-route and per-consumer token tracking

### 7.4 RAG Integration
- [x] Plugin documentation for `ai-rag` (vector DB context injection)
- [x] Plugin documentation for `ai-rate-limiting` (token-based rate limiting)

---

## Phase 8 -- GraphQL Gateway ✅

**Goal**: First-class GraphQL API management leveraging APISIX's native GraphQL routing engine.

> APISIX has built-in GraphQL-aware routing (`graphql_operation`, `graphql_name`, `graphql_root_fields`) and a `degraphql` plugin. This phase exposes these capabilities through the FuseOne UI and adds governance features via custom plugins.

### 8.1 GraphQL-Aware Routing
- [x] Flow editor: GraphQL match conditions (operation type, operation name, root fields)
- [x] Visual route builder: route queries vs mutations to different upstreams (read replicas vs primary)
- [x] Per-operation policy assignment (different rate limits for queries vs mutations)
- [x] GraphQL introspection toggle (block in production, allow in dev)

### 8.2 REST-to-GraphQL Bridge
- [x] Visual configurator for `degraphql` plugin (convert REST endpoints into GraphQL queries)
- [x] Variable mapping UI: map query params / JSON body fields → GraphQL variables
- [x] Template library with common GraphQL patterns (CRUD, pagination, filtering)
- [x] Response transformation: extract nested GraphQL data into flat REST responses

### 8.3 GraphQL Security & Governance (Custom Plugins)
- [x] Custom Lua plugin: `graphql-depth-limit` — reject queries exceeding max nesting depth
- [x] Custom Lua plugin: `graphql-complexity` — cost-based analysis with field weights
- [x] Custom Lua plugin: `graphql-allowlist` — persisted queries / query allowlisting
- [x] Custom Lua plugin: `graphql-introspection-guard` — block introspection in production

### 8.4 GraphQL Documentation
- [x] Full PT-BR documentation (5 articles) covering GraphQL routing, security, and degraphql
- [x] Plugin documentation for all 5 GraphQL plugins with examples and best practices

---

## Phase 9 -- Event-Native APIs (Kafka Gateway) ✅

**Goal**: Expose Kafka topics as managed REST APIs, similar to Gravitee's event-native gateway. Bridge the gap between synchronous HTTP and asynchronous event streaming.

> APISIX has `kafka-proxy` (wire protocol), PubSub (WebSocket consume), and `kafka-logger`. For full REST↔Kafka mediation, we use Strimzi KafkaBridge as upstream + custom Lua plugins.

### 9.1 Kafka Bridge Infrastructure
- [x] Docker Compose integration: Zookeeper + Kafka + Strimzi KafkaBridge (profiles: kafka)
- [x] Connection management UI: configure Kafka clusters (brokers, SASL, TLS, bridge URL)
- [x] Topic browser: list topics, partitions, consumer groups from FuseOne UI
- [x] PostgreSQL migration for `kafka_connections` table

### 9.2 REST-to-Kafka API
- [x] Backend: KafkaBridge HTTP client (ListTopics, GetTopic, Produce, Consume, ConsumerGroups)
- [x] Backend: Kafka handler with 9 REST endpoints under `/api/kafka/`
- [x] Frontend: Kafka dashboard with connections, topic browser, produce/consume
- [x] Frontend: 4 pages (dashboard, connections, topics list, topic detail)

### 9.3 Documentation
- [x] Full PT-BR documentation (5 articles) covering Kafka infrastructure, topics, and event APIs

### Deferred to Future Iteration
- [ ] Schema validation (Avro/JSON Schema) on produce
- [ ] Dead letter queue routing (custom Lua plugin)
- [ ] WebSocket streaming via APISIX PubSub
- [ ] Per-topic rate limiting and message transformation policies

---

## Phase 10 -- API Monetization

**Goal**: Built-in billing and monetization for API products, enabling API-as-a-product business models.

### 10.1 Billing Plans
- [ ] Plan tiers: Free, Developer, Business, Enterprise (configurable)
- [ ] Pricing models: flat rate, per-request, tiered (volume brackets), pay-as-you-go
- [ ] Quota management: requests/month, bandwidth/month, with overage policies
- [ ] Trial periods with automatic expiration
- [ ] Custom plan creation per API product

### 10.2 Usage Metering
- [ ] Real-time usage tracking per application/consumer
- [ ] Metering dimensions: requests, bandwidth, compute time, tokens (AI)
- [ ] Usage dashboard for API consumers (in Developer Portal)
- [ ] Quota warnings at 80%/90%/100% thresholds
- [ ] Overage handling: block, throttle, or allow with surcharge

### 10.3 Payment Integration
- [ ] Stripe integration: subscriptions, invoicing, payment methods
- [ ] Invoice generation: monthly/quarterly billing cycles
- [ ] Revenue dashboard: MRR, churn, ARPU, revenue per API
- [ ] Webhook notifications for payment events (success, failure, churn)
- [ ] Self-service plan upgrade/downgrade in Developer Portal

### 10.4 Cost Allocation
- [ ] Internal chargeback: allocate API costs to teams/departments
- [ ] Cost reports per API, per consumer, per environment
- [ ] Budget alerts: notify when projected costs exceed thresholds
- [ ] Export to CSV/PDF for finance teams

---

## Phase 11 -- API Testing & Quality ✅

**Goal**: Automated API quality assurance with contract testing, synthetic monitoring, and SLA tracking.

### 11.1 Test Suites & Contract Testing
- [x] Test suite CRUD with multi-step test scenarios (HTTP requests, assertions)
- [x] Assertion builder: status code, response time, body JSONPath, header checks
- [x] OpenAPI contract testing: validate responses against spec
- [x] Test executor service with step-by-step results
- [x] Test run history with pass/fail tracking
- [x] Visual test step editor in frontend

### 11.2 Synthetic Monitoring
- [x] Synthetic monitors: scheduled test suite execution at configurable intervals
- [x] Uptime tracking with historical availability percentage
- [x] Background runner service (goroutine) for active monitors
- [x] Uptime sparklines in monitoring UI
- [x] Alert integration on synthetic test failures

### 11.3 SLA Management
- [x] SLA definition CRUD: availability %, latency p99, error rate targets
- [x] SLA evaluator service: background compliance calculation from metrics
- [x] SLA dashboard with circular gauge components (compliance %)
- [x] Error budget tracking and burn-rate indicators

### 11.4 Frontend
- [x] Testing dashboard with overview, suites, monitors, and SLA tabs
- [x] Test step editor component with assertion builder
- [x] SLA gauge component for visual compliance display

### Deferred to Future Iteration
- [ ] Load testing (k6 integration) with scenario builder
- [ ] Performance baseline capture and regression detection
- [ ] Breaking change detection on deployment

---

## Phase 12 -- Service Mesh Integration ✅

**Goal**: Extend FuseOne from north-south API gateway to include east-west service mesh observability.

### 12.1 Service Discovery & Topology
- [x] Backend: Mesh service aggregating upstreams with `discovery_type`, health data, and dependency graph
- [x] Backend: APISIX Control API integration (`/v1/discovery/{type}/dump`, health checks)
- [x] Backend: 5 mesh endpoints under `/api/mesh/` (services, nodes, topology, discovery-status, health)
- [x] Frontend: Service mesh dashboard with overview, discovery types, and health status
- [x] Frontend: Interactive topology graph (@xyflow/react) for service dependency visualization
- [x] Frontend: Per-service detail page with nodes, routes, and health indicators

### 12.2 Traffic Management & mTLS
- [x] Frontend: Traffic policies page (canary, circuit breaker, retries configuration)
- [x] Frontend: mTLS management page for service-to-service certificate management

### 12.3 Documentation
- [x] Full PT-BR documentation (3 articles) covering mesh concepts, topology, and mTLS

### Deferred to Future Iteration
- [ ] Distributed tracing viewer (Jaeger/Zipkin trace correlation)
- [ ] Cross-service latency/error overlay on topology graph
- [ ] Zero-trust policy editor with fine-grained service access rules

---

## Phase 13 -- Marketplace & Extensibility

**Goal**: Plugin marketplace and community extensibility ecosystem.

### 13.1 Plugin Marketplace
- [ ] Community plugin registry: browse, search, install custom plugins
- [ ] Plugin packaging standard: metadata, schema, Lua code, documentation
- [ ] One-click install: upload plugin → register in APISIX → available in flow editor
- [ ] Version management: update, rollback, dependency tracking
- [ ] Rating & reviews system

### 13.2 API Templates
- [ ] Shareable API templates: pre-configured route + policies + upstream patterns
- [ ] Template gallery: REST CRUD, GraphQL proxy, gRPC gateway, Kafka bridge, etc.
- [ ] Import/export: share templates across FuseOne instances
- [ ] Community-contributed templates

### 13.3 Webhook & Integration Platform
- [ ] Outbound webhook system: trigger on API events (deploy, error spike, SLA breach)
- [ ] Pre-built integrations: PagerDuty, Datadog, New Relic, OpsGenie
- [ ] Custom integration builder: define trigger → transform → deliver pipelines
- [ ] Integration marketplace: community-built connectors

### 13.4 SDK & CLI
- [ ] FuseOne CLI: manage APIs, deploy, promote from terminal
- [ ] Terraform provider: infrastructure-as-code for API definitions
- [ ] REST Admin API documentation (OpenAPI spec for FuseOne itself)
- [ ] Client SDKs: generate typed API clients from OpenAPI specs

---

## Priority Summary

| Phase | Focus | Status | Business Impact |
|---|---|---|---|
| **Phase 0** | Foundation | ✅ Complete | Core platform |
| **Phase 1** | Troubleshooting & Observability | ✅ Complete | Eliminates #1 competitive gap |
| **Phase 2** | Custom Plugins (Callout, Masking, Threat) | ✅ Complete | Enables enterprise patterns |
| **Phase 3** | Analytics & Monitoring | ✅ Complete | Self-contained, no Grafana needed |
| **Phase 4** | Multi-Environment & Governance | ✅ Complete | Enterprise deployment workflows |
| **Phase 5** | Developer Portal | ✅ Complete | Required for external API programs |
| **Phase 6** | Advanced Features | ✅ Complete | Differentiation & polish |
| **Phase 7** | AI Gateway | ✅ Complete | Next-gen AI/LLM capabilities |
| **Phase 8** | GraphQL Gateway | ✅ Complete | GraphQL-native API management |
| **Phase 9** | Event-Native APIs (Kafka) | ✅ Complete | Async/event-driven API products |
| **Phase 10** | API Monetization | Pending | API-as-a-product business model |
| **Phase 11** | API Testing & Quality | ✅ Complete | Automated quality assurance |
| **Phase 12** | Service Mesh Integration | ✅ Complete | East-west traffic management |
| **Phase 13** | Marketplace & Extensibility | Pending | Community ecosystem |
