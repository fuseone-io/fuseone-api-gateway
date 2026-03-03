"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
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
} from "recharts"
import {
  Activity,
  Bot,
  Clock,
  DollarSign,
  RefreshCw,
  Settings,
  Zap,
} from "lucide-react"
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
  formatTimestampForSpan,
  formatNumber,
  dateRangeToParams,
  dateRangeSpanHours,
} from "@/lib/metrics-utils"
import type { DateRangeValue } from "@/types/metrics"
import type {
  AITokenTimeSeries,
  AITokenSummary,
  TopProvider,
  TopModel,
} from "@/types/ai-metrics"
import { toast } from "sonner"

const AUTO_REFRESH_INTERVAL = 30_000

const PIE_COLORS = ["#0f5fb8", "#950fb8", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]

function formatCost(value: number): string {
  return `$${value.toFixed(2)}`
}

export default function AIGatewayPage() {
  const [dateRange, setDateRange] = useState<DateRangeValue>({ type: "preset", preset: "1h" })
  const [timeSeries, setTimeSeries] = useState<AITokenTimeSeries[]>([])
  const [summary, setSummary] = useState<AITokenSummary | null>(null)
  const [topProviders, setTopProviders] = useState<TopProvider[]>([])
  const [topModels, setTopModels] = useState<TopModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    const rangeParams = dateRangeToParams(dateRange)
    try {
      const [ts, sum, providers, models] = await Promise.all([
        api.aiMetricsTimeSeries(rangeParams),
        api.aiMetricsSummary(rangeParams),
        api.aiTopProviders({ ...rangeParams, limit: 10 }),
        api.aiTopModels({ ...rangeParams, limit: 10 }),
      ])
      setTimeSeries(ts ?? [])
      setSummary(sum)
      setTopProviders(providers ?? [])
      setTopModels(models ?? [])
      setError(null)
      setLastRefresh(new Date())
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch AI metrics"
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
    fetchData().then(() => toast.success("AI metrics refreshed"))
  }

  const spanHours = dateRangeSpanHours(dateRange)
  const chartData = timeSeries.map((p) => ({
    ...p,
    time: formatTimestampForSpan(p.ts, spanHours),
  }))

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    },
    labelStyle: { color: "var(--foreground)" },
  }

  // Loading skeleton
  if (loading && timeSeries.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="h-6 w-6 text-primary" />
            <div>
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-4 w-48 mt-1" />
            </div>
          </div>
        </div>
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

  // Error state
  if (error && timeSeries.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Gateway</h1>
            <p className="text-sm text-muted-foreground">Monitor AI/LLM token usage, costs, and performance</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <Bot className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <p className="text-lg font-medium">Unable to fetch AI metrics</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <Button variant="outline" className="mt-4" onClick={handleManualRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasData = timeSeries.length > 0

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Gateway</h1>
            <p className="text-sm text-muted-foreground">Monitor AI/LLM token usage, costs, and performance</p>
          </div>
        </div>
        <Link href="/ai/settings">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            AI Settings
          </Button>
        </Link>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <MetricsDateRange value={dateRange} onChange={setDateRange} />
          <div className="flex items-center gap-2">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="ai-auto-refresh" />
            <label htmlFor="ai-auto-refresh" className="text-sm text-muted-foreground cursor-pointer">
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
                  <p className="text-xs font-medium text-muted-foreground">Total Tokens</p>
                  <p className="text-2xl font-bold mt-1">{formatNumber(summary.total_tokens)}</p>
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
                  <p className="text-xs font-medium text-muted-foreground">Total Cost USD</p>
                  <p className="text-2xl font-bold mt-1">{formatCost(summary.total_cost_usd)}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Avg Tokens/Request</p>
                  <p className="text-2xl font-bold mt-1">{formatNumber(Math.round(summary.avg_tokens_per_request))}</p>
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
                  <p className="text-xs font-medium text-muted-foreground">Active Models</p>
                  <p className="text-2xl font-bold mt-1">{summary.unique_models}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                  <Bot className="h-5 w-5 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!hasData ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bot className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-medium">No AI traffic data yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Metrics will appear here once AI/LLM requests flow through the gateway.
              Configure your AI providers and routes to start collecting token usage data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Token Time Series Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Token Usage Over Time</CardTitle>
              <CardDescription>Prompt and completion tokens per interval</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(value, name) => {
                      const label = name === "prompt_tokens" ? "Prompt Tokens" : "Completion Tokens"
                      return [formatNumber(value as number), label]
                    }}
                  />
                  <Legend
                    formatter={(value: string) =>
                      value === "prompt_tokens" ? "Prompt Tokens" : "Completion Tokens"
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="prompt_tokens"
                    stroke="#0f5fb8"
                    strokeWidth={2}
                    dot={false}
                    name="prompt_tokens"
                  />
                  <Line
                    type="monotone"
                    dataKey="completion_tokens"
                    stroke="#950fb8"
                    strokeWidth={2}
                    dot={false}
                    name="completion_tokens"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cost Over Time Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cost Over Time</CardTitle>
              <CardDescription>Estimated cost in USD per interval</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(value) => [formatCost(value as number), "Estimated Cost"]}
                  />
                  <Bar
                    dataKey="estimated_cost_usd"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    name="Estimated Cost"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Providers: Table + Pie Chart */}
          {topProviders.length > 0 && (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Top Providers</CardTitle>
                  <CardDescription>AI provider usage breakdown</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Provider</TableHead>
                        <TableHead className="text-right">Requests</TableHead>
                        <TableHead className="text-right">Total Tokens</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProviders.map((provider) => (
                        <TableRow key={provider.provider}>
                          <TableCell>
                            <span className="font-medium text-sm">{provider.provider}</span>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatNumber(provider.requests)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatNumber(provider.total_tokens)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCost(provider.estimated_cost_usd)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Token Distribution by Provider</CardTitle>
                  <CardDescription>Share of total tokens per provider</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={topProviders.map((p) => ({
                          name: p.provider,
                          value: p.total_tokens,
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {topProviders.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value) => [formatNumber(value as number), "Tokens"]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Top Models Table */}
          {topModels.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">Top Models</CardTitle>
                    <CardDescription>Detailed model-level token usage and costs</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Prompt Tokens</TableHead>
                      <TableHead className="text-right">Completion Tokens</TableHead>
                      <TableHead className="text-right">Total Tokens</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topModels.map((model) => (
                      <TableRow key={`${model.provider}-${model.model}`}>
                        <TableCell>
                          <span className="font-medium text-sm">{model.provider}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono">{model.model}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(model.requests)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(model.prompt_tokens)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(model.completion_tokens)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(model.total_tokens)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCost(model.estimated_cost_usd)}
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
