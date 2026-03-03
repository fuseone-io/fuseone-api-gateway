--
-- FuseOne API Composition Plugin
--
-- Orchestrates multiple HTTP calls and aggregates responses into a single
-- response. Supports sequential and parallel execution modes.
--
-- Built on patterns from http-callout.lua (SSRF protection, variable
-- substitution, JSONPath extraction).
--
-- Priority: 398 (after auth, close to http-callout at 405)
-- Phase: access
--

local core     = require("apisix.core")
local http     = require("resty.http")
local cjson    = require("cjson.safe")

local plugin_name = "api-composition"

local ngx      = ngx
local type     = type
local pairs    = pairs
local ipairs   = ipairs
local tostring = tostring
local tonumber = tonumber
local re_gsub  = ngx.re.gsub
local ngx_var  = ngx.var
local str_find = string.find

-- Private IP ranges for SSRF protection (same as http-callout)
local PRIVATE_RANGES = {
    { "127.0.0.0",     "127.255.255.255"   },
    { "10.0.0.0",      "10.255.255.255"    },
    { "172.16.0.0",    "172.31.255.255"    },
    { "192.168.0.0",   "192.168.255.255"   },
    { "169.254.0.0",   "169.254.255.255"   },
    { "0.0.0.0",       "0.255.255.255"     },
}

local function ip_to_num(ip)
    local o1, o2, o3, o4 = ip:match("^(%d+)%.(%d+)%.(%d+)%.(%d+)$")
    if not o1 then return nil end
    return tonumber(o1) * 16777216 + tonumber(o2) * 65536 + tonumber(o3) * 256 + tonumber(o4)
end

local function is_private_ip(ip)
    local n = ip_to_num(ip)
    if not n then return false end
    for _, range in ipairs(PRIVATE_RANGES) do
        local low = ip_to_num(range[1])
        local high = ip_to_num(range[2])
        if n >= low and n <= high then
            return true
        end
    end
    return false
end

-- Substitute $var with nginx variables and $ctx.key with context values
local function substitute_vars(s, ctx_data)
    if not s or type(s) ~= "string" then return s end

    -- First substitute $ctx.key references
    if ctx_data then
        s = re_gsub(s, [[\$ctx\.([a-zA-Z_]\w*)]], function(m)
            local key = m[1]
            local val = ctx_data[key]
            if val == nil then return "" end
            if type(val) == "table" then
                return cjson.encode(val) or ""
            end
            return tostring(val)
        end, "jo")
    end

    -- Then substitute $var nginx variable references
    s = re_gsub(s, [[\$([a-zA-Z_]\w*)]], function(m)
        local name = m[1]
        if name == "ctx" then return "$ctx" end  -- skip, handled above
        local val = ngx_var[name]
        return val or ""
    end, "jo")

    return s
end

-- Simple JSONPath extraction (same pattern as http-callout)
local function extract_jsonpath(data, path)
    if not data or not path then return nil end
    if path == "$" then return data end

    -- Remove leading $. or $
    local p = path
    if p:sub(1, 2) == "$." then
        p = p:sub(3)
    elseif p:sub(1, 1) == "$" then
        p = p:sub(2)
    end

    local current = data
    for segment in p:gmatch("[^.]+") do
        -- Array wildcard: field[*]
        local field, wildcard = segment:match("^(.+)%[%*%]$")
        if field then
            if type(current) ~= "table" then return nil end
            current = current[field]
            if type(current) ~= "table" then return nil end
            -- Collect from all array elements
            local results = {}
            for _, item in ipairs(current) do
                if type(item) == "table" then
                    results[#results + 1] = item
                else
                    results[#results + 1] = item
                end
            end
            current = results
        else
            -- Try numeric index first, then string key
            local idx = tonumber(segment)
            if idx and type(current) == "table" then
                current = current[idx]
            elseif type(current) == "table" then
                current = current[segment]
            else
                return nil
            end
        end
        if current == nil then return nil end
    end
    return current
end

-- Execute a single HTTP step
local function execute_step(step, ctx_data)
    local uri = substitute_vars(step.uri, ctx_data)
    if not uri or uri == "" then
        return nil, "empty URI"
    end

    -- SSRF protection: resolve and check
    local host_match = uri:match("https?://([^/:]+)")
    if host_match then
        -- Simple IP check (skip DNS resolution for non-IP hosts)
        if host_match:match("^%d+%.%d+%.%d+%.%d+$") and is_private_ip(host_match) then
            return nil, "SSRF protection: private IP blocked"
        end
    end

    local httpc = http.new()
    httpc:set_timeouts(
        step.timeout or 3000,  -- connect
        step.timeout or 3000,  -- send
        step.timeout or 3000   -- read
    )

    -- Build headers
    local headers = {}
    if step.headers then
        for k, v in pairs(step.headers) do
            headers[k] = substitute_vars(v, ctx_data)
        end
    end
    if not headers["Content-Type"] then
        headers["Content-Type"] = "application/json"
    end

    local body = nil
    if step.body and step.body ~= "" then
        body = substitute_vars(step.body, ctx_data)
    end

    local res, err = httpc:request_uri(uri, {
        method = step.method or "GET",
        headers = headers,
        body = body,
        ssl_verify = false,
    })

    if not res then
        return nil, "request failed: " .. (err or "unknown")
    end

    -- Parse response body
    local response_data = nil
    if res.body and res.body ~= "" then
        response_data = cjson.decode(res.body)
        if not response_data then
            response_data = res.body  -- Keep as string if not JSON
        end
    end

    return {
        status = res.status,
        headers = res.headers,
        body = response_data,
        raw_body = res.body,
    }, nil
end

-- Plugin schema
local step_schema = {
    type = "object",
    properties = {
        id = { type = "string", minLength = 1 },
        uri = { type = "string", minLength = 1 },
        method = {
            type = "string",
            default = "GET",
            enum = { "GET", "POST", "PUT", "DELETE", "PATCH", "HEAD" },
        },
        headers = {
            type = "object",
            additionalProperties = { type = "string" },
            default = {},
        },
        body = { type = "string", default = "" },
        timeout = {
            type = "integer",
            minimum = 100,
            maximum = 60000,
            default = 3000,
        },
        extract = {
            type = "array",
            items = {
                type = "object",
                properties = {
                    source = { type = "string" },
                    target = { type = "string" },
                },
                required = { "source", "target" },
            },
            default = {},
        },
        on_error = {
            type = "string",
            enum = { "skip", "abort", "fallback" },
            default = "skip",
        },
        fallback_value = { type = "string", default = "" },
    },
    required = { "id", "uri" },
}

local schema = {
    type = "object",
    properties = {
        steps = {
            type = "array",
            minItems = 1,
            items = step_schema,
        },
        execution = {
            type = "string",
            enum = { "parallel", "sequential" },
            default = "sequential",
        },
        response_template = { type = "string", default = "" },
        response_status = {
            type = "integer",
            minimum = 100,
            maximum = 599,
            default = 200,
        },
        response_content_type = {
            type = "string",
            default = "application/json",
        },
    },
    required = { "steps" },
}

local _M = {
    version = 0.1,
    priority = 398,
    name = plugin_name,
    schema = schema,
}

function _M.check_schema(conf)
    local ok, err = core.schema.check(schema, conf)
    if not ok then
        return false, err
    end
    return true
end

function _M.access(conf, ctx)
    local steps = conf.steps
    if not steps or #steps == 0 then
        return
    end

    local ctx_data = {}
    local errors = {}

    if conf.execution == "parallel" then
        -- Parallel execution using ngx.thread.spawn
        local threads = {}
        for i, step in ipairs(steps) do
            threads[i] = ngx.thread.spawn(execute_step, step, ctx_data)
        end

        -- Wait for all threads
        for i, thread in ipairs(threads) do
            local ok, result, err = ngx.thread.wait(thread)
            local step = steps[i]
            if ok and result then
                ctx_data[step.id] = result.body

                -- Apply extractions
                if step.extract then
                    for _, ext in ipairs(step.extract) do
                        local val = extract_jsonpath(result.body, ext.source)
                        if val ~= nil then
                            ctx_data[ext.target] = val
                        end
                    end
                end
            else
                local step_err = err or "thread failed"
                core.log.warn("api-composition: step '", step.id, "' failed: ", step_err)

                if step.on_error == "abort" then
                    return core.response.exit(502, {
                        error = "composition step failed",
                        step = step.id,
                        message = step_err,
                    })
                elseif step.on_error == "fallback" then
                    local fb = step.fallback_value or ""
                    ctx_data[step.id] = cjson.decode(fb) or fb
                else
                    ctx_data[step.id] = nil
                end
            end
        end
    else
        -- Sequential execution
        for _, step in ipairs(steps) do
            local result, err = execute_step(step, ctx_data)

            if result then
                ctx_data[step.id] = result.body

                -- Apply extractions
                if step.extract then
                    for _, ext in ipairs(step.extract) do
                        local val = extract_jsonpath(result.body, ext.source)
                        if val ~= nil then
                            ctx_data[ext.target] = val
                        end
                    end
                end
            else
                core.log.warn("api-composition: step '", step.id, "' failed: ", err)

                if step.on_error == "abort" then
                    return core.response.exit(502, {
                        error = "composition step failed",
                        step = step.id,
                        message = err,
                    })
                elseif step.on_error == "fallback" then
                    local fb = step.fallback_value or ""
                    ctx_data[step.id] = cjson.decode(fb) or fb
                else
                    ctx_data[step.id] = nil
                end
            end
        end
    end

    -- Build response from template
    local template = conf.response_template
    if template and template ~= "" then
        local response_body = substitute_vars(template, ctx_data)

        -- Try to validate as JSON for cleaner output
        local parsed = cjson.decode(response_body)
        if parsed then
            response_body = cjson.encode(parsed)
        end

        ngx.status = conf.response_status or 200
        ngx.header["Content-Type"] = conf.response_content_type or "application/json"
        ngx.say(response_body)
        return ngx.exit(ngx.status)
    else
        -- No template: return all context data as JSON
        ngx.status = conf.response_status or 200
        ngx.header["Content-Type"] = conf.response_content_type or "application/json"
        ngx.say(cjson.encode(ctx_data))
        return ngx.exit(ngx.status)
    end
end

return _M
