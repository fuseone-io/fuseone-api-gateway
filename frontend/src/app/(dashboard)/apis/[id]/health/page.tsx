"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Heart,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AIInsightButton } from "@/components/ai-assistant/AIInsightButton"
import {
  Card,
  CardContent,
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
import { api } from "@/lib/api-client"
import type { UpstreamHealthChecker, UpstreamHealthNode } from "@/types/apisix"
import type { ApiDefRecord } from "@/types/api"
import { toast } from "sonner"

const AUTO_REFRESH_INTERVAL = 10_000

function getNodes(checker: UpstreamHealthChecker): UpstreamHealthNode[] {
  return Array.isArray(checker.nodes) ? checker.nodes : []
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

export default function ApiHealthPage() {
  const t = useTranslations("apis")
  const tc = useTranslations("common")
  const params = useParams()

  const apiId = params.id as string

  function StatusBadge({ status }: { status: UpstreamHealthNode["status"] }) {
    if (status === "healthy") {
      return (
        <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {t("detail.healthy")}
        </Badge>
      )
    }
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        {t("detail.unhealthy")}
      </Badge>
    )
  }

  // API info
  const [record, setRecord] = useState<ApiDefRecord | null>(null)
  const [loadingApi, setLoadingApi] = useState(true)

  // Health state
  const [checkers, setCheckers] = useState<UpstreamHealthChecker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
        toast.error(err instanceof Error ? err.message : tc("failedToLoad", { resource: "API" }))
      } finally {
        setLoadingApi(false)
      }
    }
    load()
  }, [apiId, tc])

  const fetchHealth = useCallback(async () => {
    try {
      const data = await api.apiUpstreamHealth(apiId)
      setCheckers(Array.isArray(data) ? data : [])
      setError(null)
      setLastRefresh(new Date())
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("detail.unableToFetchHealth")
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [apiId, t])

  useEffect(() => {
    if (!loadingApi) {
      setLoading(true)
      fetchHealth()
    }
  }, [fetchHealth, loadingApi])

  useEffect(() => {
    if (autoRefresh && !loadingApi) {
      intervalRef.current = setInterval(fetchHealth, AUTO_REFRESH_INTERVAL)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, fetchHealth, loadingApi])

  const { total, healthy, unhealthy } = countNodes(checkers)
  const isDraft = record?.sync_status === "draft"

  // Detect diagnostic patterns to help the operator
  const allNodes = checkers.flatMap(getNodes)
  const hasActiveCheckFailures = allNodes.some(
    (n) => n.status === "unhealthy" && n.counter.success === 0 && (n.counter.tcp_failure > 0 || n.counter.timeout_failure > 0)
  )

  if (loadingApi) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-[200px] w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={record?.name || "API"}
        description={t("detail.upstreamHealth")}
        icon={<Heart className="h-5 w-5" />}
        badge={record?.version ? <Badge variant="outline" className="text-[10px] font-mono shrink-0">v{record.version}</Badge> : undefined}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("detail.totalNodes")}</p>
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
                <p className="text-xs font-medium text-muted-foreground">{t("detail.healthy")}</p>
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
                <p className="text-xs font-medium text-muted-foreground">{t("detail.unhealthy")}</p>
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
          <div className="flex items-center gap-1.5">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="health-auto-refresh" />
            <Label htmlFor="health-auto-refresh" className="text-xs text-muted-foreground cursor-pointer">
              Auto (10s)
            </Label>
          </div>
          {lastRefresh && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AIInsightButton
            buildPrompt={() => {
              const apiName = record?.name ?? "this API"
              const nodeDetails = allNodes.slice(0, 8).map((n) => `  - ${n.ip}:${n.port} → ${n.status} (http_fail:${n.counter?.http_failure ?? 0}, tcp_fail:${n.counter?.tcp_failure ?? 0})`).join("\n")
              return `Analyze upstream health for API "${apiName}":\n- Total nodes: ${total}, Healthy: ${healthy}, Unhealthy: ${unhealthy}\n${hasActiveCheckFailures ? "- Active health check failures detected!\n" : ""}\nNode details:\n${nodeDetails || "  (no data)"}\n\nWhat is causing the unhealthy nodes and how can I fix them?`
            }}
          />
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchHealth().then(() => toast.success(t("detail.healthRefreshed"))) }} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            {tc("refresh")}
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading && checkers.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      ) : error && checkers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <p className="text-sm font-medium">{t("detail.unableToFetchHealth")}</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setLoading(true); fetchHealth() }}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              {tc("retry")}
            </Button>
          </CardContent>
        </Card>
      ) : isDraft ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Heart className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">{t("detail.deployToMonitor")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("detail.deployToMonitorDescription")}
            </p>
          </CardContent>
        </Card>
      ) : checkers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Heart className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">{t("detail.noHealthChecks")}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {t("detail.noHealthChecksDescription")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Diagnostic hint */}
          {hasActiveCheckFailures && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-700 dark:text-amber-400">{t("detail.activeCheckFailing")}</p>
                  <p className="text-muted-foreground mt-1">
                    {t("detail.activeCheckFailingDescription")}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("detail.tableHeaders.node")}</TableHead>
                  <TableHead>{t("detail.tableHeaders.status")}</TableHead>
                  <TableHead className="text-right">{t("detail.tableHeaders.success")}</TableHead>
                  <TableHead className="text-right">{t("detail.tableHeaders.httpFailures")}</TableHead>
                  <TableHead className="text-right">{t("detail.tableHeaders.tcpFailures")}</TableHead>
                  <TableHead className="text-right">{t("detail.tableHeaders.timeouts")}</TableHead>
                  <TableHead>{t("detail.tableHeaders.type")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkers.flatMap((checker) =>
                  getNodes(checker).map((node) => (
                    <TableRow key={`${checker.name}-${node.ip}-${node.port}`}>
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
        </>
      )}
    </div>
  )
}
