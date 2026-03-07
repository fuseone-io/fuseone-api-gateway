"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Activity } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TracesTab } from "@/app/(dashboard)/monitoring/traces-tab"
import { api } from "@/lib/api-client"
import type { ApiDefRecord } from "@/types/api"
import { toast } from "sonner"

export default function ApiTracesPage() {
  const t = useTranslations("apis")
  const tc = useTranslations("common")
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
        toast.error(err instanceof Error ? err.message : tc("failedToLoad", { resource: "API" }))
      } finally {
        setLoadingApi(false)
      }
    }
    load()
  }, [apiId, tc])

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
      <PageHeader
        title={record?.name || "API"}
        description={t("detail.requestTracing")}
        icon={<Activity className="h-5 w-5" />}
        badge={record?.version ? <Badge variant="outline" className="text-[10px] font-mono shrink-0">v{record.version}</Badge> : undefined}
      />

      <TracesTab apiId={apiId} />
    </div>
  )
}
