--
-- FuseOne Threat Protection Plugin
--
-- Protects APIs against payload-based attacks:
--   - JSON structure limits (depth, array size, object entries, string length, body size)
--   - SQL injection detection
--   - XSS detection
--
-- Priority: 510 (runs early, before auth plugins)
-- Phase: access
--

local core   = require("apisix.core")
local cjson  = require("cjson.safe")

local plugin_name = "threat-protection"

local ngx      = ngx
local type     = type
local pairs    = pairs
local ipairs   = ipairs
local tonumber = tonumber
local re_find  = ngx.re.find
local str_len  = string.len

-- SQL injection patterns (case-insensitive)
local SQL_PATTERNS = {
    [['\s*OR\s+.*=]],
    [['\s*OR\s+'.*']],
    [[UNION\s+SELECT]],
    [[;\s*DROP\s]],
    [[;\s*DELETE\s]],
    [[;\s*UPDATE\s]],
    [[;\s*INSERT\s]],
    [[--\s]],
    [[/\*.*\*/]],
    [['\s*;\s*]],
    [[EXEC\s*\(]],
    [[xp_cmdshell]],
    [[WAITFOR\s+DELAY]],
    [[BENCHMARK\s*\(]],
    [[SLEEP\s*\(]],
}

-- XSS patterns (case-insensitive)
local XSS_PATTERNS = {
    [[<\s*script]],
    [[javascript\s*:]],
    [[on\w+\s*=]],
    [[<\s*iframe]],
    [[<\s*img[^>]+onerror]],
    [[<\s*svg[^>]+onload]],
    [[<\s*body[^>]+onload]],
    [[<\s*embed]],
    [[<\s*object]],
    [[<\s*link[^>]+rel\s*=\s*["']import]],
    [[expression\s*\(]],
    [[url\s*\(]],
    [[eval\s*\(]],
    [[document\.\w+]],
    [[window\.\w+]],
    [[\.innerHTML\s*=]],
}

local json_schema = {
    type = "object",
    properties = {
        json = {
            type = "object",
            properties = {
                max_depth = {
                    type = "integer",
                    default = 20,
                    minimum = 1,
                    maximum = 1000,
                },
                max_array_length = {
                    type = "integer",
                    default = 1000,
                    minimum = 1,
                },
                max_object_entries = {
                    type = "integer",
                    default = 500,
                    minimum = 1,
                },
                max_string_length = {
                    type = "integer",
                    default = 100000,
                    minimum = 1,
                },
                max_body_size = {
                    type = "integer",
                    default = 1048576,  -- 1 MB
                    minimum = 1,
                },
            },
            default = {},
        },
        injection = {
            type = "object",
            properties = {
                sql_injection = {
                    type = "boolean",
                    default = true,
                },
                xss = {
                    type = "boolean",
                    default = true,
                },
                scan_headers = {
                    type = "boolean",
                    default = false,
                },
                scan_query = {
                    type = "boolean",
                    default = true,
                },
                scan_body = {
                    type = "boolean",
                    default = true,
                },
            },
            default = {},
        },
        action = {
            type = "string",
            default = "reject",
            enum = {"reject", "log"},
        },
    },
}

local _M = {
    version  = 0.1,
    priority = 510,
    name     = plugin_name,
    schema   = json_schema,
}


function _M.check_schema(conf)
    return core.schema.check(json_schema, conf)
end


-- Recursively validate JSON structure limits
local function validate_json_structure(value, conf, depth)
    local json_conf = conf.json or {}
    local max_depth = json_conf.max_depth or 20

    if depth > max_depth then
        return false, "JSON depth exceeds maximum of " .. max_depth
    end

    local val_type = type(value)

    if val_type == "string" then
        local max_str = json_conf.max_string_length or 100000
        if str_len(value) > max_str then
            return false, "JSON string length exceeds maximum of " .. max_str
        end

    elseif val_type == "table" then
        -- Check if it's an array
        local is_array = core.table.isarray(value)

        if is_array then
            local max_arr = json_conf.max_array_length or 1000
            if #value > max_arr then
                return false, "JSON array length exceeds maximum of " .. max_arr
            end
            for _, item in ipairs(value) do
                local ok, err = validate_json_structure(item, conf, depth + 1)
                if not ok then
                    return false, err
                end
            end
        else
            local max_obj = json_conf.max_object_entries or 500
            local count = 0
            for k, v in pairs(value) do
                count = count + 1
                if count > max_obj then
                    return false, "JSON object entries exceed maximum of " .. max_obj
                end
                -- Check key length
                local max_str = json_conf.max_string_length or 100000
                if str_len(k) > max_str then
                    return false, "JSON key length exceeds maximum of " .. max_str
                end
                local ok, err = validate_json_structure(v, conf, depth + 1)
                if not ok then
                    return false, err
                end
            end
        end
    end

    return true
end


-- Check a string for injection patterns
local function check_injection(str, conf)
    if not str or str == "" then
        return true
    end

    local inj = conf.injection or {}

    if inj.sql_injection ~= false then
        for _, pattern in ipairs(SQL_PATTERNS) do
            if re_find(str, pattern, "joi") then
                return false, "SQL injection pattern detected"
            end
        end
    end

    if inj.xss ~= false then
        for _, pattern in ipairs(XSS_PATTERNS) do
            if re_find(str, pattern, "joi") then
                return false, "XSS pattern detected"
            end
        end
    end

    return true
end


-- Handle threat detection based on action config
local function handle_threat(conf, reason)
    local action = conf.action or "reject"

    if action == "log" then
        core.log.warn("threat-protection: ", reason, " (log-only mode)")
        return  -- allow request to continue
    end

    return core.response.exit(403, {
        message = "Threat detected: " .. reason,
    })
end


function _M.access(conf, ctx)
    local json_conf = conf.json or {}
    local inj = conf.injection or {}

    -- 1. Check body size via Content-Length header
    local content_length = tonumber(core.request.header(ctx, "Content-Length"))
    local max_body = json_conf.max_body_size or 1048576
    if content_length and content_length > max_body then
        return handle_threat(conf, "Request body size (" .. content_length
            .. " bytes) exceeds maximum of " .. max_body)
    end

    -- 2. Scan query parameters for injection
    if inj.scan_query ~= false then
        local args = core.request.get_uri_args(ctx)
        if args then
            for name, val in pairs(args) do
                local values = type(val) == "table" and val or {val}
                for _, v in ipairs(values) do
                    if type(v) == "string" then
                        local ok, reason = check_injection(v, conf)
                        if not ok then
                            return handle_threat(conf, reason .. " in query parameter '" .. name .. "'")
                        end
                    end
                end
            end
        end
    end

    -- 3. Scan headers for injection
    if inj.scan_headers then
        local headers = core.request.headers(ctx)
        if headers then
            for name, val in pairs(headers) do
                local values = type(val) == "table" and val or {val}
                for _, v in ipairs(values) do
                    if type(v) == "string" then
                        local ok, reason = check_injection(v, conf)
                        if not ok then
                            return handle_threat(conf, reason .. " in header '" .. name .. "'")
                        end
                    end
                end
            end
        end
    end

    -- 4. Read and validate request body (JSON structure + injection)
    local body = core.request.get_body()
    if body and str_len(body) > 0 then
        -- Check actual body size
        if str_len(body) > max_body then
            return handle_threat(conf, "Request body size (" .. str_len(body)
                .. " bytes) exceeds maximum of " .. max_body)
        end

        -- Scan body for injection patterns
        if inj.scan_body ~= false then
            local ok, reason = check_injection(body, conf)
            if not ok then
                return handle_threat(conf, reason .. " in request body")
            end
        end

        -- Validate JSON structure
        local content_type = core.request.header(ctx, "Content-Type") or ""
        if content_type:find("application/json", 1, true) then
            local decoded, err = cjson.decode(body)
            if decoded then
                local ok, reason = validate_json_structure(decoded, conf, 1)
                if not ok then
                    return handle_threat(conf, reason)
                end
            end
            -- If JSON decode fails, skip structure validation (might not be JSON)
        end
    end
end


return _M
