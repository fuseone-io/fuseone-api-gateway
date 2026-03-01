"use client"

import { Wifi } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"

export default function StreamRouteDetailPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Stream Routes"
        description="Manage TCP/UDP stream proxy routes"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Wifi className="h-5 w-5 text-primary" />
              Stream Route Configuration
            </CardTitle>
            <Badge variant="secondary">Coming Soon</Badge>
          </div>
          <CardDescription>
            This feature will allow you to configure Layer 4 (TCP/UDP) stream
            proxy routes with SNI-based routing, TLS termination, and upstream
            health checks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 rounded-lg bg-muted/50 border border-dashed">
            <Wifi className="h-16 w-16 text-muted-foreground/20" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
