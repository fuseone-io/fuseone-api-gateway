"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Activity,
  AlertTriangle,
  Calendar,
  Clock,
  RefreshCw,
  Search,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { TraceDetailSheet } from "@/components/trace-detail-sheet"
import { api } from "@/lib/api-client"
import type { RequestTrace, TraceListParams, TracingStatus } from "@/types/trace"
import { toast } from "sonner"

const AUTO_REFRESH_INTERVAL = 10_000

const HTTP_METHODS = ["__all__", "GET", "POST", "PUT", "PATCH", "DELETE"] as const

const TIME_PERIODS = [
  { value: "__all__", label: "All Time" },
  { value: "15m", label: "Last 15min" },
  { value: "1h", label: "Last 1h" },
  { value: "6h", label: "Last 6h" },
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "Last 7d" },
  { value: "30d", label: "Last 30d" },
  { value: "custom", label: "Custom" },
] as const

function getTimeFrom(period: string): string | undefined {
  if (period === "__all__" || period === "custom") return undefined
  const now = new Date()
  const units: Record<string, number> = {
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  }
  const ms = units[period]
  if (!ms) return undefined
  return new Date(now.getTime() - ms).toISOString()
}

function nsToMs(ns: number): string {
  const ms = ns / 1_000_000
  if (ms < 1) return `${(ns / 1_000).toFixed(0)}µs`
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function statusColor(code: number): string {
  if (code >= 200 && code < 300) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
  if (code >= 300 && code < 400) return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
  if (code >= 400 && code < 500) return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
  return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
}

function methodColor(method: string): string {
  switch (method?.toUpperCase()) {
    case "GET": return "text-emerald-600"
    case "POST": return "text-blue-600"
    case "PUT": return "text-amber-600"
    case "DELETE": return "text-red-600"
    case "PATCH": return "text-purple-600"
    default: return "text-muted-foreground"
  }
}

interface TracesTabProps {
  routeId?: string
  apiId?: string
}

export function TracesTab({ routeId, apiId }: TracesTabProps = {}) {
  const [traces, setTraces] = useState<RequestTrace[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [selectedTrace, setSelectedTrace] = useState<RequestTrace | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [status, setStatus] = useState<TracingStatus | null>(null)

  // Filters
  const [search, setSearch] = useState("")
  const [method, setMethod] = useState("__all__")
  const [statusFilter, setStatusFilter] = useState("__all__")
  const [timePeriod, setTimePeriod] = useState("24h")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [page, setPage] = useState(0)
  const limit = 50

  const fetchTraces = useCallback(async () => {
    try {
      const params: TraceListParams = {
        limit,
        offset: page * limit,
      }
      if (apiId) params.api_id = apiId
      else if (routeId) params.route_id = routeId
      if (search) params.search = search
      if (method !== "__all__") params.method = method
      if (statusFilter === "2xx") { params.status_min = 200; params.status_max = 299 }
      else if (statusFilter === "4xx") { params.status_min = 400; params.status_max = 499 }
      else if (statusFilter === "5xx") { params.status_min = 500; params.status_max = 599 }
      else if (statusFilter === "error") { params.status_min = 400 }

      if (timePeriod === "custom") {
        if (customFrom) params.from = new Date(customFrom).toISOString()
        if (customTo) params.to = new Date(customTo).toISOString()
      } else {
        const from = getTimeFrom(timePeriod)
        if (from) params.from = from
      }

      const res = await api.listTraces(params)
      setTraces(res.data || [])
      setTotal(res.meta?.total || 0)
      setError(null)
      setLastRefresh(new Date())
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch traces"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [routeId, apiId, search, method, statusFilter, timePeriod, customFrom, customTo, page])

  const fetchStatus = useCallback(async () => {
    try {
      const s = await api.getTracingStatus()
      setStatus(s)
    } catch {
      // Non-critical
    }
  }, [])

  useEffect(() => {
    fetchTraces()
    fetchStatus()
  }, [fetchTraces, fetchStatus])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchTraces, AUTO_REFRESH_INTERVAL)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, fetchTraces])

  const handleRefresh = () => {
    setLoading(true)
    fetchTraces().then(() => toast.success("Traces refreshed"))
  }

  const handleTraceClick = (trace: RequestTrace) => {
    setSelectedTrace(trace)
    setSheetOpen(true)
  }

  const totalPages = Math.ceil(total / limit)

  if (loading && traces.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && traces.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <p className="text-lg font-medium">Unable to fetch traces</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Button variant="outline" className="mt-4" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Status + Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {status && (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={status.enabled ? "border-emerald-400 text-emerald-600" : "border-red-400 text-red-600"}
              >
                {status.enabled ? "Tracing Enabled" : "Tracing Disabled"}
              </Badge>
              {status.sample_rate < 1 && (
                <Badge variant="outline" className="text-[10px]">
                  Sample: {(status.sample_rate * 100).toFixed(0)}%
                </Badge>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="trace-auto-refresh" />
            <label htmlFor="trace-auto-refresh" className="text-sm text-muted-foreground cursor-pointer">
              Auto-refresh
            </label>
          </div>
          {lastRefresh && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search URI..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={method} onValueChange={(v) => { setMethod(v); setPage(0) }}>
          <SelectTrigger className="w-28 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HTTP_METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                {m === "__all__" ? "All Methods" : m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0) }}>
          <SelectTrigger className="w-28 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Status</SelectItem>
            <SelectItem value="2xx">2xx</SelectItem>
            <SelectItem value="4xx">4xx</SelectItem>
            <SelectItem value="5xx">5xx</SelectItem>
            <SelectItem value="error">Errors (4xx+)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={timePeriod} onValueChange={(v) => { setTimePeriod(v); setPage(0) }}>
          <SelectTrigger className="w-32 h-9 text-sm">
            <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_PERIODS.map((tp) => (
              <SelectItem key={tp.value} value={tp.value}>
                {tp.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {timePeriod === "custom" && (
          <>
            <Input
              type="datetime-local"
              value={customFrom}
              onChange={(e) => { setCustomFrom(e.target.value); setPage(0) }}
              className="w-44 h-9 text-xs"
              placeholder="From"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="datetime-local"
              value={customTo}
              onChange={(e) => { setCustomTo(e.target.value); setPage(0) }}
              className="w-44 h-9 text-xs"
              placeholder="To"
            />
          </>
        )}
        <div className="text-xs text-muted-foreground">
          {total} traces
        </div>
      </div>

      {/* Traces table */}
      {traces.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-medium">No traces found</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Request traces will appear here when the OpenTelemetry plugin is enabled on your routes.
              Enable tracing on a route to start collecting data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-16">Method</TableHead>
                    <TableHead className="text-xs">URI</TableHead>
                    <TableHead className="text-xs w-16">Status</TableHead>
                    <TableHead className="text-xs w-24 text-right">Duration</TableHead>
                    <TableHead className="text-xs w-14 text-right">Spans</TableHead>
                    <TableHead className="text-xs w-36">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {traces.map((trace) => (
                    <TableRow
                      key={trace.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleTraceClick(trace)}
                    >
                      <TableCell>
                        <span className={`text-xs font-mono font-bold ${methodColor(trace.method)}`}>
                          {trace.method || "???"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-mono truncate max-w-[300px]">
                        {trace.uri || "/"}
                      </TableCell>
                      <TableCell>
                        {trace.status_code > 0 ? (
                          <Badge className={`text-[10px] ${statusColor(trace.status_code)}`}>
                            {trace.status_code}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-right">
                        {nsToMs(trace.duration_ns)}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">
                        {trace.spans.length}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(trace.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail sheet */}
      <TraceDetailSheet
        trace={selectedTrace}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  )
}
