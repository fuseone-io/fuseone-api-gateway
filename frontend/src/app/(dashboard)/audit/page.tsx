"use client"

import { useEffect, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
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
import { PageHeader } from "@/components/page-header"
import type { AuditLog } from "@/types/auth"

const ACTION_OPTIONS = [
  { value: "all", labelKey: "allActions" },
  { value: "create", labelKey: "actionCreate" },
  { value: "update", labelKey: "actionUpdate" },
  { value: "delete", labelKey: "actionDelete" },
  { value: "login", labelKey: "actionLogin" },
  { value: "logout", labelKey: "actionLogout" },
]

const RESOURCE_TYPE_OPTIONS = [
  { value: "all", labelKey: "allResources" },
  { value: "route", labelKey: "resourceRoute" },
  { value: "service", labelKey: "resourceService" },
  { value: "upstream", labelKey: "resourceUpstream" },
  { value: "consumer", labelKey: "resourceConsumer" },
  { value: "ssl", labelKey: "resourceSsl" },
  { value: "global_rule", labelKey: "resourceGlobalRule" },
  { value: "plugin_config", labelKey: "resourcePluginConfig" },
  { value: "stream_route", labelKey: "resourceStreamRoute" },
  { value: "user", labelKey: "resourceUser" },
  { value: "role", labelKey: "resourceRole" },
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
  const t = useTranslations("audit")
  const tc = useTranslations("common")
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
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={<ScrollText className="h-6 w-6" />}
      />

      <div className="flex flex-wrap gap-3">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("filterByAction")} />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={resourceTypeFilter} onValueChange={setResourceTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("filterByResource")} />
          </SelectTrigger>
          <SelectContent>
            {RESOURCE_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>{t("time")}</TableHead>
              <TableHead>{t("user")}</TableHead>
              <TableHead>{t("action")}</TableHead>
              <TableHead>{t("resourceType")}</TableHead>
              <TableHead>{t("resourceId")}</TableHead>
              <TableHead>{tc("status")}</TableHead>
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
                    <p className="text-muted-foreground">{t("noLogsFound")}</p>
                    {(actionFilter !== "all" || resourceTypeFilter !== "all") && (
                      <p className="text-sm text-muted-foreground">
                        {t("tryAdjustingFilters")}
                      </p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/50">
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
