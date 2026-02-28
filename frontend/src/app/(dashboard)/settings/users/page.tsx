"use client"

import { Users } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function UsersSettingsPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Users className="h-7 w-7 text-muted-foreground" />
            </div>
          </div>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            User management is coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This feature will allow you to create and manage user accounts,
            send invitations, enable two-factor authentication, and control
            access to the API Gateway dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
