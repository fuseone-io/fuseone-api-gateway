"use client"

import { useEffect } from "react"
import Link from "next/link"
import {
  Activity,
  CheckCircle2,
  Clock,
  FlaskConical,
  ListChecks,
  MonitorCheck,
  Play,
  Plus,
  Shield,
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
import { SLAGauge } from "@/components/sla-gauge"
import { useTestingStore } from "@/stores/testing-store"

const RUN_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  passed: { label: "Aprovado", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  failed: { label: "Falhou", className: "bg-red-500/15 text-red-600 border-red-500/30" },
  error: { label: "Erro", className: "bg-red-500/15 text-red-600 border-red-500/30" },
  running: { label: "Executando", className: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  pending: { label: "Pendente", className: "bg-slate-500/15 text-slate-600 border-slate-500/30" },
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "agora"
  if (diffMin < 60) return `${diffMin}min atras`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h atras`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d atras`
}

export default function TestingOverviewPage() {
  const {
    suites,
    suitesLoading,
    runs,
    monitors,
    monitorsLoading,
    slaDefinitions,
    slaLoading,
    fetchSuites,
    fetchMonitors,
    fetchSLAs,
  } = useTestingStore()

  useEffect(() => {
    fetchSuites()
    fetchMonitors()
    fetchSLAs()
  }, [fetchSuites, fetchMonitors, fetchSLAs])

  const loading = suitesLoading || monitorsLoading || slaLoading

  // Stats
  const totalSuites = suites.length
  const activeMonitors = monitors.filter((m) => m.enabled).length
  const compliantSLAs = slaDefinitions.filter((s) => s.compliance_status === "compliant").length
  const totalSLAs = slaDefinitions.length

  // Gather all recent runs from all suites - we only have the `runs` for the currently-viewed suite.
  // For the overview, we show last known runs or a message.
  // For a real implementation, the backend would provide a "recent-runs" endpoint.

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Testing & Quality"
        description="Suites de teste, monitoramento sintetico e controle de SLA"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/testing/monitors">
                <MonitorCheck className="mr-2 h-4 w-4" />
                Novo Monitor
              </Link>
            </Button>
            <Button asChild>
              <Link href="/testing/suites">
                <Plus className="mr-2 h-4 w-4" />
                Nova Suite
              </Link>
            </Button>
          </div>
        }
      />

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total de Suites</p>
                <p className="text-2xl font-bold mt-1">{totalSuites}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ListChecks className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Ultima Execucao</p>
                <p className="text-2xl font-bold mt-1">
                  {runs.length > 0 ? (
                    <Badge
                      variant="outline"
                      className={`text-sm ${RUN_STATUS_BADGE[runs[0].status]?.className || ""}`}
                    >
                      {RUN_STATUS_BADGE[runs[0].status]?.label || runs[0].status}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">--</span>
                  )}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                <FlaskConical className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Monitores Ativos</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{activeMonitors}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <Activity className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">SLA Compliance</p>
                <p className="text-2xl font-bold mt-1">
                  {totalSLAs > 0 ? (
                    <span className={compliantSLAs === totalSLAs ? "text-emerald-600" : "text-amber-600"}>
                      {compliantSLAs}/{totalSLAs}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">--</span>
                  )}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors">
          <Link href="/testing/suites">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">Nova Suite de Teste</p>
                <p className="text-sm text-muted-foreground">Criar uma nova suite com steps e assertions</p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors">
          <Link href="/testing/suites">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10">
                <Play className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="font-medium">Executar Teste</p>
                <p className="text-sm text-muted-foreground">Selecionar e executar uma suite existente</p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors">
          <Link href="/testing/monitors">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10">
                <MonitorCheck className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="font-medium">Novo Monitor</p>
                <p className="text-sm text-muted-foreground">Configurar monitoramento sintetico</p>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Recent runs table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Execucoes Recentes</CardTitle>
          <CardDescription>Ultimas execucoes de testes em todas as suites</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-center py-8">
              <FlaskConical className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma execucao encontrada. Execute uma suite para ver os resultados aqui.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Suite</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Steps</TableHead>
                  <TableHead className="text-right">Duracao</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.slice(0, 5).map((run) => {
                  const suite = suites.find((s) => s.id === run.suite_id)
                  const badge = RUN_STATUS_BADGE[run.status] || RUN_STATUS_BADGE.pending
                  return (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">
                        {suite?.name || run.suite_id}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${badge.className}`}>
                          {run.status === "passed" ? (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          ) : run.status === "failed" || run.status === "error" ? (
                            <XCircle className="h-3 w-3 mr-1" />
                          ) : null}
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-emerald-600">{run.passed_steps}</span>
                        <span className="text-muted-foreground">/</span>
                        <span>{run.total_steps}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatDuration(run.duration_ms)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {run.trigger_type === "manual" ? "Manual" : run.trigger_type === "synthetic" ? "Sintetico" : "CI"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {run.created_at ? formatRelativeTime(run.created_at) : "--"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* SLA Summary */}
      {slaDefinitions.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Resumo SLA</CardTitle>
              <CardDescription>Status atual dos acordos de nivel de servico</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/testing/sla">Ver Todos</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 grid-cols-2 md:grid-cols-4">
              {slaDefinitions.slice(0, 4).map((sla) => (
                <div key={sla.id} className="flex flex-col items-center">
                  <SLAGauge value={sla.current_avail} label={sla.name} size={100} />
                  <Badge
                    variant="outline"
                    className={`text-[10px] mt-2 ${
                      sla.compliance_status === "compliant"
                        ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                        : sla.compliance_status === "at_risk"
                          ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                          : "bg-red-500/15 text-red-600 border-red-500/30"
                    }`}
                  >
                    {sla.compliance_status === "compliant"
                      ? "Em Conformidade"
                      : sla.compliance_status === "at_risk"
                        ? "Em Risco"
                        : "Violado"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
