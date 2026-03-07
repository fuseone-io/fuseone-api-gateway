--
-- FuseOne Timing Plugin
-- Measures per-phase AND per-plugin processing time.
--
-- Priority 15000 ensures this plugin runs BEFORE opentelemetry (12011) and all
-- standard APISIX plugins in every phase.
--
-- Phase-level timings (ctx.fuseone_timing):
--   rewrite_ms              - total rewrite phase
--   access_plus_upstream_ms - access phase + upstream combined
--   header_filter_ms        - header_filter phase
--
-- Per-plugin timings (ctx.fuseone_timing.plugin_timing_json):
--   JSON array: [{"n":"key-auth","o":5,"d":8}, ...]
--   n = plugin name, o = offset_ms from ft_t0, d = duration_ms
--
-- Per-plugin instrumentation uses _M.init() + ngx.timer to monkey-patch
-- each loaded plugin's phase functions AFTER plugin.lua finishes populating
-- local_plugins_hash. This is safe because nginx workers are single-threaded.
--

local plugin_name = "fuseone-timing"
local core         = require("apisix.core")
local ngx          = ngx
local math         = math
local table        = table
local type         = type

-- High-resolution monotonic clock via LuaJIT FFI.
-- ngx.now() caches time during synchronous Lua (no I/O), returning 0 for fast plugins.
-- clock_gettime(CLOCK_MONOTONIC_RAW) reads the hardware clock directly — no caching.
local ffi = require("ffi")
ffi.cdef[[
    typedef long time_t;
    struct timespec { time_t tv_sec; long tv_nsec; };
    int clock_gettime(int clockid, struct timespec *tp);
]]
local CLOCK_MONOTONIC_RAW = 4   -- Linux constant; falls back to MONOTONIC on other OSes
local _ts_buf = ffi.new("struct timespec[1]")

-- Returns the current time in microseconds (µs) from the monotonic clock.
local function now_us()
    ffi.C.clock_gettime(CLOCK_MONOTONIC_RAW, _ts_buf)
    return tonumber(_ts_buf[0].tv_sec) * 1000000 + math.floor(tonumber(_ts_buf[0].tv_nsec) / 1000)
end

local schema = {
    type             = "object",
    properties       = {},
    additionalProperties = false,
}

local _M = {
    version  = 0.1,
    priority = 15000,
    name     = plugin_name,
    schema   = schema,
}

function _M.check_schema(conf)
    return core.schema.check(schema, conf)
end

-- ─── Per-plugin instrumentation ──────────────────────────────────────────────

local TIMED_PHASES = { "rewrite", "access", "header_filter" }

-- Append one timing entry to ctx.fuseone_pt.
-- t_start_us = now_us() snapshot (monotonic µs) taken BEFORE calling the plugin.
-- ctx.ft_t0_us = now_us() snapshot from our rewrite() hook (first plugin to run).
-- All times in MICROSECONDS; Go side converts to ns via * 1000.
local function record_plugin_time(ctx, pname, t_start_us, t_end_us)
    if not ctx.fuseone_pt then
        ctx.fuseone_pt = {}
    end
    local offset_us = ctx.ft_t0_us and (t_start_us - ctx.ft_t0_us) or 0
    local duration_us = t_end_us - t_start_us
    if duration_us < 0 then duration_us = 0 end
    if offset_us < 0 then offset_us = 0 end

    ctx.fuseone_pt[#ctx.fuseone_pt + 1] = {
        n = pname,
        o = offset_us,   -- offset in µs from ft_t0_us
        d = duration_us, -- duration in µs
    }
end

-- Permanently wrap a plugin module's phase functions with timing.
-- Guard flag prevents double-wrapping across hot-reloads when the module is
-- not evicted from package.loaded.
local function wrap_plugin(plug)
    if plug._fuseone_timed then return end
    plug._fuseone_timed = true

    local pname = plug.name

    for _, phase in ipairs(TIMED_PHASES) do
        local original = plug[phase]
        if type(original) == "function" then
            if phase == "rewrite" or phase == "access" then
                -- These phases return (code, body) — capture both return values.
                plug[phase] = function(conf, ctx)
                    local t0 = now_us()
                    local code, body = original(conf, ctx)
                    record_plugin_time(ctx, pname, t0, now_us())
                    return code, body
                end
            else
                -- header_filter: void call.
                plug[phase] = function(conf, ctx)
                    local t0 = now_us()
                    original(conf, ctx)
                    record_plugin_time(ctx, pname, t0, now_us())
                end
            end
        end
    end
end

-- Iterate all loaded HTTP plugins and apply timing wrappers.
local function wrap_all_plugins(plugin_module)
    local http_plugins = plugin_module.get_all({ "name" })
    if not http_plugins then return end

    for pname in pairs(http_plugins) do
        if pname ~= plugin_name then   -- don't instrument ourselves
            local plug = plugin_module.get(pname)
            if plug then
                wrap_plugin(plug)
            end
        end
    end

    core.log.info("fuseone-timing: per-plugin instrumentation applied")
end

-- _M.init() is called by plugin.lua's load_plugin() for every (re)load.
-- At this moment, local_plugins_hash is still being populated, so we defer
-- the actual wrapping via ngx.timer.at(0, …) — by the time the timer fires,
-- load() has finished and local_plugins_hash is complete.
function _M.init()
    local plugin_module = require("apisix.plugin")

    -- First startup: hook _M.load for hot-reload support.
    if not plugin_module._fuseone_timing_patched then
        plugin_module._fuseone_timing_patched = true

        local original_load = plugin_module.load
        plugin_module.load = function(config)
            local result = original_load(config)
            wrap_all_plugins(plugin_module)
            return result
        end
    end

    -- Defer wrapping to after current load() cycle completes (hash is fully populated).
    local ok, err = ngx.timer.at(0, function()
        wrap_all_plugins(plugin_module)
    end)
    if not ok then
        core.log.error("fuseone-timing: failed to schedule init timer: ", err)
    end
end

-- ─── Phase hooks (phase-level timestamps) ────────────────────────────────────

function _M.rewrite(conf, ctx)
    ctx.ft_t0    = ngx.now()    -- ms-precision for phase-level aggregates (rewrite_ms, etc.)
    ctx.ft_t0_us = now_us()     -- µs-precision for per-plugin offset calculations
end

function _M.access(conf, ctx)
    ctx.ft_t1 = ngx.now()
end

function _M.header_filter(conf, ctx)
    ctx.ft_t2 = ngx.now()
end

-- Serialize ctx.fuseone_pt (array of {n,o,d} tables) to a compact JSON string.
local function pt_to_json(pt)
    if not pt or #pt == 0 then return nil end
    local parts = {}
    for _, entry in ipairs(pt) do
        if entry.d > 0 then
            parts[#parts + 1] = '{"n":"' .. entry.n .. '","o":' .. entry.o .. ',"d":' .. entry.d .. "}"
        end
    end
    if #parts == 0 then return nil end
    return "[" .. table.concat(parts, ",") .. "]"
end

local function compute_timing(ctx)
    local t_now = ngx.now()
    local rewrite_ms = 0
    local access_plus_upstream_ms = 0
    local header_filter_ms = 0

    if ctx.ft_t1 then
        rewrite_ms = math.floor((ctx.ft_t1 - ctx.ft_t0) * 1000 + 0.5)
    end
    if ctx.ft_t1 and ctx.ft_t2 then
        access_plus_upstream_ms = math.floor((ctx.ft_t2 - ctx.ft_t1) * 1000 + 0.5)
    end
    if ctx.ft_t2 then
        header_filter_ms = math.floor((t_now - ctx.ft_t2) * 1000 + 0.5)
    end

    return {
        rewrite_ms              = rewrite_ms,
        access_plus_upstream_ms = access_plus_upstream_ms,
        header_filter_ms        = header_filter_ms,
        plugin_timing_json      = pt_to_json(ctx.fuseone_pt),
    }
end

function _M.body_filter(conf, ctx)
    -- Only compute once; body_filter may be called multiple times for chunked
    -- responses. OTel's delayed_body_filter (priority 12011) reads this same phase,
    -- so ctx.fuseone_timing must be ready before the OTel span is closed.
    if ctx.fuseone_timing or not ctx.ft_t0 then return end
    ctx.fuseone_timing = compute_timing(ctx)
end

function _M.log(conf, ctx)
    -- Fallback: if body_filter was never called (empty response body), compute
    -- timing here. OTel's log() fallback reads ctx.fuseone_timing via
    -- inject_late_attributes.
    if ctx.fuseone_timing or not ctx.ft_t0 then return end
    ctx.fuseone_timing = compute_timing(ctx)
    ctx.fuseone_timing.header_filter_ms = 0
end

return _M
