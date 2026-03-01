# FuseOne API Gateway -- Implementation Roadmap

> Last updated: 2026-03-01

## Vision

Transform FuseOne from an APISIX dashboard into a **full-lifecycle API management platform** that competes with Sensedia, Gravitee, and Kong Enterprise on features while remaining open-source and APISIX-native.

---

## Phase 0 -- Foundation (Current State)

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

---

## Phase 1 -- Troubleshooting & Observability (P0)

**Goal**: Match Sensedia's troubleshooting experience. This is the #1 competitive gap.

**Timeline**: 4-6 weeks

### 1.1 Log Collection Infrastructure
- [ ] Create `debug_logs` PostgreSQL table with TTL (auto-delete after 48h)
- [ ] Backend handler: `POST /internal/debug-logs` to receive `http-logger` batches from APISIX
- [ ] Backend API: `GET /api/debug/logs?route_id=X&status=5xx&limit=50`
- [ ] SSE endpoint: `GET /api/debug/logs/stream` for real-time feed
- [ ] Configure APISIX `http-logger` plugin pointing to our backend

### 1.2 Debug Toggle Per-Route
- [ ] UI toggle button on each API/route: "Enable Debug"
- [ ] When ON: PATCH route in APISIX to add `http-logger` with `include_req_body` + `include_resp_body`
- [ ] Conditional body capture using `X-FuseOne-Debug` header expression
- [ ] When OFF: remove debug logger from route
- [ ] Visual indicator in sidebar/flow when debug is active

### 1.3 Live Traffic Feed
- [ ] Real-time traffic table: Time | Method | Path | Status | Latency | [View]
- [ ] Filters: route, status code range, method, latency threshold, text search
- [ ] Color-coded status (green 2xx, yellow 3xx, red 4xx/5xx)
- [ ] Auto-scroll with pause capability

### 1.4 Request Detail View
- [ ] Headers tab: request + response headers in formatted table
- [ ] Body tab: syntax-highlighted JSON/XML with copy button
- [ ] Timing waterfall: `|== APISIX (Xms) ==|==== Upstream (Yms) ====|`
- [ ] Plugins executed list (from `Apisix-Plugins` debug header)
- [ ] cURL export button (reproduce the request)

### 1.5 Prometheus Metrics Dashboard
- [ ] Backend scraper for `http://apisix:9091/apisix/prometheus/metrics`
- [ ] Parse Prometheus exposition format → JSON API
- [ ] Latency charts: p50, p95, p99 per route (from `apisix_http_latency`)
- [ ] Error rate chart: 4xx/5xx over time (from `apisix_http_status`)
- [ ] Requests/sec chart (from `apisix_http_requests_total`)
- [ ] Bandwidth chart: ingress/egress (from `apisix_bandwidth`)

### 1.6 Upstream Health Monitor
- [ ] Proxy APISIX Control API `GET :9090/v1/healthcheck`
- [ ] Display upstream nodes with health status (green/red)
- [ ] Success/failure counters per node
- [ ] Last check timestamp
- [ ] Auto-refresh every 10 seconds

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    FuseOne Dashboard                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Traffic Feed │  │ Request View │  │ Metrics Charts    │  │
│  │ (SSE)        │  │ (Detail)     │  │ (Prometheus)      │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘  │
│         │                 │                   │             │
│  ┌──────┴─────────────────┴───────────────────┴──────────┐  │
│  │              Go Backend API                           │  │
│  │  /api/debug/logs  /api/debug/stream  /api/metrics     │  │
│  └──────┬─────────────────┬─────────────────┬────────────┘  │
│         │                 │                 │               │
│  ┌──────┴──────┐  ┌───────┴───────┐  ┌──────┴──────────┐    │
│  │ PostgreSQL  │  │ APISIX        │  │ APISIX          │    │
│  │ debug_logs  │  │ Control API   │  │ Prometheus      │    │
│  │ (TTL 48h)   │  │ :9090         │  │ :9091           │    │
│  └─────────────┘  └───────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────┘

APISIX ──http-logger──► Go Backend POST /internal/debug-logs
```

---

## Phase 2 -- Custom Plugins (P1)

**Goal**: Build essential custom APISIX plugins that close critical gaps vs Gravitee/Sensedia.

**Timeline**: 3-4 weeks

### 2.1 Plugin Infrastructure
- [ ] Create `custom-plugins/` directory in repo root
- [ ] Update `docker-compose.yml` to volume-mount `custom-plugins:/opt/custom-plugins:ro`
- [ ] Update `apisix-config.yaml` with `extra_lua_path: "/opt/custom-plugins/?.lua"`
- [ ] Pre-register all custom plugin names in `config.yaml` `plugins` list
- [ ] Add hot-reload endpoint in Go backend: `POST /api/admin/plugins/reload`
- [ ] Create `Dockerfile.apisix` for production builds with baked-in plugins
- [ ] Document plugin development workflow in `docs/CUSTOM-PLUGINS.md`

### 2.2 HTTP Callout Plugin (`http-callout`)
- [ ] Lua plugin: make HTTP(S) calls to external services during request processing
- [ ] Configuration: url, method, headers, body (with variable substitution)
- [ ] Response handling: extract fields via JSONPath, inject into headers/context
- [ ] Error handling: exit_on_error, error_status, fallback behavior
- [ ] Fire-and-forget mode for async notifications
- [ ] Timeout configuration with sensible defaults (3s)
- [ ] Register in FuseOne UI policy gallery under "Transformation" category
- [ ] Write plugin documentation with use case examples

### 2.3 Data Masking Plugin (`data-masking`)
- [ ] Lua plugin: redact sensitive fields in response bodies
- [ ] Configuration: JSONPath patterns to mask (e.g., `$.cpf`, `$.credit_card`)
- [ ] Masking strategies: full redact (`***`), partial (`***1234`), hash (SHA-256)
- [ ] Configurable per content-type (JSON, XML)
- [ ] Works on response phase (before sending to client)
- [ ] LGPD/GDPR compliance focus
- [ ] Register in FuseOne UI policy gallery under "Security" category

### 2.4 Threat Protection Plugin (`threat-protection`)
- [ ] Lua plugin: protect against payload-based attacks
- [ ] JSON protection: max depth, max array size, max string length, max object entries
- [ ] Injection detection: SQL injection patterns, XSS patterns in body
- [ ] Request size limits (beyond what `client-control` offers)
- [ ] Configurable action: reject (403) or sanitize
- [ ] Register in FuseOne UI policy gallery under "Security" category

### Plugin Deploy Strategy
```
Development:
  custom-plugins/ (git repo) ──volume mount──► APISIX container
  Code change → PUT /apisix/admin/plugins/reload → Hot-reload (no restart)

Production:
  Dockerfile.apisix (FROM apache/apisix:3.x + COPY custom-plugins/) → Custom image
  New plugin name → config.yaml update → apisix reload (graceful, no downtime)
  Code update only → PUT /plugins/reload (zero downtime)
```

---

## Phase 3 -- Analytics & Monitoring (P2)

**Goal**: Built-in analytics without requiring external Grafana.

**Timeline**: 3-4 weeks

### 3.1 Analytics Dashboard
- [ ] Overview page: total requests, avg latency, error rate, top APIs
- [ ] Per-API analytics: traffic, latency percentiles, error breakdown
- [ ] Per-Application analytics: usage by consumer/app
- [ ] Time range selector: 1h, 6h, 24h, 7d, 30d, custom
- [ ] Charts: line (time-series), bar (top-N), pie (status distribution)

### 3.2 Alerting System
- [ ] Configurable alert rules: error rate > X%, latency p99 > Yms, traffic drop > Z%
- [ ] Alert channels: email, webhook (Slack/Discord/Teams)
- [ ] Alert history with acknowledgment
- [ ] Per-API or global alert scope

### 3.3 API Usage Reports
- [ ] Exportable reports (CSV, PDF) for billing/governance
- [ ] Per-application usage breakdown
- [ ] Plan quota usage tracking
- [ ] Historical trend analysis

---

## Phase 4 -- Multi-Environment & Governance (P2)

**Goal**: Support enterprise deployment workflows.

**Timeline**: 4-5 weeks

### 4.1 Environment Management
- [ ] Define environments: development, staging, production (configurable)
- [ ] Each environment points to a different APISIX cluster
- [ ] API configurations stored per-environment in PostgreSQL
- [ ] Environment switcher in the dashboard header

### 4.2 Promotion Workflows
- [ ] Promote API configuration from env A → env B
- [ ] Diff view before promotion (what will change)
- [ ] Approval workflow: request → review → approve/reject
- [ ] Audit trail for all promotions
- [ ] Rollback capability

### 4.3 API Revision Diff
- [ ] Side-by-side diff of API configurations between versions
- [ ] Highlight changes: added/removed/modified policies, routes, upstream config
- [ ] One-click rollback to any previous revision

---

## Phase 5 -- Developer Portal (P2)

**Goal**: Self-service portal for API consumers.

**Timeline**: 6-8 weeks

> See [ROADMAP-DEVELOPER-PORTAL.md](./ROADMAP-DEVELOPER-PORTAL.md) for detailed plan.

### Key Features
- [ ] API catalog with search and filtering
- [ ] Interactive API documentation (OpenAPI rendering + try-it)
- [ ] Self-service application registration
- [ ] API subscription with plan selection
- [ ] Credential management (API keys, OAuth)
- [ ] Usage dashboard for consumers
- [ ] White-label customization (branding, domain)

---

## Phase 6 -- Advanced Features (P3)

**Timeline**: Ongoing

### 6.1 API Composition / Orchestration
- [ ] Visual editor to call multiple backends from a single endpoint
- [ ] Response aggregation with field mapping
- [ ] Parallel and sequential call patterns
- [ ] Built on top of HTTP Callout plugin

### 6.2 Custom Scripting IDE
- [ ] In-browser Lua editor for `serverless-pre-function` / `serverless-post-function`
- [ ] Syntax highlighting, autocompletion
- [ ] Inline testing with sample requests
- [ ] Script library for common patterns

### 6.3 API Mocking (Polished)
- [ ] Visual mock response builder
- [ ] Dynamic responses based on request parameters
- [ ] Integrated into API design workflow (mock before backend is ready)
- [ ] Auto-generate mock from OpenAPI spec

### 6.4 REST-to-SOAP Templates
- [ ] Pre-built body-transformer templates for SOAP integration
- [ ] Visual SOAP envelope builder
- [ ] WSDL import

---

## Phase 7 -- AI Gateway (P4)

**Timeline**: Future

### 7.1 LLM Routing
- [ ] Multi-model routing (OpenAI, Anthropic, Gemini, etc.)
- [ ] Fallback chains between providers
- [ ] Cost-based routing

### 7.2 Prompt Guard Rails
- [ ] Input validation / prompt injection detection
- [ ] Output filtering (PII, harmful content)
- [ ] Custom safety rules

### 7.3 Token Tracking & Cost Management
- [ ] Per-application token usage tracking
- [ ] Budget limits and alerts
- [ ] Cost allocation by team/project

### 7.4 RAG Integration
- [ ] Context injection from vector databases
- [ ] Document retrieval pipeline configuration

---

## Priority Summary

| Phase | Focus | Timeline | Business Impact |
|---|---|---|---|
| **Phase 1** | Troubleshooting & Observability | 4-6 weeks | Eliminates #1 competitive gap |
| **Phase 2** | Custom Plugins (Callout, Masking, Threat) | 3-4 weeks | Enables enterprise patterns |
| **Phase 3** | Analytics & Monitoring | 3-4 weeks | Self-contained, no Grafana needed |
| **Phase 4** | Multi-Environment & Governance | 4-5 weeks | Enterprise deployment workflows |
| **Phase 5** | Developer Portal | 6-8 weeks | Required for external API programs |
| **Phase 6** | Advanced Features | Ongoing | Differentiation & polish |
| **Phase 7** | AI Gateway | Future | Next-gen positioning |

---

## Technical Dependencies

### Infrastructure Required
- PostgreSQL (already in place) -- add `debug_logs` table
- APISIX Control API access (port 9090) -- expose in docker-compose
- APISIX Prometheus endpoint (port 9091) -- already configured
- APISIX `http-logger` plugin -- configure to send to our backend
- APISIX `debug.yaml` -- enable dynamic debug headers

### Backend Changes (Go)
- New handler: `debug_log.go` (receive/store/stream debug logs)
- New handler: `metrics.go` (scrape/parse/serve Prometheus metrics)
- New handler: `health.go` (proxy APISIX Control API health checks)
- New service: `plugin_manager.go` (hot-reload, custom plugin management)
- New migration: `000008_debug_logs.up.sql`

### Frontend Changes (Next.js)
- New page: `troubleshooting/page.tsx` (or replace monitoring Coming Soon)
- New components: `TrafficFeed`, `RequestDetail`, `TimingWaterfall`, `MetricsCharts`
- New stores: `debug-store.ts` (Zustand for live traffic state)
- Chart library: add `recharts` or `@tremor/react` for analytics
