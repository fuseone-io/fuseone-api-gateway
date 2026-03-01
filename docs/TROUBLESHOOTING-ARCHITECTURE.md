# FuseOne Troubleshooting & Observability -- Technical Architecture

> Last updated: 2026-03-01

## 1. Why This Matters

Troubleshooting is the **#1 competitive gap** vs Sensedia. Enterprise clients consistently cite the ability to see "what happened to my request" as a deciding factor. Today, debugging an APISIX route requires reading raw logs, using curl with debug headers, and correlating timestamps manually. FuseOne should turn this into a **visual, click-through experience**.

---

## 2. APISIX Capabilities Available

### 2.1 Data Captured Per-Request (Default Log Entry)

```json
{
  "client_ip": "127.0.0.1",
  "route_id": "1",
  "service_id": "1",
  "start_time": 1704067200000,
  "request": {
    "method": "GET",
    "uri": "/api/v1/users?page=1",
    "url": "http://example.com/api/v1/users?page=1",
    "querystring": { "page": "1" },
    "headers": { "host": "...", "authorization": "Bearer xxx" },
    "size": 245
  },
  "response": {
    "status": 200,
    "headers": { "content-type": "application/json" },
    "size": 1024
  },
  "upstream": "10.0.0.5:8080",
  "latency": {
    "request": 152,
    "upstream": 120,
    "apisix": 32
  }
}
```

### 2.2 Body Capture (Conditional)

All APISIX logger plugins support body capture with conditional expressions:

```json
{
  "include_req_body": true,
  "include_req_body_expr": [["http_x_fuseone_debug", "==", "true"]],
  "include_resp_body": true,
  "include_resp_body_expr": [["http_x_fuseone_debug", "==", "true"]]
}
```

This means body logging only activates when the `X-FuseOne-Debug: true` header is present. Zero overhead in production.

### 2.3 Debug Headers

| Feature | Config | Effect |
|---|---|---|
| `Apisix-Plugins` header | `debug.yaml` basic.enable=true | Response header lists all executed plugins |
| `X-APISIX-Dynamic-Debug` | `debug.yaml` http_filter.enable=true | Per-request debug activation |

### 2.4 Prometheus Metrics

Already configured at port 9091. Key metrics:

| Metric | Type | Use |
|---|---|---|
| `apisix_http_latency{type=request\|upstream\|apisix}` | Histogram | Latency breakdown per route |
| `apisix_http_status{code=200\|404\|500}` | Counter | Request counts by status |
| `apisix_bandwidth{type=ingress\|egress}` | Counter | Bytes in/out per route |
| `apisix_upstream_status` | Gauge | Health check results |

### 2.5 Control API (port 9090)

| Endpoint | Use |
|---|---|
| `GET /v1/healthcheck` | Upstream health status per node |
| `GET /v1/routes` | All active routes with config |
| `GET /v1/upstreams` | Upstream configuration |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   FuseOne Dashboard                      │
│                                                          │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │Traffic Feed │  │Request Detail│  │Metrics/Charts    │  │
│  │(WebSocket/  │  │(Headers,Body│  │(Latency,Errors,  │  │
│  │ SSE stream) │  │ Timing)     │  │ RPS, Bandwidth)  │  │
│  └─────┬──────┘  └──────┬──────┘  └────────┬─────────┘  │
│        │                │                   │            │
│  ┌─────┴────────────────┴───────────────────┴─────────┐  │
│  │              Go Backend API                        │  │
│  │                                                    │  │
│  │  /api/debug/logs          → query stored logs      │  │
│  │  /api/debug/logs/stream   → SSE real-time feed     │  │
│  │  /api/debug/toggle/{id}   → enable/disable debug   │  │
│  │  /api/metrics/latency     → parsed Prometheus      │  │
│  │  /api/metrics/status      → error rate data        │  │
│  │  /api/metrics/bandwidth   → traffic volume         │  │
│  │  /api/health/upstreams    → upstream health        │  │
│  │                                                    │  │
│  │  /internal/debug-logs     → receive from APISIX    │  │
│  └──┬──────────────┬──────────────┬───────────────────┘  │
│     │              │              │                       │
│  ┌──┴───────┐  ┌───┴──────┐  ┌───┴────────────────────┐  │
│  │PostgreSQL│  │APISIX    │  │APISIX                  │  │
│  │debug_logs│  │Control   │  │Prometheus   http-logger │  │
│  │(TTL 48h) │  │API :9090 │  │:9091        → backend  │  │
│  └──────────┘  └──────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **APISIX processes a request** → `http-logger` plugin sends log entry to `POST /internal/debug-logs`
2. **Go backend receives log** → stores in PostgreSQL `debug_logs` table → pushes to SSE subscribers
3. **Frontend subscribes to SSE** → `GET /api/debug/logs/stream?route_id=X` → shows in real-time feed
4. **User clicks a log entry** → `GET /api/debug/logs/{id}` → shows full request/response detail
5. **Metrics charts** → backend periodically scrapes Prometheus → serves as JSON

---

## 4. Database Schema

```sql
-- migrations/000008_debug_logs.up.sql
CREATE TABLE debug_logs (
    id              BIGSERIAL PRIMARY KEY,
    route_id        TEXT NOT NULL,
    service_id      TEXT,
    consumer_name   TEXT,

    -- Request
    req_method      TEXT NOT NULL,
    req_uri         TEXT NOT NULL,
    req_headers     JSONB,
    req_body        TEXT,          -- NULL unless debug mode active
    req_size        INTEGER,
    client_ip       INET,

    -- Response
    resp_status     SMALLINT NOT NULL,
    resp_headers    JSONB,
    resp_body       TEXT,          -- NULL unless debug mode active
    resp_size       INTEGER,

    -- Timing (milliseconds)
    latency_total   INTEGER NOT NULL,
    latency_upstream INTEGER,
    latency_gateway  INTEGER,

    -- Upstream
    upstream_addr   TEXT,

    -- Metadata
    plugins_executed TEXT[],       -- from Apisix-Plugins header
    apisix_node     TEXT,

    -- Timestamps
    request_time    TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_debug_logs_route_time ON debug_logs (route_id, request_time DESC);
CREATE INDEX idx_debug_logs_status ON debug_logs (resp_status, request_time DESC);
CREATE INDEX idx_debug_logs_created ON debug_logs (created_at);

-- Auto-cleanup: delete logs older than 48 hours
-- Run via pg_cron or application-level scheduler
-- DELETE FROM debug_logs WHERE created_at < NOW() - INTERVAL '48 hours';
```

```sql
-- migrations/000008_debug_logs.down.sql
DROP TABLE IF EXISTS debug_logs;
```

---

## 5. APISIX Configuration Changes

### 5.1 Enable Debug Headers

```yaml
# debug.yaml (mount into APISIX container)
basic:
  enable: true                    # Adds Apisix-Plugins response header

http_filter:
  enable: true
  enable_header_name: X-APISIX-Dynamic-Debug  # Per-request debug activation
```

### 5.2 Global http-logger (Lightweight -- No Bodies)

For the always-on traffic feed (metadata only, no bodies):

```json
{
  "plugins": {
    "http-logger": {
      "uri": "http://gateway-api:8080/internal/debug-logs",
      "batch_max_size": 100,
      "buffer_duration": 5,
      "inactive_timeout": 3,
      "concat_method": "json",
      "include_req_body": false,
      "include_resp_body": false
    }
  }
}
```

### 5.3 Per-Route Debug Logger (Full Bodies)

When user enables debug on a specific route:

```json
{
  "plugins": {
    "http-logger": {
      "uri": "http://gateway-api:8080/internal/debug-logs",
      "batch_max_size": 1,
      "inactive_timeout": 1,
      "concat_method": "json",
      "include_req_body": true,
      "include_req_body_expr": [["http_x_fuseone_debug", "==", "true"]],
      "include_resp_body": true,
      "include_resp_body_expr": [["http_x_fuseone_debug", "==", "true"]]
    }
  }
}
```

**Two modes of body capture:**
1. **Auto-capture**: All requests on the debugged route get body logged
2. **Header-triggered**: Only requests with `X-FuseOne-Debug: true` get body logged (recommended for production)

---

## 6. Backend Implementation Plan

### 6.1 New Files

```
backend/
  internal/
    handler/
      debug_log.go        # Receive logs from APISIX, query API for frontend
    service/
      debug_log.go        # Business logic, SSE broadcast
    repository/
      debug_log.go        # PostgreSQL operations
    model/
      debug_log.go        # Data structures
  migrations/
    000008_debug_logs.up.sql
    000008_debug_logs.down.sql
```

### 6.2 API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/internal/debug-logs` | Receive log batches from APISIX (internal only) |
| `GET` | `/api/debug/logs` | Query stored logs with filters |
| `GET` | `/api/debug/logs/:id` | Get single log entry with full detail |
| `GET` | `/api/debug/logs/stream` | SSE stream for real-time feed |
| `POST` | `/api/debug/toggle/:route_id` | Enable/disable debug mode on a route |
| `GET` | `/api/debug/status/:route_id` | Check if debug is enabled on a route |
| `GET` | `/api/metrics/overview` | Aggregated metrics summary |
| `GET` | `/api/metrics/latency` | Latency percentiles per route |
| `GET` | `/api/metrics/status` | Status code distribution |
| `GET` | `/api/metrics/bandwidth` | Bandwidth per route |
| `GET` | `/api/health/upstreams` | Upstream health status |

### 6.3 SSE Implementation

```go
// Simplified SSE handler
func (h *DebugLogHandler) StreamLogs(c *gin.Context) {
    routeID := c.Query("route_id")

    c.Header("Content-Type", "text/event-stream")
    c.Header("Cache-Control", "no-cache")
    c.Header("Connection", "keep-alive")

    ch := h.service.Subscribe(routeID)
    defer h.service.Unsubscribe(ch)

    for {
        select {
        case log := <-ch:
            data, _ := json.Marshal(log)
            fmt.Fprintf(c.Writer, "data: %s\n\n", data)
            c.Writer.Flush()
        case <-c.Request.Context().Done():
            return
        }
    }
}
```

---

## 7. Frontend UI Design

### 7.1 Troubleshooting Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  API Troubleshooting                [Route: ▼ All Routes ]  │
│                                     [Status: ▼ All      ]  │
│                                     [Debug: ● ON  ○ OFF ]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Live Traffic                                    [⏸ Pause] │
│  ┌─────────┬────────┬──────────────┬────────┬──────┬──────┐│
│  │ Time    │ Method │ Path         │ Status │ ms   │      ││
│  ├─────────┼────────┼──────────────┼────────┼──────┼──────┤│
│  │ 14:32:01│ GET    │ /api/users   │ 200    │ 45   │ View ││
│  │ 14:32:02│ POST   │ /api/orders  │ 500    │ 2304 │ View ││
│  │ 14:32:03│ GET    │ /api/health  │ 200    │ 3    │ View ││
│  │ 14:32:04│ PUT    │ /api/users/5 │ 403    │ 12   │ View ││
│  └─────────┴────────┴──────────────┴────────┴──────┴──────┘│
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Request Detail                            [⤓ cURL]  │   │
│  │                                                      │   │
│  │ [Request] [Response] [Timing] [Policies]             │   │
│  │                                                      │   │
│  │ ┌── Request Headers ──────────────────────────────┐  │   │
│  │ │ Host: api.example.com                           │  │   │
│  │ │ Authorization: Bearer eyJ...                    │  │   │
│  │ │ Content-Type: application/json                  │  │   │
│  │ └────────────────────────────────────────────────-┘  │   │
│  │                                                      │   │
│  │ ┌── Request Body (JSON) ──────────────────────────┐  │   │
│  │ │ {                                               │  │   │
│  │ │   "name": "John Doe",                          │  │   │
│  │ │   "email": "john@example.com"                  │  │   │
│  │ │ }                                               │  │   │
│  │ └────────────────────────────────────────────────-┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌── Timing ─────────────────────────────────────────────┐  │
│  │ |████ GW 12ms ████|████████ Upstream 33ms ████████|   │  │
│  │ Total: 45ms                                           │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌── Metrics (24h) ─────────────────────────────────────┐   │
│  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │   │
│  │ │ Latency      │ │ Error Rate   │ │ RPS          │  │   │
│  │ │ p50: 23ms    │ │ 4xx: 2.1%   │ │ 142 req/s    │  │   │
│  │ │ p95: 89ms    │ │ 5xx: 0.3%   │ │ peak: 312    │  │   │
│  │ │ p99: 234ms   │ │              │ │              │  │   │
│  │ │ [chart]      │ │ [chart]      │ │ [chart]      │  │   │
│  │ └──────────────┘ └──────────────┘ └──────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌── Upstream Health ────────────────────────────────────┐  │
│  │ ● 10.0.0.5:8080  Healthy   success:142  failures:0   │  │
│  │ ○ 10.0.0.6:8080  Unhealthy success:98   failures:5   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Frontend Components

```
frontend/src/
  app/(dashboard)/
    troubleshooting/
      page.tsx              # Main troubleshooting page
  components/
    troubleshooting/
      traffic-feed.tsx      # Live traffic table with SSE
      request-detail.tsx    # Full request/response viewer
      timing-waterfall.tsx  # Visual timing breakdown
      policy-trace.tsx      # Executed policies list
      metrics-panel.tsx     # Latency/error/RPS charts
      upstream-health.tsx   # Upstream node health
      debug-toggle.tsx      # Enable/disable debug per route
  stores/
    debug-store.ts          # Zustand store for live traffic state
```

### 7.3 Key Libraries Needed

```bash
cd frontend && pnpm add recharts       # For metrics charts
# or
cd frontend && pnpm add @tremor/react  # Alternative chart library
```

---

## 8. Performance Considerations

### Log Volume Estimation

| Traffic | Logs/hour | Storage/hour (no body) | Storage/hour (with body) |
|---|---|---|---|
| 100 req/s | 360,000 | ~180 MB | ~1.8 GB |
| 1,000 req/s | 3,600,000 | ~1.8 GB | ~18 GB |
| 10,000 req/s | 36,000,000 | ~18 GB | ~180 GB |

### Mitigation Strategies

1. **Global logger captures metadata only** (no bodies) -- ~500 bytes/log
2. **Body capture only when explicitly enabled** per route or per request
3. **48-hour TTL** with automatic cleanup via pg_cron or Go scheduler
4. **Batch insertion** -- `http-logger` sends batches (100 entries every 5 seconds)
5. **Sampling** -- For high-traffic routes, sample 10% of requests
6. **Ring buffer** -- Consider in-memory ring buffer (last 10,000 entries) for SSE feed, only persist filtered/debugged requests to PostgreSQL

### Recommended Configuration by Environment

| Environment | Global Logger | Body Capture | Retention |
|---|---|---|---|
| Development | All requests, all bodies | Always on | 24h |
| Staging | All requests, no bodies | On debug toggle | 48h |
| Production | Sampled (10%), no bodies | Header-triggered only | 48h |
