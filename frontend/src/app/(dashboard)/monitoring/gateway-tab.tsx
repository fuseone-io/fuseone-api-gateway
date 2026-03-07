"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import {
  Activity,
  CheckCircle2,
  Database,
  HardDrive,
  Loader2,
  Network,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api-client"
import { useEnvironmentStore } from "@/stores/environment-store"
import type { GatewayHealth } from "@/types/environment"

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function GatewayTab() {
  const t = useTranslations("monitoring.gateway")
  const tc = useTranslations("common")
  const { environments, activeEnvironmentId, fetchEnvironments } = useEnvironmentStore()
  const [healthStates, setHealthStates] = useState<Record<string, { loading: boolean; data: GatewayHealth | null }>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      await fetchEnvironments()
    } finally {
      setLoading(false)
    }
  }, [fetchEnvironments])

  useEffect(() => {
    load()
  }, [load])

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
        [envId]: { loading: false, data: { available: false, message: t("couldNotConnect") } },
      }))
    }
  }

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

  const handleRefreshAll = () => {
    environments.forEach((env) => fetchHealth(env.id))
  }

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId)
  const activeHealth = activeEnv ? healthStates[activeEnv.id] : undefined

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[200px] rounded-lg" />
        <Skeleton className="h-[200px] rounded-lg" />
      </div>
    )
  }

  if (!activeEnv) {
    return (
      <div className="py-12 text-center rounded-lg border border-dashed bg-muted/30">
        <Server className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm font-medium">{t("noActiveEnvironment")}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {t("configureEnvironment")}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Active Environment Health */}
      {activeHealth?.data?.available ? (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Server
                className="h-4 w-4 shrink-0"
                style={{ color: activeEnv.color || "#3b82f6" }}
              />
              <div>
                <h4 className="text-sm font-semibold">{activeEnv.name}</h4>
                <p className="text-xs text-muted-foreground">{t("activeEnvironment")}</p>
              </div>
              {activeHealth.data.node?.version && (
                <Badge variant="outline" className="text-[10px]">
                  v{activeHealth.data.node.version}
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchHealth(activeEnv.id)} disabled={activeHealth.loading}>
              {activeHealth.loading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              {tc("refresh")}
            </Button>
          </div>

          <GatewayHealthPanel health={activeHealth.data} />
        </div>
      ) : activeHealth?.data ? (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium">{t("gatewayUnavailable")}</p>
              <p className="text-xs text-muted-foreground">{activeHealth.data.message || t("couldNotConnect")}</p>
            </div>
          </div>
        </div>
      ) : activeHealth?.loading ? (
        <Skeleton className="h-[200px] rounded-lg" />
      ) : null}

      {/* All Environments Summary */}
      {environments.length > 1 && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h4 className="text-sm font-semibold">{t("allEnvironments")}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("healthAcrossEnvs", { count: environments.length })}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleRefreshAll}>
              <RefreshCw className="h-3 w-3 mr-1" />
              {tc("refreshAll")}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {environments.map((env) => {
              const health = healthStates[env.id]
              const h = health?.data
              const isActive = env.id === activeEnvironmentId
              return (
                <div
                  key={env.id}
                  className={`rounded-lg border p-4 ${isActive ? "border-primary/40 bg-primary/5" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Server
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: env.color || "#3b82f6" }}
                    />
                    <span className="text-sm font-medium truncate">{env.name}</span>
                    {isActive && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
                        {tc("active")}
                      </Badge>
                    )}
                  </div>

                  {health?.loading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {tc("loading")}
                    </div>
                  ) : h?.available ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">{t("connections")}</p>
                        <p className="text-sm font-bold tabular-nums">{h.connections?.active ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">{t("memory")}</p>
                        <p className="text-sm font-bold tabular-nums">{h.shared_memory?.used_pct ?? 0}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">{t("etcd")}</p>
                        <div className="flex items-center gap-1">
                          {h.etcd_reachable ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                          )}
                          <span className={`text-xs ${h.etcd_reachable ? "text-emerald-600" : "text-destructive"}`}>
                            {h.etcd_reachable ? t("ok") : t("down")}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">{t("totalRequests")}</p>
                        <p className="text-sm font-bold tabular-nums">{formatNumber(h.total_requests ?? 0)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <XCircle className="h-3 w-3" />
                      {t("unavailable")}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function GatewayHealthPanel({ health }: { health: GatewayHealth }) {
  const t = useTranslations("monitoring.gateway")
  const memPct = health.shared_memory?.used_pct ?? 0

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {/* Connections */}
      <div className="rounded-md border p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Network className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-xs text-muted-foreground">{t("connections")}</span>
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
          <span className="text-xs text-muted-foreground">{t("sharedMemory")}</span>
        </div>
        <div className="text-2xl font-bold tabular-nums">
          {memPct}<span className="text-sm font-normal text-muted-foreground">%</span>
        </div>
        <Progress value={memPct} className="h-1.5 mt-1.5" />
        <div className="text-[10px] text-muted-foreground mt-1">
          {health.shared_memory?.used_mb ?? 0} / {health.shared_memory?.capacity_mb ?? 0} MB
        </div>
      </div>

      {/* etcd */}
      <div className="rounded-md border p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Database className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs text-muted-foreground">{t("etcd")}</span>
        </div>
        <div className="flex items-center gap-2">
          {health.etcd_reachable ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-600">{t("reachable")}</span>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-destructive" />
              <span className="text-sm font-medium text-destructive">{t("unreachable")}</span>
            </>
          )}
        </div>
      </div>

      {/* Total Requests */}
      <div className="rounded-md border p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Activity className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs text-muted-foreground">{t("totalRequests")}</span>
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
  )
}
