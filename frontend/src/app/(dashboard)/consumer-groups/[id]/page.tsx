"use client"

import { UserCog } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function ConsumerGroupPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <UserCog className="h-7 w-7 text-muted-foreground" />
            </div>
          </div>
          <CardTitle>Consumer Groups</CardTitle>
          <CardDescription>
            Consumer group management is coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This feature will allow you to group consumers together and apply
            shared plugin configurations across multiple consumers.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
