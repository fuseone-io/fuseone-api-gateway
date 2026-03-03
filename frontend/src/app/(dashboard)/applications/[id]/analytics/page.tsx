"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
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
import { Label } from "@/components/ui/label"
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
const SYNC_ID = "consumer-analytics"

export default function ApplicationAnalyticsPage() {
  const params = useParams()
  const consumerId = params.id as string

  const [dateRange, setDateRange] = useState<DateRangeValue>({ type: "preset", preset: "1h" })
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([])
  const [summary, setSummary] = useState<MetricsSummary | null>(null)
  const [topRoutes, setTopRoutes] = useState<TopRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Drag-to-zoom
  const [dragStartIdx, setDragStartIdx] = useState<number | null>(null)
  const [dragEndIdx, setDragEndIdx] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    const rangeParams = dateRangeToParams(dateRange)
    try {
      const [ts, sum, routes] = await Promise.all([
        api.metricsTimeSeries({ consumer_names: [consumerId], ...rangeParams }),
        api.metricsSummary({ consumer_names: [consumerId], ...rangeParams }),
        api.metricsTopRoutes({ consumer_names: [consumerId], ...rangeParams, limit: 20 }),
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
  }, [consumerId, dateRange, autoRefresh])

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

  const spanHours = dateRangeSpanHours(dateRange)
  const chartData = timeSeries.map((p) => ({
    ...p,
    time: formatTimestampForSpan(p.ts, spanHours),
  }))

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

  const dragRefStart = dragStartIdx != null ? chartData[dragStartIdx]?.time : null
  const dragRefEnd = dragEndIdx != null ? chartData[dragEndIdx]?.time : null
  const hasData = timeSeries.length > 0

  const tooltipStyle = {
    contentStyle: { backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" },
    labelStyle: { color: "var(--foreground)" },
  }

  if (loading && timeSeries.length === 0) {
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
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight truncate">{consumerId}</h1>
          <Badge variant="outline" className="text-[10px] shrink-0">Application</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">Traffic analytics for this application</p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <MetricsDateRange value={dateRange} onChange={setDateRange} />
          <div className="flex items-center gap-1.5">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="consumer-metrics-auto" />
            <Label htmlFor="consumer-metrics-auto" className="text-xs text-muted-foreground cursor-pointer">
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
      {!hasData ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">No traffic data yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Metrics will appear here once this application generates traffic.
              Make sure the consumer is using authenticated requests.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Requests Over Time */}
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

          {/* Latency Percentiles */}
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

          {/* Charts Row: Route Bar + Status Pie */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {/* Routes Bar Chart */}
            {topRoutes.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Traffic by Route</CardTitle>
                  <CardDescription>Routes used by this application</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(200, topRoutes.length * 36)}>
                    <BarChart data={topRoutes.slice(0, 10)} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="route_name"
                        width={120}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: string, i: number) => v || topRoutes[i]?.route_id || ""}
                      />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value) => [formatNumber(Number(value ?? 0)), "Requests"]}
                      />
                      <Bar dataKey="requests_total" fill="var(--primary)" radius={[0, 4, 4, 0]} name="Requests" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Status Distribution Pie Chart */}
            {summary && summary.total_requests > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Status Distribution</CardTitle>
                  <CardDescription>HTTP response status breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "2xx", value: summary.status_2xx, fill: "#22c55e" },
                          { name: "3xx", value: summary.status_3xx, fill: "#3b82f6" },
                          { name: "4xx", value: summary.status_4xx, fill: "#f59e0b" },
                          { name: "5xx", value: summary.status_5xx, fill: "#ef4444" },
                        ].filter((d) => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      >
                        {[
                          { name: "2xx", value: summary.status_2xx, fill: "#22c55e" },
                          { name: "3xx", value: summary.status_3xx, fill: "#3b82f6" },
                          { name: "4xx", value: summary.status_4xx, fill: "#f59e0b" },
                          { name: "5xx", value: summary.status_5xx, fill: "#ef4444" },
                        ].filter((d) => d.value > 0).map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value) => [formatNumber(Number(value ?? 0)), "Responses"]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Routes Table */}
          {topRoutes.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Routes Used</CardTitle>
                <CardDescription>Routes accessed by this application</CardDescription>
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
