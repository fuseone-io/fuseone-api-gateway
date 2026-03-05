"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Activity } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TracesTab } from "@/app/(dashboard)/monitoring/traces-tab"
import { api } from "@/lib/api-client"
import type { ApiDefRecord } from "@/types/api"
import { toast } from "sonner"

export default function ApiTracesPage() {
  const params = useParams()
  const apiId = params.id as string

  const [record, setRecord] = useState<ApiDefRecord | null>(null)
  const [loadingApi, setLoadingApi] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const rec = await api.getApi(apiId)
        setRecord(rec)
        if (rec.name) sessionStorage.setItem(`breadcrumb:${apiId}`, rec.name)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load API")
      } finally {
        setLoadingApi(false)
      }
    }
    load()
  }, [apiId])

  if (loadingApi) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-2xl font-bold tracking-tight truncate">{record?.name || "API"}</h1>
            {record?.version && (
              <Badge variant="outline" className="text-[10px] font-mono shrink-0">v{record.version}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Request tracing and span waterfall analysis</p>
        </div>
      </div>

      <TracesTab apiId={apiId} />
    </div>
  )
}
