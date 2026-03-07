# FuseOne API Gateway

<p align="center">
  <img src="https://fuseone.io/icon.png" alt="FuseOne" width="80" />
</p>

<p align="center">
  Enterprise API Gateway Platform — powered by Apache APISIX 3.15
</p>

<p align="center">
  <a href="https://github.com/devopsfuseone/fuseone-api-gateway/actions/workflows/build-images.yml">
    <img src="https://github.com/devopsfuseone/fuseone-api-gateway/actions/workflows/build-images.yml/badge.svg" alt="Build" />
  </a>
  <a href="https://hub.docker.com/r/devopsfuseone/fuseone-api-gateway-backend">
    <img src="https://img.shields.io/docker/pulls/devopsfuseone/fuseone-api-gateway-backend?label=backend%20pulls" alt="Docker Pulls" />
  </a>
  <img src="https://img.shields.io/badge/APISIX-3.15-blue" alt="APISIX 3.15" />
  <img src="https://img.shields.io/badge/Go-1.24-00ADD8?logo=go" alt="Go 1.24" />
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
</p>

---

## Overview

FuseOne API Gateway is a full-featured, enterprise-grade API management platform that provides a modern management console on top of Apache APISIX. It delivers policy enforcement, real-time observability, traffic control, and a developer portal — all from a single deployment.

### Key capabilities

| Feature | Details |
|---|---|
| **API Management** | CRUD for routes, upstreams, services, consumers |
| **Plugin Policies** | 60+ built-in APISIX plugins + custom FuseOne plugins |
| **Authentication** | JWT, API Key, Basic Auth, OAuth2 / OIDC, HMAC, LDAP |
| **Rate Limiting** | Per-consumer, per-route, per-IP (limit-req, limit-count, limit-conn) |
| **Observability** | OpenTelemetry traces, Prometheus metrics, per-phase timing waterfall |
| **AI Gateway** | LLM proxy, prompt injection protection, semantic caching |
| **GraphQL** | Depth limit, complexity control, introspection guard, allowlist |
| **Kafka / Event Gateway** | HTTP→Kafka bridge, topic management |
| **Service Mesh** | mTLS, traffic policies, topology view |
| **Developer Portal** | Self-service API subscription, docs, API key management |
| **Multi-environment** | Promote configs across dev/staging/prod environments |
| **Audit & RBAC** | Full audit trail, fine-grained role-based access control |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FuseOne Platform                        │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │   Frontend   │   │   Backend    │   │ Developer      │  │
│  │  (Next.js)   │──▶│    (Go)      │   │ Portal         │  │
│  │  :3000       │   │    :8080     │   │ (Next.js):3001 │  │
│  └──────────────┘   └──────┬───────┘   └────────────────┘  │
│                            │ Admin API                       │
│                     ┌──────▼───────┐                        │
│                     │    APISIX    │                        │
│                     │ :9080 (proxy)│                        │
│                     │ :9180 (admin)│                        │
│                     └──────┬───────┘                        │
│                            │                                │
│              ┌─────────────┴──────────┐                    │
│        ┌─────▼─────┐          ┌───────▼──────┐             │
│        │   etcd    │          │  PostgreSQL   │             │
│        │  :2379    │          │    :5432      │             │
│        └───────────┘          └──────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

**Component roles:**

- **Backend (Go)** — REST API for the management console. Communicates with APISIX Admin API and PostgreSQL. Handles auth, RBAC, audit, tracing aggregation.
- **Frontend (Next.js)** — Management dashboard. All API resources, monitoring, traces, alerts, settings.
- **Developer Portal (Next.js)** — Self-service portal for API consumers: subscription, API key generation, documentation.
- **Custom APISIX** — Apache APISIX 3.15 with FuseOne Lua plugins pre-baked in: `http-callout`, `data-masking`, `threat-protection`, `api-composition`, `fuseone-timing`, and a patched `opentelemetry` plugin.
- **Event Gateway (Go)** — Kafka protocol mediator for HTTP→Kafka bridging.
- **etcd** — State store for APISIX (routes, upstreams, plugins, consumers).
- **PostgreSQL** — Auth, users, roles, audit log, dashboard settings.

---

## Docker Images

All images are published to Docker Hub under `devopsfuseone/`:

| Image | Description |
|---|---|
| `devopsfuseone/fuseone-api-gateway-backend` | Go backend API |
| `devopsfuseone/fuseone-api-gateway-frontend` | Next.js management console |
| `devopsfuseone/apisix` | Apache APISIX + FuseOne custom plugins |
| `devopsfuseone/fuseone-developer-portal` | Next.js developer portal |
| `devopsfuseone/fuseone-event-gateway` | Kafka event gateway |

---

## Quick Start (Docker Compose)

### Prerequisites

- Docker 24+ and Docker Compose v2
- 4 GB RAM minimum

### 1. Clone and configure

```bash
git clone https://github.com/devopsfuseone/fuseone-api-gateway.git
cd fuseone-api-gateway
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
JWT_SECRET=your-secret-here
DB_PASSWORD=your-db-password
```

### 2. Start the platform

```bash
# Start APISIX + etcd + PostgreSQL
make infra

# Start backend (hot reload via air)
make backend

# Start frontend
make frontend
```

Access the dashboard at **http://localhost:3000** and log in with the default admin credentials set in `.env`.

---

## Local Development

```bash
# Backend only (requires infra running)
make backend          # go run via air — hot reload on :8080

# Frontend only
make frontend         # pnpm dev — hot reload on :3000

# Run all tests
cd backend && go test ./...
cd frontend && pnpm test
```

**Directory layout:**

```
fuseone-api-gateway/
├── backend/              # Go API server (Gin + pgx + Viper)
│   ├── cmd/              # Entry points
│   ├── internal/
│   │   ├── handler/      # HTTP handlers
│   │   ├── service/      # Business logic
│   │   ├── repository/   # PostgreSQL queries
│   │   └── middleware/   # Auth, audit, CORS
│   └── migrations/       # Embedded SQL migrations
├── frontend/             # Next.js management console
│   └── src/
│       ├── app/          # App Router pages
│       ├── components/   # Shared UI components
│       ├── lib/          # API client, utilities
│       ├── stores/       # Zustand state stores
│       └── types/        # TypeScript types
├── developer-portal/     # Next.js developer portal
├── event-gateway/        # Go Kafka gateway
├── custom-plugins/
│   └── apisix/
│       ├── Dockerfile    # Custom APISIX image
│       └── plugins/      # FuseOne Lua plugins
├── charts/               # Helm charts
│   ├── fuseone/          # Umbrella chart
│   ├── apisix/           # APISIX sub-chart
│   └── etcd/             # etcd sub-chart
└── apisix-config.yaml    # APISIX runtime config
```

---

## Kubernetes / Helm

### Install (full platform)

```bash
helm install fuseone charts/fuseone \
  --set backend.secrets.jwtSecret=$(openssl rand -hex 32) \
  --set backend.secrets.dbPassword=changeme \
  --set backend.secrets.apisixApiKey=fuseone-gateway-admin-key \
  --namespace fuseone --create-namespace
```

### Deployment modes

| Mode | Command |
|---|---|
| **Full Platform** (default) | `helm install fuseone charts/fuseone` |
| **Gateway Only** (no console) | `--set backend.enabled=false --set frontend.enabled=false --set postgresql.enabled=false` |
| **Console Only** (remote gateway) | `--set apisix.enabled=false --set etcd.enabled=false --set backend.config.apisixAdminURL=http://remote:9180` |

### Production values

```bash
helm install fuseone charts/fuseone \
  -f charts/fuseone/values-production.yaml \
  --set backend.secrets.jwtSecret=$(openssl rand -hex 32) \
  --set backend.secrets.dbPassword=<DB_PASS> \
  --namespace fuseone --create-namespace
```

The production values file (`charts/fuseone/values-production.yaml`) enables:
- 3 replicas for backend, frontend, and APISIX
- Pod anti-affinity for all stateless components
- Hard anti-affinity for etcd (one pod per node)
- `pullPolicy: Always` for all images
- LoadBalancer service for APISIX

---

## Custom Plugins

FuseOne extends APISIX with the following custom Lua plugins:

| Plugin | Phase | Description |
|---|---|---|
| `http-callout` | access | External HTTP callout during request processing |
| `data-masking` | body_filter | Redact PII / sensitive fields from responses |
| `threat-protection` | access | WAF-style payload inspection |
| `api-composition` | access | Fan-out multiple upstream calls and merge responses |
| `fuseone-timing` | all phases | Per-phase timing collection for trace waterfall |
| `opentelemetry` | log | Patched OTel plugin with FuseOne phase attributes |

Custom plugins are baked into `devopsfuseone/apisix` — no ConfigMap mounts required.

---

## GraphQL Gateway

FuseOne ships four dedicated GraphQL guard plugins, applied at the route or global level:

| Plugin | Description |
|---|---|
| `graphql-depth-limit` | Reject queries that exceed a configured nesting depth — prevents exponential query attacks |
| `graphql-complexity` | Assign cost weights to fields and block queries above a complexity budget |
| `graphql-allowlist` | Whitelist specific operation hashes; block any query not on the list (persisted queries) |
| `graphql-introspection-guard` | Disable or restrict `__schema` / `__type` introspection in production |

In addition, `degraphql` allows exposing a GraphQL API as REST endpoints — clients send plain HTTP requests and the gateway translates them to GraphQL queries upstream.

---

## Observability

### Distributed Tracing

FuseOne uses OpenTelemetry with a custom per-phase timing overlay. Each trace provides a waterfall breakdown:

- **Auth & Rewrite** — jwt-auth, key-auth, proxy-rewrite time
- **Rate Limiting** — limit-req, limit-count, WAF access phase
- **Upstream Connect / TTFB / Transfer** — upstream timing breakdown
- **Response Processing** — CORS, response-rewrite header_filter phase

### Metrics

Prometheus metrics are exposed by APISIX at `:9091/apisix/prometheus/metrics`. Configure your Prometheus scrape config to collect them.

---

## CI/CD

GitHub Actions workflows:

| Workflow | Trigger | Action |
|---|---|---|
| `build-images.yml` | push to `main`, tags, PRs | Build & push 5 Docker images + Helm lint |
| `helm-release.yml` | version tags (`v*`) | Package and upload Helm charts to GitHub Release |

Required GitHub secrets:

| Secret | Description |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Write tests first (TDD): backend Go tests, frontend Vitest
4. Implement the feature
5. Submit a pull request

---

## License

Copyright © 2025 FuseOne. All rights reserved.
