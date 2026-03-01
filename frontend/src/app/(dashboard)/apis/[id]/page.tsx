"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Save, Rocket, Clock, Download, Copy, AlertTriangle, Ban, Globe, Route, X, PenLine } from "lucide-react"
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
import type { ApiDefinition, ApiDefRecord, LifecycleStatus, RoutingMode } from "@/types/api"
import { api } from "@/lib/api-client"

const SYNC_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className: string }> = {
  draft: { label: "Draft", variant: "secondary", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  synced: { label: "Synced", variant: "secondary", className: "bg-green-500/15 text-green-600 border-green-500/30" },
  out_of_sync: { label: "Out of Sync", variant: "secondary", className: "bg-orange-500/15 text-orange-600 border-orange-500/30" },
}

const LIFECYCLE_BADGE: Record<LifecycleStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-500/15 text-slate-600 border-slate-500/30" },
  active: { label: "Active", className: "bg-green-500/15 text-green-600 border-green-500/30" },
  deprecated: { label: "Deprecated", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  retired: { label: "Retired", className: "bg-red-500/15 text-red-600 border-red-500/30" },
}

export default function ApiDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

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

  useEffect(() => {
    loadApi()
  }, [id])

  const loadApi = async () => {
    try {
      const rec = await api.getApi(id)
      setRecord(rec)
      setApiDef(rec.definition)
      if (rec.name) sessionStorage.setItem(`breadcrumb:${id}`, rec.name)
      // Load versions
      try {
        const vers = await api.getApiVersions(id)
        setVersions(vers || [])
      } catch {
        // versions endpoint may not be available yet
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load API")
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
      toast.success("Draft saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save draft")
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
        toast.error(err instanceof Error ? err.message : "Failed to save before deploy")
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
      toast.success("API deployed to gateway")
      // Reload versions (lifecycle may have changed)
      try {
        const vers = await api.getApiVersions(record.id)
        setVersions(vers || [])
      } catch {}
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deploy API")
    } finally {
      setDeploying(false)
    }
  }

  const handleClone = async () => {
    if (!record) return
    try {
      const cloned = await api.cloneApi(record.id)
      toast.success(`Cloned to ${cloned.version}`)
      router.push(`/apis/${cloned.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clone API")
    }
  }

  const handleDeprecate = async () => {
    if (!record) return
    try {
      const result = await api.deprecateApi(record.id, sunsetDate ? { sunset_date: new Date(sunsetDate).toISOString() } : undefined)
      setRecord(result)
      setShowDeprecateDialog(false)
      setSunsetDate("")
      toast.success("API deprecated")
      try {
        const vers = await api.getApiVersions(record.id)
        setVersions(vers || [])
      } catch {}
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deprecate API")
    }
  }

  const handleRetire = async () => {
    if (!record) return
    try {
      const result = await api.retireApi(record.id)
      setRecord(result)
      setShowRetireDialog(false)
      toast.success("API retired — returning 410 Gone")
      try {
        const vers = await api.getApiVersions(record.id)
        setVersions(vers || [])
      } catch {}
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retire API")
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

  const syncBadge = SYNC_BADGE[record.sync_status] || SYNC_BADGE.draft
  const lifecycleBadge = LIFECYCLE_BADGE[record.lifecycle_status] || LIFECYCLE_BADGE.draft
  const canDeploy = record.sync_status === "draft" || record.sync_status === "out_of_sync"
  const isRetired = record.lifecycle_status === "retired"

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
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push("/apis")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

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

        <div className="flex items-center gap-2 shrink-0">
          {/* Version selector */}
          {versions.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-[10px] font-mono gap-1">
                  {record.version}
                  <span className="text-muted-foreground">({versions.length})</span>
                </Button>
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
            <Badge variant="outline" className="text-[10px] font-mono h-7">
              {record.version}
            </Badge>
          )}

          {/* Lifecycle badge (hidden when draft to avoid duplicate with sync badge) */}
          {record.lifecycle_status !== "draft" && (
            <Badge variant="outline" className={`text-[10px] ${lifecycleBadge.className}`}>
              {lifecycleBadge.label}
            </Badge>
          )}

          {/* Properties popover */}
          {!isRetired && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] hover:bg-accent transition-colors">
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

          {/* Sync status badge */}
          <Badge variant={syncBadge.variant} className={`text-[10px] ${syncBadge.className}`}>
            {syncBadge.label}
          </Badge>

          {/* Deployed timestamp */}
          {record.deployed_at && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(record.deployed_at).toLocaleString()}
            </span>
          )}

          {/* Status toggle */}
          {!isRetired && (
            <div className="flex items-center gap-1.5">
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

          {apiDef.flows.length > 1 && (
            <Badge variant="outline" className="text-[10px]">
              {apiDef.flows.length} flows
            </Badge>
          )}

          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportAsFuseOneJson(apiDef)}>
                Export FuseOne JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAsOpenAPIYaml(apiDef)}>
                Export OpenAPI YAML
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clone */}
          <Button variant="outline" size="sm" onClick={handleClone} className="h-8">
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Clone
          </Button>

          {/* Lifecycle actions */}
          {record.lifecycle_status === "active" && (
            <Button variant="outline" size="sm" onClick={() => setShowDeprecateDialog(true)} className="h-8">
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
              Deprecate
            </Button>
          )}
          {record.lifecycle_status === "deprecated" && (
            <>
              <Button variant="outline" size="sm" onClick={handleUndeprecate} className="h-8">
                Reactivate
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowRetireDialog(true)} className="h-8">
                <Ban className="mr-1.5 h-3.5 w-3.5" />
                Retire
              </Button>
            </>
          )}

          {/* Save/Deploy */}
          {!isRetired && (
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Draft"}
            </Button>
          )}

          {canDeploy && !isRetired && (
            <Button onClick={handleDeploy} disabled={deploying}>
              <Rocket className="mr-2 h-4 w-4" />
              {deploying ? "Deploying..." : "Deploy"}
            </Button>
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
                value={apiDef.routing_mode || "path"}
                onValueChange={(v) => setApiDef({ ...apiDef, routing_mode: v as RoutingMode })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
    </div>
  )
}
