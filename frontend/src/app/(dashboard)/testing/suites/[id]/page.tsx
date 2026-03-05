"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FlaskConical,
  Loader2,
  Play,
  Plus,
  Save,
  Settings,
  Tag,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { TagInput } from "@/components/tag-input"
import { TestStepEditor } from "@/components/test-step-editor"
import { useTestingStore } from "@/stores/testing-store"
import { api } from "@/lib/api-client"
import type { TestSuite, TestRun, StepResult, TestStep } from "@/types/testing"

const RUN_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  passed: { label: "Aprovado", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  failed: { label: "Falhou", className: "bg-red-500/15 text-red-600 border-red-500/30" },
  error: { label: "Erro", className: "bg-red-500/15 text-red-600 border-red-500/30" },
  running: { label: "Executando", className: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  pending: { label: "Pendente", className: "bg-slate-500/15 text-slate-600 border-slate-500/30" },
}

const STEP_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  passed: { label: "OK", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  failed: { label: "Falhou", className: "bg-red-500/15 text-red-600 border-red-500/30" },
  error: { label: "Erro", className: "bg-red-500/15 text-red-600 border-red-500/30" },
  skipped: { label: "Pulado", className: "bg-slate-500/15 text-slate-600 border-slate-500/30" },
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

// ── Step Result Details (expandable row) ──
function StepResultDetail({ result }: { result: StepResult }) {
  const [expanded, setExpanded] = useState(false)
  const badge = STEP_STATUS_BADGE[result.status] || STEP_STATUS_BADGE.skipped

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="w-[40px]">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-mono text-xs">#{result.step_index + 1}</TableCell>
        <TableCell className="font-medium text-sm">{result.step_name}</TableCell>
        <TableCell>
          <Badge variant="outline" className={`text-[10px] ${badge.className}`}>
            {result.status === "passed" ? (
              <CheckCircle2 className="h-3 w-3 mr-1" />
            ) : result.status === "failed" || result.status === "error" ? (
              <XCircle className="h-3 w-3 mr-1" />
            ) : null}
            {badge.label}
          </Badge>
        </TableCell>
        <TableCell className="font-mono text-xs text-center">
          {result.status_code || "--"}
        </TableCell>
        <TableCell className="font-mono text-xs text-right">
          {formatDuration(result.response_time_ms)}
        </TableCell>
        <TableCell className="text-xs text-center">
          <span className="text-emerald-600">
            {result.assertions.filter((a) => a.passed).length}
          </span>
          <span className="text-muted-foreground">/</span>
          <span>{result.assertions.length}</span>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/20 p-4">
            <div className="space-y-3">
              {/* Assertion results */}
              <div>
                <p className="text-xs font-semibold mb-2">Assertions</p>
                <div className="space-y-1">
                  {result.assertions.map((a, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${
                        a.passed ? "bg-emerald-500/10" : "bg-red-500/10"
                      }`}
                    >
                      {a.passed ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                      )}
                      <span className="font-mono">
                        {a.type} {a.target ? `(${a.target})` : ""} {a.operator} &ldquo;{a.expected}&rdquo;
                      </span>
                      {!a.passed && (
                        <span className="text-muted-foreground ml-auto">
                          Obtido: &ldquo;{a.actual}&rdquo;
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Error */}
              {result.error && (
                <div>
                  <p className="text-xs font-semibold text-destructive mb-1">Erro</p>
                  <pre className="text-xs bg-destructive/10 rounded p-2 overflow-x-auto">
                    {result.error}
                  </pre>
                </div>
              )}

              {/* Extracted variables */}
              {result.extracted_vars && Object.keys(result.extracted_vars).length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-1">Variaveis Extraidas</p>
                  <div className="space-y-0.5">
                    {Object.entries(result.extracted_vars).map(([key, val]) => (
                      <p key={key} className="text-xs font-mono">
                        <span className="text-primary">{key}</span> = {val}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Response body (truncated) */}
              {result.response_body && (
                <div>
                  <p className="text-xs font-semibold mb-1">Response Body</p>
                  <pre className="text-xs bg-muted rounded p-2 overflow-x-auto max-h-[200px]">
                    {result.response_body.length > 2000
                      ? result.response_body.substring(0, 2000) + "..."
                      : result.response_body}
                  </pre>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ── Run History Entry ──
function RunEntry({ run }: { run: TestRun }) {
  const [expanded, setExpanded] = useState(false)
  const badge = RUN_STATUS_BADGE[run.status] || RUN_STATUS_BADGE.pending

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <Badge variant="outline" className={`text-xs ${badge.className}`}>
          {run.status === "passed" ? (
            <CheckCircle2 className="h-3 w-3 mr-1" />
          ) : run.status === "failed" || run.status === "error" ? (
            <XCircle className="h-3 w-3 mr-1" />
          ) : null}
          {badge.label}
        </Badge>
        <span className="text-xs text-muted-foreground">
          <span className="text-emerald-600 font-medium">{run.passed_steps}</span>
          /{run.total_steps} steps
        </span>
        <span className="text-xs font-mono text-muted-foreground ml-auto">
          {formatDuration(run.duration_ms)}
        </span>
        <Badge variant="outline" className="text-[10px]">
          {run.trigger_type === "manual" ? "Manual" : run.trigger_type === "synthetic" ? "Sintetico" : "CI"}
        </Badge>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {run.created_at ? formatDateTime(run.created_at) : "--"}
        </span>
      </div>

      {expanded && run.results && run.results.length > 0 && (
        <div className="border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Step</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[80px] text-center">HTTP</TableHead>
                <TableHead className="w-[100px] text-right">Tempo</TableHead>
                <TableHead className="w-[100px] text-center">Assertions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.results.map((result, i) => (
                <StepResultDetail key={i} result={result} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──
export default function TestSuiteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const suiteId = params.id as string

  const { runs, runsLoading, fetchRuns, runSuite, updateSuite, deleteSuite } =
    useTestingStore()

  const [suite, setSuite] = useState<TestSuite | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("steps")

  // Editable fields
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editTags, setEditTags] = useState<string[]>([])
  const [editSteps, setEditSteps] = useState<TestStep[]>([])

  const loadSuite = useCallback(async () => {
    try {
      const data = await api.getTestSuite(suiteId)
      setSuite(data)
      setEditName(data.name)
      setEditDescription(data.description)
      setEditTags(data.tags || [])
      setEditSteps(data.steps || [])
      if (data.name) sessionStorage.setItem(`breadcrumb:${suiteId}`, data.name)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar suite")
      router.push("/testing/suites")
    } finally {
      setLoading(false)
    }
  }, [suiteId, router])

  useEffect(() => {
    loadSuite()
    fetchRuns(suiteId)
  }, [loadSuite, fetchRuns, suiteId])

  const handleSave = async () => {
    if (!suite) return
    setSaving(true)
    try {
      const updated = await updateSuite(suite.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        steps: editSteps,
        tags: editTags,
      })
      setSuite(updated)
      toast.success("Suite salva com sucesso")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar suite")
    } finally {
      setSaving(false)
    }
  }

  const handleRun = async () => {
    setRunning(true)
    try {
      const run = await runSuite(suiteId)
      toast.success(
        run.status === "passed"
          ? "Teste aprovado!"
          : run.status === "failed"
            ? "Teste falhou"
            : "Teste executado"
      )
      await fetchRuns(suiteId)
      setActiveTab("runs")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao executar suite")
    } finally {
      setRunning(false)
    }
  }

  const handleDelete = async () => {
    if (!suite) return
    try {
      await deleteSuite(suite.id)
      toast.success("Suite excluida")
      router.push("/testing/suites")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir suite")
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  if (!suite) return null

  const hasChanges =
    editName !== suite.name ||
    editDescription !== suite.description ||
    JSON.stringify(editTags) !== JSON.stringify(suite.tags) ||
    JSON.stringify(editSteps) !== JSON.stringify(suite.steps)

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<FlaskConical className="h-5 w-5" />}
        title={suite.name}
        description={suite.description || "Suite de teste"}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/testing/suites")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setEditSteps([
                  ...editSteps,
                  {
                    name: "",
                    method: "GET",
                    url: "",
                    headers: {},
                    body: "",
                    assertions: [{ type: "status_code", target: "", operator: "eq", expected: "200" }],
                    extract_vars: {},
                    delay_ms: 0,
                  },
                ])
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Step
            </Button>
            {hasChanges && (
              <Button variant="outline" onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            )}
            <Button
              onClick={handleRun}
              disabled={running || editSteps.length === 0}
            >
              {running ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {running ? "Executando..." : "Executar"}
            </Button>
          </div>
        }
      />

      {/* Tags display */}
      {suite.tags.length > 0 && (
        <div className="flex items-center gap-2">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          {suite.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="steps" className="gap-1.5">
            <FlaskConical className="h-4 w-4" />
            Steps ({editSteps.length})
          </TabsTrigger>
          <TabsTrigger value="runs" className="gap-1.5">
            <Play className="h-4 w-4" />
            Execucoes ({runs.length})
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="h-4 w-4" />
            Configuracoes
          </TabsTrigger>
        </TabsList>

        {/* Steps Tab */}
        <TabsContent value="steps" className="mt-4">
          <TestStepEditor steps={editSteps} onChange={setEditSteps} />
        </TabsContent>

        {/* Runs Tab */}
        <TabsContent value="runs" className="mt-4 space-y-3">
          {runsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Play className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma execucao encontrada. Clique em &ldquo;Executar&rdquo; para rodar a suite.
                </p>
              </CardContent>
            </Card>
          ) : (
            runs.map((run) => <RunEntry key={run.id} run={run} />)
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuracoes da Suite</CardTitle>
              <CardDescription>Edite as informacoes basicas da suite de teste</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome da suite"
                />
              </div>
              <div className="space-y-2">
                <Label>Descricao</Label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Descricao da suite"
                />
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <TagInput
                  value={editTags}
                  onChange={setEditTags}
                  placeholder="Digite e pressione Enter"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <p className="text-sm font-medium text-destructive">Zona de Perigo</p>
                  <p className="text-xs text-muted-foreground">
                    Excluir permanentemente esta suite e todo o historico de execucoes
                  </p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir Suite
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Suite</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a suite &ldquo;{suite.name}&rdquo;?
              Todas as execucoes serao removidas. Esta acao nao pode ser desfeita.
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
