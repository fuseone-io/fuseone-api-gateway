"use client"

import { UserCog } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"

export default function ConsumerGroupDetailPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Consumer Groups"
        description="Group consumers and apply shared plugins"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" />
              Consumer Group Management
            </CardTitle>
            <Badge variant="secondary">Coming Soon</Badge>
          </div>
          <CardDescription>
            This feature will allow you to create consumer groups, manage group
            membership, and apply shared plugin configurations across multiple consumers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 rounded-lg bg-muted/50 border border-dashed">
            <UserCog className="h-16 w-16 text-muted-foreground/20" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
