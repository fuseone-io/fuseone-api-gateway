"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  CircleDot,
  Clock,
  Globe,
  Gauge,
  Plus,
  ScrollText,
  ShieldAlert,
  TrendingUp,
  Workflow,
  XCircle,
  LayoutDashboard,
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { api } from "@/lib/api-client"
import type { DashboardSummary } from "@/types/apisix"
import type { AuditLog } from "@/types/auth"
import type { ApiDefRecord } from "@/types/api"
import type { TimeSeriesPoint, MetricsSummary, TopRoute } from "@/types/metrics"
import type { AlertEvent } from "@/types/alert"
import type { SyntheticMonitor } from "@/types/testing"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { useUIStore } from "@/stores/ui-store"

const statusColors: Record<string, string> = {
  healthy: "bg-green-500",
  degraded: "bg-yellow-500",
  unhealthy: "bg-red-500",
}

const lifecycleColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-500/10 text-green-700 dark:text-green-400",
  deprecated: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  retired: "bg-red-500/10 text-red-700 dark:text-red-400",
}

const syncColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  synced: "bg-green-500/10 text-green-700 dark:text-green-400",
  out_of_sync: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
}

const monitorStatusColors: Record<string, string> = {
  up: "bg-green-500",
  degraded: "bg-yellow-500",
  down: "bg-red-500",
  unknown: "bg-muted-foreground/50",
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  },
  labelStyle: { color: "var(--foreground)" },
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
  return n.toLocaleString()
}

function formatMs(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(1) + "s"
  return ms.toFixed(0) + "ms"
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function MiniSparkline({ data, dataKey, color, height = 40 }: { data: { value: number }[]; dataKey: string; color: string; height?: number }) {
  if (data.length === 0) return null
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${dataKey})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default function DashboardPage() {
  const t = useTranslations("dashboard")
  const tc = useTranslations("common")
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null)
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([])
  const [topRoutes, setTopRoutes] = useState<TopRoute[]>([])
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([])
  const [monitors, setMonitors] = useState<SyntheticMonitor[]>([])
  const [recentAudit, setRecentAudit] = useState<AuditLog[]>([])
  const [apis, setApis] = useState<ApiDefRecord[]>([])
  const [loading, setLoading] = useState(true)
  const setMonitoringTab = useUIStore((s) => s.setMonitoringTab)

  useEffect(() => {
    Promise.all([
      api.dashboardSummary().catch(() => null),
      api.metricsSummary({ range: "24h" }).catch(() => null),
      api.metricsTimeSeries({ range: "24h" }).catch(() => []),
      api.metricsTopRoutes({ range: "24h", limit: 5 }).catch(() => []),
      api.listAlertEvents({ limit: 5 }).catch(() => []),
      api.listSyntheticMonitors().catch(() => []),
      api.listApis({ page_size: "50" }).catch(() => ({ data: [] })),
      api.listAuditLogs({ page_size: "5" }).catch(() => ({ data: [] })),
    ])
      .then(([sum, met, ts, routes, alerts, mons, apiList, audit]) => {
        setSummary(sum)
        setMetrics(met)
        setTimeSeries(ts || [])
        setTopRoutes(routes || [])
        setAlertEvents(alerts || [])
        setMonitors(mons || [])
        setApis(apiList?.data || [])
        setRecentAudit(audit?.data || [])
      })
      .finally(() => setLoading(false))
  }, [])

  // Compute API stats
  const apiStats = {
    total: apis.length,
    active: apis.filter((a) => a.lifecycle_status === "active").length,
    draft: apis.filter((a) => a.lifecycle_status === "draft").length,
    deprecated: apis.filter((a) => a.lifecycle_status === "deprecated").length,
    synced: apis.filter((a) => a.sync_status === "synced").length,
    outOfSync: apis.filter((a) => a.sync_status === "out_of_sync").length,
  }

  // Sparkline data from time series
  const requestsSparkline = timeSeries.map((p) => ({ value: p.requests_total }))
  const latencySparkline = timeSeries.map((p) => ({ value: p.latency_p50 }))
  const errorSparkline = timeSeries.map((p) => ({ value: p.status_4xx + p.status_5xx }))

  // Chart data for traffic
  const trafficChartData = timeSeries.map((p) => ({
    time: formatTimestamp(p.ts),
    success: p.status_2xx + p.status_3xx,
    errors: p.status_4xx + p.status_5xx,
  }))

  // Monitor uptime average
  const enabledMonitors = monitors.filter((m) => m.enabled)
  const avgUptime = enabledMonitors.length > 0
    ? enabledMonitors.reduce((sum, m) => sum + m.uptime_pct, 0) / enabledMonitors.length
    : 0

  // Firing alerts
  const firingEvents = alertEvents.filter((e) => e.event_type === "fired")

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={<LayoutDashboard className="h-6 w-6" />}
        actions={
          <>
            {summary && (
              <Badge
                variant="outline"
                className="flex items-center gap-2 h-9 px-4 text-sm font-medium"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${statusColors[summary.apisix_status] || ""}`}
                />
                {t("gatewayStatus", { status: summary.apisix_status })}
              </Badge>
            )}
            <Button asChild>
              <Link href="/apis/new">
                <Plus className="mr-2 h-4 w-4" />
                {t("createApi")}
              </Link>
            </Button>
          </>
        }
      />

      {/* Row 1 — KPI Cards with Sparklines */}
      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="hover:border-primary/40 hover:shadow-md transition-all">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-muted-foreground">{t("requests24h")}</p>
                  <Globe className="h-4 w-4 text-blue-500" />
                </div>
                <p className="text-2xl font-bold">{metrics ? formatNumber(metrics.total_requests) : "—"}</p>
                <div className="mt-2">
                  <MiniSparkline data={requestsSparkline} dataKey="requests" color="#3b82f6" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/40 hover:shadow-md transition-all">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-muted-foreground">{t("avgLatency")}</p>
                  <Gauge className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-2xl font-bold">{metrics ? formatMs(metrics.avg_latency_ms) : "—"}</p>
                <div className="mt-2">
                  <MiniSparkline data={latencySparkline} dataKey="latency" color="#f59e0b" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/40 hover:shadow-md transition-all">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-muted-foreground">{t("errorRate")}</p>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </div>
                <p className="text-2xl font-bold">
                  {metrics ? (metrics.error_rate * 100).toFixed(2) + "%" : "—"}
                </p>
                <div className="mt-2">
                  <MiniSparkline data={errorSparkline} dataKey="errors" color="#ef4444" />
                </div>
              </CardContent>
            </Card>

            <Link href="/testing/monitors">
              <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-muted-foreground">{t("monitorsUptime")}</p>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-2xl font-bold">
                    {enabledMonitors.length > 0 ? avgUptime.toFixed(1) + "%" : "—"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-3">
                    {enabledMonitors.length > 0 ? (
                      enabledMonitors.slice(0, 10).map((m) => (
                        <span
                          key={m.id}
                          title={`${m.name}: ${m.last_status}`}
                          className={`h-2.5 w-2.5 rounded-full ${monitorStatusColors[m.last_status] || monitorStatusColors.unknown}`}
                        />
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">{t("noMonitors")}</p>
                    )}
                    {enabledMonitors.length > 10 && (
                      <span className="text-xs text-muted-foreground">+{enabledMonitors.length - 10}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          </>
        )}
      </div>

      {/* Row 2 — Traffic Chart + Alerts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-primary" />
              {t("traffic24h")}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/monitoring" onClick={() => setMonitoringTab("analytics")}>
                {tc("details")}
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : trafficChartData.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-center">
                <Activity className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">{t("noTrafficData")}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trafficChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatNumber}
                  />
                  <Tooltip {...tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="success"
                    stackId="1"
                    stroke="#22c55e"
                    fill="url(#successGrad)"
                    strokeWidth={2}
                    name={t("successLabel")}
                  />
                  <Area
                    type="monotone"
                    dataKey="errors"
                    stackId="1"
                    stroke="#ef4444"
                    fill="url(#errorGrad)"
                    strokeWidth={2}
                    name={t("errorsLabel")}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5 text-primary" />
              {t("alerts")}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/monitoring" onClick={() => setMonitoringTab("alerts")}>
                {tc("viewAll")}
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : firingEvents.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-500/50 mb-3" />
                <p className="text-sm font-medium text-green-700 dark:text-green-400">{t("allClear")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("noFiringAlerts")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {firingEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-3"
                  >
                    <ShieldAlert className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{evt.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(evt.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3 — Top Routes + Monitors */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t("topRoutes24h")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : topRoutes.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <TrendingUp className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">{t("noRouteData")}</p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_80px_80px_70px] gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <span>{t("route")}</span>
                  <span className="text-right">{t("requests")}</span>
                  <span className="text-right">{t("latency")}</span>
                  <span className="text-right">{t("errors")}</span>
                </div>
                {topRoutes.map((route) => (
                  <Link
                    key={route.route_id}
                    href={`/apis/${route.route_id}`}
                    className="grid grid-cols-[1fr_80px_80px_70px] gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors group items-center"
                  >
                    <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {route.route_name || route.route_id}
                    </span>
                    <span className="text-sm text-right tabular-nums">{formatNumber(route.requests_total)}</span>
                    <span className="text-sm text-right tabular-nums">{formatMs(route.avg_latency_ms)}</span>
                    <span className={`text-sm text-right tabular-nums ${route.error_rate > 0.05 ? "text-red-500 font-medium" : ""}`}>
                      {(route.error_rate * 100).toFixed(1)}%
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-5 w-5 text-primary" />
              {t("syntheticMonitors")}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/testing/monitors">
                {tc("viewAll")}
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : monitors.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Gauge className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium">{t("noMonitorsTitle")}</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  {t("noMonitorsDescription")}
                </p>
                <Button size="sm" asChild>
                  <Link href="/testing/monitors">
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    {t("createMonitor")}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {monitors.slice(0, 8).map((mon) => (
                  <Link
                    key={mon.id}
                    href="/testing/monitors"
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`h-2.5 w-2.5 rounded-full shrink-0 ${monitorStatusColors[mon.last_status] || monitorStatusColors.unknown}`}
                      />
                      <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {mon.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {mon.uptime_pct > 0 ? mon.uptime_pct.toFixed(1) + "%" : "—"}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 ${
                          mon.last_status === "up"
                            ? "bg-green-500/10 text-green-700 dark:text-green-400"
                            : mon.last_status === "degraded"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : mon.last_status === "down"
                                ? "bg-red-500/10 text-red-700 dark:text-red-400"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {mon.last_status}
                      </Badge>
                    </div>
                  </Link>
                ))}
                {monitors.length > 8 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    {t("moreMonitors", { count: monitors.length - 8 })}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4 — API Overview + Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* API Overview */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="h-5 w-5 text-primary" />
              {t("apiOverview")}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/apis">
                {tc("viewAll")}
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : apis.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Workflow className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium">{t("noApisTitle")}</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  {t("noApisDescription")}
                </p>
                <Button size="sm" asChild>
                  <Link href="/apis/new">
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    {t("createApi")}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Lifecycle distribution */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: t("activeApis"), value: apiStats.active, icon: CheckCircle2, color: "text-green-500" },
                    { label: t("draftApis"), value: apiStats.draft, icon: Clock, color: "text-muted-foreground" },
                    { label: t("deprecatedApis"), value: apiStats.deprecated, icon: AlertTriangle, color: "text-amber-500" },
                    { label: t("outOfSync"), value: apiStats.outOfSync, icon: XCircle, color: "text-red-500" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg border p-3 text-center">
                      <stat.icon className={`h-4 w-4 mx-auto mb-1.5 ${stat.color}`} />
                      <p className="text-lg font-bold">{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Recent APIs list */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2">{t("recentApis")}</p>
                  {apis.slice(0, 5).map((apiDef) => (
                    <Link
                      key={apiDef.id}
                      href={`/apis/${apiDef.id}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CircleDot className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {apiDef.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            v{apiDef.version}
                            {apiDef.definition?.context_path && (
                              <span className="ml-1 font-mono">{apiDef.definition.context_path}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 ${lifecycleColors[apiDef.lifecycle_status] || ""}`}
                        >
                          {apiDef.lifecycle_status}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 ${syncColors[apiDef.sync_status] || ""}`}
                        >
                          {apiDef.sync_status === "out_of_sync" ? "out of sync" : apiDef.sync_status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-5 w-5 text-primary" />
              {t("recentActivity")}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/audit">
                {tc("viewAll")}
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentAudit.length === 0 ? (
              <div className="text-center py-8">
                <ScrollText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t("noRecentActivity")}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentAudit.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-xs font-semibold text-primary">
                          {(log.user_name || "?")[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm truncate">
                          <span className="font-medium">{log.user_name}</span>
                          {" "}
                          {log.action}{" "}
                          <span className="text-muted-foreground">{log.resource_type}</span>
                          {log.resource_id && (
                            <span className="font-mono text-xs text-muted-foreground">
                              {" "}#{log.resource_id.slice(0, 8)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge
                        variant={log.status === "success" ? "default" : "destructive"}
                        className="text-[10px]"
                      >
                        {log.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {log.created_at
                          ? new Date(log.created_at).toLocaleTimeString()
                          : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
