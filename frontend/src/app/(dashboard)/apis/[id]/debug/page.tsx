"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bug,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Filter,
  Gauge,
  Info,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api-client"
import {
  methodColor,
  formatLatency,
  formatTime,
  formatSize,
  tryFormatJSON,
  statusBadgeClass,
  computeDebugStats,
} from "@/lib/debug-utils"
import { useDebugStore } from "@/stores/debug-store"
import type { DebugLog, DebugLogFilter } from "@/types/debug"
import type { ApiDefRecord } from "@/types/api"
import { toast } from "sonner"

const PAGE_SIZE = 30
const POLL_INTERVAL = 3_000

/* ─── Detail Sheet ─── */

function LogDetailSheet({ log, open, onClose }: { log: DebugLog | null; open: boolean; onClose: () => void }) {
  if (!log) return null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="data-[side=right]:sm:max-w-[50vw] flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className="px-6 pr-12 py-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span className={`font-mono font-bold ${methodColor(log.req_method)}`}>
              {log.req_method}
            </span>
            <span className="font-mono text-sm truncate flex-1">{log.req_uri}</span>
            <Badge variant="outline" className={`shrink-0 font-mono text-[11px] ${statusBadgeClass(log.resp_status)}`}>
              {log.resp_status}
            </Badge>
          </SheetTitle>
          <SheetDescription className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(log.request_time)}
            </span>
            <span>Route: <span className="font-mono">{log.route_id}</span></span>
            {log.service_id && <span>Service: <span className="font-mono">{log.service_id}</span></span>}
            {log.consumer_name && <span>Application: <span className="font-mono">{log.consumer_name}</span></span>}
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6 space-y-6">
            {/* Summary grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <SummaryCell label="Client IP" value={log.client_ip || "-"} mono />
              <SummaryCell label="Upstream" value={log.upstream_addr || "-"} mono />
              <SummaryCell label="Req Size" value={formatSize(log.req_size)} />
              <SummaryCell label="Resp Size" value={formatSize(log.resp_size)} />
            </div>

            {/* Latency bar */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Total</span>
                <span className="font-mono font-semibold">{formatLatency(log.latency_total)}</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Upstream</span>
                <span className="font-mono">{log.latency_upstream != null ? formatLatency(log.latency_upstream) : "-"}</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Gateway</span>
                <span className="font-mono">{log.latency_gateway != null ? formatLatency(log.latency_gateway) : "-"}</span>
              </div>
            </div>

            <Separator />

            {/* Request Headers */}
            {log.req_headers && Object.keys(log.req_headers).length > 0 && (
              <CollapsibleHeaders title="Request Headers" variant="request" headers={log.req_headers} defaultOpen />
            )}

            {/* Request Body */}
            {log.req_body && (
              <CollapsibleCode title="Request Body" variant="request" badge="Debug Mode">
                {tryFormatJSON(log.req_body)}
              </CollapsibleCode>
            )}

            {/* Response Headers */}
            {log.resp_headers && Object.keys(log.resp_headers).length > 0 && (
              <CollapsibleHeaders title="Response Headers" variant="response" headers={log.resp_headers} defaultOpen />
            )}

            {/* Response Body */}
            {log.resp_body && (
              <CollapsibleCode title="Response Body" variant="response" badge="Debug Mode">
                {tryFormatJSON(log.resp_body)}
              </CollapsibleCode>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function SummaryCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm truncate ${mono ? "font-mono" : ""}`} title={value}>{value}</p>
    </div>
  )
}

const headerVariants = {
  request: "border-blue-200/50 dark:border-blue-900/30",
  response: "border-emerald-200/50 dark:border-emerald-900/30",
} as const

const headerRowVariants = {
  request: "even:bg-blue-50/50 dark:even:bg-blue-950/15",
  response: "even:bg-emerald-50/50 dark:even:bg-emerald-950/15",
} as const

function CollapsibleHeaders({ title, variant, headers, defaultOpen }: { title: string; variant: "request" | "response"; headers: Record<string, string>; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const entries = Object.entries(headers).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left group"
        onClick={() => setOpen(!open)}
      >
        <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        <h4 className="text-sm font-medium">{title}</h4>
        <Badge variant="outline" className="text-[10px]">{entries.length}</Badge>
        <span className="text-xs text-muted-foreground ml-auto group-hover:text-foreground">
          {open ? "Collapse" : "Expand"}
        </span>
      </button>
      {open && (
        <div className={`mt-2 rounded-md border overflow-hidden ${headerVariants[variant]}`}>
          {entries.map(([key, value]) => (
            <div key={key} className={`flex text-xs ${headerRowVariants[variant]}`}>
              <span className="w-[40%] shrink-0 px-3 py-1.5 font-mono font-medium text-muted-foreground truncate" title={key}>
                {key}
              </span>
              <span className="flex-1 px-3 py-1.5 font-mono break-all border-l border-inherit">
                {value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const codeVariants = {
  request: "bg-blue-50/70 border-blue-200/50 dark:bg-blue-950/20 dark:border-blue-900/30",
  response: "bg-emerald-50/70 border-emerald-200/50 dark:bg-emerald-950/20 dark:border-emerald-900/30",
  default: "bg-muted/50 border",
} as const

function CollapsibleCode({ title, badge, defaultOpen, variant = "default", children }: { title: string; badge?: string; defaultOpen?: boolean; variant?: keyof typeof codeVariants; children: string }) {
  const [open, setOpen] = useState(defaultOpen ?? false)

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left group"
        onClick={() => setOpen(!open)}
      >
        <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        <h4 className="text-sm font-medium">{title}</h4>
        {badge && <Badge variant="outline" className="text-[10px]">{badge}</Badge>}
        <span className="text-xs text-muted-foreground ml-auto group-hover:text-foreground">
          {open ? "Collapse" : "Expand"}
        </span>
      </button>
      {open && (
        <pre className={`mt-2 text-xs rounded-md p-3 overflow-x-auto max-h-72 whitespace-pre-wrap border ${codeVariants[variant]}`}>
          {children}
        </pre>
      )}
    </div>
  )
}

/* ─── Main Page ─── */

export default function ApiDebugPage() {
  const params = useParams()
  const router = useRouter()
  const apiId = params.id as string

  // API info
  const [record, setRecord] = useState<ApiDefRecord | null>(null)
  const [loadingApi, setLoadingApi] = useState(true)

  // Debug state
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [includeReqBody, setIncludeReqBody] = useState(true)
  const [includeRespBody, setIncludeRespBody] = useState(true)

  // Logs
  const [logs, setLogs] = useState<DebugLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // Filters from Zustand
  const statusFilter = useDebugStore((s) => s.statusFilter)
  const setStatusFilter = useDebugStore((s) => s.setStatusFilter)
  const methodFilter = useDebugStore((s) => s.methodFilter)
  const setMethodFilter = useDebugStore((s) => s.setMethodFilter)
  const searchQuery = useDebugStore((s) => s.searchQuery)
  const setSearchQuery = useDebugStore((s) => s.setSearchQuery)
  const clientIpFilter = useDebugStore((s) => s.clientIpFilter)
  const setClientIpFilter = useDebugStore((s) => s.setClientIpFilter)
  const latencyFilter = useDebugStore((s) => s.latencyFilter)
  const setLatencyFilter = useDebugStore((s) => s.setLatencyFilter)
  const consumerFilter = useDebugStore((s) => s.consumerFilter)
  const setConsumerFilter = useDebugStore((s) => s.setConsumerFilter)
  const autoRefresh = useDebugStore((s) => s.autoRefresh)
  const setAutoRefresh = useDebugStore((s) => s.setAutoRefresh)
  const showAdvancedFilters = useDebugStore((s) => s.showAdvancedFilters)
  const setShowAdvancedFilters = useDebugStore((s) => s.setShowAdvancedFilters)
  const clearAllFilters = useDebugStore((s) => s.clearFilters)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Detail sheet
  const [selectedLog, setSelectedLog] = useState<DebugLog | null>(null)

  // Load API info
  useEffect(() => {
    async function load() {
      try {
        const rec = await api.getApi(apiId)
        setRecord(rec)
        if (rec.name) sessionStorage.setItem(`breadcrumb:${apiId}`, rec.name)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load API")
      } finally {
        setLoadingApi(false)
      }
    }
    load()
  }, [apiId])

  // Load debug status
  useEffect(() => {
    api.debugStatusApi(apiId)
      .then((status) => {
        setDebugEnabled(status.enabled)
        setIncludeReqBody(status.include_req_body ?? true)
        setIncludeRespBody(status.include_resp_body ?? true)
      })
      .catch(() => {})
  }, [apiId])

  // Build filter — always scoped to this API
  const buildFilter = useCallback((): DebugLogFilter => {
    const f: DebugLogFilter = { api_id: apiId, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }
    if (methodFilter !== "all") f.method = methodFilter
    if (searchQuery.trim()) f.search = searchQuery.trim()
    if (statusFilter === "2xx") { f.status_min = 200; f.status_max = 299 }
    else if (statusFilter === "3xx") { f.status_min = 300; f.status_max = 399 }
    else if (statusFilter === "4xx") { f.status_min = 400; f.status_max = 499 }
    else if (statusFilter === "5xx") { f.status_min = 500; f.status_max = 599 }
    else if (statusFilter === "error") { f.status_min = 400; f.status_max = 599 }
    if (clientIpFilter.trim()) f.client_ip = clientIpFilter.trim()
    if (latencyFilter !== "all") f.latency_min = parseInt(latencyFilter, 10)
    if (consumerFilter.trim()) f.consumer_name = consumerFilter.trim()
    return f
  }, [apiId, statusFilter, methodFilter, searchQuery, clientIpFilter, latencyFilter, consumerFilter, page])

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.debugLogs(buildFilter())
      setLogs(res.data || [])
      setTotal(res.meta?.total || 0)
      setLastRefresh(new Date())
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch logs"
      if (!autoRefresh) toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [buildFilter, autoRefresh])

  // Initial fetch + on filter change
  useEffect(() => {
    setLoading(true)
    fetchLogs()
  }, [fetchLogs])

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, POLL_INTERVAL)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, fetchLogs])

  const handleToggleDebug = async () => {
    setToggling(true)
    try {
      const result = await api.debugToggleApi(apiId)
      setDebugEnabled(result.enabled)
      toast.success(result.enabled ? "Debug mode enabled" : "Debug mode disabled")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle debug")
    } finally {
      setToggling(false)
    }
  }

  const handleCaptureChange = async (field: "include_req_body" | "include_resp_body", value: boolean) => {
    const newReqBody = field === "include_req_body" ? value : includeReqBody
    const newRespBody = field === "include_resp_body" ? value : includeRespBody

    if (field === "include_req_body") setIncludeReqBody(value)
    else setIncludeRespBody(value)

    try {
      await api.debugUpdateCapture(apiId, {
        include_req_body: newReqBody,
        include_resp_body: newRespBody,
      })
    } catch (err) {
      if (field === "include_req_body") setIncludeReqBody(!value)
      else setIncludeRespBody(!value)
      toast.error(err instanceof Error ? err.message : "Failed to update capture options")
    }
  }

  const stats = useMemo(() => computeDebugStats(logs, total), [logs, total])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters = statusFilter !== "all" || methodFilter !== "all" || searchQuery.trim() !== ""
    || clientIpFilter.trim() !== "" || latencyFilter !== "all" || consumerFilter.trim() !== ""
  const activeAdvancedCount = [clientIpFilter.trim(), latencyFilter !== "all" ? "1" : "", consumerFilter.trim()].filter(Boolean).length
  const rangeStart = total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  const clearFilters = () => {
    clearAllFilters()
    setPage(1)
  }

  const isDraft = record?.sync_status === "draft"

  if (loadingApi) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push(`/apis/${apiId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight truncate">{record?.name || "API"}</h1>
              {record?.version && (
                <Badge variant="outline" className="text-[10px] font-mono shrink-0">v{record.version}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">Request logs and traffic debugging</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Debug status badge */}
          <Badge
            variant="outline"
            className={
              debugEnabled
                ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1.5"
                : "bg-slate-500/15 text-slate-600 border-slate-500/30 gap-1.5"
            }
          >
            {debugEnabled && <Radio className="h-3 w-3 animate-pulse" />}
            {debugEnabled ? "Debug Active" : "Debug Off"}
          </Badge>

          {/* Toggle button */}
          {isDraft ? (
            <Button variant="outline" size="sm" disabled>
              <Bug className="mr-1.5 h-3.5 w-3.5" /> Deploy First
            </Button>
          ) : (
            <Button
              variant={debugEnabled ? "outline" : "default"}
              size="sm"
              onClick={handleToggleDebug}
              disabled={toggling}
            >
              {toggling ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Bug className="mr-1.5 h-3.5 w-3.5" />}
              {debugEnabled ? "Stop Capture" : "Start Capture"}
            </Button>
          )}
        </div>
      </div>

      {/* Capture options (inline below header) */}
      {debugEnabled && !isDraft && (
        <div className="flex items-center gap-5 ml-11">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={includeReqBody}
              onCheckedChange={(v) => handleCaptureChange("include_req_body", !!v)}
            />
            <span className="text-xs text-muted-foreground">Request body</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={includeRespBody}
              onCheckedChange={(v) => handleCaptureChange("include_resp_body", !!v)}
            />
            <span className="text-xs text-muted-foreground">Response body</span>
          </label>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Info className="h-3 w-3" />
            Headers always captured
          </span>
        </div>
      )}

      {/* ─── Summary Cards ─── */}
      <div className="grid gap-4 grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold mt-1">{stats.totalRequests.toLocaleString()}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Activity className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Avg Latency</p>
                <p className="text-2xl font-bold mt-1">{formatLatency(stats.avgLatency)}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Error Rate</p>
                <p className={`text-2xl font-bold mt-1 ${stats.errorRate > 10 ? "text-red-600" : stats.errorRate > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {stats.errorRate}%
                </p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stats.errorRate > 10 ? "bg-red-500/10" : "bg-muted/50"}`}>
                <AlertTriangle className={`h-5 w-5 ${stats.errorRate > 10 ? "text-red-500" : "text-muted-foreground"}`} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">P95 Latency</p>
                <p className="text-2xl font-bold mt-1">{formatLatency(stats.p95Latency)}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <Gauge className="h-5 w-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Primary Filters ─── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[120px] h-9 text-xs">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
            <SelectItem value="PATCH">PATCH</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[130px] h-9 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="2xx">2xx Success</SelectItem>
            <SelectItem value="3xx">3xx Redirect</SelectItem>
            <SelectItem value="4xx">4xx Client</SelectItem>
            <SelectItem value="5xx">5xx Server</SelectItem>
            <SelectItem value="error">Errors (4xx+5xx)</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search URI..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
            className="pl-8 h-9 text-xs"
          />
        </div>

        <Button
          variant={showAdvancedFilters ? "secondary" : "outline"}
          size="sm"
          className="h-9 gap-1.5 text-xs"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          More Filters
          {activeAdvancedCount > 0 && (
            <Badge variant="default" className="h-4 text-[10px] px-1.5 ml-0.5">
              {activeAdvancedCount}
            </Badge>
          )}
        </Button>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-xs">
            <X className="h-3 w-3" /> Clear
          </Button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1.5">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="debug-auto-refresh" />
            <Label htmlFor="debug-auto-refresh" className="text-xs text-muted-foreground cursor-pointer">
              Auto (3s)
            </Label>
          </div>
          {lastRefresh && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => { setLoading(true); fetchLogs() }}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ─── Advanced Filters Panel ─── */}
      {showAdvancedFilters && (
        <div className="flex items-center gap-4 flex-wrap p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Source IP</Label>
            <Input
              placeholder="e.g. 192.168.1.1"
              value={clientIpFilter}
              onChange={(e) => { setClientIpFilter(e.target.value); setPage(1) }}
              className="h-8 w-[160px] text-xs font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Min Latency</Label>
            <Select value={latencyFilter} onValueChange={(v) => { setLatencyFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                <SelectItem value="100">&gt;100ms</SelectItem>
                <SelectItem value="500">&gt;500ms</SelectItem>
                <SelectItem value="1000">&gt;1s</SelectItem>
                <SelectItem value="5000">&gt;5s</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Application</Label>
            <Input
              placeholder="application name"
              value={consumerFilter}
              onChange={(e) => { setConsumerFilter(e.target.value); setPage(1) }}
              className="h-8 w-[160px] text-xs font-mono"
            />
          </div>
        </div>
      )}

      {/* ─── Table or Empty State ─── */}
      {loading && logs.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          </CardContent>
        </Card>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bug className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">No traffic captured yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {!debugEnabled
                ? "Enable debug mode above to start capturing traffic."
                : hasFilters
                  ? "No logs match your filters."
                  : "Send requests to this API and logs will appear here."}
            </p>
            {hasFilters && (
              <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                <Filter className="h-3.5 w-3.5 mr-1.5" /> Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Time</TableHead>
                <TableHead className="w-[70px]">Method</TableHead>
                <TableHead>URI</TableHead>
                <TableHead className="w-[120px]">Client IP</TableHead>
                <TableHead className="w-[65px]">Status</TableHead>
                <TableHead className="w-[80px] text-right">Latency</TableHead>
                <TableHead className="w-[70px] text-right">Req</TableHead>
                <TableHead className="w-[70px] text-right">Resp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow
                  key={log.id}
                  className={`cursor-pointer transition-colors ${selectedLog?.id === log.id ? "bg-accent" : ""}`}
                  onClick={() => setSelectedLog(log)}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground py-2">
                    {formatTime(log.request_time)}
                  </TableCell>
                  <TableCell className={`font-mono text-xs font-semibold py-2 ${methodColor(log.req_method)}`}>
                    {log.req_method}
                  </TableCell>
                  <TableCell className="font-mono text-xs truncate max-w-[400px] py-2" title={log.req_uri}>
                    {log.req_uri}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground py-2">
                    {log.client_ip || "-"}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className={`font-mono text-[11px] ${statusBadgeClass(log.resp_status)}`}>
                      {log.resp_status}
                    </Badge>
                  </TableCell>
                  <TableCell className={`font-mono text-xs text-right py-2 ${log.latency_total > 1000 ? "text-red-600" : log.latency_total > 300 ? "text-amber-600" : "text-muted-foreground"}`}>
                    {formatLatency(log.latency_total)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right text-muted-foreground py-2">
                    {formatSize(log.req_size)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right text-muted-foreground py-2">
                    {formatSize(log.resp_size)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
            <p className="text-xs text-muted-foreground">
              {total > 0 ? (
                <>Showing <span className="font-medium text-foreground">{rangeStart}-{rangeEnd}</span> of <span className="font-medium text-foreground">{total}</span> entries</>
              ) : (
                "No entries"
              )}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(1)}>
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground px-2 min-w-[80px] text-center">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Sheet */}
      <LogDetailSheet
        log={selectedLog}
        open={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  )
}
