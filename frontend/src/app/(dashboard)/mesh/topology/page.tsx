"use client"

import { useEffect } from "react"
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
    toast.success("Topologia atualizada")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Topologia do Mesh"
        description="Visualizacao interativa dos servicos e suas dependencias"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/mesh">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
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
          <span>Rota (animada)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 border-t border-dashed border-muted-foreground" />
          <span>Referencia de plugin</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-emerald-500/60" />
          <span>Todos saudaveis</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-red-500/60" />
          <span>Com problemas</span>
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
            <p className="text-lg font-medium">Nenhum servico na topologia</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              A topologia sera exibida quando houver servicos registrados com
              dependencias configuradas no mesh.
            </p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/mesh">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para Service Mesh
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
              <p className="text-xs text-muted-foreground">Servicos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{topology.dependencies.length}</p>
              <p className="text-xs text-muted-foreground">Dependencias</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">
                {topology.dependencies.filter((d) => d.type === "route").length}
              </p>
              <p className="text-xs text-muted-foreground">Conexoes de Rota</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
