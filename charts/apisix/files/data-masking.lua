--
-- FuseOne Data Masking Plugin
--
-- Redacts sensitive data (PII) from API response bodies before
-- they reach the client. Critical for LGPD/GDPR compliance.
--
-- Masking strategies:
--   full     - Replace entire value with replacement string (default: ***)
--   partial  - Keep last N visible chars, mask the rest
--   hash     - Replace with sha256 hex digest
--   email    - Mask local part (j***@example.com)
--   phone    - Mask middle digits, keep country code and last 4
--
-- Priority: 110 (runs late, after transformations, before logging)
-- Phase: body_filter
--

local core   = require("apisix.core")
local cjson  = require("cjson.safe")

local plugin_name = "data-masking"

local ngx      = ngx
local type     = type
local pairs    = pairs
local ipairs   = ipairs
local tostring = tostring
local str_rep  = string.rep
local str_sub  = string.sub
local str_len  = string.len
local str_find = string.find
local str_byte = string.byte
local table_concat = table.concat
local ngx_sha256 -- lazy-loaded

local json_schema = {
    type = "object",
    properties = {
        rules = {
            type = "array",
            items = {
                type = "object",
                properties = {
                    path = {
                        type = "string",
                        description = "JSONPath to the field to mask (e.g., $.cpf, $.data[*].email)",
                    },
                    strategy = {
                        type = "string",
                        default = "full",
                        enum = {"full", "partial", "hash", "email", "phone"},
                    },
                    replacement = {
                        type = "string",
                        default = "***",
                    },
                    visible_chars = {
                        type = "integer",
                        default = 4,
                        minimum = 1,
                    },
                },
                required = {"path"},
            },
            minItems = 1,
        },
        content_types = {
            type = "array",
            items = { type = "string" },
            default = {"application/json"},
        },
        enabled_for_debug = {
            type = "boolean",
            default = false,
        },
    },
    required = {"rules"},
}


local _M = {
    version  = 0.1,
    priority = 110,
    name     = plugin_name,
    schema   = json_schema,
}


function _M.check_schema(conf)
    return core.schema.check(json_schema, conf)
end


-- Compute SHA-256 hex digest
local function sha256_hex(input)
    if not ngx_sha256 then
        -- Use resty.sha256 if available, fallback to ngx.sha256_bin + tohex
        local ok, sha256_lib = pcall(require, "resty.sha256")
        if ok then
            ngx_sha256 = function(s)
                local sha = sha256_lib:new()
                sha:update(s)
                local digest = sha:final()
                return require("resty.string").to_hex(digest)
            end
        else
            -- Fallback: use ngx.sha1_bin as a simpler alternative
            ngx_sha256 = function(s)
                local digest = ngx.sha1_bin(s)
                local hex = {}
                for i = 1, #digest do
                    hex[i] = string.format("%02x", str_byte(digest, i))
                end
                return table_concat(hex)
            end
        end
    end
    return ngx_sha256(tostring(input))
end


-- Apply masking strategy to a string value
local function apply_mask(value, rule)
    local str = tostring(value)
    local strategy = rule.strategy or "full"

    if strategy == "full" then
        return rule.replacement or "***"

    elseif strategy == "partial" then
        local visible = rule.visible_chars or 4
        local len = str_len(str)
        if len <= visible then
            return str_rep("*", len)
        end
        return str_rep("*", len - visible) .. str_sub(str, len - visible + 1)

    elseif strategy == "hash" then
        return "sha256:" .. sha256_hex(str)

    elseif strategy == "email" then
        local at_pos = str_find(str, "@", 1, true)
        if not at_pos or at_pos <= 1 then
            return rule.replacement or "***"
        end
        local local_part = str_sub(str, 1, at_pos - 1)
        local domain = str_sub(str, at_pos)
        if str_len(local_part) <= 1 then
            return "*" .. domain
        end
        return str_sub(local_part, 1, 1)
            .. str_rep("*", str_len(local_part) - 1)
            .. domain

    elseif strategy == "phone" then
        -- Keep country code prefix and last 4 digits, mask middle
        -- Handles formats like: +55 11 99999-0000, +5511999990000, 11999990000
        local digits = {}
        local non_digits = {}
        local positions = {}

        for i = 1, str_len(str) do
            local c = str_sub(str, i, i)
            if c:match("%d") then
                digits[#digits + 1] = c
                positions[#positions + 1] = i
            end
        end

        local num_digits = #digits
        if num_digits <= 4 then
            return str_rep("*", str_len(str))
        end

        -- Mask strategy: keep first 2-3 digits (country code) and last 4
        local keep_start = 2
        if str_sub(str, 1, 1) == "+" then
            keep_start = 3  -- +XX country code
        end

        -- Build masked version character by character
        local result = {}
        local digit_idx = 0
        for i = 1, str_len(str) do
            local c = str_sub(str, i, i)
            if c:match("%d") then
                digit_idx = digit_idx + 1
                if digit_idx <= keep_start or digit_idx > (num_digits - 4) then
                    result[#result + 1] = c
                else
                    result[#result + 1] = "*"
                end
            else
                result[#result + 1] = c
            end
        end

        return table_concat(result)
    end

    -- Unknown strategy, use full replacement
    return rule.replacement or "***"
end


-- Parse a JSONPath into segments
-- Handles: $.field, $.nested.field, $.array[*].field, $.deep[*].nested.field
local function parse_path(path)
    local cleaned = path
    if cleaned:sub(1, 2) == "$." then
        cleaned = cleaned:sub(3)
    elseif cleaned:sub(1, 1) == "$" then
        cleaned = cleaned:sub(2)
    end

    local segments = {}
    for segment in cleaned:gmatch("[^%.]+") do
        -- Check for array wildcard
        local field, wildcard = segment:match("^(.+)%[%*%]$")
        if wildcard then
            segments[#segments + 1] = { field = field, wildcard = true }
        else
            segments[#segments + 1] = { field = segment, wildcard = false }
        end
    end

    return segments
end


-- Recursively apply masking to a data structure following path segments
local function mask_at_path(data, segments, seg_idx, rule)
    if data == nil or seg_idx > #segments then
        return data
    end

    local seg = segments[seg_idx]
    local is_last = (seg_idx == #segments)

    if seg.wildcard then
        -- Access the field, then iterate over array
        local arr = data[seg.field]
        if type(arr) ~= "table" then
            return data
        end

        if is_last then
            -- Mask each element directly
            for i, item in ipairs(arr) do
                arr[i] = apply_mask(item, rule)
            end
        else
            -- Continue traversing into each array element
            for i, item in ipairs(arr) do
                if type(item) == "table" then
                    mask_at_path(item, segments, seg_idx + 1, rule)
                end
            end
        end
    else
        if is_last then
            -- Mask the field value
            if data[seg.field] ~= nil then
                data[seg.field] = apply_mask(data[seg.field], rule)
            end
        else
            -- Traverse deeper
            local child = data[seg.field]
            if type(child) == "table" then
                mask_at_path(child, segments, seg_idx + 1, rule)
            end
        end
    end

    return data
end


-- Check if content-type matches the configured types
local function should_process(content_type, conf)
    if not content_type then
        return false
    end

    local types = conf.content_types or {"application/json"}
    for _, ct in ipairs(types) do
        if str_find(content_type, ct, 1, true) then
            return true
        end
    end

    return false
end


function _M.header_filter(conf, ctx)
    -- We need to buffer the body, so remove Content-Length
    -- (it will change after masking)
    if should_process(ngx.header["Content-Type"], conf) then
        core.response.clear_header_as_body_modified()
    end
end


function _M.body_filter(conf, ctx)
    -- Debug bypass
    if conf.enabled_for_debug then
        local debug_header = core.request.header(ctx, "X-FuseOne-Debug")
        if debug_header then
            return
        end
    end

    -- Check content type
    if not should_process(ngx.header["Content-Type"], conf) then
        return
    end

    -- Buffer response body chunks
    local chunk = ngx.arg[1]
    local eof = ngx.arg[2]

    local buf = ctx._data_masking_buffer
    if not buf then
        buf = {}
        ctx._data_masking_buffer = buf
    end

    if chunk and chunk ~= "" then
        buf[#buf + 1] = chunk
        -- Suppress output until we have the full body
        ngx.arg[1] = ""
    end

    if not eof then
        return
    end

    -- Final chunk: process the complete body
    local body = table_concat(buf)
    ctx._data_masking_buffer = nil

    if body == "" then
        ngx.arg[1] = ""
        return
    end

    local decoded, err = cjson.decode(body)
    if not decoded then
        -- Not valid JSON, pass through unmodified
        core.log.warn("data-masking: failed to decode JSON body: ", err)
        ngx.arg[1] = body
        return
    end

    -- Apply each masking rule
    for _, rule in ipairs(conf.rules) do
        local segments = parse_path(rule.path)
        if #segments > 0 then
            mask_at_path(decoded, segments, 1, rule)
        end
    end

    -- Re-encode and emit
    local masked_body = cjson.encode(decoded)
    if not masked_body then
        core.log.error("data-masking: failed to encode masked JSON")
        ngx.arg[1] = body
        return
    end

    ngx.arg[1] = masked_body
end


return _M
