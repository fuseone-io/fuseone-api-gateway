"use client"

import { ShieldCheck } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"

export default function RolesSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Role Management"
        description="Configure roles and permissions for RBAC"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Roles & Permissions
            </CardTitle>
            <Badge variant="secondary">Coming Soon</Badge>
          </div>
          <CardDescription>
            This feature will allow you to configure granular role-based access control
            with custom permissions for routes, services, plugins, and other resources.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 rounded-lg bg-muted/50 border border-dashed">
            <ShieldCheck className="h-16 w-16 text-muted-foreground/20" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
