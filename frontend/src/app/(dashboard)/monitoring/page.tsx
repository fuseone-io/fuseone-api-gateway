"use client"

import { Activity, BarChart3, Heart, Gauge } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"

export default function MonitoringPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring"
        description="Real-time metrics and health status for your API Gateway"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Request Analytics
              </CardTitle>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
            <CardDescription>
              Track request volumes, latencies, and error rates across your APIs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8 rounded-lg bg-muted/50 border border-dashed">
              <BarChart3 className="h-12 w-12 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Upstream Health
              </CardTitle>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
            <CardDescription>
              Monitor health check status for all upstream servers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8 rounded-lg bg-muted/50 border border-dashed">
              <Heart className="h-12 w-12 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                Prometheus Metrics
              </CardTitle>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
            <CardDescription>
              Integration with Prometheus for advanced monitoring and alerting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8 rounded-lg bg-muted/50 border border-dashed">
              <Gauge className="h-12 w-12 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
