"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { Activity, ArrowRightLeft, BarChart3, Bug, Eye, Heart, Save, Rocket, Clock, Download, Copy, AlertTriangle, Ban, Globe, Route, X, PenLine, Users, Store, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ApiFlowEditor } from "@/components/flow/api-flow-editor"
import { exportAsFuseOneJson, exportAsOpenAPIYaml } from "@/lib/openapi-converter"
import type { ApiDefinition, ApiDefRecord, ApiDeployment, LifecycleStatus, RoutingMode } from "@/types/api"
import { api } from "@/lib/api-client"
import { useEnvironmentStore } from "@/stores/environment-store"
import { useSidebar } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export default function ApiDetailPage() {
  const t = useTranslations("apis")
  const tc = useTranslations("common")
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const LIFECYCLE_BADGE: Record<LifecycleStatus, { label: string; className: string }> = {
    draft: { label: t("status.draft"), className: "bg-slate-500/15 text-slate-600 border-slate-500/30" },
    active: { label: t("status.active"), className: "bg-green-500/15 text-green-600 border-green-500/30" },
    deprecated: { label: t("status.deprecated"), className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
    retired: { label: t("status.retired"), className: "bg-red-500/15 text-red-600 border-red-500/30" },
  }

  const [record, setRecord] = useState<ApiDefRecord | null>(null)
  const [apiDef, setApiDef] = useState<ApiDefinition | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [versions, setVersions] = useState<ApiDefRecord[]>([])
  const [showDeprecateDialog, setShowDeprecateDialog] = useState(false)
  const [showRetireDialog, setShowRetireDialog] = useState(false)
  const [sunsetDate, setSunsetDate] = useState("")
  const [showRoutingConfig, setShowRoutingConfig] = useState(false)
  const [showProperties, setShowProperties] = useState(false)
  const [deployments, setDeployments] = useState<ApiDeployment[]>([])
  const [showPortalDialog, setShowPortalDialog] = useState(false)
  const [portalVisible, setPortalVisible] = useState(false)
  const [portalCategories, setPortalCategories] = useState<string[]>([])
  const [openapiSpec, setOpenapiSpec] = useState("")
  const [savingPortal, setSavingPortal] = useState(false)
  const savedSnapshot = useRef<string>("")
  const { environments, fetchEnvironments } = useEnvironmentStore()
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar()
  const prevSidebarState = useRef<boolean | null>(null)

  // Auto-collapse sidebar when entering the flow editor, restore on leave
  useEffect(() => {
    prevSidebarState.current = sidebarOpen
    setSidebarOpen(false)
    return () => {
      if (prevSidebarState.current !== null) {
        setSidebarOpen(prevSidebarState.current)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchEnvironments()
  }, [fetchEnvironments])

  useEffect(() => {
    loadApi()
  }, [id])

  const loadDeployments = async () => {
    try {
      const deps = await api.listApiDeployments(id)
      setDeployments(deps || [])
    } catch {
      // deployments endpoint may not be available yet
    }
  }

  const loadApi = async () => {
    try {
      const rec = await api.getApi(id)
      setRecord(rec)
      setApiDef(rec.definition)
      savedSnapshot.current = JSON.stringify(rec.definition)
      if (rec.name) sessionStorage.setItem(`breadcrumb:${id}`, rec.name)
      // Load versions
      try {
        const vers = await api.getApiVersions(id)
        setVersions(vers || [])
      } catch {
        // versions endpoint may not be available yet
      }
      // Load deployments
      loadDeployments()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("detail.editor.toasts.failedLoad"))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!apiDef || !record) return
    setSaving(true)
    try {
      const updated = await api.updateApi(record.id, {
        name: apiDef.name,
        description: apiDef.description,
        definition: apiDef,
      })
      setRecord(updated)
      setApiDef(updated.definition)
      savedSnapshot.current = JSON.stringify(updated.definition)
      toast.success(t("detail.editor.toasts.changesSaved"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("detail.editor.toasts.failedSave"))
    } finally {
      setSaving(false)
    }
  }

  const handleDeploy = async () => {
    if (!record) return
    if (apiDef) {
      setSaving(true)
      try {
        await api.updateApi(record.id, {
          name: apiDef.name,
          description: apiDef.description,
          definition: apiDef,
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("detail.editor.toasts.failedSaveBeforeDeploy"))
        setSaving(false)
        return
      }
      setSaving(false)
    }

    setDeploying(true)
    try {
      const deployed = await api.deployApi(record.id)
      setRecord(deployed)
      setApiDef(deployed.definition)
      savedSnapshot.current = JSON.stringify(deployed.definition)
      toast.success(record.lifecycle_status !== "draft" ? t("detail.editor.toasts.appliedToGateway") : t("detail.editor.toasts.deployed"))
      // Reload versions (lifecycle may have changed)
      try {
        const vers = await api.getApiVersions(record.id)
        setVersions(vers || [])
      } catch {}
      // Reload deployments
      loadDeployments()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("detail.editor.toasts.failedDeploy"))
    } finally {
      setDeploying(false)
    }
  }

  const handleClone = async () => {
    if (!record) return
    try {
      const cloned = await api.cloneApi(record.id)
      toast.success(t("detail.editor.toasts.clonedToVersion", { version: cloned.version }))
      router.push(`/apis/${cloned.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("detail.editor.toasts.failedClone"))
    }
  }

  const handleDeprecate = async () => {
    if (!record) return
    try {
      const result = await api.deprecateApi(record.id, sunsetDate ? { sunset_date: new Date(sunsetDate).toISOString() } : undefined)
      setRecord(result)
      setShowDeprecateDialog(false)
      setSunsetDate("")
      toast.success(t("detail.editor.toasts.apiDeprecated"))
      try {
        const vers = await api.getApiVersions(record.id)
        setVersions(vers || [])
      } catch {}
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("detail.editor.toasts.failedDeprecate"))
    }
  }

  const handleRetire = async () => {
    if (!record) return
    try {
      const result = await api.retireApi(record.id)
      setRecord(result)
      setShowRetireDialog(false)
      toast.success(t("detail.editor.toasts.apiRetired"))
      try {
        const vers = await api.getApiVersions(record.id)
        setVersions(vers || [])
      } catch {}
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("detail.editor.toasts.failedRetire"))
    }
  }

  const handleUndeprecate = async () => {
    if (!record) return
    try {
      const result = await api.undeprecateApi(record.id)
      setRecord(result)
      toast.success("API reactivated")
      try {
        const vers = await api.getApiVersions(record.id)
        setVersions(vers || [])
      } catch {}
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reactivate API")
    }
  }

  const handlePromote = async (targetEnvId: string) => {
    if (!record) return
    const activeEnvId = useEnvironmentStore.getState().activeEnvironmentId
    const sourceEnvId = activeEnvId || environments.find((e) => e.is_default)?.id
    if (!sourceEnvId) {
      toast.error("No source environment selected")
      return
    }
    try {
      await api.createPromotion({
        api_definition_id: record.id,
        source_env_id: sourceEnvId,
        target_env_id: targetEnvId,
      })
      toast.success("Promotion request created")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create promotion")
    }
  }

  const openPortalDialog = async () => {
    setShowPortalDialog(true)
    try {
      const settings = await api.getPortalSettings(id)
      setPortalVisible(settings.portal_visible)
      setPortalCategories(settings.portal_categories || [])
      setOpenapiSpec(settings.openapi_spec || "")
    } catch {
      // Fields may not exist yet, use defaults
    }
  }

  const handleSavePortal = async () => {
    setSavingPortal(true)
    try {
      await api.updatePortalSettings(id, {
        portal_visible: portalVisible,
        portal_categories: portalCategories,
        openapi_spec: openapiSpec,
      })
      toast.success("Portal settings updated")
      setShowPortalDialog(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update portal settings")
    } finally {
      setSavingPortal(false)
    }
  }

  const handleSpecFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setOpenapiSpec(text)
      toast.success(`Loaded ${file.name}`)
    }
    reader.readAsText(file)
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    )
  }

  if (!apiDef || !record) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-lg font-medium text-muted-foreground">API not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/apis")}>
          Back to APIs
        </Button>
      </div>
    )
  }

  const lifecycleBadge = LIFECYCLE_BADGE[record.lifecycle_status] || LIFECYCLE_BADGE.draft
  const isRetired = record.lifecycle_status === "retired"
  const hasBeenDeployed = record.lifecycle_status !== "draft"
  const isDirty = apiDef ? JSON.stringify(apiDef) !== savedSnapshot.current : false
  const needsApply = hasBeenDeployed && record.sync_status === "out_of_sync"

  return (
    <div className="flex flex-col -m-8 h-[calc(100vh-4rem)]">
      {/* Retired banner */}
      {isRetired && (
        <div className="bg-red-500/10 border-b border-red-500/30 text-red-600 px-4 py-2 text-sm flex items-center gap-2 shrink-0">
          <Ban className="h-4 w-4" />
          This API version has been retired and is returning 410 Gone to consumers.
        </div>
      )}

      {/* Deprecated banner */}
      {record.lifecycle_status === "deprecated" && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-600 px-4 py-2 text-sm flex items-center gap-2 shrink-0">
          <AlertTriangle className="h-4 w-4" />
          This API version is deprecated.
          {record.sunset_date && (
            <> Sunset date: <strong>{new Date(record.sunset_date).toLocaleDateString()}</strong></>
          )}
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-card shrink-0">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm font-semibold truncate max-w-xs">
            {apiDef.name || <span className="text-muted-foreground">Untitled API</span>}
          </span>
          {apiDef.description && (
            <>
              <div className="w-px h-4 bg-border shrink-0" />
              <span className="text-xs text-muted-foreground truncate max-w-sm">{apiDef.description}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Deployed timestamp */}
          {record.deployed_at && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(record.deployed_at).toLocaleString()}
            </span>
          )}

          {/* Per-environment deployment badges */}
          {deployments.length > 0 && environments.length > 1 && (
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center gap-1">
                {deployments.map((dep) => {
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
                        <p className="font-medium">{env.name}</p>
                        {dep.deployed_at && (
                          <p className="text-muted-foreground">
                            {new Date(dep.deployed_at).toLocaleString()}
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            </TooltipProvider>
          )}

          {/* Lifecycle badge */}
          {record.lifecycle_status !== "draft" && (
            <Badge variant="outline" className={`text-[10px] ${lifecycleBadge.className}`}>
              {lifecycleBadge.label}
            </Badge>
          )}

          <div className="w-px h-4 bg-border shrink-0" />

          {/* Version selector */}
          {versions.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-mono hover:bg-accent transition-colors">
                  {record.version}
                  <span className="text-muted-foreground">({versions.length})</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {versions.map((v) => {
                  const vlc = LIFECYCLE_BADGE[v.lifecycle_status] || LIFECYCLE_BADGE.draft
                  return (
                    <DropdownMenuItem
                      key={v.id}
                      onClick={() => { if (v.id !== record.id) router.push(`/apis/${v.id}`) }}
                      className={v.id === record.id ? "bg-accent" : ""}
                    >
                      <span className="font-mono mr-2">{v.version}</span>
                      <Badge variant="outline" className={`text-[9px] ${vlc.className}`}>{vlc.label}</Badge>
                      {v.id === record.id && <span className="ml-auto text-xs text-muted-foreground">(current)</span>}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Badge variant="outline" className="text-[10px] font-mono">
              {record.version}
            </Badge>
          )}

          {/* Flows count */}
          <Badge variant="outline" className="text-[10px]">
            {apiDef.flows.length} {apiDef.flows.length === 1 ? "flow" : "flows"}
          </Badge>

          {/* Status toggle */}
          {!isRetired && (
            <div className="flex items-center gap-1">
              <Switch
                checked={apiDef.status === "enabled"}
                onCheckedChange={(checked) =>
                  setApiDef({ ...apiDef, status: checked ? "enabled" : "disabled" })
                }
                className="scale-75"
              />
              <Badge variant={apiDef.status === "enabled" ? "default" : "secondary"} className="text-[10px]">
                {apiDef.status}
              </Badge>
            </div>
          )}

          <div className="w-px h-4 bg-border shrink-0" />

          {/* Properties popover (controlled — triggered from expanded buttons or condensed menu) */}
          {!isRetired && (
            <Popover open={showProperties} onOpenChange={setShowProperties}>
              <PopoverTrigger asChild>
                <button className="hidden xl:flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] hover:bg-accent transition-colors">
                  <PenLine className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Properties</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={apiDef.name}
                    onChange={(e) => setApiDef({ ...apiDef, name: e.target.value })}
                    placeholder="API name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={apiDef.description}
                    onChange={(e) => setApiDef({ ...apiDef, description: e.target.value })}
                    placeholder="Description..."
                  />
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Expanded action buttons — visible on wide screens */}
          <div className="hidden xl:flex items-center gap-1.5">
            {/* Routing config */}
            {!isRetired && (
              <button
                onClick={() => setShowRoutingConfig(true)}
                className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] hover:bg-accent transition-colors"
              >
                <Globe className="h-3 w-3 text-muted-foreground" />
                {apiDef.context_path && (
                  <span className="font-mono">{apiDef.context_path}</span>
                )}
                {apiDef.hosts && apiDef.hosts.length > 0 && (
                  <span className="font-mono text-blue-500">
                    {apiDef.hosts.length === 1 ? apiDef.hosts[0] : `${apiDef.hosts.length} hosts`}
                  </span>
                )}
                {!apiDef.context_path && (!apiDef.hosts || apiDef.hosts.length === 0) && (
                  <span className="text-muted-foreground">Routing</span>
                )}
              </button>
            )}

            {/* Portal settings */}
            {!isRetired && (
              <button
                onClick={openPortalDialog}
                className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] hover:bg-accent transition-colors"
              >
                <Store className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Portal</span>
              </button>
            )}

            {/* Observe */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] hover:bg-accent transition-colors">
                  <Eye className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Observe</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/apis/${id}/analytics`)}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Analytics
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/apis/${id}/health`)}>
                  <Heart className="mr-2 h-4 w-4" />
                  Upstream Health
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/apis/${id}/traces`)}>
                  <Activity className="mr-2 h-4 w-4" />
                  Traces
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push(`/apis/${id}/debug`)}>
                  <Bug className="mr-2 h-4 w-4" />
                  Debug Logs
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push(`/apis/${id}/subscriptions`)}>
                  <Users className="mr-2 h-4 w-4" />
                  Subscribers
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Promote to... */}
            {environments.length > 1 && hasBeenDeployed && !isRetired && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] hover:bg-accent transition-colors">
                    <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Promote</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {environments
                    .filter((env) => {
                      const activeId = useEnvironmentStore.getState().activeEnvironmentId
                      const sourceId = activeId || environments.find((e) => e.is_default)?.id
                      return env.id !== sourceId
                    })
                    .map((env) => (
                      <DropdownMenuItem key={env.id} onClick={() => handlePromote(env.id)}>
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0 mr-2"
                          style={{ backgroundColor: env.color }}
                        />
                        Promote to {env.name}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Export / Clone */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] hover:bg-accent transition-colors">
                  <Download className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Export</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleClone}>
                  <Copy className="mr-2 h-4 w-4" />
                  Clone API
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportAsFuseOneJson(apiDef)}>
                  Export FuseOne JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAsOpenAPIYaml(apiDef)}>
                  Export OpenAPI YAML
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Lifecycle actions */}
            {record.lifecycle_status === "active" && (
              <button
                onClick={() => setShowDeprecateDialog(true)}
                className="flex items-center gap-1.5 rounded-md border border-amber-500/30 px-2.5 py-1 text-[10px] text-amber-600 hover:bg-amber-500/10 transition-colors"
              >
                <AlertTriangle className="h-3 w-3" />
                <span>Deprecate</span>
              </button>
            )}
            {record.lifecycle_status === "deprecated" && (
              <>
                <button
                  onClick={handleUndeprecate}
                  className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] hover:bg-accent transition-colors"
                >
                  <span className="text-muted-foreground">Reactivate</span>
                </button>
                <button
                  onClick={() => setShowRetireDialog(true)}
                  className="flex items-center gap-1.5 rounded-md border border-red-500/30 px-2.5 py-1 text-[10px] text-red-600 hover:bg-red-500/10 transition-colors"
                >
                  <Ban className="h-3 w-3" />
                  <span>Retire</span>
                </button>
              </>
            )}
          </div>

          {/* Condensed actions dropdown — visible on narrow screens */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="xl:hidden flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] hover:bg-accent transition-colors">
                <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Actions</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              {!isRetired && (
                <>
                  <DropdownMenuItem onClick={() => setShowProperties(true)}>
                    <PenLine className="mr-2 h-4 w-4" />
                    Properties
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowRoutingConfig(true)}>
                    <Globe className="mr-2 h-4 w-4" />
                    Routing
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openPortalDialog}>
                    <Store className="mr-2 h-4 w-4" />
                    Portal
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuLabel className="text-xs text-muted-foreground">Observe</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => router.push(`/apis/${id}/analytics`)}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Analytics
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/apis/${id}/health`)}>
                <Heart className="mr-2 h-4 w-4" />
                Upstream Health
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/apis/${id}/traces`)}>
                <Activity className="mr-2 h-4 w-4" />
                Traces
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/apis/${id}/debug`)}>
                <Bug className="mr-2 h-4 w-4" />
                Debug Logs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/apis/${id}/subscriptions`)}>
                <Users className="mr-2 h-4 w-4" />
                Subscribers
              </DropdownMenuItem>
              {environments.length > 1 && hasBeenDeployed && !isRetired && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Promote</DropdownMenuLabel>
                  {environments
                    .filter((env) => {
                      const activeId = useEnvironmentStore.getState().activeEnvironmentId
                      const sourceId = activeId || environments.find((e) => e.is_default)?.id
                      return env.id !== sourceId
                    })
                    .map((env) => (
                      <DropdownMenuItem key={env.id} onClick={() => handlePromote(env.id)}>
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0 mr-2"
                          style={{ backgroundColor: env.color }}
                        />
                        Promote to {env.name}
                      </DropdownMenuItem>
                    ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleClone}>
                <Copy className="mr-2 h-4 w-4" />
                Clone API
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAsFuseOneJson(apiDef)}>
                <Download className="mr-2 h-4 w-4" />
                Export FuseOne JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAsOpenAPIYaml(apiDef)}>
                <Download className="mr-2 h-4 w-4" />
                Export OpenAPI YAML
              </DropdownMenuItem>
              {record.lifecycle_status === "active" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowDeprecateDialog(true)} className="text-amber-600">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Deprecate
                  </DropdownMenuItem>
                </>
              )}
              {record.lifecycle_status === "deprecated" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleUndeprecate}>
                    Reactivate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowRetireDialog(true)} className="text-red-600">
                    <Ban className="mr-2 h-4 w-4" />
                    Retire
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-4 bg-border shrink-0" />

          {/* Save / Deploy / Apply */}
          {!isRetired && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] hover:bg-accent transition-colors disabled:opacity-50"
            >
              <Save className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{saving ? "Saving..." : "Save"}</span>
            </button>
          )}

          {!isRetired && !hasBeenDeployed && (
            <button
              onClick={handleDeploy}
              disabled={deploying || saving}
              className="flex items-center gap-1.5 rounded-md border border-primary bg-primary text-primary-foreground px-2.5 py-1 text-[10px] hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Rocket className="h-3 w-3" />
              <span>{deploying ? "Deploying..." : "Deploy"}</span>
            </button>
          )}

          {!isRetired && needsApply && (
            <button
              onClick={handleDeploy}
              disabled={deploying || saving}
              className="flex items-center gap-1.5 rounded-md border border-amber-600 bg-amber-600 text-white px-2.5 py-1 text-[10px] hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              <Rocket className="h-3 w-3" />
              <span>{deploying ? "Applying..." : "Apply"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Flow editor */}
      <div className="flex-1 min-h-0">
        <ApiFlowEditor api={apiDef} onChange={setApiDef} readOnly={isRetired} version={record.version} />
      </div>

      {/* Routing configuration dialog */}
      <Dialog open={showRoutingConfig} onOpenChange={setShowRoutingConfig}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Routing Configuration</DialogTitle>
            <DialogDescription>
              Configure how requests are routed to this API.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Context Path */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Route className="h-4 w-4" />
                Context Path
              </Label>
              <Input
                value={apiDef.context_path || ""}
                onChange={(e) => setApiDef({ ...apiDef, context_path: e.target.value })}
                placeholder="/payments"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Base path for this API. Flow URIs will be relative to this path.
              </p>
            </div>

            {/* Virtual Hosts */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Virtual Hosts
              </Label>
              <div className="flex flex-wrap gap-1.5 items-center">
                {(apiDef.hosts || []).map((h, i) => (
                  <Badge key={i} variant="secondary" className="text-xs font-mono gap-1 pl-2 pr-1">
                    {h}
                    <button
                      className="ml-0.5 hover:text-destructive transition-colors"
                      onClick={() => {
                        const hosts = (apiDef.hosts || []).filter((_, idx) => idx !== i)
                        setApiDef({ ...apiDef, hosts: hosts.length > 0 ? hosts : undefined })
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Input
                  placeholder="api.example.com"
                  className="h-8 w-48 font-mono text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      const val = (e.target as HTMLInputElement).value.trim()
                      if (val && !(apiDef.hosts || []).includes(val)) {
                        setApiDef({ ...apiDef, hosts: [...(apiDef.hosts || []), val] })
                        ;(e.target as HTMLInputElement).value = ""
                      }
                    }
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Restrict to specific domains (Host header). Supports wildcards: *.example.com
              </p>
            </div>

            {/* Version Routing */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Route className="h-4 w-4" />
                Version Routing
              </Label>
              <Select
                value={apiDef.routing_mode || "none"}
                onValueChange={(v) => setApiDef({ ...apiDef, routing_mode: v as RoutingMode })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Versioning (/payments/...)</SelectItem>
                  <SelectItem value="path">Version in Path (/v1/payments/...)</SelectItem>
                  <SelectItem value="header">Version by Header (X-API-Version)</SelectItem>
                  <SelectItem value="both">Path + Header (both strategies)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Default Version */}
            {(apiDef.routing_mode === "header" || apiDef.routing_mode === "both") && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Default Version</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Serve this version when no X-API-Version header is sent
                  </p>
                </div>
                <Switch
                  checked={apiDef.is_default_version ?? false}
                  onCheckedChange={(checked) => setApiDef({ ...apiDef, is_default_version: checked })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoutingConfig(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deprecate dialog */}
      <Dialog open={showDeprecateDialog} onOpenChange={setShowDeprecateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deprecate API</DialogTitle>
            <DialogDescription>
              Mark this API version as deprecated. Existing consumers will receive
              deprecation headers in responses. No new consumers should connect.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Sunset Date (optional)</Label>
              <Input
                type="datetime-local"
                value={sunsetDate}
                onChange={(e) => setSunsetDate(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                When this API version will be retired. A Sunset header will be sent to consumers.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeprecateDialog(false)}>Cancel</Button>
            <Button onClick={handleDeprecate}>Deprecate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retire confirmation */}
      <AlertDialog open={showRetireDialog} onOpenChange={setShowRetireDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire API</AlertDialogTitle>
            <AlertDialogDescription>
              This will configure the API Gateway to return 410 Gone for all requests
              to this API version. This action affects live traffic.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRetire}>Retire</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Portal settings dialog */}
      <Dialog open={showPortalDialog} onOpenChange={setShowPortalDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Developer Portal Settings</DialogTitle>
            <DialogDescription>
              Control how this API appears in the Developer Portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Visibility toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Visible on Developer Portal</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Make this API discoverable by developers
                </p>
              </div>
              <Switch checked={portalVisible} onCheckedChange={setPortalVisible} />
            </div>

            {/* Categories */}
            <div className="space-y-2">
              <Label>Categories</Label>
              <div className="flex flex-wrap gap-1.5 items-center">
                {portalCategories.map((cat, i) => (
                  <Badge key={i} variant="secondary" className="text-xs gap-1 pl-2 pr-1">
                    {cat}
                    <button
                      className="ml-0.5 hover:text-destructive transition-colors"
                      onClick={() => setPortalCategories(portalCategories.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Input
                  placeholder="Add category..."
                  className="h-8 w-40 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      const val = (e.target as HTMLInputElement).value.trim()
                      if (val && !portalCategories.includes(val)) {
                        setPortalCategories([...portalCategories, val])
                        ;(e.target as HTMLInputElement).value = ""
                      }
                    }
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Press Enter to add. Categories help developers filter APIs.
              </p>
            </div>

            {/* OpenAPI Spec */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>OpenAPI Specification</Label>
                <label className="cursor-pointer text-xs text-primary hover:underline">
                  Upload file
                  <input type="file" accept=".json,.yaml,.yml" className="hidden" onChange={handleSpecFileUpload} />
                </label>
              </div>
              <textarea
                value={openapiSpec}
                onChange={(e) => setOpenapiSpec(e.target.value)}
                rows={8}
                className="w-full rounded-md border bg-muted p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder='Paste OpenAPI 3.0 JSON spec here, or upload a file...'
              />
              <p className="text-xs text-muted-foreground">
                This powers the interactive documentation page in the Developer Portal.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPortalDialog(false)}>Cancel</Button>
            <Button onClick={handleSavePortal} disabled={savingPortal}>
              {savingPortal ? "Saving..." : "Save Portal Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
