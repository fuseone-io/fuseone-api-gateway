"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  BarChart3,
  Bug,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Heart,
  Trash2,
  Rocket,
  GitBranch,
  Cable,
  Download,
  Copy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { api } from "@/lib/api-client"
import { PageHeader } from "@/components/page-header"
import { exportAsFuseOneJson, exportAsOpenAPIYaml } from "@/lib/openapi-converter"
import { useEnvironmentStore } from "@/stores/environment-store"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ApiDefRecord, ApiDeployment } from "@/types/api"

const SYNC_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  synced: { label: "Synced", className: "bg-green-500/15 text-green-600 border-green-500/30" },
  out_of_sync: { label: "Out of Sync", className: "bg-orange-500/15 text-orange-600 border-orange-500/30" },
}

const LIFECYCLE_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-500/15 text-slate-600 border-slate-500/30" },
  active: { label: "Active", className: "bg-green-500/15 text-green-600 border-green-500/30" },
  deprecated: { label: "Deprecated", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  retired: { label: "Retired", className: "bg-red-500/15 text-red-600 border-red-500/30" },
}

export default function ApisPage() {
  const router = useRouter()
  const [records, setRecords] = useState<ApiDefRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [syncFilter, setSyncFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("all")
  const [deleteTarget, setDeleteTarget] = useState<ApiDefRecord | null>(null)
  const [deploying, setDeploying] = useState<string | null>(null)
  const [debugActiveRouteIds, setDebugActiveRouteIds] = useState<Set<string>>(new Set())
  const [deploymentsMap, setDeploymentsMap] = useState<Record<string, ApiDeployment[]>>({})
  const { environments } = useEnvironmentStore()
  const multiEnv = environments.length > 1

  const loadApis = async () => {
    try {
      const params: Record<string, string> = { page_size: "100" }
      if (search) params.search = search
      if (syncFilter !== "all") params.sync_status = syncFilter
      if (lifecycleFilter !== "all") params.lifecycle_status = lifecycleFilter
      const result = await api.listApis(params)
      setRecords(result.data || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load APIs")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadApis, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [search, syncFilter, lifecycleFilter])

  // Load deployments per API when multi-env
  useEffect(() => {
    if (!multiEnv || records.length === 0) return
    const load = async () => {
      const map: Record<string, ApiDeployment[]> = {}
      await Promise.all(
        records.map(async (rec) => {
          try {
            const deps = await api.listApiDeployments(rec.id)
            if (deps?.length) map[rec.id] = deps
          } catch {}
        })
      )
      setDeploymentsMap(map)
    }
    load()
  }, [records, multiEnv])

  // Fetch debug-active route IDs (single APISIX call) to show debug badges
  useEffect(() => {
    api.debugActiveRoutes()
      .then((routeIds) => setDebugActiveRouteIds(new Set(routeIds || [])))
      .catch(() => {}) // silent — badge is informational
  }, [records])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.deleteApi(deleteTarget.id)
      toast.success("API deleted")
      setDeleteTarget(null)
      loadApis()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete API")
    }
  }

  const handleDeploy = async (record: ApiDefRecord) => {
    setDeploying(record.id)
    try {
      await api.deployApi(record.id)
      toast.success("API deployed")
      loadApis()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deploy API")
    } finally {
      setDeploying(null)
    }
  }

  const handleClone = async (record: ApiDefRecord) => {
    try {
      const cloned = await api.cloneApi(record.id)
      toast.success(`Cloned to ${cloned.version}`)
      router.push(`/apis/${cloned.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clone API")
    }
  }

  const hasDebugActive = (record: ApiDefRecord): boolean => {
    if (!record.apisix_route_ids || debugActiveRouteIds.size === 0) return false
    return record.apisix_route_ids.some((rid) => debugActiveRouteIds.has(rid))
  }

  // Client-side status filter (status is inside the definition JSON)
  const filtered = records.filter((r) => {
    if (statusFilter === "all") return true
    return r.definition?.status === statusFilter
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="APIs"
        description="Manage your API definitions with visual flow design"
        actions={
          <Button asChild>
            <Link href="/apis/new">
              <Plus className="mr-2 h-4 w-4" />
              Create API
            </Link>
          </Button>
        }
      />

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search APIs..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={syncFilter} onValueChange={setSyncFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sync Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sync</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="synced">Synced</SelectItem>
            <SelectItem value="out_of_sync">Out of Sync</SelectItem>
          </SelectContent>
        </Select>
        <Select value={lifecycleFilter} onValueChange={setLifecycleFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Lifecycle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Lifecycle</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="deprecated">Deprecated</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg font-medium text-muted-foreground mb-2">
              {search || syncFilter !== "all" || statusFilter !== "all" || lifecycleFilter !== "all"
                ? "No APIs match your filters"
                : "No APIs created yet"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {search || syncFilter !== "all" || statusFilter !== "all" || lifecycleFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Create your first API to get started with the visual flow designer"}
            </p>
            {!search && syncFilter === "all" && statusFilter === "all" && lifecycleFilter === "all" && (
              <Button asChild>
                <Link href="/apis/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create API
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[60px] text-center">Version</TableHead>
                <TableHead>URI</TableHead>
                <TableHead className="w-[80px] text-center">Flows</TableHead>
                <TableHead className="w-[90px] text-center">Policies</TableHead>
                <TableHead className="w-[100px] text-center">Lifecycle</TableHead>
                <TableHead className="w-[110px] text-center">Sync</TableHead>
                {multiEnv && <TableHead className="w-[80px] text-center">Envs</TableHead>}
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((record) => {
                const def = record.definition
                const firstFlow = def?.flows?.[0]
                const totalPolicies = def?.flows?.reduce(
                  (sum: number, f: { policies: unknown[] }) => sum + (f.policies?.length || 0),
                  0
                ) || 0
                const flowCount = def?.flows?.length || 0
                const syncInfo = SYNC_BADGE[record.sync_status] || SYNC_BADGE.draft
                const lifecycleInfo = LIFECYCLE_BADGE[record.lifecycle_status] || LIFECYCLE_BADGE.draft
                const contextPath = def?.context_path || ""
                const primaryUri = contextPath || firstFlow?.entrypoint?.uri || "/"

                return (
                  <TableRow
                    key={record.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/apis/${record.id}`)}
                  >
                    <TableCell className="max-w-[280px]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Cable className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate" title={record.name}>
                              {record.name || "Untitled API"}
                            </p>
                            {hasDebugActive(record) && (
                              <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-600 border-amber-500/30 gap-1 shrink-0">
                                <Bug className="h-3 w-3" />
                                Debug
                              </Badge>
                            )}
                          </div>
                          {record.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5" title={record.description}>
                              {record.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {record.version}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs font-mono text-muted-foreground">
                        {primaryUri}
                      </code>
                    </TableCell>
                    <TableCell className="text-center">
                      {flowCount > 1 ? (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <GitBranch className="h-3 w-3" />
                          {flowCount}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{flowCount}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs text-muted-foreground">{totalPolicies}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-[10px] ${lifecycleInfo.className}`}>
                        {lifecycleInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-[10px] ${syncInfo.className}`}>
                        {syncInfo.label}
                      </Badge>
                    </TableCell>
                    {multiEnv && (
                      <TableCell className="text-center">
                        <TooltipProvider delayDuration={200}>
                          <div className="flex items-center justify-center gap-1">
                            {(deploymentsMap[record.id] || []).map((dep) => {
                              const env = environments.find((e) => e.id === dep.environment_id)
                              if (!env) return null
                              return (
                                <Tooltip key={dep.id}>
                                  <TooltipTrigger asChild>
                                    <span
                                      className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-border"
                                      style={{ backgroundColor: env.color }}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="text-xs">
                                    {env.name}
                                  </TooltipContent>
                                </Tooltip>
                              )
                            })}
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    )}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/apis/${record.id}`)}>
                            <Eye className="mr-2 h-3.5 w-3.5" /> View
                          </DropdownMenuItem>
                          {(record.sync_status === "draft" || record.sync_status === "out_of_sync") && (
                            <DropdownMenuItem
                              onClick={() => handleDeploy(record)}
                              disabled={deploying === record.id}
                            >
                              <Rocket className="mr-2 h-3.5 w-3.5" />
                              {deploying === record.id ? "Deploying..." : "Deploy"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleClone(record)}>
                            <Copy className="mr-2 h-3.5 w-3.5" /> Clone to New Version
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => record.definition && exportAsFuseOneJson(record.definition)}>
                            <Download className="mr-2 h-3.5 w-3.5" /> Export JSON
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => record.definition && exportAsOpenAPIYaml(record.definition)}>
                            <Download className="mr-2 h-3.5 w-3.5" /> Export OpenAPI
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => router.push(`/apis/${record.id}/analytics`)}>
                            <BarChart3 className="mr-2 h-3.5 w-3.5" /> Analytics
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/apis/${record.id}/health`)}>
                            <Heart className="mr-2 h-3.5 w-3.5" /> Health Check
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/apis/${record.id}/debug`)}>
                            <Bug className="mr-2 h-3.5 w-3.5" /> Debug
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteTarget(record)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this API definition
              {deleteTarget?.sync_status === "synced" && " and remove it from the API Gateway"}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
