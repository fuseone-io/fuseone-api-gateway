"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Network,
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
import type { MeshService } from "@/types/mesh"
import { toast } from "sonner"

const discoveryTypeColors: Record<string, string> = {
  dns: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  consul: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
  nacos: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  eureka: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
  kubernetes: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  static: "bg-muted text-muted-foreground border-muted",
}

const nodeStatusConfig = {
  healthy: {
    label: "Saudavel",
    color: "text-emerald-600",
    bg: "bg-emerald-500",
    icon: CheckCircle2,
  },
  unhealthy: {
    label: "Com Problema",
    color: "text-red-600",
    bg: "bg-red-500",
    icon: XCircle,
  },
  unknown: {
    label: "Desconhecido",
    color: "text-muted-foreground",
    bg: "bg-muted-foreground",
    icon: Server,
  },
}

function getDiscoveryTypeColor(type: string): string {
  return discoveryTypeColors[type.toLowerCase()] || discoveryTypeColors.static
}

export default function MeshServiceDetailPage() {
  const params = useParams()
  const serviceId = params.serviceId as string
  const fetchService = useMeshStore((s) => s.fetchService)

  const [service, setService] = useState<MeshService | null>(null)
  const [loading, setLoading] = useState(true)

  const loadService = async () => {
    setLoading(true)
    const data = await fetchService(serviceId)
    setService(data)
    setLoading(false)
  }

  useEffect(() => {
    loadService()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId])

  const handleRefresh = () => {
    loadService()
    toast.success("Dados do servico atualizados")
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <div>
            <Skeleton className="h-7 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid gap-4 grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="space-y-6">
        <PageHeader title="Servico nao encontrado" />
        <Card>
          <CardContent className="p-12 text-center">
            <Network className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-medium">Servico nao encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              O servico com ID &quot;{serviceId}&quot; nao foi encontrado no mesh.
            </p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/mesh">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para Service Mesh
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={service.name}
        description={`Detalhes do servico ${service.name}`}
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
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* Service info */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">Tipo de Discovery</p>
            <Badge
              variant="outline"
              className={`text-xs ${getDiscoveryTypeColor(service.discovery_type)}`}
            >
              {service.discovery_type}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">Upstream ID</p>
            <p className="text-sm font-mono">{service.upstream_id}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">ID do Servico</p>
            <p className="text-sm font-mono">{service.id}</p>
          </CardContent>
        </Card>
      </div>

      {/* Health Summary */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total de Nodes</p>
                <p className="text-2xl font-bold mt-1">{service.total_count}</p>
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
                <p className="text-xs font-medium text-muted-foreground">Saudaveis</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{service.healthy_count}</p>
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
                <p className="text-xs font-medium text-muted-foreground">Com Problema</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{service.unhealthy_count}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Nodes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-5 w-5 text-primary" />
            Nodes
          </CardTitle>
          <CardDescription>
            Lista de nodes registrados neste servico
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {service.nodes.length === 0 ? (
            <div className="p-12 text-center">
              <Server className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium">Nenhum node registrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Nodes aparecerao aqui quando forem registrados pelo service discovery.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Host:Porta</TableHead>
                  <TableHead className="text-center">Peso</TableHead>
                  <TableHead className="text-center">Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Metadados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {service.nodes.map((node) => {
                  const statusCfg = nodeStatusConfig[node.status] || nodeStatusConfig.unknown
                  const StatusIcon = statusCfg.icon
                  return (
                    <TableRow key={node.id}>
                      <TableCell className="font-mono text-sm">
                        {node.host}:{node.port}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {node.weight}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {node.priority}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${statusCfg.bg}`} />
                          <span className={`text-sm ${statusCfg.color}`}>
                            <StatusIcon className="h-3.5 w-3.5 inline mr-1" />
                            {statusCfg.label}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {node.metadata && Object.keys(node.metadata).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(node.metadata).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-[10px]">
                                {key}: {value}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Associated Routes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-5 w-5 text-primary" />
            Rotas Associadas
          </CardTitle>
          <CardDescription>
            Rotas que utilizam este servico como upstream
          </CardDescription>
        </CardHeader>
        <CardContent>
          {service.routes.length === 0 ? (
            <div className="py-8 text-center">
              <Network className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma rota associada a este servico
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {service.routes.map((route) => (
                <div
                  key={route}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-mono">{route}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
