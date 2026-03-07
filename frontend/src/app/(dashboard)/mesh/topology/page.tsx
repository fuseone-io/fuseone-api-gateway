"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { ArrowLeft, Network, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { TopologyGraph } from "@/components/topology-graph"
import { useMeshStore } from "@/stores/mesh-store"
import { toast } from "sonner"

export default function MeshTopologyPage() {
  const t = useTranslations("mesh.topology")
  const tc = useTranslations("common")
  const {
    topology,
    topologyLoading,
    fetchTopology,
  } = useMeshStore()

  useEffect(() => {
    fetchTopology()
  }, [fetchTopology])

  const handleRefresh = () => {
    fetchTopology()
    toast.success(t("topologyRefreshed"))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/mesh">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {tc("back")}
              </Link>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={topologyLoading}
            >
              <RefreshCw className={`h-4 w-4 ${topologyLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-primary" />
          <span>{t("legendRoute")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 border-t border-dashed border-muted-foreground" />
          <span>{t("legendPluginRef")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-emerald-500/60" />
          <span>{t("legendAllHealthy")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-red-500/60" />
          <span>{t("legendWithIssues")}</span>
        </div>
      </div>

      {/* Graph */}
      {topologyLoading && !topology ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[600px] w-full rounded-lg" />
          </CardContent>
        </Card>
      ) : !topology || topology.services.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Network className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-medium">{t("noTopologyTitle")}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {t("noTopologyDescription")}
            </p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/mesh">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("backToMesh")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TopologyGraph
          services={topology.services}
          dependencies={topology.dependencies}
        />
      )}

      {/* Summary info */}
      {topology && topology.services.length > 0 && (
        <div className="grid gap-4 grid-cols-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{topology.services.length}</p>
              <p className="text-xs text-muted-foreground">{t("services")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{topology.dependencies.length}</p>
              <p className="text-xs text-muted-foreground">{t("dependencies")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">
                {topology.dependencies.filter((d) => d.type === "route").length}
              </p>
              <p className="text-xs text-muted-foreground">{t("routeConnections")}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
