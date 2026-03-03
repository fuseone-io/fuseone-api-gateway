export interface ScriptSnippet {
  id: string
  title: string
  description: string
  category: "headers" | "security" | "transform" | "logging" | "routing"
  code: string
}

export const SCRIPT_LIBRARY: ScriptSnippet[] = [
  {
    id: "add-header",
    title: "Add Custom Header",
    description: "Add a custom header to the request before it reaches the upstream",
    category: "headers",
    code: `return function(conf, ctx)
  ngx.req.set_header("X-Custom-Source", "fuseone-gateway")
  ngx.req.set_header("X-Request-Time", ngx.now())
end`,
  },
  {
    id: "copy-header",
    title: "Copy Header Value",
    description: "Copy a header value to another header name",
    category: "headers",
    code: `return function(conf, ctx)
  local auth = ngx.req.get_headers()["Authorization"]
  if auth then
    ngx.req.set_header("X-Original-Auth", auth)
  end
end`,
  },
  {
    id: "reject-ip-range",
    title: "Reject by IP Range",
    description: "Block requests from specific IP addresses or CIDR ranges",
    category: "security",
    code: `return function(conf, ctx)
  local blocked = {
    "192.168.1.100",
    "10.0.0.50",
  }
  local ip = ngx.var.remote_addr
  for _, blocked_ip in ipairs(blocked) do
    if ip == blocked_ip then
      ngx.status = 403
      ngx.say('{"error": "Forbidden"}')
      return ngx.exit(403)
    end
  end
end`,
  },
  {
    id: "require-header",
    title: "Require Specific Header",
    description: "Reject requests missing a required header",
    category: "security",
    code: `return function(conf, ctx)
  local api_key = ngx.req.get_headers()["X-API-Key"]
  if not api_key or api_key == "" then
    ngx.status = 401
    ngx.say('{"error": "Missing X-API-Key header"}')
    return ngx.exit(401)
  end
end`,
  },
  {
    id: "log-request",
    title: "Log Request Details",
    description: "Log method, URI, and headers to the error log for debugging",
    category: "logging",
    code: `return function(conf, ctx)
  local method = ngx.req.get_method()
  local uri = ngx.var.request_uri
  local headers = ngx.req.get_headers()
  ngx.log(ngx.WARN, string.format(
    "[DEBUG] %s %s | Host: %s | UA: %s",
    method, uri,
    headers["host"] or "-",
    headers["user-agent"] or "-"
  ))
end`,
  },
  {
    id: "log-body",
    title: "Log Request Body",
    description: "Read and log the request body (useful for debugging POST/PUT)",
    category: "logging",
    code: `return function(conf, ctx)
  ngx.req.read_body()
  local body = ngx.req.get_body_data()
  if body then
    ngx.log(ngx.WARN, "[DEBUG] Request body: ", body)
  end
end`,
  },
  {
    id: "transform-json-field",
    title: "Transform JSON Field",
    description: "Parse request body, rename or remove fields, then rewrite body",
    category: "transform",
    code: `return function(conf, ctx)
  ngx.req.read_body()
  local body = ngx.req.get_body_data()
  if not body then return end

  local cjson = require("cjson.safe")
  local data = cjson.decode(body)
  if not data then return end

  -- Rename field
  if data["old_field"] then
    data["new_field"] = data["old_field"]
    data["old_field"] = nil
  end

  -- Remove sensitive field
  data["password"] = nil

  ngx.req.set_body_data(cjson.encode(data))
end`,
  },
  {
    id: "inject-timestamp",
    title: "Inject Timestamp",
    description: "Add a timestamp field to the JSON request body",
    category: "transform",
    code: `return function(conf, ctx)
  ngx.req.read_body()
  local body = ngx.req.get_body_data()
  if not body then return end

  local cjson = require("cjson.safe")
  local data = cjson.decode(body)
  if not data then return end

  data["timestamp"] = ngx.now()
  data["request_id"] = ngx.var.request_id or ""

  ngx.req.set_body_data(cjson.encode(data))
  ngx.req.set_header("Content-Length", #cjson.encode(data))
end`,
  },
  {
    id: "route-by-header",
    title: "Route by Header Value",
    description: "Override upstream host based on a header value",
    category: "routing",
    code: `return function(conf, ctx)
  local version = ngx.req.get_headers()["X-API-Version"]
  if version == "v2" then
    ctx.var.upstream_host = "v2-backend.internal"
  end
end`,
  },
  {
    id: "maintenance-mode",
    title: "Maintenance Mode",
    description: "Return a maintenance response for all requests",
    category: "routing",
    code: `return function(conf, ctx)
  local enabled = false  -- Set to true to enable maintenance mode

  if enabled then
    ngx.status = 503
    ngx.header["Content-Type"] = "application/json"
    ngx.header["Retry-After"] = "3600"
    ngx.say('{"error": "Service temporarily unavailable", "message": "Scheduled maintenance in progress"}')
    return ngx.exit(503)
  end
end`,
  },
  {
    id: "cors-preflight",
    title: "Custom CORS Handler",
    description: "Handle CORS preflight with custom origin validation",
    category: "security",
    code: `return function(conf, ctx)
  local origin = ngx.req.get_headers()["Origin"]
  if not origin then return end

  -- Allow specific origins
  local allowed = {
    ["https://app.example.com"] = true,
    ["https://admin.example.com"] = true,
  }

  if allowed[origin] then
    ngx.header["Access-Control-Allow-Origin"] = origin
    ngx.header["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    ngx.header["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    ngx.header["Access-Control-Max-Age"] = "3600"
  end

  if ngx.req.get_method() == "OPTIONS" then
    ngx.status = 204
    return ngx.exit(204)
  end
end`,
  },
  {
    id: "response-wrapper",
    title: "Wrap Response in Envelope",
    description: "Post-function: wrap upstream response in a standard envelope",
    category: "transform",
    code: `return function(conf, ctx)
  -- Note: This works with body_filter phase
  -- For serverless-post-function, use header_filter phase to set headers
  ngx.header["X-Response-Wrapped"] = "true"
  ngx.header["X-Response-Time"] = ngx.now() - ngx.req.start_time()
end`,
  },
]

export const SCRIPT_CATEGORIES: Record<string, { label: string; color: string }> = {
  headers: { label: "Headers", color: "text-blue-500 bg-blue-500/10" },
  security: { label: "Security", color: "text-red-500 bg-red-500/10" },
  transform: { label: "Transform", color: "text-purple-500 bg-purple-500/10" },
  logging: { label: "Logging", color: "text-green-500 bg-green-500/10" },
  routing: { label: "Routing", color: "text-amber-500 bg-amber-500/10" },
}
