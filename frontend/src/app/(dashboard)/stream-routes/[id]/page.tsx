"use client"

import { Wifi } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function StreamRoutePage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Wifi className="h-7 w-7 text-muted-foreground" />
            </div>
          </div>
          <CardTitle>Stream Routes</CardTitle>
          <CardDescription>
            Stream route management is coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This feature will allow you to configure TCP/UDP stream proxying
            with SNI-based routing and stream-level plugins.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
