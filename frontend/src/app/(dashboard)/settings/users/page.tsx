"use client"

import { Users } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"

export default function UsersSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Create and manage user accounts for the API Gateway"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              User Accounts
            </CardTitle>
            <Badge variant="secondary">Coming Soon</Badge>
          </div>
          <CardDescription>
            This feature will allow you to create and manage user accounts,
            send invitations, enable two-factor authentication, and control
            access to the API Gateway dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 rounded-lg bg-muted/50 border border-dashed">
            <Users className="h-16 w-16 text-muted-foreground/20" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
