"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MonitorCheck,
  Plus,
  Trash2,
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
import { Switch } from "@/components/ui/switch"
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
import { useTestingStore } from "@/stores/testing-store"
import type { SyntheticMonitor } from "@/types/testing"

const STATUS_CONFIG: Record<
  SyntheticMonitor["last_status"],
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  up: { label: "Online", color: "text-emerald-500", icon: CheckCircle2 },
  down: { label: "Offline", color: "text-red-500", icon: XCircle },
  degraded: { label: "Degradado", color: "text-amber-500", icon: AlertTriangle },
  unknown: { label: "Desconhecido", color: "text-slate-400", icon: Activity },
}

const LOCATIONS = [
  { value: "us-east-1", label: "US East (Virginia)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "EU West (Ireland)" },
  { value: "sa-east-1", label: "South America (Sao Paulo)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
]

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

function formatInterval(sec: number): string {
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}min`
  return `${Math.floor(sec / 3600)}h`
}

export default function SyntheticMonitorsPage() {
  const {
    monitors,
    monitorsLoading,
    suites,
    fetchMonitors,
    fetchSuites,
    createMonitor,
    toggleMonitor,
    deleteMonitor,
  } = useTestingStore()

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SyntheticMonitor | null>(null)

  // Create form state
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newSuiteId, setNewSuiteId] = useState("")
  const [newInterval, setNewInterval] = useState("60")
  const [newLocations, setNewLocations] = useState<string[]>(["sa-east-1"])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchMonitors()
    fetchSuites()
  }, [fetchMonitors, fetchSuites])

  const handleCreate = async () => {
    if (!newName.trim() || !newSuiteId) return
    setCreating(true)
    try {
      await createMonitor({
        name: newName.trim(),
        description: newDescription.trim(),
        suite_id: newSuiteId,
        interval_sec: parseInt(newInterval) || 60,
        locations: newLocations,
      })
      toast.success("Monitor criado com sucesso")
      setCreateOpen(false)
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar monitor")
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleMonitor(id, enabled)
      toast.success(enabled ? "Monitor ativado" : "Monitor desativado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar monitor")
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMonitor(deleteTarget.id)
      toast.success("Monitor excluido")
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir monitor")
    }
  }

  const resetForm = () => {
    setNewName("")
    setNewDescription("")
    setNewSuiteId("")
    setNewInterval("60")
    setNewLocations(["sa-east-1"])
  }

  const toggleLocation = (loc: string) => {
    setNewLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    )
  }

  if (monitorsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitores Sinteticos"
        description="Execute suites de teste automaticamente em intervalos regulares"
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Monitor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Novo Monitor Sintetico</DialogTitle>
                <DialogDescription>
                  Configure um monitor que executa uma suite de teste periodicamente.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    placeholder="Ex: Health Check - API Usuarios"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descricao</Label>
                  <Textarea
                    placeholder="Descricao do monitor..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Suite de Teste</Label>
                  <Select value={newSuiteId} onValueChange={setNewSuiteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma suite" />
                    </SelectTrigger>
                    <SelectContent>
                      {suites.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Intervalo</Label>
                  <Select value={newInterval} onValueChange={setNewInterval}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 segundos</SelectItem>
                      <SelectItem value="60">1 minuto</SelectItem>
                      <SelectItem value="300">5 minutos</SelectItem>
                      <SelectItem value="600">10 minutos</SelectItem>
                      <SelectItem value="1800">30 minutos</SelectItem>
                      <SelectItem value="3600">1 hora</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Localizacoes</Label>
                  <div className="flex flex-wrap gap-2">
                    {LOCATIONS.map((loc) => (
                      <Badge
                        key={loc.value}
                        variant={newLocations.includes(loc.value) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleLocation(loc.value)}
                      >
                        {loc.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim() || !newSuiteId || newLocations.length === 0}
                >
                  {creating ? "Criando..." : "Criar Monitor"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Monitor cards */}
      {monitors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MonitorCheck className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">
              Nenhum monitor configurado
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Crie um monitor sintetico para verificar suas APIs automaticamente
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Monitor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {monitors.map((monitor) => {
            const statusConf = STATUS_CONFIG[monitor.last_status] || STATUS_CONFIG.unknown
            const StatusIcon = statusConf.icon
            const suite = suites.find((s) => s.id === monitor.suite_id)

            return (
              <Card key={monitor.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`shrink-0 ${statusConf.color}`}>
                        <StatusIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm truncate">{monitor.name}</CardTitle>
                        {monitor.description && (
                          <CardDescription className="text-xs line-clamp-1 mt-0.5">
                            {monitor.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={monitor.enabled}
                      onCheckedChange={(enabled) => handleToggle(monitor.id, enabled)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Uptime */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Uptime</span>
                      <span className="font-medium">
                        {monitor.uptime_pct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          monitor.uptime_pct >= 99
                            ? "bg-emerald-500"
                            : monitor.uptime_pct >= 95
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(100, monitor.uptime_pct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/50 rounded px-2 py-1.5">
                      <span className="text-muted-foreground block">Intervalo</span>
                      <span className="font-medium">{formatInterval(monitor.interval_sec)}</span>
                    </div>
                    <div className="bg-muted/50 rounded px-2 py-1.5">
                      <span className="text-muted-foreground block">Falhas Consecutivas</span>
                      <span
                        className={`font-medium ${
                          monitor.consecutive_fail > 0 ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {monitor.consecutive_fail}
                      </span>
                    </div>
                  </div>

                  {/* Suite reference */}
                  {suite && (
                    <div className="text-xs text-muted-foreground">
                      Suite: <span className="font-medium text-foreground">{suite.name}</span>
                    </div>
                  )}

                  {/* Locations */}
                  <div className="flex flex-wrap gap-1">
                    {monitor.locations.map((loc) => (
                      <Badge key={loc} variant="outline" className="text-[10px] px-1.5 py-0">
                        {loc}
                      </Badge>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {monitor.last_run_at
                        ? formatRelativeTime(monitor.last_run_at)
                        : "Nunca executado"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(monitor)}
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
            <AlertDialogTitle>Excluir Monitor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o monitor &ldquo;{deleteTarget?.name}&rdquo;?
              Esta acao nao pode ser desfeita.
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
