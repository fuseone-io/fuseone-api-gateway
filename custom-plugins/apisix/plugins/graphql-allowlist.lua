--
-- FuseOne GraphQL Allowlist Plugin
--
-- Only allows pre-registered (persisted) GraphQL queries. Unknown queries
-- are rejected or logged depending on the enforcement mode. Queries are
-- identified by their MD5 hash after normalization (whitespace collapsing
-- and trimming).
--
-- An LRU cache is used to store the hash lookup table so it is not
-- rebuilt on every request for the same configuration.
--
-- Priority: 506 (runs early, before depth and complexity checks)
-- Phase: access
--

local core      = require("apisix.core")
local cjson     = require("cjson.safe")
local lru_cache = require("resty.lrucache")

local plugin_name = "graphql-allowlist"

local ngx      = ngx
local type     = type
local pairs    = pairs
local ipairs   = ipairs
local tostring = tostring
local ngx_md5  = ngx.md5
local str_gsub = string.gsub
local str_match = string.match

-- LRU cache for hash lookup tables, keyed by a hash of the config's
-- allowed_queries array. Avoids rebuilding the lookup on every request.
local hash_lookup_cache, cache_err = lru_cache.new(128)
if not hash_lookup_cache then
    error("failed to create LRU cache for graphql-allowlist: " .. (cache_err or "unknown"))
end

local json_schema = {
    type = "object",
    properties = {
        enforce = {
            type = "boolean",
            default = false,
            description = "When true, reject queries not in the allowlist. When false, only log warnings.",
        },
        allowed_queries = {
            type = "array",
            items = {
                type = "object",
                properties = {
                    name = {
                        type = "string",
                        description = "Human-readable name for the query (for logging/reference)",
                    },
                    hash = {
                        type = "string",
                        description = "MD5 hash of the normalized query string",
                    },
                },
            },
            default = {},
            description = "List of allowed queries identified by their MD5 hash",
        },
        hash_algorithm = {
            type = "string",
            default = "sha256",
            enum = {"sha256", "md5"},
            description = "Hash algorithm used (md5 is used internally for simplicity)",
        },
    },
}

local _M = {
    version  = 0.1,
    priority = 506,
    name     = plugin_name,
    schema   = json_schema,
}


function _M.check_schema(conf)
    return core.schema.check(json_schema, conf)
end


--- Normalize a GraphQL query string for consistent hashing.
-- Trims leading/trailing whitespace and collapses multiple whitespace
-- characters into a single space.
-- @param query  The raw query string
-- @return       The normalized query string
local function normalize_query(query)
    -- Trim leading and trailing whitespace
    query = str_match(query, "^%s*(.-)%s*$") or query
    -- Collapse multiple whitespace characters into a single space
    query = str_gsub(query, "%s+", " ")
    return query
end


--- Build or retrieve a hash lookup table from the configuration.
-- The lookup table maps hash strings to query names for fast O(1) checks.
-- Results are cached in an LRU to avoid rebuilding on every request.
-- @param conf  The plugin configuration
-- @return      A table mapping hash -> name (or hash -> true if name is nil)
local function get_hash_lookup(conf)
    local allowed = conf.allowed_queries
    if not allowed or #allowed == 0 then
        return {}
    end

    -- Build a cache key from the serialized allowed_queries list
    local cache_key = cjson.encode(allowed)
    if not cache_key then
        cache_key = "empty"
    end
    local cache_key_hash = ngx_md5(cache_key)

    -- Check the LRU cache
    local lookup = hash_lookup_cache:get(cache_key_hash)
    if lookup then
        return lookup
    end

    -- Build the lookup table
    lookup = {}
    for _, entry in ipairs(allowed) do
        if entry.hash and entry.hash ~= "" then
            lookup[entry.hash] = entry.name or true
        end
    end

    -- Cache for future requests (TTL: 60 seconds)
    hash_lookup_cache:set(cache_key_hash, lookup, 60)

    return lookup
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

    -- 3. Normalize the query and compute its hash
    local normalized = normalize_query(query)
    local query_hash = ngx_md5(normalized)

    -- 4. Build/retrieve the lookup table and check membership
    local lookup = get_hash_lookup(conf)

    local found = lookup[query_hash]
    if found then
        -- Query is in the allowlist, proceed
        core.log.info(plugin_name, ": query matched allowlist entry: ",
            type(found) == "string" and found or query_hash)
        return
    end

    -- 5. Query not found in allowlist
    local enforce = conf.enforce
    if enforce == nil then
        enforce = false
    end

    if not enforce then
        -- Non-enforcing mode: log and allow
        core.log.warn(plugin_name, ": query not in allowlist (hash: ",
            query_hash, ") — enforce=false, allowing request")
        return
    end

    -- Enforcing mode: reject the query
    core.log.warn(plugin_name, ": rejecting unknown query (hash: ", query_hash, ")")

    return core.response.exit(403, {
        message = "GraphQL query not in allowlist",
        hash = query_hash,
    })
end


return _M
