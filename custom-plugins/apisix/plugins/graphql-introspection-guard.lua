--
-- FuseOne GraphQL Introspection Guard Plugin
--
-- Blocks GraphQL introspection queries (__schema, __type) in production
-- environments. Introspection is powerful for development but exposes the
-- full API schema to potential attackers in production.
--
-- An optional bypass list allows specific operation names to still perform
-- introspection (e.g., for internal tooling).
--
-- Priority: 503 (runs after depth and complexity checks)
-- Phase: access
--

local core  = require("apisix.core")
local cjson = require("cjson.safe")

local plugin_name = "graphql-introspection-guard"

local ngx      = ngx
local type     = type
local ipairs   = ipairs
local re_find  = ngx.re.find
local re_match = ngx.re.match

local json_schema = {
    type = "object",
    properties = {
        block_introspection = {
            type = "boolean",
            default = true,
            description = "When true, block queries containing __schema or __type",
        },
        allowed_operation_names = {
            type = "array",
            items = {
                type = "string",
            },
            default = {},
            description = "Operation names that are allowed to perform introspection (bypass list)",
        },
        action = {
            type = "string",
            default = "reject",
            enum = {"reject", "log"},
            description = "Action to take when introspection is detected: reject (403) or log only",
        },
    },
}

local _M = {
    version  = 0.1,
    priority = 503,
    name     = plugin_name,
    schema   = json_schema,
}


function _M.check_schema(conf)
    return core.schema.check(json_schema, conf)
end


--- Check if an operation name is in the allowed bypass list.
-- @param operation_name          The operation name from the request
-- @param allowed_operation_names Array of allowed operation name strings
-- @return                        true if the operation is allowed
local function is_operation_allowed(operation_name, allowed_operation_names)
    if not operation_name or not allowed_operation_names then
        return false
    end

    for _, allowed in ipairs(allowed_operation_names) do
        if allowed == operation_name then
            return true
        end
    end

    return false
end


--- Extract the operation name from a GraphQL query string.
-- Looks for patterns like `query OperationName {` or `query OperationName(`
-- @param query  The raw GraphQL query string
-- @return       The operation name string, or nil if not found
local function extract_operation_name(query)
    -- Match: query/mutation/subscription followed by an operation name
    local m, err = re_match(query,
        [[(?:query|mutation|subscription)\s+(\w+)]],
        "jo")

    if m and m[1] then
        return m[1]
    end

    return nil
end


function _M.access(conf, ctx)
    -- If introspection blocking is disabled, skip entirely
    local block = conf.block_introspection
    if block == false then
        return
    end

    -- 1. Read request body
    local body = core.request.get_body()
    if not body or body == "" then
        return
    end

    -- 2. Decode the JSON body (expects {query: "...", ...})
    local decoded, err = cjson.decode(body)
    if not decoded then
        core.log.warn(plugin_name, ": failed to decode JSON body: ", err)
        return
    end

    local query = decoded.query
    if not query or type(query) ~= "string" or query == "" then
        return
    end

    -- 3. Check if the query contains introspection fields (__schema or __type)
    local introspection_found = re_find(query, "__schema|__type", "jo")

    if not introspection_found then
        -- No introspection detected, allow the request
        return
    end

    -- 4. Introspection detected — check if the operation name is in the bypass list
    local allowed_names = conf.allowed_operation_names or {}
    if #allowed_names > 0 then
        -- Try to get the operation name from the JSON body first
        local operation_name = decoded.operationName

        -- Fall back to extracting from the query string
        if not operation_name or operation_name == "" then
            operation_name = extract_operation_name(query)
        end

        if is_operation_allowed(operation_name, allowed_names) then
            core.log.info(plugin_name, ": introspection allowed for operation '",
                operation_name, "'")
            return
        end
    end

    -- 5. Introspection is not allowed — take action
    local action = conf.action or "reject"

    if action == "log" then
        core.log.warn(plugin_name, ": GraphQL introspection detected (log-only mode)")
        return
    end

    core.log.warn(plugin_name, ": blocking GraphQL introspection query")

    return core.response.exit(403, {
        message = "GraphQL introspection is not allowed",
    })
end


return _M
