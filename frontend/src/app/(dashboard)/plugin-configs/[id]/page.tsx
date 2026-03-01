"use client"

import { FileJson } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"

export default function PluginConfigDetailPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Plugin Configs"
        description="Manage reusable plugin configuration sets"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileJson className="h-5 w-5 text-primary" />
              Plugin Config Sets
            </CardTitle>
            <Badge variant="secondary">Coming Soon</Badge>
          </div>
          <CardDescription>
            This feature will allow you to create and manage reusable plugin configuration
            sets that can be shared across multiple routes and services.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 rounded-lg bg-muted/50 border border-dashed">
            <FileJson className="h-16 w-16 text-muted-foreground/20" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
