# Sharding Tags & Multi-Tenancy Study

> Study inspired by Gravitee's sharding tags and tenant concepts.
> Goal: evaluate if/how FuseOne should support regional deployments and multi-tenant isolation
> managed from a single control plane.

---

## 1. What Gravitee Does

Gravitee has two complementary concepts for distributed gateway management:

### Sharding Tags — Control which APIs are deployed where

- Each **gateway instance** is configured with tags: `tags: europe,internal`
- Each **API** is marked with tags in the management console
- During sync, gateways **only load APIs whose tags match**
- Supports exclusion with `!` prefix: `tags: europe,!premium`

**Evaluation logic:**
1. No tags configured → gateway deploys everything
2. Only exclusions (`!internal`) → deploys all except excluded
3. Only inclusions (`europe`) → deploys only matching
4. Mixed (`europe,!premium`) → must match inclusion AND not match exclusion

### Tenants — Control which backend is used per gateway

- Each gateway gets one tenant: `tenant: europe`
- Each API endpoint can be associated with a tenant
- Gateway with `tenant: europe` routes to `api-eu.example.com`
- Same API, different backends per region

| Aspect | Sharding Tags | Tenants |
|--------|--------------|---------|
| Scope | Which APIs a gateway loads | Which backend to route to |
| Granularity | API-level | Endpoint-level |
| Cardinality | Multiple per gateway | One per gateway |
| Primary use | Deployment topology | Backend routing |

---

## 2. What FuseOne Already Has

**FuseOne's Environment system already provides multi-cluster management.** Here's what exists today:

### Backend Infrastructure

| Component | File | What It Does |
|-----------|------|-------------|
| **Environment model** | `internal/model/` | name, slug, color, admin_url, api_key, control_url, metrics_url per cluster |
| **Environment repo** | `internal/repository/environment_repo.go` | CRUD + SetDefault in PostgreSQL |
| **APISIXClientRegistry** | `internal/service/apisix_client_registry.go` | Lazy-creates and caches APISIX clients per environment. GetClient(ctx, envID) returns the right client |
| **EnvironmentContext middleware** | `internal/middleware/environment.go` | Extracts `X-Environment-ID` header, places envID in Gin context |
| **Promotion service** | `internal/service/promotion_service.go` | Promote API definitions between environments with snapshot, diff, and approval workflow |
| **API deployment tracking** | `internal/repository/api_deployment_repo.go` | Tracks which APIs are deployed to which environment |
| **Environment handler** | `internal/handler/environment.go` | Full CRUD + TestConnection (creates temp APISIX client, lists routes) |

### Frontend

| Component | What It Does |
|-----------|-------------|
| Settings > Environments page | Full CRUD for environments with color coding |
| Connection test button | Tests APISIX Admin API connectivity per environment |
| Default environment selector | Sets which environment is used by default |
| Environment store (Zustand) | Client-side state for environment switching |

### Current Architecture

```
┌──────────────────────────────────────────────┐
│            FuseOne Go Backend                 │
│         (Centralized Control Plane)           │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │       APISIXClientRegistry              │  │
│  │  map[envID] → *APISIXClient (cached)    │  │
│  └──────────┬──────────────┬───────────────┘  │
│             │              │                  │
│    X-Environment-ID    X-Environment-ID       │
│    = env-staging       = env-production       │
└─────────────┼──────────────┼──────────────────┘
              │              │
      ┌───────▼──────┐ ┌────▼──────────┐
      │ APISIX       │ │ APISIX        │
      │ Staging      │ │ Production    │
      │ (etcd-stg)   │ │ (etcd-prod)   │
      └──────────────┘ └───────────────┘
```

**This is already a centralized CP + distributed DP pattern** — the same architecture Kong, Tyk, and Azure APIM use. The difference is that our implementation pushes config via APISIX Admin API rather than a proprietary sync protocol.

---

## 3. What Gravitee Has That We Don't (Yet)

### 3.1 Sharding Tags — Selective API Deployment

**What it means:** Today, when an API is deployed to an environment, the admin explicitly chooses the target environment. There is no concept of "this API should automatically be on all Europe gateways."

**When this matters:**
- Managing 10+ environments where manually deploying to each is tedious
- Auto-deployment rules (e.g., "all APIs tagged `public` go to all DMZ gateways")
- Excluding specific APIs from specific clusters

**Possible implementation:**
```
Environment table: add `tags text[]` column (e.g., ['europe', 'dmz'])
API definition: add `sharding_tags text[]` to definition metadata
Deploy logic: auto-deploy to environments whose tags match
```

### 3.2 Tenants — Per-Gateway Backend Routing

**What it means:** A single API definition deployed to multiple regions, but each region routes to its own backend. Today, each environment gets its own copy of the API definition (via promotion), which can have different upstream URLs.

**Current workaround:** The promotion system already supports this — when promoting from staging to production, the definition snapshot is deployed to the target's APISIX. The upstream URL can differ per environment since each APISIX has independent route configs.

**Gap:** The user must manually adjust upstreams after promotion. Gravitee's tenant model automates this — the API definition includes multiple endpoints tagged by tenant, and the gateway picks the right one automatically.

### 3.3 Gateway-Side Tag Filtering

**What it means:** In Gravitee, the gateway itself filters which APIs it loads based on its tags. In APISIX, all routes in etcd are loaded by all connected nodes.

**Current approach:** Since FuseOne uses separate APISIX instances per environment (each with its own Admin API + etcd), this filtering happens naturally — the Go backend only pushes configs to the correct APISIX instance. This is actually cleaner than Gravitee's approach.

---

## 4. Industry Comparison

| Feature | Kong | Tyk | Azure APIM | Gravitee | **FuseOne** |
|---------|------|-----|------------|----------|-------------|
| CP/DP split | Hybrid Mode | MDCB | Native (Premium) | Native | **Environments + Registry** |
| Multi-cluster | DP per region | Worker DCs | Multi-region auto | Sharding tags | **Environment per cluster** |
| Config sync | WebSocket/wRPC | RPC via MDCB | Automatic | Event/poll | **Admin API push** |
| Promotion workflow | N/A | N/A | N/A | Basic | **Snapshot + diff + approval** |
| DP independence | Cached config | Local Redis | Cached | Cached | **Each APISIX is independent** |
| Multi-tenancy | Workspaces | Organizations | Workspaces | Tenants | **Environments (≈ workspaces)** |
| Connection test | N/A | N/A | N/A | N/A | **Built-in per environment** |

**Key insight:** FuseOne's promotion workflow (with diff and approval) is more advanced than what most competitors offer for cross-environment management.

---

## 5. Evolution Roadmap

### Stage 1: Current State (Done)
- [x] Environment CRUD with per-cluster connection details
- [x] APISIXClientRegistry with lazy caching
- [x] X-Environment-ID middleware for request routing
- [x] API promotion between environments (snapshot + diff + approval)
- [x] Connection testing per environment
- [x] Frontend for environment management
- [x] Gateway health monitoring (connections, shared memory, etcd, node info) via Prometheus scrape

### Stage 1.5: Enhanced Gateway Observability (Future — low effort, high value)

Deeper runtime visibility without requiring external monitoring stacks:

- [ ] Custom Lua plugin for LuaJIT memory (`collectgarbage("count")`) and CPU time per request
- [ ] Docker API integration for container-level CPU/memory when runtime=docker
- [ ] Kubernetes Metrics API integration for pod-level CPU/memory when runtime=k8s
- [ ] Add `runtime_type` field to environments (docker/kubernetes/bare-metal) to auto-select metrics source
- [ ] Auto-refresh health on interval (polling every 30s) in connection page
- [ ] Health history sparklines (store snapshots in PostgreSQL, show trends)
- [ ] Alerting thresholds: notify when shared memory > 80%, etcd unreachable, connections spike

**Context:** APISIX (Nginx/OpenResty) does not expose CPU/memory natively — unlike Java-based gateways (Gravitee) where the JVM provides this. Kong Enterprise solved this with their proprietary Vitals module (custom Lua instrumentation inside the worker). We can take the same approach with a custom plugin, or leverage container runtime APIs depending on the deployment mode.

### Stage 2: Sharding Tags (Future — when managing 5+ environments)

Add tag-based auto-deployment rules to reduce manual work:

- [ ] Add `tags text[]` column to `environments` table
- [ ] Add `sharding_tags text[]` to API definitions metadata
- [ ] Tag management UI (global tag registry in Settings)
- [ ] Auto-deploy: when an API is saved, deploy to all environments with matching tags
- [ ] Exclusion syntax (`!tag`) for tag matching logic
- [ ] Bulk operations: deploy/undeploy an API across all tagged environments

### Stage 3: Regional Backend Routing (Future — for multi-region)

Tenant-like per-region upstream selection:

- [ ] Add `region` or `tenant` identifier to environments
- [ ] API upstream profiles: define different upstreams per region in a single API definition
- [ ] On promotion/deploy, auto-select the upstream matching the target environment's region
- [ ] Health-aware routing: if region-A backend is down, optionally failover to region-B

### Stage 4: Config Sync Agent (Future — for geo-distributed deployments)

For environments where the APISIX Admin API isn't directly reachable from the control plane:

- [ ] Lightweight sync agent that runs alongside each APISIX instance
- [ ] Agent polls the FuseOne API for its environment's configuration
- [ ] Applies changes to local APISIX via Admin API or standalone YAML
- [ ] Reports health/status back to the control plane
- [ ] Supports APISIX standalone mode (no etcd dependency in remote regions)

### Stage 5: Kubernetes-Native Host Management (Future — for K8s deployments)

Automate external traffic routing when running on Kubernetes:

- [ ] Detect K8s runtime (in-cluster service account or kubeconfig)
- [ ] When a new host is added to an API, optionally create/update Kubernetes resources to route external traffic to APISIX
- [ ] Support both Ingress and Gateway API (K8s sig-network) resource types
- [ ] Integrate with cert-manager for automatic TLS certificate provisioning per host
- [ ] UI toggle per environment: "Auto-manage Ingress" on/off
- [ ] Show Ingress/Gateway status in the API detail page (pending, synced, error)

**Deployment patterns and when this matters:**

| APISIX Deployment | New Host Behavior | Ingress Needed? |
|-------------------|-------------------|-----------------|
| APISIX **is** the Ingress Controller | Route creation in APISIX automatically exposes the host | No |
| APISIX behind **LoadBalancer Service** + wildcard DNS (`*.api.company.com`) | Any subdomain already routes to APISIX | No |
| APISIX behind **another Ingress Controller** (nginx-ingress, traefik) | External traffic doesn't reach APISIX for the new host | **Yes** |
| Custom domains outside wildcard (e.g., `api.otherdomain.com`) | DNS + TLS certificate needed | **Yes** |

**Recommended default approach:** Wildcard DNS (`*.gateway.company.com`) pointing to the APISIX LoadBalancer Service. This covers most cases with zero config for new hosts. The Ingress auto-creation is needed only for custom domains outside the wildcard.

**TLS automation flow:**
```
User adds host "api.cliente.com" to API
  → FuseOne creates route in APISIX (already works today)
  → FuseOne creates Ingress resource with cert-manager annotation
  → cert-manager provisions Let's Encrypt certificate
  → Ingress Controller routes external traffic to APISIX Service
  → APISIX handles the request per its route config
```

### Stage 6: Workspace Isolation (Future — for platform/SaaS use)

Multi-tenant isolation within the control plane:

- [ ] Workspace entity (groups of users + environments + APIs)
- [ ] RBAC scoped to workspaces
- [ ] Per-workspace API quotas and rate limits
- [ ] Isolated views: each team sees only their workspace's resources
- [ ] Cross-workspace API sharing (publish to marketplace)

---

## 6. Technical Considerations

### etcd and Multi-Region

APISIX's dependency on etcd has implications:
- etcd uses Raft consensus — cross-region latency (50-200ms) impacts writes
- etcd recommends all members in a single region
- **Our approach is better:** separate APISIX + etcd per environment, FuseOne backend syncs config via Admin API

### Data Sovereignty

When going multi-region, logging/tracing must be region-aware:
- Request traces must stay in-region (GDPR, LGPD)
- Our analytics factory pattern (`analytics_factory.go`) and trace collector already support pluggable backends
- Future: configure different analytics backends per environment

### APISIX Standalone Mode

For remote regions where etcd is impractical:
- APISIX can read config from `apisix.yaml` (no etcd needed)
- FuseOne backend could generate per-environment YAML
- Combined with a sync agent, enables fully disconnected data planes

---

## 7. When to Invest

| Signal | Threshold | Action |
|--------|-----------|--------|
| Number of environments | > 5 | Add sharding tags (Stage 2) |
| Geographic distribution | 2+ continents | Add regional routing (Stage 3) |
| Network isolation | Unreachable Admin API | Build sync agent (Stage 4) |
| Running on Kubernetes | Custom domains outside wildcard | K8s host management (Stage 5) |
| Multiple teams | > 3 teams sharing gateway | Add workspaces (Stage 6) |
| Regulatory requirements | GDPR/LGPD compliance | Region-aware logging + Stage 3 |

**Bottom line:** The foundation is solid. Environments + APISIXClientRegistry + Promotions already give us multi-cluster capabilities that most competitors charge enterprise prices for. The sharding/tenant features are natural extensions to add when scale demands it.
