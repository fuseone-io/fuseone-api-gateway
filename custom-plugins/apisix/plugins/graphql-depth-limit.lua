--
-- FuseOne GraphQL Depth Limit Plugin
--
-- Limits the nesting depth of GraphQL queries to prevent deeply nested
-- attacks that can cause excessive resource consumption on the backend.
--
-- A simple character-by-character scanner counts brace nesting depth
-- in the query string, skipping content inside quoted strings.
--
-- Priority: 505 (runs in the GraphQL security plugin range)
-- Phase: access
--

local core  = require("apisix.core")
local cjson = require("cjson.safe")

local plugin_name = "graphql-depth-limit"

local ngx      = ngx
local type     = type
local tostring = tostring
local str_byte = string.byte
local str_len  = string.len

-- Character codes for fast comparison
local CHAR_OPEN_BRACE  = str_byte("{")
local CHAR_CLOSE_BRACE = str_byte("}")
local CHAR_QUOTE       = str_byte('"')
local CHAR_BACKSLASH   = str_byte("\\")

local json_schema = {
    type = "object",
    properties = {
        max_depth = {
            type = "integer",
            default = 10,
            minimum = 1,
            maximum = 100,
            description = "Maximum allowed nesting depth of GraphQL queries",
        },
        action = {
            type = "string",
            default = "reject",
            enum = {"reject", "log"},
            description = "Action to take when depth is exceeded: reject (400) or log only",
        },
    },
}

local _M = {
    version  = 0.1,
    priority = 505,
    name     = plugin_name,
    schema   = json_schema,
}


function _M.check_schema(conf)
    return core.schema.check(json_schema, conf)
end


--- Calculate the maximum brace nesting depth of a GraphQL query string.
-- Scans character-by-character, skipping content inside double-quoted strings.
-- @param query  The raw GraphQL query string
-- @return       The maximum nesting depth found
local function calculate_depth(query)
    local depth = 0
    local max_depth = 0
    local in_string = false
    local len = str_len(query)
    local i = 1

    while i <= len do
        local ch = str_byte(query, i)

        if in_string then
            -- Inside a quoted string: skip escaped characters
            if ch == CHAR_BACKSLASH then
                i = i + 1  -- skip the next character (escaped)
            elseif ch == CHAR_QUOTE then
                in_string = false
            end
        else
            if ch == CHAR_QUOTE then
                in_string = true
            elseif ch == CHAR_OPEN_BRACE then
                depth = depth + 1
                if depth > max_depth then
                    max_depth = depth
                end
            elseif ch == CHAR_CLOSE_BRACE then
                depth = depth - 1
            end
        end

        i = i + 1
    end

    return max_depth
end


function _M.access(conf, ctx)
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

    -- 3. Calculate the maximum brace nesting depth
    local depth = calculate_depth(query)

    -- 4. Check against the configured maximum
    local max_depth = conf.max_depth or 10

    if depth > max_depth then
        local action = conf.action or "reject"

        if action == "log" then
            core.log.warn(plugin_name, ": GraphQL query depth (", depth,
                ") exceeds maximum of ", max_depth, " (log-only mode)")
            return
        end

        return core.response.exit(400, {
            message = "GraphQL query depth (" .. tostring(depth)
                .. ") exceeds maximum of " .. tostring(max_depth),
        })
    end
end


return _M
