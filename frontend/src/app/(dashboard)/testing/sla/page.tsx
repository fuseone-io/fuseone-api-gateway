"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Clock,
  Plus,
  Shield,
  Trash2,
  TrendingDown,
  TrendingUp,
  Zap,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/page-header"
import { SLAGauge } from "@/components/sla-gauge"
import { useTestingStore } from "@/stores/testing-store"
import type { SLADefinition } from "@/types/testing"

const COMPLIANCE_BADGE: Record<string, { label: string; className: string }> = {
  compliant: { label: "Em Conformidade", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  at_risk: { label: "Em Risco", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  breached: { label: "Violado", className: "bg-red-500/15 text-red-600 border-red-500/30" },
}

const EVAL_WINDOW_LABELS: Record<string, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function SLADashboardPage() {
  const { slaDefinitions, slaLoading, fetchSLAs, createSLA, deleteSLA } = useTestingStore()

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SLADefinition | null>(null)

  // Create form state
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newAvailability, setNewAvailability] = useState("99.9")
  const [newLatency, setNewLatency] = useState("500")
  const [newErrorRate, setNewErrorRate] = useState("1")
  const [newEvalWindow, setNewEvalWindow] = useState<"7d" | "30d" | "90d">("30d")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchSLAs()
  }, [fetchSLAs])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await createSLA({
        name: newName.trim(),
        description: newDescription.trim(),
        availability_pct: parseFloat(newAvailability) || 99.9,
        latency_p99_ms: parseInt(newLatency) || 500,
        error_rate_pct: parseFloat(newErrorRate) || 1,
        eval_window: newEvalWindow,
      })
      toast.success("SLA criado com sucesso")
      setCreateOpen(false)
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar SLA")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteSLA(deleteTarget.id)
      toast.success("SLA excluido")
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir SLA")
    }
  }

  const resetForm = () => {
    setNewName("")
    setNewDescription("")
    setNewAvailability("99.9")
    setNewLatency("500")
    setNewErrorRate("1")
    setNewEvalWindow("30d")
  }

  // Summary stats
  const compliant = slaDefinitions.filter((s) => s.compliance_status === "compliant").length
  const atRisk = slaDefinitions.filter((s) => s.compliance_status === "at_risk").length
  const breached = slaDefinitions.filter((s) => s.compliance_status === "breached").length

  if (slaLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="SLA Dashboard"
        description="Acordos de nivel de servico e compliance das suas APIs"
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo SLA
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Novo Acordo de Nivel de Servico</DialogTitle>
                <DialogDescription>
                  Defina as metas de disponibilidade, latencia e taxa de erro.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    placeholder="Ex: SLA Premium - API Pagamentos"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descricao</Label>
                  <Textarea
                    placeholder="Descricao do SLA..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Disponibilidade (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={newAvailability}
                      onChange={(e) => setNewAvailability(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Latencia P99 (ms)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newLatency}
                      onChange={(e) => setNewLatency(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Taxa de Erro (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={newErrorRate}
                      onChange={(e) => setNewErrorRate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Janela de Avaliacao</Label>
                  <Select value={newEvalWindow} onValueChange={(v) => setNewEvalWindow(v as "7d" | "30d" | "90d")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">7 dias</SelectItem>
                      <SelectItem value="30d">30 dias</SelectItem>
                      <SelectItem value="90d">90 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                  {creating ? "Criando..." : "Criar SLA"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Summary stats */}
      {slaDefinitions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Em Conformidade</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{compliant}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Em Risco</p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{atRisk}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                  <Zap className="h-5 w-5 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Violados</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{breached}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SLA cards */}
      {slaDefinitions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">
              Nenhum SLA definido
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Crie um acordo de nivel de servico para monitorar compliance das suas APIs
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo SLA
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {slaDefinitions.map((sla) => {
            const compBadge = COMPLIANCE_BADGE[sla.compliance_status] || COMPLIANCE_BADGE.compliant

            return (
              <Card key={sla.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        {sla.name}
                      </CardTitle>
                      {sla.description && (
                        <CardDescription className="text-xs mt-1">{sla.description}</CardDescription>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-xs ${compBadge.className}`}>
                      {compBadge.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Gauges row */}
                  <div className="flex items-center justify-around">
                    <SLAGauge
                      value={sla.current_avail}
                      label="Disponibilidade"
                      size={90}
                      strokeWidth={8}
                    />
                    <div className="text-center">
                      <p
                        className={`text-xl font-bold ${
                          sla.current_latency <= sla.latency_p99_ms
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {sla.current_latency}ms
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        P99 Latencia
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Meta: {sla.latency_p99_ms}ms
                      </p>
                    </div>
                    <div className="text-center">
                      <p
                        className={`text-xl font-bold ${
                          sla.current_error <= sla.error_rate_pct
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {sla.current_error.toFixed(2)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Taxa de Erro
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Meta: {sla.error_rate_pct}%
                      </p>
                    </div>
                  </div>

                  {/* Budget remaining */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Error Budget Restante</span>
                      <span className="font-medium">
                        {sla.budget_remaining.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          sla.budget_remaining > 50
                            ? "bg-emerald-500"
                            : sla.budget_remaining > 20
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, sla.budget_remaining))}%` }}
                      />
                    </div>
                  </div>

                  {/* Targets row */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-muted/50 rounded px-2 py-1.5 text-center">
                      <span className="text-muted-foreground block">Meta Disp.</span>
                      <span className="font-medium">{sla.availability_pct}%</span>
                    </div>
                    <div className="bg-muted/50 rounded px-2 py-1.5 text-center">
                      <span className="text-muted-foreground block">Janela</span>
                      <span className="font-medium">{EVAL_WINDOW_LABELS[sla.eval_window]}</span>
                    </div>
                    <div className="bg-muted/50 rounded px-2 py-1.5 text-center">
                      <span className="text-muted-foreground block">Atual Disp.</span>
                      <span
                        className={`font-medium ${
                          sla.current_avail >= sla.availability_pct
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {sla.current_avail.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {sla.last_eval_at
                        ? `Avaliado: ${formatDateTime(sla.last_eval_at)}`
                        : "Ainda nao avaliado"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(sla)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir SLA</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o SLA &ldquo;{deleteTarget?.name}&rdquo;?
              O historico de compliance sera perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
