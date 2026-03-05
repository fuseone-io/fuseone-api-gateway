"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowDown,
  ArrowUp,
  Bug,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  Radio,
  RefreshCw,
  Search,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  statusBadgeClass,
  methodColor,
  formatLatency,
  formatTime,
  formatSize,
  tryFormatJSON,
} from "@/lib/debug-utils"
import type { DebugLog, DebugLogFilter } from "@/types/debug"
import type { ApiDefRecord } from "@/types/api"
import { toast } from "sonner"

const PAGE_SIZE = 30
const POLL_INTERVAL = 3_000

/* ─── Detail Sheet (matches API debug page exactly) ─── */

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

function LogDetailSheet({ log, open, onClose, apis }: { log: DebugLog | null; open: boolean; onClose: () => void; apis: ApiDefRecord[] }) {
  if (!log) return null

  const apiName = apis.find((a) => a.apisix_route_ids?.includes(log.route_id))?.name
  const apiRecord = apis.find((a) => a.apisix_route_ids?.includes(log.route_id))

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
            {apiName && <span>API: <span className="font-medium text-foreground">{apiName}</span></span>}
            <span>Route: <span className="font-mono">{log.route_id}</span></span>
            {log.service_id && <span>Service: <span className="font-mono">{log.service_id}</span></span>}
            {log.consumer_name && <span>Application: <span className="font-mono">{log.consumer_name}</span></span>}
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6 space-y-6">
            {apiRecord && (
              <Link
                href={`/apis/${apiRecord.id}/debug`}
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Bug className="h-3.5 w-3.5" />
                Open debug page for {apiName}
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}

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

export function TroubleshootingTab() {
  const [logs, setLogs] = useState<DebugLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Filters
  const [apiFilter, setApiFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [methodFilter, setMethodFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // API list for selector
  const [apis, setApis] = useState<ApiDefRecord[]>([])

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Detail sheet
  const [selectedLog, setSelectedLog] = useState<DebugLog | null>(null)

  // Load APIs for selector
  useEffect(() => {
    async function loadApis() {
      try {
        const res = await api.listApis({ page_size: "100" })
        setApis(res.data || [])
      } catch {
        // Non-critical
      }
    }
    loadApis()
  }, [])

  // Build filter params
  const buildFilter = useCallback((): DebugLogFilter => {
    const f: DebugLogFilter = { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }
    if (apiFilter !== "all") f.api_id = apiFilter
    if (methodFilter !== "all") f.method = methodFilter
    if (searchQuery.trim()) f.search = searchQuery.trim()
    if (statusFilter === "2xx") { f.status_min = 200; f.status_max = 299 }
    else if (statusFilter === "3xx") { f.status_min = 300; f.status_max = 399 }
    else if (statusFilter === "4xx") { f.status_min = 400; f.status_max = 499 }
    else if (statusFilter === "5xx") { f.status_min = 500; f.status_max = 599 }
    else if (statusFilter === "error") { f.status_min = 400; f.status_max = 599 }
    return f
  }, [apiFilter, statusFilter, methodFilter, searchQuery, page])

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.debugLogs(buildFilter())
      setLogs(res.data || [])
      setTotal(res.meta?.total || 0)
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters = apiFilter !== "all" || statusFilter !== "all" || methodFilter !== "all" || searchQuery.trim() !== ""

  const clearFilters = () => {
    setApiFilter("all")
    setStatusFilter("all")
    setMethodFilter("all")
    setSearchQuery("")
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Hint: debug toggle is on the API page */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
        <Bug className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span>
          To enable debug capture, go to an API and click <strong>Debug</strong>. This view shows all captured logs across APIs.
        </span>
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* API filter */}
        <Select value={apiFilter} onValueChange={(v) => { setApiFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All APIs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All APIs</SelectItem>
            {apis.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="truncate">{a.name}</span>
                {a.version && <span className="ml-1 text-xs text-muted-foreground">v{a.version}</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[130px]">
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

        {/* Method filter */}
        <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[120px]">
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

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search URI..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
            className="pl-9 h-9"
          />
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}

        {/* Auto-refresh + Refresh */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-2">
            {autoRefresh && <Radio className="h-3 w-3 text-emerald-500 animate-pulse" />}
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="debug-auto-refresh" />
            <label htmlFor="debug-auto-refresh" className="text-xs text-muted-foreground cursor-pointer">
              Live
            </label>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchLogs() }}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Traffic Table */}
      {loading && logs.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-medium">No traffic captured yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {hasFilters
                ? "No logs match your current filters. Try adjusting or clearing them."
                : "Enable debug mode on an API to start capturing traffic. Go to APIs, select one, and click Debug."}
            </p>
            {hasFilters && (
              <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                <Filter className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70px]">Time</TableHead>
                  <TableHead className="w-[70px]">Method</TableHead>
                  <TableHead>URI</TableHead>
                  <TableHead className="w-[70px]">Status</TableHead>
                  <TableHead className="w-[90px] text-right">Latency</TableHead>
                  <TableHead className="w-[70px] text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ArrowDown className="h-3 w-3" />
                      Size
                    </div>
                  </TableHead>
                  <TableHead className="w-[70px] text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ArrowUp className="h-3 w-3" />
                      Size
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px]">API</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatTime(log.request_time)}
                    </TableCell>
                    <TableCell className={`font-mono text-xs font-semibold ${methodColor(log.req_method)}`}>
                      {log.req_method}
                    </TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-[300px]" title={log.req_uri}>
                      {log.req_uri}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`font-mono text-[11px] ${statusBadgeClass(log.resp_status)}`}>
                        {log.resp_status}
                      </Badge>
                    </TableCell>
                    <TableCell className={`font-mono text-xs text-right ${log.latency_total > 1000 ? "text-red-600" : log.latency_total > 300 ? "text-amber-600" : "text-muted-foreground"}`}>
                      {formatLatency(log.latency_total)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right text-muted-foreground">
                      {formatSize(log.req_size)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right text-muted-foreground">
                      {formatSize(log.resp_size)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]" title={log.route_id}>
                      {apis.find((a) => a.apisix_route_ids?.includes(log.route_id))?.name || log.route_id}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-muted-foreground">
                {total} total logs
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Detail Sheet */}
      <LogDetailSheet
        log={selectedLog}
        open={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
        apis={apis}
      />
    </div>
  )
}
