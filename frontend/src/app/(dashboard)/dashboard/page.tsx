"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowUpDown,
  Lock,
  Route,
  Server,
  ShieldCheck,
  Users,
  Wifi,
  Activity,
  Plus,
  Workflow,
  ArrowRight,
  ScrollText,
} from "lucide-react"
import { api } from "@/lib/api-client"
import type { DashboardSummary } from "@/types/apisix"
import type { AuditLog } from "@/types/auth"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"

const statusColors = {
  healthy: "bg-green-500",
  degraded: "bg-yellow-500",
  unhealthy: "bg-red-500",
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [recentAudit, setRecentAudit] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.dashboardSummary().catch(() => null),
      api.listAuditLogs({ page_size: "5" }).catch(() => ({ data: [] })),
    ])
      .then(([sum, audit]) => {
        setSummary(sum)
        setRecentAudit(audit?.data || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const metrics = summary
    ? [
        { label: "Routes", value: summary.routes, icon: Route, href: "/routes" },
        { label: "Services", value: summary.services, icon: Server, href: "/services" },
        { label: "Upstreams", value: summary.upstreams, icon: ArrowUpDown, href: "/upstreams" },
        { label: "Consumers", value: summary.consumers, icon: Users, href: "/consumers" },
        { label: "SSL Certs", value: summary.ssl_certs, icon: Lock, href: "/ssl" },
        { label: "Global Rules", value: summary.global_rules, icon: ShieldCheck, href: "/global-rules" },
        { label: "Stream Routes", value: summary.stream_routes, icon: Wifi, href: "/stream-routes/list" },
      ]
    : []

  return (
    <div className="space-y-8">
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                    <Skeleton className="h-12 w-12 rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))
          : metrics.map((metric) => (
              <Link key={metric.label} href={metric.href}>
                <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {metric.label}
                        </p>
                        <p className="text-3xl font-bold mt-1">{metric.value}</p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <metric.icon className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gateway Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-primary" />
              Gateway Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : summary ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge
                    variant={
                      summary.apisix_status === "healthy"
                        ? "default"
                        : "destructive"
                    }
                  >
                    {summary.apisix_status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground">
                    Total Resources
                  </span>
                  <span className="text-sm font-semibold">
                    {summary.routes +
                      summary.services +
                      summary.upstreams +
                      summary.consumers}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground">
                    Global Rules
                  </span>
                  <span className="text-sm font-semibold">
                    {summary.global_rules}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground">
                    SSL Certificates
                  </span>
                  <span className="text-sm font-semibold">
                    {summary.ssl_certs}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <Activity className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Unable to connect to API Gateway
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-auto py-3 justify-start" asChild>
                <Link href="/apis/new">
                  <Workflow className="mr-2 h-4 w-4 text-primary" />
                  Create API
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-3 justify-start" asChild>
                <Link href="/routes/new">
                  <Route className="mr-2 h-4 w-4 text-primary" />
                  New Route
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-3 justify-start" asChild>
                <Link href="/consumers">
                  <Users className="mr-2 h-4 w-4 text-primary" />
                  Consumers
                </Link>
              </Button>
              <Button variant="outline" className="h-auto py-3 justify-start" asChild>
                <Link href="/plugins">
                  <ShieldCheck className="mr-2 h-4 w-4 text-primary" />
                  Plugin Catalog
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2">
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
              <div className="text-center py-6">
                <ScrollText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
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
                              {" "}#{log.resource_id}
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
