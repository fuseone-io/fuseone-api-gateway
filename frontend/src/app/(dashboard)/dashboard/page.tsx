"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Activity,
  AppWindow,
  ArrowRight,
  CircleDot,
  CreditCard,
  FileJson,
  Lock,
  Plus,
  ScrollText,
  ShieldCheck,
  Wifi,
  Workflow,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Zap,
} from "lucide-react"
import { api } from "@/lib/api-client"
import type { DashboardSummary } from "@/types/apisix"
import type { AuditLog } from "@/types/auth"
import type { ApiDefRecord } from "@/types/api"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"

const statusColors = {
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

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [recentAudit, setRecentAudit] = useState<AuditLog[]>([])
  const [apis, setApis] = useState<ApiDefRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.dashboardSummary().catch(() => null),
      api.listAuditLogs({ page_size: "5" }).catch(() => ({ data: [] })),
      api.listApis({ page_size: "50" }).catch(() => ({ data: [] })),
    ])
      .then(([sum, audit, apiList]) => {
        setSummary(sum)
        setRecentAudit(audit?.data || [])
        setApis(apiList?.data || [])
      })
      .finally(() => setLoading(false))
  }, [])

  // Compute API stats from our data
  const apiStats = {
    total: apis.length,
    active: apis.filter((a) => a.lifecycle_status === "active").length,
    draft: apis.filter((a) => a.lifecycle_status === "draft").length,
    deprecated: apis.filter((a) => a.lifecycle_status === "deprecated").length,
    synced: apis.filter((a) => a.sync_status === "synced").length,
    outOfSync: apis.filter((a) => a.sync_status === "out_of_sync").length,
  }

  // KPI metrics aligned to our model
  const kpiMetrics = summary
    ? [
        { label: "APIs", value: apiStats.total, icon: Workflow, href: "/apis", accent: "text-blue-500" },
        { label: "Active APIs", value: apiStats.active, icon: CheckCircle2, href: "/apis", accent: "text-green-500" },
        { label: "Applications", value: summary.consumers, icon: AppWindow, href: "/applications", accent: "text-purple-500" },
        { label: "Global Policies", value: summary.global_rules, icon: ShieldCheck, href: "/global-rules", accent: "text-amber-500" },
        { label: "SSL Certificates", value: summary.ssl_certs, icon: Lock, href: "/ssl", accent: "text-cyan-500" },
        { label: "Stream Proxy", value: summary.stream_routes, icon: Wifi, href: "/stream-routes", accent: "text-teal-500" },
      ]
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your API Gateway"
        actions={
          <>
            {summary && (
              <Badge
                variant="outline"
                className="flex items-center gap-2 px-3 py-1.5"
              >
                <span
                  className={`h-2 w-2 rounded-full ${statusColors[summary.apisix_status]}`}
                />
                Gateway {summary.apisix_status}
              </Badge>
            )}
            <Button asChild>
              <Link href="/apis/new">
                <Plus className="mr-2 h-4 w-4" />
                Create API
              </Link>
            </Button>
          </>
        }
      />

      {/* KPI Metrics */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))
          : kpiMetrics.map((metric) => (
              <Link key={metric.label} href={metric.href}>
                <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer h-full">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {metric.label}
                        </p>
                        <p className="text-2xl font-bold mt-1">{metric.value}</p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                        <metric.icon className={`h-5 w-5 ${metric.accent}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* API Health Overview */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-primary" />
              API Overview
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/apis">
                View all
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
                <p className="text-sm font-medium">No APIs yet</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Create your first API to get started
                </p>
                <Button size="sm" asChild>
                  <Link href="/apis/new">
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Create API
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Lifecycle distribution */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Active", value: apiStats.active, icon: CheckCircle2, color: "text-green-500" },
                    { label: "Draft", value: apiStats.draft, icon: Clock, color: "text-muted-foreground" },
                    { label: "Deprecated", value: apiStats.deprecated, icon: AlertTriangle, color: "text-amber-500" },
                    { label: "Out of Sync", value: apiStats.outOfSync, icon: XCircle, color: "text-red-500" },
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
                  <p className="text-xs font-medium text-muted-foreground mb-2">Recent APIs</p>
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

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" className="w-full h-auto py-3 justify-start" asChild>
                <Link href="/apis/new">
                  <Workflow className="mr-2.5 h-4 w-4 text-blue-500" />
                  Create API
                </Link>
              </Button>
              <Button variant="outline" className="w-full h-auto py-3 justify-start" asChild>
                <Link href="/applications">
                  <AppWindow className="mr-2.5 h-4 w-4 text-purple-500" />
                  Applications
                </Link>
              </Button>
              <Button variant="outline" className="w-full h-auto py-3 justify-start" asChild>
                <Link href="/plans">
                  <CreditCard className="mr-2.5 h-4 w-4 text-amber-500" />
                  Plans
                </Link>
              </Button>
              <Button variant="outline" className="w-full h-auto py-3 justify-start" asChild>
                <Link href="/plugins">
                  <ShieldCheck className="mr-2.5 h-4 w-4 text-green-500" />
                  Policy Catalog
                </Link>
              </Button>
              <Button variant="outline" className="w-full h-auto py-3 justify-start" asChild>
                <Link href="/plugin-configs">
                  <FileJson className="mr-2.5 h-4 w-4 text-cyan-500" />
                  Policy Templates
                </Link>
              </Button>
              <Button variant="outline" className="w-full h-auto py-3 justify-start" asChild>
                <Link href="/global-rules">
                  <ShieldCheck className="mr-2.5 h-4 w-4 text-red-500" />
                  Global Policies
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/audit">
              View all
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
              <p className="text-sm text-muted-foreground">No recent activity</p>
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
  )
}
