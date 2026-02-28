"use client"

import { ShieldCheck } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function RolesSettingsPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <ShieldCheck className="h-7 w-7 text-muted-foreground" />
            </div>
          </div>
          <CardTitle>Roles &amp; Permissions</CardTitle>
          <CardDescription>
            Role management is coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This feature will allow you to define custom roles with granular
            permissions, controlling what each user can view, create, update,
            or delete across the API Gateway.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
