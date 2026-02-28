"use client"

import { FileJson } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function PluginConfigPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <FileJson className="h-7 w-7 text-muted-foreground" />
            </div>
          </div>
          <CardTitle>Plugin Configs</CardTitle>
          <CardDescription>
            Plugin configuration management is coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This feature will allow you to create reusable plugin configuration
            templates that can be shared across multiple routes.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
