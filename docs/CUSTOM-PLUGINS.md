# FuseOne Custom APISIX Plugins -- Strategy & Development Guide

> Last updated: 2026-03-01

## 1. Overview

FuseOne extends Apache APISIX with custom Lua plugins to close critical feature gaps vs competitors (Sensedia, Gravitee, Kong Enterprise). This document covers the plugin deployment strategy, development workflow, and technical specifications for each custom plugin.

---

## 2. Deploy Strategy

### Key Question: Dynamic or Baked into Image?

**Answer: Both, depending on the lifecycle stage.**

| Operation | Method | Downtime |
|---|---|---|
| **Update code** of existing plugin | Replace `.lua` file + `PUT /apisix/admin/plugins/reload` | **Zero** (hot-reload) |
| **Add new plugin name** to registry | Edit `config.yaml` + `apisix reload` (CLI) | **Graceful** (connections drain) |
| **Change `extra_lua_path`** | Edit `config.yaml` + `apisix reload` (CLI) | **Graceful** |
| **Change plugin config on a route** | Admin API (etcd propagation) | **Zero** (instant) |

### Development Workflow (Volume Mount)

```yaml
# docker-compose.yml
services:
  apisix:
    image: apache/apisix:3.9-debian
    volumes:
      - ./custom-plugins:/opt/custom-plugins:ro
      - ./apisix-config.yaml:/usr/local/apisix/conf/config.yaml:ro
```

```yaml
# apisix-config.yaml
apisix:
  extra_lua_path: "/opt/custom-plugins/?.lua"

plugins:
  # Built-in plugins...
  - key-auth
  - jwt-auth
  - ...
  # Custom plugins (pre-registered)
  - http-callout
  - data-masking
  - threat-protection
```

**Directory structure:**
```
custom-plugins/
  apisix/
    plugins/
      http-callout.lua
      data-masking.lua
      threat-protection.lua
```

**After editing a plugin file:**
```bash
# Hot-reload (no restart, no downtime)
curl -X PUT http://127.0.0.1:9180/apisix/admin/plugins/reload \
  -H "X-API-KEY: $ADMIN_KEY"
```

### Production Workflow (Custom Docker Image)

```dockerfile
# Dockerfile.apisix
FROM apache/apisix:3.9-debian

# Copy custom plugins
COPY custom-plugins/ /opt/custom-plugins/

# Copy configuration
COPY apisix-config.yaml /usr/local/apisix/conf/config.yaml

# Install additional Lua dependencies if needed
# RUN luarocks install lua-cjson
```

**Build and deploy:**
```bash
docker build -f Dockerfile.apisix -t fuseone/apisix:latest .
```

### Pre-Registration Strategy

**Critical insight**: You can register plugin names in `config.yaml` before the plugin code exists. APISIX will warn but not fail if a registered plugin's `.lua` file is missing (it just won't execute). This allows us to:

1. Pre-register all planned plugin names at image build time
2. Deploy plugin code later via volume mount or image update
3. Hot-reload code without restarting APISIX

This is the recommended approach for FuseOne: **always pre-register custom plugin names** in the base configuration.

---

## 3. Hot-Reload Integration with FuseOne Backend

The Go backend should expose a management endpoint that triggers plugin hot-reload:

```go
// POST /api/admin/plugins/reload
func (h *PluginManagerHandler) ReloadPlugins(c *gin.Context) {
    // Call APISIX Admin API to reload plugins
    resp, err := h.apisixClient.Put("/apisix/admin/plugins/reload", nil)
    if err != nil {
        c.JSON(500, gin.H{"error": "Failed to reload plugins"})
        return
    }
    c.JSON(200, gin.H{"message": "Plugins reloaded successfully"})
}
```

This allows the FuseOne dashboard to trigger plugin reloads from the UI after deploying updated plugin code.

---

## 4. Plugin Specifications

### 4.1 HTTP Callout Plugin (`http-callout`)

**Purpose**: Make HTTP(S) calls to external services during API request/response processing. Enables request enrichment, external authorization, data validation, and service composition.

**Execution Phase**: `access` (request) or `header_filter` (response)

**Priority**: 405 (runs after auth plugins, before proxy)

#### Configuration Schema

```json
{
  "type": "object",
  "properties": {
    "uri": {
      "type": "string",
      "description": "External service URL to call"
    },
    "method": {
      "type": "string",
      "default": "GET",
      "enum": ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"]
    },
    "headers": {
      "type": "object",
      "description": "Headers to send with the callout request",
      "additionalProperties": { "type": "string" }
    },
    "body": {
      "type": "string",
      "description": "Request body (supports $var substitution from original request)"
    },
    "timeout": {
      "type": "integer",
      "default": 3000,
      "description": "Timeout in milliseconds"
    },
    "ssl_verify": {
      "type": "boolean",
      "default": true
    },
    "keepalive": {
      "type": "boolean",
      "default": true
    },
    "extract": {
      "type": "array",
      "description": "Fields to extract from callout response and inject",
      "items": {
        "type": "object",
        "properties": {
          "source": {
            "type": "string",
            "description": "JSONPath expression on callout response body"
          },
          "target_header": {
            "type": "string",
            "description": "Request header name to inject the extracted value"
          }
        }
      }
    },
    "exit_on_error": {
      "type": "boolean",
      "default": false,
      "description": "Return error to client if callout fails"
    },
    "error_status": {
      "type": "integer",
      "default": 503
    },
    "error_message": {
      "type": "string",
      "default": "External service unavailable"
    },
    "fire_and_forget": {
      "type": "boolean",
      "default": false,
      "description": "Execute callout asynchronously without waiting for response"
    },
    "cache_ttl": {
      "type": "integer",
      "default": 0,
      "description": "Cache callout response for N seconds (0 = no cache)"
    }
  },
  "required": ["uri"]
}
```

#### Use Cases

1. **External Authorization**: Call auth service before allowing request
   ```json
   {
     "uri": "http://auth-service:8080/validate",
     "method": "POST",
     "body": "{\"token\": \"$http_authorization\"}",
     "exit_on_error": true,
     "error_status": 401,
     "extract": [
       { "source": "$.user_id", "target_header": "X-User-Id" },
       { "source": "$.roles", "target_header": "X-User-Roles" }
     ]
   }
   ```

2. **Request Enrichment**: Call user profile service to add metadata
   ```json
   {
     "uri": "http://user-service:8080/profile/$http_x_user_id",
     "method": "GET",
     "cache_ttl": 300,
     "extract": [
       { "source": "$.tier", "target_header": "X-User-Tier" },
       { "source": "$.company", "target_header": "X-Company" }
     ]
   }
   ```

3. **Webhook Notification**: Fire-and-forget to notify external system
   ```json
   {
     "uri": "https://hooks.slack.com/services/xxx/yyy/zzz",
     "method": "POST",
     "body": "{\"text\": \"API called: $request_uri\"}",
     "fire_and_forget": true
   }
   ```

#### Plugin Code Structure

```lua
-- custom-plugins/apisix/plugins/http-callout.lua
local core      = require("apisix.core")
local http      = require("resty.http")
local cjson     = require("cjson.safe")
local lrucache  = require("resty.lrucache")

local plugin_name = "http-callout"
local cache, err = lrucache.new(256)

local schema = { ... }  -- as above

local _M = {
    version  = 0.1,
    priority = 405,
    name     = plugin_name,
    schema   = schema,
}

function _M.check_schema(conf)
    return core.schema.check(schema, conf)
end

function _M.access(conf, ctx)
    -- 1. Build request URL with variable substitution
    -- 2. Check cache if cache_ttl > 0
    -- 3. Make HTTP call (or fire-and-forget via ngx.timer.at)
    -- 4. Extract fields from response via JSONPath
    -- 5. Inject into request headers
    -- 6. Handle errors per configuration
end

return _M
```

---

### 4.2 Data Masking Plugin (`data-masking`)

**Purpose**: Redact sensitive data (PII) from API response bodies before they reach the client. Critical for LGPD/GDPR compliance.

**Execution Phase**: `body_filter` (response)

**Priority**: 110 (runs late, after most transformations)

#### Configuration Schema

```json
{
  "type": "object",
  "properties": {
    "rules": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "description": "JSONPath to the field to mask (e.g., $.cpf, $.data[*].email)"
          },
          "strategy": {
            "type": "string",
            "enum": ["full", "partial", "hash", "email", "phone"],
            "default": "full"
          },
          "replacement": {
            "type": "string",
            "default": "***",
            "description": "Custom replacement string (for 'full' strategy)"
          },
          "visible_chars": {
            "type": "integer",
            "default": 4,
            "description": "Number of visible chars at end (for 'partial' strategy)"
          }
        },
        "required": ["path"]
      }
    },
    "content_types": {
      "type": "array",
      "default": ["application/json"],
      "description": "Response content-types to process"
    },
    "enabled_for_debug": {
      "type": "boolean",
      "default": false,
      "description": "If true, masking is bypassed when X-FuseOne-Debug header is present"
    }
  },
  "required": ["rules"]
}
```

#### Masking Strategies

| Strategy | Input | Output |
|---|---|---|
| `full` | `123.456.789-00` | `***` |
| `partial` (visible_chars=4) | `123.456.789-00` | `***9-00` |
| `hash` | `john@example.com` | `sha256:a1b2c3d4...` |
| `email` | `john@example.com` | `j***@example.com` |
| `phone` | `+55 11 99999-0000` | `+55 11 *****-0000` |

#### Example Configuration

```json
{
  "data-masking": {
    "rules": [
      { "path": "$.cpf", "strategy": "partial", "visible_chars": 3 },
      { "path": "$.data[*].email", "strategy": "email" },
      { "path": "$.credit_card", "strategy": "partial", "visible_chars": 4 },
      { "path": "$.data[*].phone", "strategy": "phone" },
      { "path": "$.password", "strategy": "full", "replacement": "[REDACTED]" }
    ]
  }
}
```

---

### 4.3 Threat Protection Plugin (`threat-protection`)

**Purpose**: Protect APIs against payload-based attacks (injection, oversized payloads, deep nesting).

**Execution Phase**: `access` (request)

**Priority**: 510 (runs early, before auth)

#### Configuration Schema

```json
{
  "type": "object",
  "properties": {
    "json": {
      "type": "object",
      "properties": {
        "max_depth": { "type": "integer", "default": 20 },
        "max_array_length": { "type": "integer", "default": 1000 },
        "max_object_entries": { "type": "integer", "default": 500 },
        "max_string_length": { "type": "integer", "default": 100000 },
        "max_body_size": { "type": "integer", "default": 1048576, "description": "Max body size in bytes (default 1MB)" }
      }
    },
    "injection": {
      "type": "object",
      "properties": {
        "sql_injection": { "type": "boolean", "default": true },
        "xss": { "type": "boolean", "default": true },
        "scan_headers": { "type": "boolean", "default": false },
        "scan_query": { "type": "boolean", "default": true },
        "scan_body": { "type": "boolean", "default": true }
      }
    },
    "action": {
      "type": "string",
      "enum": ["reject", "log"],
      "default": "reject",
      "description": "Action on threat detection: reject (403) or log-only"
    }
  }
}
```

---

## 5. FuseOne UI Integration

### Plugin Gallery Registration

Each custom plugin must be registered in `frontend/src/lib/constants.ts`:

```typescript
// Custom FuseOne plugins
{ name: "http-callout", label: "HTTP Callout", description: "Call external services during request processing", category: "transformation", phase: "request", icon: "Globe" },
{ name: "data-masking", label: "Data Masking", description: "Redact sensitive data (PII) from responses", category: "security", phase: "response", icon: "EyeOff" },
{ name: "threat-protection", label: "Threat Protection", description: "Protect against injection and payload attacks", category: "security", phase: "request", icon: "ShieldAlert" },
```

### Plugin Documentation

Each plugin must have documentation in `frontend/src/lib/plugin-docs.ts` with:
- Overview
- Use cases (4+)
- Best practices (4+)
- Cautions (3+)
- Configuration examples (3+)
- Related plugins

### Configuration Forms

Custom form components for complex plugin configurations:
- `http-callout`: URL builder, header editor, extraction rules builder, test button
- `data-masking`: JSONPath builder with preview, strategy selector per field
- `threat-protection`: Toggles for each protection type, threshold sliders

---

## 6. Testing Strategy

### Unit Tests (Lua)

```bash
# Install test framework
luarocks install busted

# Run tests
busted custom-plugins/spec/
```

### Integration Tests

```bash
# Start APISIX with custom plugins
docker compose up -d

# Run integration tests against APISIX
go test ./backend/internal/service/custom_plugins_test.go -v
```

### Test Matrix

| Plugin | Test Case | Expected |
|---|---|---|
| http-callout | Successful callout | Headers injected from response |
| http-callout | Callout timeout | Error returned (if exit_on_error) |
| http-callout | Fire-and-forget | Request continues immediately |
| http-callout | Cache hit | No external call, cached response used |
| data-masking | JSON with PII | Fields masked per strategy |
| data-masking | Non-JSON response | Passed through unchanged |
| data-masking | Nested array fields | All array items masked |
| threat-protection | Deep nested JSON | Rejected with 403 |
| threat-protection | SQL injection in query | Rejected with 403 |
| threat-protection | Normal request | Passed through |

---

## 7. Monitoring Custom Plugins

All custom plugins should log to APISIX's standard log system:

```lua
core.log.warn("http-callout: external call to ", conf.uri, " returned ", res.status)
core.log.error("data-masking: failed to parse JSON body: ", err)
```

Additionally, expose Prometheus metrics from custom plugins:

```lua
local prometheus = require("apisix.plugins.prometheus.exporter")

-- In plugin code:
prometheus.http_callout_total:inc(1, {route_id, status})
prometheus.http_callout_latency:observe(duration, {route_id})
```

---

## 8. Security Considerations

1. **HTTP Callout**: Never allow callouts to internal/private IPs by default. Implement SSRF protection with allowlists.
2. **Data Masking**: Never log unmasked data. The masking plugin should run BEFORE logging plugins.
3. **Threat Protection**: Keep injection patterns updated. Consider loading patterns from a configurable file.
4. **Plugin Code**: All custom plugins must be code-reviewed before deployment. The hot-reload endpoint should be restricted to admin role only.
