"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowUpDown,
  Lock,
  Route,
  Server,
  ShieldCheck,
  Users,
  Wifi,
  Activity,
} from "lucide-react"
import { api } from "@/lib/api-client"
import type { DashboardSummary } from "@/types/apisix"
import { Skeleton } from "@/components/ui/skeleton"

const statusColors = {
  healthy: "bg-green-500",
  degraded: "bg-yellow-500",
  unhealthy: "bg-red-500",
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.dashboardSummary()
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const metrics = summary
    ? [
        { label: "Routes", value: summary.routes, icon: Route },
        { label: "Services", value: summary.services, icon: Server },
        { label: "Upstreams", value: summary.upstreams, icon: ArrowUpDown },
        { label: "Consumers", value: summary.consumers, icon: Users },
        { label: "SSL Certificates", value: summary.ssl_certs, icon: Lock },
        { label: "Global Rules", value: summary.global_rules, icon: ShieldCheck },
        { label: "Stream Routes", value: summary.stream_routes, icon: Wifi },
      ]
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your API Gateway
          </p>
        </div>
        {summary && (
          <Badge
            variant="outline"
            className="flex items-center gap-2 px-3 py-1.5"
          >
            <span
              className={`h-2 w-2 rounded-full ${statusColors[summary.apisix_status]}`}
            />
            APISIX {summary.apisix_status}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))
          : metrics.map((metric) => (
              <Card key={metric.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {metric.label}
                  </CardTitle>
                  <metric.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{metric.value}</div>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              APISIX Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : summary ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
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
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Total Resources
                  </span>
                  <span className="font-medium">
                    {summary.routes +
                      summary.services +
                      summary.upstreams +
                      summary.consumers}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Unable to connect to APISIX
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <a
                href="/routes/new"
                className="flex items-center gap-2 rounded-lg border p-3 text-sm hover:bg-accent transition-colors"
              >
                <Route className="h-4 w-4 text-primary" />
                New Route
              </a>
              <a
                href="/services/new"
                className="flex items-center gap-2 rounded-lg border p-3 text-sm hover:bg-accent transition-colors"
              >
                <Server className="h-4 w-4 text-primary" />
                New Service
              </a>
              <a
                href="/upstreams/new"
                className="flex items-center gap-2 rounded-lg border p-3 text-sm hover:bg-accent transition-colors"
              >
                <ArrowUpDown className="h-4 w-4 text-primary" />
                New Upstream
              </a>
              <a
                href="/consumers/new"
                className="flex items-center gap-2 rounded-lg border p-3 text-sm hover:bg-accent transition-colors"
              >
                <Users className="h-4 w-4 text-primary" />
                New Consumer
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
