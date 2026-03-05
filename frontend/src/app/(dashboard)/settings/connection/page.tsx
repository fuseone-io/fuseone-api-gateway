"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Activity,
  CheckCircle2,
  Database,
  ExternalLink,
  HardDrive,
  KeyRound,
  Loader2,
  Network,
  Plug,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/api-client"
import { useEnvironmentStore } from "@/stores/environment-store"
import type { TestConnectionResult, GatewayHealth } from "@/types/environment"
import { toast } from "sonner"

interface TestState {
  loading: boolean
  result: TestConnectionResult | null
}

interface HealthState {
  loading: boolean
  data: GatewayHealth | null
}

export default function ConnectionContent() {
  const { environments, activeEnvironmentId, fetchEnvironments } = useEnvironmentStore()
  const [loading, setLoading] = useState(true)
  const [testStates, setTestStates] = useState<Record<string, TestState>>({})
  const [healthStates, setHealthStates] = useState<Record<string, HealthState>>({})

  const load = useCallback(async () => {
    try {
      await fetchEnvironments()
    } catch {
      toast.error("Failed to load environments")
    } finally {
      setLoading(false)
    }
  }, [fetchEnvironments])

  useEffect(() => {
    load()
  }, [load])

  // Auto-fetch health for all environments on load
  useEffect(() => {
    if (!loading && environments.length > 0) {
      environments.forEach((env) => {
        if (!healthStates[env.id]) {
          fetchHealth(env.id)
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, environments.length])

  const fetchHealth = async (envId: string) => {
    setHealthStates((prev) => ({
      ...prev,
      [envId]: { loading: true, data: null },
    }))
    try {
      const data = await api.getEnvironmentHealth(envId)
      setHealthStates((prev) => ({
        ...prev,
        [envId]: { loading: false, data },
      }))
    } catch {
      setHealthStates((prev) => ({
        ...prev,
        [envId]: { loading: false, data: { available: false, message: "Failed to fetch health" } },
      }))
    }
  }

  const handleTest = async (envId: string) => {
    setTestStates((prev) => ({
      ...prev,
      [envId]: { loading: true, result: null },
    }))

    try {
      const result = await api.testEnvironmentConnection(envId)
      setTestStates((prev) => ({
        ...prev,
        [envId]: { loading: false, result },
      }))
      if (result.success) {
        toast.success(`Connection successful (${result.latency_ms}ms)`)
      } else {
        toast.error(result.message)
      }
    } catch (err) {
      setTestStates((prev) => ({
        ...prev,
        [envId]: {
          loading: false,
          result: { success: false, message: err instanceof Error ? err.message : "Connection failed" },
        },
      }))
      toast.error(err instanceof Error ? err.message : "Connection test failed")
    }
  }

  const handleRefreshAll = () => {
    environments.forEach((env) => fetchHealth(env.id))
  }

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId)
  const activeHealth = activeEnv ? healthStates[activeEnv.id] : undefined

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Gateway Connection</h3>
          <p className="text-sm text-muted-foreground mt-1">
            API Gateway endpoint configuration and health check
          </p>
        </div>
        <Skeleton className="h-[200px] rounded-lg" />
        <Skeleton className="h-[200px] rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Gateway Connection</h3>
        <p className="text-sm text-muted-foreground mt-1">
          API Gateway endpoint configuration and health check
        </p>
      </div>

      {/* Active Environment Card */}
      {activeEnv ? (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Server
                className="h-4 w-4 shrink-0"
                style={{ color: activeEnv.color || "#3b82f6" }}
              />
              <div>
                <h4 className="text-sm font-semibold">{activeEnv.name}</h4>
                <p className="text-xs text-muted-foreground">Active Environment</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleTest(activeEnv.id)}
              disabled={testStates[activeEnv.id]?.loading}
            >
              {testStates[activeEnv.id]?.loading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Plug className="h-3.5 w-3.5 mr-1.5" />
              )}
              Test Connection
            </Button>
          </div>

          {testStates[activeEnv.id]?.result && (
            <div
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm mb-4 ${
                testStates[activeEnv.id].result!.success
                  ? "bg-green-500/10 text-green-700"
                  : "bg-red-500/10 text-red-700"
              }`}
            >
              {testStates[activeEnv.id].result!.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{testStates[activeEnv.id].result!.message}</span>
              {testStates[activeEnv.id].result!.latency_ms != null && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {testStates[activeEnv.id].result!.latency_ms}ms
                </Badge>
              )}
            </div>
          )}

          <Separator className="mb-4" />

          <div className="grid gap-3">
            <ConnectionField
              label="Admin API"
              value={activeEnv.admin_url}
              icon={<KeyRound className="h-3.5 w-3.5" />}
            />
            <ConnectionField
              label="Control API"
              value={activeEnv.control_url || "Not configured"}
              muted={!activeEnv.control_url}
              icon={<Plug className="h-3.5 w-3.5" />}
            />
            <ConnectionField
              label="Metrics Endpoint"
              value={activeEnv.metrics_url || "Not configured"}
              muted={!activeEnv.metrics_url}
              icon={<Plug className="h-3.5 w-3.5" />}
            />
          </div>

          {/* Gateway Health for Active Environment */}
          {activeHealth?.data?.available && (
            <>
              <Separator className="my-4" />
              <GatewayHealthPanel health={activeHealth.data} />
            </>
          )}
        </div>
      ) : (
        <div className="py-8 text-center rounded-lg border border-dashed bg-muted/30">
          <Plug className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">No active environment</p>
          <p className="text-xs text-muted-foreground mt-1">
            Configure an environment in the Environments tab.
          </p>
        </div>
      )}

      {/* All Environments Table Card */}
      {environments.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h4 className="text-sm font-semibold">All Environments</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {environments.length} environment{environments.length !== 1 ? "s" : ""} configured
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleRefreshAll}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh Health
            </Button>
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Environment</TableHead>
                  <TableHead>Connections</TableHead>
                  <TableHead>Memory</TableHead>
                  <TableHead>etcd</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {environments.map((env) => {
                  const testState = testStates[env.id]
                  const health = healthStates[env.id]
                  const h = health?.data
                  return (
                    <TableRow key={env.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Server
                            className="h-3.5 w-3.5 shrink-0"
                            style={{ color: env.color || "#3b82f6" }}
                          />
                          <span className="font-medium text-sm">{env.name}</span>
                          {env.id === activeEnvironmentId && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                              Active
                            </Badge>
                          )}
                          {env.is_default && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-600">
                              Default
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {health?.loading ? (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : h?.available && h.connections ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5 text-xs">
                                <Network className="h-3 w-3 text-muted-foreground" />
                                <span className="font-mono">{h.connections.active ?? 0}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                                <span className="text-muted-foreground">Active:</span>
                                <span className="font-mono">{h.connections.active ?? 0}</span>
                                <span className="text-muted-foreground">Reading:</span>
                                <span className="font-mono">{h.connections.reading ?? 0}</span>
                                <span className="text-muted-foreground">Writing:</span>
                                <span className="font-mono">{h.connections.writing ?? 0}</span>
                                <span className="text-muted-foreground">Waiting:</span>
                                <span className="font-mono">{h.connections.waiting ?? 0}</span>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {health?.loading ? (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : h?.available && h.shared_memory ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5 text-xs">
                                <HardDrive className="h-3 w-3 text-muted-foreground" />
                                <span className="font-mono">{h.shared_memory.used_pct}%</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                                <span className="text-muted-foreground">Used:</span>
                                <span className="font-mono">{h.shared_memory.used_mb} MB</span>
                                <span className="text-muted-foreground">Free:</span>
                                <span className="font-mono">{h.shared_memory.free_mb} MB</span>
                                <span className="text-muted-foreground">Capacity:</span>
                                <span className="font-mono">{h.shared_memory.capacity_mb} MB</span>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {health?.loading ? (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : h?.available && h.etcd_reachable !== undefined ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5">
                                <Database className={`h-3 w-3 ${h.etcd_reachable ? "text-emerald-500" : "text-destructive"}`} />
                                <span className={`text-xs ${h.etcd_reachable ? "text-emerald-600" : "text-destructive"}`}>
                                  {h.etcd_reachable ? "OK" : "Down"}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              etcd {h.etcd_reachable ? "reachable" : "unreachable"}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {health?.loading ? (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : h?.available && h.node?.version ? (
                          <span className="text-xs font-mono text-muted-foreground">{h.node.version}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {testState?.result ? (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              testState.result.success
                                ? "bg-green-500/10 text-green-600 border-green-200"
                                : "bg-red-500/10 text-red-600 border-red-200"
                            }`}
                          >
                            {testState.result.success
                              ? `OK (${testState.result.latency_ms}ms)`
                              : "Failed"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleTest(env.id)}
                          disabled={testState?.loading}
                        >
                          {testState?.loading ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Plug className="h-3 w-3 mr-1" />
                          )}
                          Test
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ExternalLink className="h-3 w-3" />
        <span>
          To edit connection details, switch to the{" "}
          <span className="font-medium text-foreground">Environments</span> tab.
        </span>
      </div>
    </div>
  )
}

function GatewayHealthPanel({ health }: { health: GatewayHealth }) {
  const memPct = health.shared_memory?.used_pct ?? 0

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gateway Health</h4>
        {health.node?.version && (
          <Badge variant="outline" className="text-[10px] ml-auto">
            APISIX {health.node.version}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Connections */}
        <div className="rounded-md border p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Network className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-xs text-muted-foreground">Connections</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {health.connections?.active ?? 0}
          </div>
          <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
            <span>R:{health.connections?.reading ?? 0}</span>
            <span>W:{health.connections?.writing ?? 0}</span>
            <span>I:{health.connections?.waiting ?? 0}</span>
          </div>
        </div>

        {/* Shared Memory */}
        <div className="rounded-md border p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <HardDrive className="h-3.5 w-3.5 text-purple-500" />
            <span className="text-xs text-muted-foreground">Shared Memory</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {memPct}<span className="text-sm font-normal text-muted-foreground">%</span>
          </div>
          <Progress
            value={memPct}
            className="h-1.5 mt-1.5"
          />
          <div className="text-[10px] text-muted-foreground mt-1">
            {health.shared_memory?.used_mb ?? 0} / {health.shared_memory?.capacity_mb ?? 0} MB
          </div>
        </div>

        {/* etcd */}
        <div className="rounded-md border p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Database className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs text-muted-foreground">etcd</span>
          </div>
          <div className="flex items-center gap-2">
            {health.etcd_reachable ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span className="text-sm font-medium text-emerald-600">Reachable</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-destructive" />
                <span className="text-sm font-medium text-destructive">Unreachable</span>
              </>
            )}
          </div>
        </div>

        {/* Total Requests */}
        <div className="rounded-md border p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs text-muted-foreground">Total Requests</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {formatNumber(health.total_requests ?? 0)}
          </div>
          {health.node?.hostname && (
            <div className="text-[10px] text-muted-foreground mt-1 truncate">
              {health.node.hostname}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ConnectionField({
  label,
  value,
  muted,
  icon,
}: {
  label: string
  value: string
  muted?: boolean
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`text-sm font-mono truncate ${
            muted ? "text-muted-foreground/60 italic" : ""
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
