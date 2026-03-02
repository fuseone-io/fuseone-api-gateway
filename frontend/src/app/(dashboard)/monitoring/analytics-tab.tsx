"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts"
import {
  Activity,
  ArrowDownRight,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { MetricsDateRange } from "@/components/metrics-date-range"
import { api } from "@/lib/api-client"
import {
  formatBytes,
  formatLatency,
  formatErrorRate,
  formatTimestampForSpan,
  formatNumber,
  dateRangeToParams,
  dateRangeSpanHours,
} from "@/lib/metrics-utils"
import type { TimeSeriesPoint, MetricsSummary, TopRoute, DateRangeValue } from "@/types/metrics"
import { toast } from "sonner"

const AUTO_REFRESH_INTERVAL = 30_000
const SYNC_ID = "global-analytics"

export function AnalyticsTab() {
  const [dateRange, setDateRange] = useState<DateRangeValue>({ type: "preset", preset: "1h" })
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([])
  const [summary, setSummary] = useState<MetricsSummary | null>(null)
  const [topRoutes, setTopRoutes] = useState<TopRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Drag-to-zoom state (index into chartData)
  const [dragStartIdx, setDragStartIdx] = useState<number | null>(null)
  const [dragEndIdx, setDragEndIdx] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    const rangeParams = dateRangeToParams(dateRange)
    try {
      const [ts, sum, routes] = await Promise.all([
        api.metricsTimeSeries(rangeParams),
        api.metricsSummary(rangeParams),
        api.metricsTopRoutes({ ...rangeParams, limit: 10 }),
      ])
      setTimeSeries(ts)
      setSummary(sum)
      setTopRoutes(routes)
      setError(null)
      setLastRefresh(new Date())
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch metrics"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchData, AUTO_REFRESH_INTERVAL)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, fetchData])

  const handleManualRefresh = () => {
    setLoading(true)
    fetchData().then(() => toast.success("Metrics refreshed"))
  }

  const spanHours = dateRangeSpanHours(dateRange)
  const chartData = timeSeries.map((p) => ({
    ...p,
    time: formatTimestampForSpan(p.ts, spanHours),
  }))

  // Drag-to-zoom: select a time range on any chart → update dateRange to custom
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleChartMouseDown(e: any) {
    if (e?.activeTooltipIndex != null) setDragStartIdx(e.activeTooltipIndex)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleChartMouseMove(e: any) {
    if (dragStartIdx != null && e?.activeTooltipIndex != null) setDragEndIdx(e.activeTooltipIndex)
  }
  function handleChartMouseUp() {
    if (dragStartIdx != null && dragEndIdx != null && dragStartIdx !== dragEndIdx) {
      const i1 = Math.min(dragStartIdx, dragEndIdx)
      const i2 = Math.max(dragStartIdx, dragEndIdx)
      const fromTs = timeSeries[i1]?.ts
      const toTs = timeSeries[i2]?.ts
      if (fromTs && toTs) {
        setDateRange({ type: "custom", from: new Date(fromTs), to: new Date(toTs) })
      }
    }
    setDragStartIdx(null)
    setDragEndIdx(null)
  }

  // Compute drag selection labels for ReferenceArea
  const dragRefStart = dragStartIdx != null ? chartData[dragStartIdx]?.time : null
  const dragRefEnd = dragEndIdx != null ? chartData[dragEndIdx]?.time : null

  // Common tooltip style
  const tooltipStyle = {
    contentStyle: { backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" },
    labelStyle: { color: "var(--foreground)" },
  }

  if (loading && timeSeries.length === 0) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[250px] w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && timeSeries.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Activity className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <p className="text-lg font-medium">Unable to fetch metrics</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Button variant="outline" className="mt-4" onClick={handleManualRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const hasData = timeSeries.length > 0

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <MetricsDateRange value={dateRange} onChange={setDateRange} />
          <div className="flex items-center gap-2">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="metrics-auto-refresh" />
            <label htmlFor="metrics-auto-refresh" className="text-sm text-muted-foreground cursor-pointer">
              Auto-refresh (30s)
            </label>
          </div>
          {lastRefresh && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
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

      {!hasData ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-medium">No traffic data yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Metrics will appear here once API traffic flows through the gateway.
              The scraper collects data every 15 seconds and flushes every minute.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Requests/min Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Requests Over Time</CardTitle>
              <CardDescription>Drag on any chart to select a time range</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData} syncId={SYNC_ID} onMouseDown={handleChartMouseDown} onMouseMove={handleChartMouseMove} onMouseUp={handleChartMouseUp}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} />
                  <Line type="monotone" dataKey="requests_total" stroke="var(--primary)" strokeWidth={2} dot={false} name="Requests" />
                  {dragRefStart && dragRefEnd && (
                    <ReferenceArea x1={dragRefStart} x2={dragRefEnd} strokeOpacity={0.3} fill="var(--primary)" fillOpacity={0.15} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Latency Percentiles Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Latency Percentiles</CardTitle>
              <CardDescription>Response time distribution (ms)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData} syncId={SYNC_ID} onMouseDown={handleChartMouseDown} onMouseMove={handleChartMouseMove} onMouseUp={handleChartMouseUp}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(value) => value != null ? [`${Number(value).toFixed(1)} ms`] : ["-"]}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="latency_p50" stroke="#22c55e" strokeWidth={2} dot={false} name="p50" />
                  <Line type="monotone" dataKey="latency_p95" stroke="#f59e0b" strokeWidth={2} dot={false} name="p95" />
                  <Line type="monotone" dataKey="latency_p99" stroke="#ef4444" strokeWidth={2} dot={false} name="p99" />
                  {dragRefStart && dragRefEnd && (
                    <ReferenceArea x1={dragRefStart} x2={dragRefEnd} strokeOpacity={0.3} fill="var(--primary)" fillOpacity={0.15} />
                  )}
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
                <LineChart data={chartData} syncId={SYNC_ID} onMouseDown={handleChartMouseDown} onMouseMove={handleChartMouseMove} onMouseUp={handleChartMouseUp}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="status_2xx" stroke="#22c55e" strokeWidth={2} dot={false} name="2xx" />
                  <Line type="monotone" dataKey="status_3xx" stroke="#3b82f6" strokeWidth={2} dot={false} name="3xx" />
                  <Line type="monotone" dataKey="status_4xx" stroke="#f59e0b" strokeWidth={2} dot={false} name="4xx" />
                  <Line type="monotone" dataKey="status_5xx" stroke="#ef4444" strokeWidth={2} dot={false} name="5xx" />
                  {dragRefStart && dragRefEnd && (
                    <ReferenceArea x1={dragRefStart} x2={dragRefEnd} strokeOpacity={0.3} fill="var(--primary)" fillOpacity={0.15} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Routes Table */}
          {topRoutes.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top Routes by Traffic</CardTitle>
                <CardDescription>Most active API routes</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Route</TableHead>
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
                          <span className="font-medium text-sm">
                            {route.route_name || route.route_id}
                          </span>
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
