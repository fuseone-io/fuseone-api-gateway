"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { ScrollText, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api-client"
import type { AuditLog } from "@/types/auth"

const ACTION_OPTIONS = [
  { value: "all", label: "All Actions" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
]

const RESOURCE_TYPE_OPTIONS = [
  { value: "all", label: "All Resources" },
  { value: "route", label: "Route" },
  { value: "service", label: "Service" },
  { value: "upstream", label: "Upstream" },
  { value: "consumer", label: "Consumer" },
  { value: "ssl", label: "SSL" },
  { value: "global_rule", label: "Global Rule" },
  { value: "plugin_config", label: "Plugin Config" },
  { value: "stream_route", label: "Stream Route" },
  { value: "user", label: "User" },
  { value: "role", label: "Role" },
]

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toLowerCase()) {
    case "success":
      return "default"
    case "failure":
    case "error":
      return "destructive"
    default:
      return "secondary"
  }
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState("all")
  const [resourceTypeFilter, setResourceTypeFilter] = useState("all")

  const fetchLogs = useCallback(() => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (actionFilter !== "all") params.action = actionFilter
    if (resourceTypeFilter !== "all") params.resource_type = resourceTypeFilter

    api
      .listAuditLogs(Object.keys(params).length > 0 ? params : undefined)
      .then((response) => {
        setLogs(response.data || [])
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [actionFilter, resourceTypeFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">
          Track all changes and actions performed in the API Gateway
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={resourceTypeFilter} onValueChange={setResourceTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by resource" />
          </SelectTrigger>
          <SelectContent>
            {RESOURCE_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource Type</TableHead>
              <TableHead>Resource ID</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <ScrollText className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No audit logs found</p>
                    {(actionFilter !== "all" || resourceTypeFilter !== "all") && (
                      <p className="text-sm text-muted-foreground">
                        Try adjusting your filters
                      </p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatTimestamp(log.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {log.user_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.resource_type}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {log.resource_id || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(log.status)}>
                      {log.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
