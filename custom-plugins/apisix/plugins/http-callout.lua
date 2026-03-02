--
-- FuseOne HTTP Callout Plugin
--
-- Makes HTTP(S) calls to external services during request processing.
-- Enables: request enrichment, external authorization, webhook notifications,
--          data validation against external services.
--
-- Error handling modes:
--   1. Default (exit_on_error=false, no exit_on_status) → ignore all errors, continue flow
--   2. exit_on_error=true → stop on ANY error (connection, timeout, HTTP status)
--   3. exit_on_status=[401,403] → stop ONLY on specific HTTP status codes;
--      connection/timeout errors are silently ignored (flow continues)
--
-- Priority: 405 (after auth plugins, before proxy-rewrite)
-- Phase: access
--

local core      = require("apisix.core")
local http      = require("resty.http")
local cjson     = require("cjson.safe")
local lrucache  = require("resty.lrucache")

local plugin_name = "http-callout"

local ngx      = ngx
local type     = type
local pairs    = pairs
local ipairs   = ipairs
local tostring = tostring
local tonumber = tonumber
local re_gsub  = ngx.re.gsub
local ngx_var  = ngx.var
local str_find = string.find

-- Response cache (shared across requests in the worker)
local response_cache, cache_err = lrucache.new(512)
if not response_cache then
    core.log.error("http-callout: failed to create LRU cache: ", cache_err)
end

-- Private IP ranges for SSRF protection
local PRIVATE_RANGES = {
    { "127.0.0.0",     "127.255.255.255"   },  -- loopback
    { "10.0.0.0",      "10.255.255.255"    },  -- class A private
    { "172.16.0.0",    "172.31.255.255"    },  -- class B private
    { "192.168.0.0",   "192.168.255.255"   },  -- class C private
    { "169.254.0.0",   "169.254.255.255"   },  -- link-local
    { "0.0.0.0",       "0.255.255.255"     },  -- unspecified
}

local function ip_to_num(ip)
    local o1, o2, o3, o4 = ip:match("(%d+)%.(%d+)%.(%d+)%.(%d+)")
    if not o1 then return nil end
    return tonumber(o1) * 16777216 + tonumber(o2) * 65536
         + tonumber(o3) * 256 + tonumber(o4)
end

local function is_private_ip(ip)
    local num = ip_to_num(ip)
    if not num then return false end

    for _, range in ipairs(PRIVATE_RANGES) do
        local low = ip_to_num(range[1])
        local high = ip_to_num(range[2])
        if num >= low and num <= high then
            return true
        end
    end

    return false
end


-- Simple JSONPath extractor for patterns: $.field, $.a.b.c, $.arr[*].field
local function jsonpath_extract(data, path)
    if not data or not path then
        return nil
    end

    -- Remove leading "$."
    local cleaned = path
    if cleaned:sub(1, 2) == "$." then
        cleaned = cleaned:sub(3)
    elseif cleaned:sub(1, 1) == "$" then
        cleaned = cleaned:sub(2)
    end

    if cleaned == "" then
        return data
    end

    local current = data
    -- Split by dots, handling [*] notation
    for segment in cleaned:gmatch("[^%.]+") do
        if current == nil then
            return nil
        end

        -- Check for array wildcard: field[*]
        local field, wildcard = segment:match("^(.+)%[%*%]$")
        if wildcard then
            -- Access the field first, then collect from all array elements
            if field and field ~= "" then
                current = current[field]
            end
            if type(current) ~= "table" then
                return nil
            end
            -- Return first match from array (for header injection we take first)
            if #current > 0 then
                current = current[1]
            else
                return nil
            end
        else
            -- Normal field access
            if type(current) ~= "table" then
                return nil
            end
            current = current[segment]
        end
    end

    return current
end


-- Substitute $variables in a string using ngx.var
local function substitute_vars(str)
    if not str or not str_find(str, "$", 1, true) then
        return str
    end

    local result = re_gsub(str, [[\$(\w+)]], function(m)
        local var_name = m[1]
        local val = ngx_var[var_name]
        return val or ""
    end, "jo")

    return result
end


-- Check if a status code is in the exit_on_status list
local function should_exit_on_status(status, exit_on_status)
    if not exit_on_status or #exit_on_status == 0 then
        return false
    end
    for _, code in ipairs(exit_on_status) do
        if code == status then
            return true
        end
    end
    return false
end


local json_schema = {
    type = "object",
    properties = {
        uri = {
            type = "string",
            description = "External service URL to call",
        },
        method = {
            type = "string",
            default = "GET",
            enum = {"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"},
        },
        headers = {
            type = "object",
            description = "Headers to send with the callout request",
        },
        body = {
            type = "string",
            description = "Request body (supports $var substitution)",
        },
        connect_timeout = {
            type = "integer",
            default = 3000,
            minimum = 100,
            maximum = 30000,
            description = "Connection timeout in milliseconds",
        },
        read_timeout = {
            type = "integer",
            default = 3000,
            minimum = 100,
            maximum = 60000,
            description = "Read timeout in milliseconds (time to wait for response)",
        },
        send_timeout = {
            type = "integer",
            default = 3000,
            minimum = 100,
            maximum = 30000,
            description = "Send timeout in milliseconds",
        },
        -- Legacy: single timeout sets all three
        timeout = {
            type = "integer",
            minimum = 100,
            maximum = 60000,
            description = "Unified timeout (sets connect, send, and read). Overridden by individual timeouts.",
        },
        ssl_verify = {
            type = "boolean",
            default = true,
        },
        keepalive = {
            type = "boolean",
            default = true,
        },
        extract = {
            type = "array",
            items = {
                type = "object",
                properties = {
                    source = {
                        type = "string",
                        description = "JSONPath on callout response body",
                    },
                    target_header = {
                        type = "string",
                        description = "Request header to inject the value into",
                    },
                },
                required = {"source", "target_header"},
            },
        },
        -- Error handling: 3 modes
        -- Mode 1 (default): exit_on_error=false, no exit_on_status → ignore everything
        -- Mode 2: exit_on_error=true → stop on ANY error (connection, timeout, HTTP >=400)
        -- Mode 3: exit_on_status=[401,403] → stop ONLY on these HTTP codes; connection/timeout errors continue
        exit_on_error = {
            type = "boolean",
            default = false,
            description = "Stop request on ANY callout error (connection, timeout, HTTP status)",
        },
        exit_on_status = {
            type = "array",
            items = {
                type = "integer",
                minimum = 100,
                maximum = 599,
            },
            description = "Stop request ONLY when callout returns one of these HTTP status codes. Connection/timeout errors are ignored.",
        },
        error_status = {
            type = "integer",
            default = 503,
            minimum = 400,
            maximum = 599,
            description = "HTTP status code to return to client when exiting on error",
        },
        error_message = {
            type = "string",
            default = "External service unavailable",
            description = "Error message to return to client when exiting on error",
        },
        fire_and_forget = {
            type = "boolean",
            default = false,
            description = "Execute callout asynchronously without waiting for response",
        },
        cache_ttl = {
            type = "integer",
            default = 0,
            minimum = 0,
            description = "Cache response for N seconds (0 = no cache)",
        },
    },
    required = {"uri"},
}


local _M = {
    version  = 0.2,
    priority = 405,
    name     = plugin_name,
    schema   = json_schema,
}


function _M.check_schema(conf)
    return core.schema.check(json_schema, conf)
end


-- Resolve effective timeouts from config
local function get_timeouts(conf)
    local default_timeout = conf.timeout or 3000
    return {
        connect = conf.connect_timeout or default_timeout,
        send    = conf.send_timeout or default_timeout,
        read    = conf.read_timeout or default_timeout,
    }
end


-- Perform the actual HTTP callout
-- Returns: result, err, is_connection_error
--   result: { status, headers, body } on success
--   err: error string on failure
--   is_connection_error: true if the error was connection/timeout (not HTTP status)
local function do_callout(conf, ctx)
    local uri = substitute_vars(conf.uri)
    local method = conf.method or "GET"
    local timeouts = get_timeouts(conf)

    -- SSRF protection: extract host from URI and check
    local host = uri:match("https?://([^/:]+)")
    if host then
        if is_private_ip(host) then
            core.log.error("http-callout: SSRF blocked - callout to private IP: ", host)
            return nil, "Callout to private IP addresses is not allowed", true
        end
    end

    -- Check cache
    if conf.cache_ttl and conf.cache_ttl > 0 and response_cache then
        local cache_key = method .. ":" .. uri
        local cached = response_cache:get(cache_key)
        if cached then
            core.log.info("http-callout: cache hit for ", cache_key)
            return cached, nil, false
        end
    end

    -- Build request
    local httpc = http.new()
    httpc:set_timeouts(timeouts.connect, timeouts.send, timeouts.read)

    local req_headers = {}
    req_headers["Content-Type"] = "application/json"

    if conf.headers then
        for k, v in pairs(conf.headers) do
            req_headers[k] = substitute_vars(tostring(v))
        end
    end

    local req_body = nil
    if conf.body then
        req_body = substitute_vars(conf.body)
    end

    local res, err = httpc:request_uri(uri, {
        method  = method,
        headers = req_headers,
        body    = req_body,
        ssl_verify = conf.ssl_verify ~= false,
        keepalive  = conf.keepalive ~= false,
    })

    if not res then
        core.log.error("http-callout: request to ", uri, " failed: ", err)
        return nil, err, true  -- connection/timeout error
    end

    if res.status >= 400 then
        core.log.warn("http-callout: external call to ", uri,
            " returned ", res.status)
    end

    local result = {
        status  = res.status,
        headers = res.headers,
        body    = res.body,
    }

    -- Cache successful responses
    if conf.cache_ttl and conf.cache_ttl > 0
       and res.status >= 200 and res.status < 300
       and response_cache then
        local cache_key = method .. ":" .. uri
        response_cache:set(cache_key, result, conf.cache_ttl)
    end

    return result, nil, false
end


-- Fire-and-forget callout (runs in background timer)
local function fire_and_forget(premature, conf, ctx_info)
    if premature then
        return
    end

    local uri = ctx_info.uri
    local method = conf.method or "GET"
    local timeouts = get_timeouts(conf)

    local httpc = http.new()
    httpc:set_timeouts(timeouts.connect, timeouts.send, timeouts.read)

    local req_headers = { ["Content-Type"] = "application/json" }
    if conf.headers then
        for k, v in pairs(conf.headers) do
            req_headers[k] = tostring(v)
        end
    end

    local res, err = httpc:request_uri(uri, {
        method  = method,
        headers = req_headers,
        body    = ctx_info.body,
        ssl_verify = conf.ssl_verify ~= false,
    })

    if not res then
        core.log.error("http-callout (fire-and-forget): request to ", uri,
            " failed: ", err)
    else
        core.log.info("http-callout (fire-and-forget): ", uri,
            " returned ", res.status)
    end
end


function _M.access(conf, ctx)
    -- Fire-and-forget mode
    if conf.fire_and_forget then
        local uri = substitute_vars(conf.uri)
        local body = conf.body and substitute_vars(conf.body) or nil

        -- Check SSRF
        local host = uri:match("https?://([^/:]+)")
        if host and is_private_ip(host) then
            core.log.error("http-callout: SSRF blocked (fire-and-forget) - ", host)
            return
        end

        local ok, err = ngx.timer.at(0, fire_and_forget, conf, {
            uri  = uri,
            body = body,
        })
        if not ok then
            core.log.error("http-callout: failed to start fire-and-forget timer: ", err)
        end
        return
    end

    -- Synchronous callout
    local result, err, is_conn_error = do_callout(conf, ctx)

    -- Determine if we have exit_on_status configured
    local has_exit_on_status = conf.exit_on_status and #conf.exit_on_status > 0

    -- Handle connection/timeout errors (no HTTP response received)
    if err then
        if has_exit_on_status then
            -- Mode 3: exit_on_status → connection errors are silently ignored
            core.log.warn("http-callout: connection error ignored (exit_on_status mode): ", err)
            return
        end

        if conf.exit_on_error then
            -- Mode 2: exit on any error
            local status = conf.error_status or 503
            local message = conf.error_message or "External service unavailable"
            return core.response.exit(status, { message = message })
        end

        -- Mode 1 (default): ignore error, continue
        core.log.warn("http-callout: continuing despite error: ", err)
        return
    end

    if not result then
        return
    end

    -- Handle HTTP status code errors
    if result.status >= 400 then
        if has_exit_on_status then
            -- Mode 3: only exit on specific status codes
            if should_exit_on_status(result.status, conf.exit_on_status) then
                local status = conf.error_status or result.status
                local message = conf.error_message or "External service returned error"
                return core.response.exit(status, { message = message })
            end
            -- Status not in list → continue flow
            core.log.info("http-callout: status ", result.status,
                " not in exit_on_status list, continuing")
        elseif conf.exit_on_error then
            -- Mode 2: exit on any HTTP error
            local status = conf.error_status or result.status
            local message = conf.error_message or "External service returned error"
            return core.response.exit(status, { message = message })
        end
        -- Mode 1 or status not matched → continue
    end

    -- Extract fields from callout response and inject as headers
    if conf.extract and result.body then
        local decoded = cjson.decode(result.body)
        if decoded then
            for _, rule in ipairs(conf.extract) do
                local value = jsonpath_extract(decoded, rule.source)
                if value ~= nil then
                    local str_val = tostring(value)
                    core.request.set_header(ctx, rule.target_header, str_val)
                    core.log.info("http-callout: injected header ",
                        rule.target_header, " = ", str_val)
                end
            end
        else
            core.log.warn("http-callout: failed to decode callout response as JSON")
        end
    end
end


return _M
