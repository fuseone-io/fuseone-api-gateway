"use client"

import {
  Activity,
  BarChart3,
  Heart,
  Gauge,
  Search,
  Radio,
  Zap,
  Clock,
  Construction,
  ArrowRight,
  Server,
  AlertTriangle,
  TrendingUp,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/page-header"

const monitoringSections = [
  {
    title: "API Troubleshooting",
    description: "Live traffic feed, request/response inspection, and debug mode per route",
    icon: Search,
    priority: "P0",
    status: "In Development",
    features: [
      "Real-time traffic feed with SSE streaming",
      "Request & response headers and body inspection",
      "3-segment timing waterfall (Gateway | Upstream | Total)",
      "Debug toggle per route with conditional body capture",
      "cURL export for request reproduction",
      "Executed policies trace per request",
    ],
  },
  {
    title: "Request Analytics",
    description: "Latency percentiles, error rates, and traffic volume over time",
    icon: BarChart3,
    priority: "P1",
    status: "Planned",
    features: [
      "Latency charts: p50, p95, p99 per route",
      "Error rate breakdown: 4xx vs 5xx over time",
      "Requests per second with peak detection",
      "Bandwidth ingress/egress per route",
      "Time range selector (1h, 6h, 24h, 7d, 30d)",
      "Per-application usage analytics",
    ],
  },
  {
    title: "Upstream Health",
    description: "Real-time health check status for all backend servers",
    icon: Heart,
    priority: "P1",
    status: "Planned",
    features: [
      "Live health status per upstream node (healthy/unhealthy)",
      "Success and failure counters",
      "Active and passive health check results",
      "Auto-refresh with configurable interval",
      "Historical health timeline",
    ],
  },
  {
    title: "Alerting",
    description: "Configurable alert rules with multi-channel notifications",
    icon: AlertTriangle,
    priority: "P2",
    status: "Planned",
    features: [
      "Alert rules: error rate threshold, latency p99, traffic anomalies",
      "Notification channels: email, Slack, Discord, webhook",
      "Alert history with acknowledgment",
      "Per-API or global alert scope",
      "Configurable cooldown periods",
    ],
  },
]

const metricsPreview = [
  { label: "Requests / sec", value: "--", icon: Zap, color: "text-blue-500" },
  { label: "Avg Latency", value: "--", icon: Clock, color: "text-amber-500" },
  { label: "Error Rate", value: "--", icon: AlertTriangle, color: "text-red-500" },
  { label: "Upstreams Healthy", value: "--", icon: Server, color: "text-green-500" },
]

export default function MonitoringPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring"
        description="Real-time metrics, troubleshooting, and health status for your API Gateway"
        actions={
          <Badge variant="outline" className="flex items-center gap-2 px-3 py-1.5">
            <Construction className="h-3.5 w-3.5" />
            Phase 1 in Roadmap
          </Badge>
        }
      />

      {/* Metrics preview bar */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {metricsPreview.map((metric) => (
          <Card key={metric.label} className="border-dashed">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                  <p className="text-2xl font-bold text-muted-foreground/30 mt-1">{metric.value}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                  <metric.icon className={`h-5 w-5 ${metric.color} opacity-30`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Architecture overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            How Monitoring Will Work
          </CardTitle>
          <CardDescription>
            Data flows from APISIX through our backend to this dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-3 py-4 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <Radio className="h-4 w-4 text-primary" />
              <span>APISIX http-logger</span>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0" />
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <Server className="h-4 w-4 text-primary" />
              <span>Go Backend</span>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0" />
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <Activity className="h-4 w-4 text-primary" />
              <span>SSE Stream</span>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0" />
            <div className="flex items-center gap-2 rounded-lg border bg-primary/10 px-3 py-2 font-medium text-primary">
              <BarChart3 className="h-4 w-4" />
              <span>This Dashboard</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <Gauge className="h-3 w-3" />
              Prometheus :9091
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              Control API :9090
            </span>
            <span className="flex items-center gap-1">
              <Search className="h-3 w-3" />
              Debug Headers
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Feature sections */}
      <div className="grid gap-4 md:grid-cols-2">
        {monitoringSections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <CardDescription className="mt-0.5">{section.description}</CardDescription>
                  </div>
                </div>
                <Badge
                  variant={section.status === "In Development" ? "default" : "secondary"}
                  className="text-[10px] shrink-0"
                >
                  {section.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Separator className="mb-4" />
              <ul className="space-y-2">
                {section.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
