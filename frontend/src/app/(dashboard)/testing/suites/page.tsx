"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Clock,
  FlaskConical,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Tag,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { useTestingStore } from "@/stores/testing-store"
import type { TestSuite } from "@/types/testing"

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

export default function TestSuitesPage() {
  const router = useRouter()
  const {
    suites,
    suitesLoading,
    suitesError,
    fetchSuites,
    createSuite,
    deleteSuite,
    runSuite,
  } = useTestingStore()

  const [search, setSearch] = useState("")
  const [tagFilter, setTagFilter] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newTags, setNewTags] = useState("")
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TestSuite | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)

  useEffect(() => {
    fetchSuites()
  }, [fetchSuites])

  const filtered = suites.filter((s) => {
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
    const matchesTag =
      !tagFilter || s.tags.some((t) => t.toLowerCase().includes(tagFilter.toLowerCase()))
    return matchesSearch && matchesTag
  })

  // Collect all unique tags
  const allTags = Array.from(new Set(suites.flatMap((s) => s.tags))).sort()

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const suite = await createSuite({
        name: newName.trim(),
        description: newDescription.trim(),
        steps: [],
        tags: newTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      })
      toast.success("Suite criada com sucesso")
      setCreateOpen(false)
      setNewName("")
      setNewDescription("")
      setNewTags("")
      router.push(`/testing/suites/${suite.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar suite")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteSuite(deleteTarget.id)
      toast.success("Suite excluida")
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir suite")
    }
  }

  const handleRun = async (suiteId: string) => {
    setRunningId(suiteId)
    try {
      const run = await runSuite(suiteId)
      toast.success(
        run.status === "passed"
          ? "Teste aprovado!"
          : run.status === "failed"
            ? "Teste falhou"
            : "Teste executado"
      )
      router.push(`/testing/suites/${suiteId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao executar suite")
    } finally {
      setRunningId(null)
    }
  }

  if (suitesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suites de Teste"
        description="Gerencie suas suites de teste com steps e assertions"
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Suite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Suite de Teste</DialogTitle>
                <DialogDescription>
                  Crie uma nova suite. Voce podera adicionar steps e assertions depois.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    placeholder="Ex: Testes da API de Usuarios"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descricao</Label>
                  <Textarea
                    placeholder="Descricao da suite de teste..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tags (separadas por virgula)</Label>
                  <Input
                    placeholder="api, usuarios, integracao"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                  {creating ? "Criando..." : "Criar Suite"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Search + filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar suites..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto">
            {tagFilter && (
              <Badge
                variant="default"
                className="cursor-pointer shrink-0"
                onClick={() => setTagFilter("")}
              >
                <Tag className="h-3 w-3 mr-1" />
                {tagFilter} x
              </Badge>
            )}
            {!tagFilter &&
              allTags.slice(0, 6).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="cursor-pointer shrink-0 hover:bg-muted"
                  onClick={() => setTagFilter(tag)}
                >
                  {tag}
                </Badge>
              ))}
          </div>
        )}
      </div>

      {suitesError && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-destructive">
            {suitesError}
          </CardContent>
        </Card>
      )}

      {/* Suite cards grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FlaskConical className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">
              {search || tagFilter ? "Nenhuma suite encontrada" : "Nenhuma suite criada"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {search || tagFilter
                ? "Tente ajustar os filtros de busca"
                : "Crie sua primeira suite de teste para comecar"}
            </p>
            {!search && !tagFilter && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Suite
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((suite) => (
            <Card
              key={suite.id}
              className="cursor-pointer hover:border-primary/50 transition-colors group"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="flex-1 min-w-0"
                    onClick={() => router.push(`/testing/suites/${suite.id}`)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FlaskConical className="h-4 w-4 text-primary shrink-0" />
                      <h3 className="font-medium truncate">{suite.name}</h3>
                    </div>
                    {suite.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {suite.description}
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/testing/suites/${suite.id}`)}
                      >
                        Ver Detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleRun(suite.id)}
                        disabled={runningId === suite.id}
                      >
                        <Play className="mr-2 h-3.5 w-3.5" />
                        {runningId === suite.id ? "Executando..." : "Executar"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteTarget(suite)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <span>{suite.steps.length} step{suite.steps.length !== 1 ? "s" : ""}</span>
                  <span>
                    {suite.steps.reduce((sum, s) => sum + s.assertions.length, 0)} assertion
                    {suite.steps.reduce((sum, s) => sum + s.assertions.length, 0) !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Tags */}
                {suite.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {suite.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(suite.updated_at)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={runningId === suite.id || suite.steps.length === 0}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRun(suite.id)
                    }}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Executar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Suite</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a suite &ldquo;{deleteTarget?.name}&rdquo;?
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
