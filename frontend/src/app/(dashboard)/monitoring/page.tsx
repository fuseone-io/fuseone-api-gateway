"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  Heart,
  RefreshCw,
  Search,
  Server,
  XCircle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { PageHeader } from "@/components/page-header"
import { api } from "@/lib/api-client"
import type { UpstreamHealthChecker, UpstreamHealthNode } from "@/types/apisix"
import { toast } from "sonner"
import { useUIStore } from "@/stores/ui-store"
import { useAlertStore } from "@/stores/alert-store"
import { AnalyticsTab } from "./analytics-tab"
import { TroubleshootingTab } from "./troubleshooting-tab"
import { AlertsTab } from "./alerts-tab"
import { TracesTab } from "./traces-tab"
import { GatewayTab } from "./gateway-tab"

const AUTO_REFRESH_INTERVAL = 10_000

/** APISIX returns nodes as {} (empty object) when unchecked, or [] when checked */
function getNodes(checker: UpstreamHealthChecker): UpstreamHealthNode[] {
  return Array.isArray(checker.nodes) ? checker.nodes : []
}

function extractUpstreamId(name: string): string {
  // APISIX returns names like "/apisix/upstreams/1" or "/apisix/routes/1"
  const parts = name.split("/")
  return parts[3] || name
}

function formatUpstreamName(checkerName: string, nameMap: Record<string, string>): { label: string; id: string } {
  const id = extractUpstreamId(checkerName)
  const label = nameMap[id] || id
  return { label, id }
}

function countNodes(checkers: UpstreamHealthChecker[]) {
  let total = 0
  let healthy = 0
  let unhealthy = 0
  for (const checker of checkers) {
    for (const node of getNodes(checker)) {
      total++
      if (node.status === "healthy") healthy++
      else unhealthy++
    }
  }
  return { total, healthy, unhealthy }
}

function StatusBadge({ status }: { status: UpstreamHealthNode["status"] }) {
  const t = useTranslations("monitoring")

  if (status === "healthy") {
    return (
      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {t("upstreamHealth.statusHealthy")}
      </Badge>
    )
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3 w-3" />
      {t("upstreamHealth.statusUnhealthy")}
    </Badge>
  )
}

function UpstreamHealthTab() {
  const t = useTranslations("monitoring")
  const tc = useTranslations("common")

  const [checkers, setCheckers] = useState<UpstreamHealthChecker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [nameMap, setNameMap] = useState<Record<string, string>>({})

  // Build a map of APISIX IDs → friendly names (service/upstream ID → API name)
  useEffect(() => {
    async function loadNames() {
      try {
        const services = await api.listResource("services")
        const map: Record<string, string> = {}
        for (const node of services.list || []) {
          const val = node.value as Record<string, unknown>
          const id = (val?.id as string) || node.key.split("/").pop() || ""
          const name = (val?.name as string) || id
          if (id) map[id] = name
        }
        setNameMap(map)
      } catch {
        // Non-critical — fall back to raw IDs
      }
    }
    loadNames()
  }, [])

  const fetchHealth = useCallback(async () => {
    try {
      const data = await api.upstreamHealth()
      setCheckers(Array.isArray(data) ? data : [])
      setError(null)
      setLastRefresh(new Date())
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch health data"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchHealth, AUTO_REFRESH_INTERVAL)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, fetchHealth])

  const handleManualRefresh = () => {
    setLoading(true)
    fetchHealth().then(() => toast.success(t("upstreamHealth.refreshed")))
  }

  const { total, healthy, unhealthy } = countNodes(checkers)

  if (loading && checkers.length === 0) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && checkers.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <p className="text-lg font-medium">{t("upstreamHealth.unableToFetch")}</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Button variant="outline" className="mt-4" onClick={handleManualRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {tc("retry")}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("upstreamHealth.totalNodes")}</p>
                <p className="text-2xl font-bold mt-1">{total}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                <Server className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("upstreamHealth.healthy")}</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{healthy}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("upstreamHealth.unhealthy")}</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{unhealthy}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="auto-refresh" />
            <label htmlFor="auto-refresh" className="text-sm text-muted-foreground cursor-pointer">
              {t("upstreamHealth.autoRefresh")}
            </label>
          </div>
          {lastRefresh && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t("upstreamHealth.lastUpdated", { time: lastRefresh.toLocaleTimeString() })}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {tc("refresh")}
        </Button>
      </div>

      {/* Health table */}
      {checkers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Heart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-medium">{t("upstreamHealth.noHealthChecks")}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {t("upstreamHealth.noHealthChecksDescription")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("upstreamHealth.tableHeaders.upstream")}</TableHead>
                  <TableHead>{t("upstreamHealth.tableHeaders.node")}</TableHead>
                  <TableHead>{t("upstreamHealth.tableHeaders.status")}</TableHead>
                  <TableHead className="text-right">{t("upstreamHealth.tableHeaders.success")}</TableHead>
                  <TableHead className="text-right">{t("upstreamHealth.tableHeaders.httpFailures")}</TableHead>
                  <TableHead className="text-right">{t("upstreamHealth.tableHeaders.tcpFailures")}</TableHead>
                  <TableHead className="text-right">{t("upstreamHealth.tableHeaders.timeouts")}</TableHead>
                  <TableHead>{t("upstreamHealth.tableHeaders.type")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkers.flatMap((checker) =>
                  getNodes(checker).map((node) => (
                    <TableRow key={`${checker.name}-${node.ip}-${node.port}`}>
                      <TableCell className="text-xs">
                        {(() => {
                          const { label, id } = formatUpstreamName(checker.name, nameMap)
                          return label !== id ? (
                            <div>
                              <span className="font-medium">{label}</span>
                              <span className="block font-mono text-muted-foreground text-[10px]">{id}</span>
                            </div>
                          ) : (
                            <span className="font-mono">{id}</span>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {node.ip}:{node.port}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={node.status} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-600">
                        {node.counter.success}
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        {node.counter.http_failure}
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        {node.counter.tcp_failure}
                      </TableCell>
                      <TableCell className="text-right font-mono text-amber-600">
                        {node.counter.timeout_failure}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {checker.type}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function MonitoringPage() {
  const t = useTranslations("monitoring")
  const monitoringTab = useUIStore((s) => s.monitoringTab)
  const setMonitoringTab = useUIStore((s) => s.setMonitoringTab)
  const firingCount = useAlertStore((s) => s.firingCount)
  const startPolling = useAlertStore((s) => s.startPolling)

  useEffect(() => {
    startPolling()
  }, [startPolling])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={<Activity className="h-6 w-6" />}
      />

      <Tabs value={monitoringTab} onValueChange={setMonitoringTab}>
        <TabsList>
          <TabsTrigger value="gateway" className="gap-1.5">
            <Server className="h-4 w-4" />
            {t("tabs.gateway")}
          </TabsTrigger>
          <TabsTrigger value="upstream-health" className="gap-1.5">
            <Heart className="h-4 w-4" />
            {t("tabs.upstreamHealth")}
          </TabsTrigger>
          <TabsTrigger value="troubleshooting" className="gap-1.5">
            <Search className="h-4 w-4" />
            {t("tabs.troubleshooting")}
          </TabsTrigger>
          <TabsTrigger value="traces" className="gap-1.5">
            <Activity className="h-4 w-4" />
            {t("tabs.traces")}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            {t("tabs.analytics")}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5">
            <Bell className="h-4 w-4" />
            {t("tabs.alerts")}
            {firingCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px]">
                {firingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gateway" className="mt-4">
          <GatewayTab />
        </TabsContent>

        <TabsContent value="upstream-health" className="mt-4">
          <UpstreamHealthTab />
        </TabsContent>

        <TabsContent value="troubleshooting" className="mt-4">
          <TroubleshootingTab />
        </TabsContent>

        <TabsContent value="traces" className="mt-4">
          <TracesTab />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <AnalyticsTab />
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <AlertsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
