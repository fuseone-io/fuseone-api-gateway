"use client"

import { useEffect } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Heart,
  Network,
  Radar,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { useMeshStore } from "@/stores/mesh-store"
import { toast } from "sonner"

const discoveryTypeColors: Record<string, string> = {
  dns: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  consul: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
  nacos: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  eureka: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
  kubernetes: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  static: "bg-muted text-muted-foreground border-muted",
}

const discoveryStatusColors: Record<string, string> = {
  active: "bg-emerald-600 hover:bg-emerald-700",
  error: "bg-red-600 hover:bg-red-700",
  unknown: "bg-muted text-muted-foreground",
}

function getDiscoveryTypeColor(type: string): string {
  return discoveryTypeColors[type.toLowerCase()] || discoveryTypeColors.static
}

function getDiscoveryStatusColor(status: string): string {
  return discoveryStatusColors[status] || discoveryStatusColors.unknown
}

export default function MeshPage() {
  const {
    overview,
    overviewLoading,
    services,
    servicesLoading,
    discoveryStatus,
    discoveryLoading,
    fetchOverview,
    fetchServices,
    fetchDiscoveryStatus,
  } = useMeshStore()

  useEffect(() => {
    fetchOverview()
    fetchServices()
    fetchDiscoveryStatus()
  }, [fetchOverview, fetchServices, fetchDiscoveryStatus])

  const handleRefresh = () => {
    fetchOverview()
    fetchServices()
    fetchDiscoveryStatus()
    toast.success("Dados atualizados")
  }

  const isLoading = overviewLoading && !overview

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Mesh"
        description="Visualize e monitore os servicos registrados no API Gateway"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/mesh/topology">
                <Network className="mr-2 h-4 w-4" />
                Ver Topologia
              </Link>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={overviewLoading}
            >
              <RefreshCw className={`h-4 w-4 ${overviewLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Total de Servicos
                    </p>
                    <p className="text-2xl font-bold mt-1">
                      {overview?.total_services ?? 0}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                    <Server className="h-5 w-5 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Nodes Saudaveis
                    </p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">
                      {overview?.healthy_nodes ?? 0}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Nodes com Problema
                    </p>
                    <p className="text-2xl font-bold text-red-600 mt-1">
                      {overview?.unhealthy_nodes ?? 0}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                    <XCircle className="h-5 w-5 text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Tipos de Discovery
                    </p>
                    <p className="text-2xl font-bold mt-1">
                      {overview?.discovery_types?.length ?? 0}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                    <Radar className="h-5 w-5 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Discovery Status Cards */}
      {!discoveryLoading && discoveryStatus.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">
            Status de Discovery
          </h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {discoveryStatus.map((ds) => (
              <Card key={ds.type}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getDiscoveryTypeColor(ds.type)}`}
                      >
                        {ds.type}
                      </Badge>
                      <span className="text-sm font-medium">
                        {ds.count} {ds.count === 1 ? "servico" : "servicos"}
                      </span>
                    </div>
                    <Badge className={getDiscoveryStatusColor(ds.status)}>
                      {ds.status === "active"
                        ? "Ativo"
                        : ds.status === "error"
                          ? "Erro"
                          : "Desconhecido"}
                    </Badge>
                  </div>
                  {ds.details && (
                    <p className="text-xs text-muted-foreground mt-2">{ds.details}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Services Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-5 w-5 text-primary" />
            Servicos
          </CardTitle>
          <CardDescription>
            Lista de todos os servicos registrados no mesh
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {servicesLoading && services.length === 0 ? (
            <div className="p-6">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          ) : services.length === 0 ? (
            <div className="p-12 text-center">
              <Heart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg font-medium">Nenhum servico encontrado</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Os servicos aparecerao aqui quando upstreams forem configurados com
                service discovery ou nodes estaticos.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Discovery</TableHead>
                  <TableHead className="text-center">Nodes</TableHead>
                  <TableHead className="text-center">Saudaveis</TableHead>
                  <TableHead className="text-center">Com Problema</TableHead>
                  <TableHead className="text-center">Rotas</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <Link
                        href={`/mesh/${service.id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {service.name}
                      </Link>
                      <p className="text-xs text-muted-foreground font-mono">
                        {service.upstream_id}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${getDiscoveryTypeColor(service.discovery_type)}`}
                      >
                        {service.discovery_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {service.total_count}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-mono">
                        <CheckCircle2 className="h-3 w-3" />
                        {service.healthy_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {service.unhealthy_count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-red-600 font-mono">
                          <AlertTriangle className="h-3 w-3" />
                          {service.unhealthy_count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-mono">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {service.routes.length}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/mesh/${service.id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
