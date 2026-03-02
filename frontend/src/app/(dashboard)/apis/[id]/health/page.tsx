"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Heart,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

function StatusBadge({ status }: { status: UpstreamHealthNode["status"] }) {
  if (status === "healthy") {
    return (
      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Healthy
      </Badge>
    )
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3 w-3" />
      Unhealthy
    </Badge>
  )
}

export default function ApiHealthPage() {
  const params = useParams()

  const apiId = params.id as string

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
        toast.error(err instanceof Error ? err.message : "Failed to load API")
      } finally {
        setLoadingApi(false)
      }
    }
    load()
  }, [apiId])

  const fetchHealth = useCallback(async () => {
    try {
      const data = await api.apiUpstreamHealth(apiId)
      setCheckers(Array.isArray(data) ? data : [])
      setError(null)
      setLastRefresh(new Date())
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch health data"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [apiId])

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
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight truncate">{record?.name || "API"}</h1>
            {record?.version && (
              <Badge variant="outline" className="text-[10px] font-mono shrink-0">v{record.version}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Upstream health status and node monitoring</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Nodes</p>
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
                <p className="text-xs font-medium text-muted-foreground">Healthy</p>
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
                <p className="text-xs font-medium text-muted-foreground">Unhealthy</p>
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
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchHealth().then(() => toast.success("Health data refreshed")) }} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
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
            <p className="text-sm font-medium">Unable to fetch health data</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setLoading(true); fetchHealth() }}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : isDraft ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Heart className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">Deploy this API to monitor upstream health</p>
            <p className="text-xs text-muted-foreground mt-1">
              Health check data will appear here once the API is deployed.
            </p>
          </CardContent>
        </Card>
      ) : checkers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Heart className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">No health checks configured</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Enable active or passive health checks in the endpoint settings to monitor upstream node health.
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
                  <p className="font-medium text-amber-700 dark:text-amber-400">Active health check cannot reach upstream</p>
                  <p className="text-muted-foreground mt-1">
                    Nodes show 0 successes with TCP/timeout failures. The active health checker is unable to connect to the
                    upstream. If the API works when you send requests, the issue is likely in the health check configuration
                    (wrong port, missing TLS, firewall blocking the probe). Passive health checks will mark nodes as healthy
                    when real traffic succeeds, but they will go back to unhealthy once traffic stops.
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
                  <TableHead>Node</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Success</TableHead>
                  <TableHead className="text-right">HTTP Failures</TableHead>
                  <TableHead className="text-right">TCP Failures</TableHead>
                  <TableHead className="text-right">Timeouts</TableHead>
                  <TableHead>Type</TableHead>
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
