--
-- FuseOne GraphQL Complexity Plugin
--
-- Cost-based complexity analysis for GraphQL queries. Each field selection
-- has a configurable cost, and list arguments (e.g., `first: 100`) act as
-- multipliers. If the total estimated complexity exceeds the configured
-- maximum, the request is rejected or logged.
--
-- The parser uses a heuristic approach: it scans for field names (word
-- characters before `{` or `(`, or standalone between braces) rather than
-- building a full GraphQL AST. This is intentionally lightweight for use
-- at the gateway layer.
--
-- Priority: 504 (runs after depth limit, before introspection guard)
-- Phase: access
--

local core  = require("apisix.core")
local cjson = require("cjson.safe")

local plugin_name = "graphql-complexity"

local ngx       = ngx
local type      = type
local pairs     = pairs
local tostring  = tostring
local tonumber  = tonumber
local re_gmatch = ngx.re.gmatch
local re_find   = ngx.re.find
local str_len   = string.len

local json_schema = {
    type = "object",
    properties = {
        max_complexity = {
            type = "integer",
            default = 1000,
            minimum = 1,
            description = "Maximum total complexity score allowed for a query",
        },
        default_field_cost = {
            type = "integer",
            default = 1,
            minimum = 0,
            description = "Default cost assigned to each field selection",
        },
        field_costs = {
            type = "object",
            additionalProperties = {
                type = "integer",
                minimum = 0,
            },
            default = {},
            description = "Map of field names to their specific cost values",
        },
        list_size_argument = {
            type = "string",
            default = "first",
            description = "Argument name used to detect list sizes (e.g., first, limit, count)",
        },
        action = {
            type = "string",
            default = "reject",
            enum = {"reject", "log"},
            description = "Action to take when complexity is exceeded: reject (400) or log only",
        },
    },
}

local _M = {
    version  = 0.1,
    priority = 504,
    name     = plugin_name,
    schema   = json_schema,
}


function _M.check_schema(conf)
    return core.schema.check(json_schema, conf)
end


--- Extract a list size multiplier from a field's argument list.
-- Looks for patterns like `(first: 100)` or `(limit: 50)` near the field.
-- @param query              The full query string
-- @param pos                The position right after the field name
-- @param list_size_argument The argument name to look for (e.g., "first")
-- @return                   The multiplier (integer >= 1)
local function extract_list_multiplier(query, pos, list_size_argument)
    -- Look for an opening parenthesis right after the field name (with optional whitespace)
    local args_start = re_find(query, [[\s*\(]], "jo", nil, nil, pos)
    if not args_start then
        return 1
    end

    -- Search for the list size argument within the parenthesized section
    -- Pattern: argument_name followed by colon and a number
    local pattern = list_size_argument .. [[\s*:\s*(\d+)]]
    local m, err = re_gmatch(query, pattern, "jo")
    if not m then
        return 1
    end

    -- We scan all occurrences but only care about the one closest to our field.
    -- For simplicity in the heuristic, return the first match found.
    local captures = m()
    if captures and captures[1] then
        local size = tonumber(captures[1])
        if size and size > 0 then
            return size
        end
    end

    return 1
end


--- Calculate the total complexity of a GraphQL query using heuristic field scanning.
-- Fields are identified as word sequences before `{`, `(`, or as leaf fields
-- (words followed by whitespace/newline/comma/`}` inside selection sets).
-- @param query               The raw GraphQL query string
-- @param field_costs         Map of field name -> cost
-- @param default_field_cost  Default cost for unlisted fields
-- @param list_size_argument  Name of the list size argument
-- @return                    Total estimated complexity score
local function calculate_complexity(query, field_costs, default_field_cost, list_size_argument)
    local total_cost = 0

    -- Match field names: word characters that appear in typical field positions.
    -- This captures:
    --   - Fields followed by `{` (object fields with sub-selections)
    --   - Fields followed by `(` (fields with arguments)
    --   - Standalone leaf fields (words between braces/newlines)
    -- Excludes GraphQL keywords: query, mutation, subscription, fragment, on
    local iterator, err = re_gmatch(query,
        [[(?<=[{\s,\n])(\w+)\s*(?=[{(:])|(?<=[{\s,\n])(\w+)\s*(?=[\s,}\n])]],
        "jo")

    if not iterator then
        core.log.warn(plugin_name, ": regex error in complexity scan: ", err)
        return 0
    end

    while true do
        local captures = iterator()
        if not captures then
            break
        end

        local field_name = captures[1] or captures[2]
        if field_name then
            -- Skip GraphQL structural keywords
            if field_name ~= "query"
                and field_name ~= "mutation"
                and field_name ~= "subscription"
                and field_name ~= "fragment"
                and field_name ~= "on"
                and field_name ~= "true"
                and field_name ~= "false"
                and field_name ~= "null" then

                -- Look up the cost for this field
                local cost = default_field_cost
                if field_costs and field_costs[field_name] then
                    cost = field_costs[field_name]
                end

                -- Check for list size multiplier
                local multiplier = extract_list_multiplier(
                    query, 0, list_size_argument)

                total_cost = total_cost + (cost * multiplier)
            end
        end
    end

    return total_cost
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

    -- 3. Calculate total complexity
    local field_costs = conf.field_costs or {}
    local default_field_cost = conf.default_field_cost or 1
    local list_size_argument = conf.list_size_argument or "first"

    local complexity = calculate_complexity(
        query, field_costs, default_field_cost, list_size_argument)

    -- 4. Check against the configured maximum
    local max_complexity = conf.max_complexity or 1000

    if complexity > max_complexity then
        local action = conf.action or "reject"

        if action == "log" then
            core.log.warn(plugin_name, ": GraphQL query complexity (", complexity,
                ") exceeds maximum of ", max_complexity, " (log-only mode)")
            return
        end

        return core.response.exit(400, {
            message = "GraphQL query complexity (" .. tostring(complexity)
                .. ") exceeds maximum of " .. tostring(max_complexity),
        })
    end
end


return _M
