"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Clock,
  RefreshCw,
  TrendingUp,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api-client"
import {
  formatBytes,
  formatLatency,
  formatErrorRate,
  formatTimestamp,
  formatNumber,
} from "@/lib/metrics-utils"
import type { TimeSeriesPoint, MetricsSummary, TopRoute, TimeRange } from "@/types/metrics"
import type { ApiDefRecord } from "@/types/api"
import { toast } from "sonner"

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "1h", label: "Last Hour" },
  { value: "6h", label: "Last 6 Hours" },
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
]

const AUTO_REFRESH_INTERVAL = 30_000

export default function ApiAnalyticsPage() {
  const params = useParams()
  const router = useRouter()
  const apiId = params.id as string

  // API info
  const [record, setRecord] = useState<ApiDefRecord | null>(null)
  const [loadingApi, setLoadingApi] = useState(true)

  // Metrics state
  const [range_, setRange] = useState<TimeRange>("1h")
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([])
  const [summary, setSummary] = useState<MetricsSummary | null>(null)
  const [topRoutes, setTopRoutes] = useState<TopRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  const routeIds = record?.apisix_route_ids

  const fetchData = useCallback(async () => {
    if (!routeIds?.length) {
      setLoading(false)
      return
    }
    try {
      const [ts, sum, routes] = await Promise.all([
        api.metricsTimeSeries({ route_ids: routeIds, range: range_ }),
        api.metricsSummary({ route_ids: routeIds, range: range_ }),
        api.metricsTopRoutes({ route_ids: routeIds, range: range_, limit: 20 }),
      ])
      setTimeSeries(ts)
      setSummary(sum)
      setTopRoutes(routes)
      setLastRefresh(new Date())
    } catch (err) {
      if (!autoRefresh) {
        toast.error(err instanceof Error ? err.message : "Failed to fetch metrics")
      }
    } finally {
      setLoading(false)
    }
  }, [routeIds, range_, autoRefresh])

  useEffect(() => {
    if (!loadingApi) {
      setLoading(true)
      fetchData()
    }
  }, [fetchData, loadingApi])

  useEffect(() => {
    if (autoRefresh && !loadingApi) {
      intervalRef.current = setInterval(fetchData, AUTO_REFRESH_INTERVAL)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, fetchData, loadingApi])

  const chartData = timeSeries.map((p) => ({
    ...p,
    time: formatTimestamp(p.ts, range_),
  }))

  const hasData = timeSeries.length > 0
  const isDraft = record?.sync_status === "draft"

  if (loadingApi) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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
            <p className="text-sm text-muted-foreground mt-0.5">Traffic analytics and performance metrics</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={range_} onValueChange={(v) => setRange(v as TimeRange)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="api-metrics-auto" />
            <Label htmlFor="api-metrics-auto" className="text-xs text-muted-foreground cursor-pointer">
              Auto (30s)
            </Label>
          </div>
          {lastRefresh && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchData() }} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Requests</p>
                  <p className="text-2xl font-bold mt-1">{formatNumber(summary.total_requests)}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Avg Latency</p>
                  <p className="text-2xl font-bold mt-1">{formatLatency(summary.avg_latency_ms)}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                  <Zap className="h-5 w-5 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Error Rate</p>
                  <p className={`text-2xl font-bold mt-1 ${summary.error_rate > 0.05 ? "text-red-600" : "text-emerald-600"}`}>
                    {formatErrorRate(summary.error_rate)}
                  </p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${summary.error_rate > 0.05 ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
                  {summary.error_rate > 0.05 ? (
                    <ArrowUpRight className="h-5 w-5 text-red-500" />
                  ) : (
                    <ArrowDownRight className="h-5 w-5 text-emerald-500" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Bandwidth</p>
                  <p className="text-2xl font-bold mt-1">
                    {formatBytes(summary.total_bandwidth_ingress + summary.total_bandwidth_egress)}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                  <Activity className="h-5 w-5 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content */}
      {loading && timeSeries.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[250px] w-full" />
          </CardContent>
        </Card>
      ) : isDraft ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">Deploy this API to start collecting metrics</p>
            <p className="text-xs text-muted-foreground mt-1">
              Analytics data will appear here once the API is deployed and receiving traffic.
            </p>
          </CardContent>
        </Card>
      ) : !hasData ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">No traffic data yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Metrics will appear here once this API receives traffic.
              The scraper collects data every 15 seconds and flushes every minute.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Requests Over Time */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Requests Over Time</CardTitle>
              <CardDescription>Total requests per time window</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
                    labelStyle={{ color: "var(--foreground)" }}
                  />
                  <Line type="monotone" dataKey="requests_total" stroke="var(--primary)" strokeWidth={2} dot={false} name="Requests" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Latency Percentiles */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Latency Percentiles</CardTitle>
              <CardDescription>Response time distribution (ms)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
                    labelStyle={{ color: "var(--foreground)" }}
                    formatter={(value) => value != null ? [`${Number(value).toFixed(1)} ms`] : ["-"]}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="latency_p50" stroke="#22c55e" strokeWidth={2} dot={false} name="p50" />
                  <Line type="monotone" dataKey="latency_p95" stroke="#f59e0b" strokeWidth={2} dot={false} name="p95" />
                  <Line type="monotone" dataKey="latency_p99" stroke="#ef4444" strokeWidth={2} dot={false} name="p99" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status Code Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Status Code Distribution</CardTitle>
              <CardDescription>HTTP response status codes over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
                    labelStyle={{ color: "var(--foreground)" }}
                  />
                  <Legend />
                  <Bar dataKey="status_2xx" stackId="status" fill="#22c55e" name="2xx" />
                  <Bar dataKey="status_3xx" stackId="status" fill="#3b82f6" name="3xx" />
                  <Bar dataKey="status_4xx" stackId="status" fill="#f59e0b" name="4xx" />
                  <Bar dataKey="status_5xx" stackId="status" fill="#ef4444" name="5xx" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Per-Flow Breakdown */}
          {topRoutes.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Per-Flow Breakdown</CardTitle>
                <CardDescription>Traffic distribution across this API&apos;s flows</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Flow / Route</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Avg Latency</TableHead>
                      <TableHead className="text-right">Error Rate</TableHead>
                      <TableHead className="text-right">Bandwidth</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topRoutes.map((route) => (
                      <TableRow key={route.route_id}>
                        <TableCell>
                          <div>
                            <span className="font-medium text-sm">
                              {route.route_name || route.route_id}
                            </span>
                            {route.route_name && route.route_name !== route.route_id && (
                              <span className="block text-xs text-muted-foreground font-mono">
                                {route.route_id}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(route.requests_total)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatLatency(route.avg_latency_ms)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={route.error_rate > 0.05 ? "destructive" : "secondary"}
                            className="font-mono"
                          >
                            {formatErrorRate(route.error_rate)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatBytes(route.bandwidth_ingress + route.bandwidth_egress)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
