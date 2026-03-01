"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Save, Rocket, FileText, Upload, PenLine, ArrowRight, ArrowLeft, Globe, Route, X, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { ApiFlowEditor } from "@/components/flow/api-flow-editor"
import {
  parseFileContent,
  detectFormat,
  openAPIToApi,
  parseFuseOneJson,
} from "@/lib/openapi-converter"
import type { ApiDefinition, RoutingMode } from "@/types/api"
import { api } from "@/lib/api-client"

const DEFAULT_API: ApiDefinition = {
  name: "",
  description: "",
  status: "enabled",
  context_path: "",
  routing_mode: "path",
  is_default_version: true,
  endpoint: {
    nodes: [{ host: "127.0.0.1", port: 80, weight: 1 }],
    type: "roundrobin",
    scheme: "http",
  },
  flows: [
    {
      id: crypto.randomUUID(),
      name: "Default Flow",
      entrypoint: { uri: "", hosts: [], methods: [] },
      policies: [],
    },
  ],
}

type CreateMode = "choose" | "configure" | "editor"

const DRAFT_KEY = "fuseone:new-api:draft"

function saveDraft(mode: CreateMode, apiDef: ApiDefinition) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ mode, apiDef, ts: Date.now() }))
  } catch { /* quota exceeded — ignore */ }
}

function loadDraft(): { mode: CreateMode; apiDef: ApiDefinition } | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.apiDef && parsed?.mode) return parsed
  } catch { /* corrupted — ignore */ }
  return null
}

function clearDraft() {
  sessionStorage.removeItem(DRAFT_KEY)
}

export default function NewApiPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [apiDef, setApiDef] = useState<ApiDefinition>(DEFAULT_API)
  const [showConfirm, setShowConfirm] = useState(false)
  const [mode, setMode] = useState<CreateMode>("choose")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importType, setImportType] = useState<"openapi" | "fuseone" | null>(null)
  const [showRoutingConfig, setShowRoutingConfig] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const initialized = useRef(false)

  // Restore draft on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const draft = loadDraft()
    if (draft && draft.mode !== "choose") {
      setHasDraft(true)
    }
  }, [])

  // Persist draft on every change (skip "choose" mode with default state)
  useEffect(() => {
    if (mode !== "choose") {
      saveDraft(mode, apiDef)
    }
  }, [mode, apiDef])

  const handleResumeDraft = () => {
    const draft = loadDraft()
    if (draft) {
      setApiDef(draft.apiDef)
      setMode(draft.mode)
      setHasDraft(false)
    }
  }

  const handleDiscardDraft = () => {
    clearDraft()
    setHasDraft(false)
  }

  const canSave = !!apiDef.name.trim()

  const handleCreate = (deploy: boolean) => {
    if (!canSave) {
      toast.error("API name is required")
      return
    }
    setShowConfirm(false)
    doCreate(deploy)
  }

  const doCreate = async (deploy: boolean) => {
    setSaving(true)
    try {
      const record = await api.createApi({
        name: apiDef.name,
        description: apiDef.description,
        definition: apiDef,
      })

      if (deploy) {
        await api.deployApi(record.id)
        toast.success("API created and deployed")
      } else {
        toast.success("API created as draft")
      }

      clearDraft()
      router.push(`/apis/${record.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create API")
    } finally {
      setSaving(false)
    }
  }

  const handleStartFromScratch = () => {
    setApiDef(DEFAULT_API)
    setMode("configure")
  }

  const handleImportClick = (type: "openapi" | "fuseone") => {
    setImportType(type)
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const content = await file.text()
      const parsed = parseFileContent(content, file.name)
      const format = detectFormat(parsed)

      let imported: ApiDefinition

      if (importType === "openapi" || format === "openapi") {
        imported = openAPIToApi(parsed)
        toast.success(`Imported OpenAPI spec: ${imported.name}`)
      } else if (importType === "fuseone" || format === "fuseone") {
        imported = parseFuseOneJson(parsed)
        toast.success(`Imported FuseOne definition: ${imported.name}`)
      } else {
        // Auto-detect
        if (format === "unknown") {
          toast.error("Unrecognized file format. Expected OpenAPI spec or FuseOne JSON.")
          return
        }
        imported = format === "openapi" ? openAPIToApi(parsed) : parseFuseOneJson(parsed)
      }

      // Clear IDs so it creates as a new API
      delete imported.id
      delete imported.serviceId
      for (const flow of imported.flows) {
        flow.id = crypto.randomUUID()
        delete flow.routeId
        delete flow.routeIds
      }

      // Set defaults for routing if not present
      if (!imported.routing_mode) imported.routing_mode = "path"
      if (imported.is_default_version === undefined) imported.is_default_version = true

      setApiDef(imported)
      setMode("configure")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse file")
    } finally {
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleConfigureDone = () => {
    // Validate context path
    const cp = apiDef.context_path?.trim() || ""
    if (cp && !cp.startsWith("/")) {
      toast.error("Context path must start with /")
      return
    }
    if (cp.endsWith("/") && cp.length > 1) {
      // Auto-fix trailing slash
      setApiDef({ ...apiDef, context_path: cp.slice(0, -1) })
    }
    setMode("editor")
  }

  // Build a preview of what the resolved URI will look like
  const getResolvedPreview = () => {
    const cp = apiDef.context_path || ""
    const flowUri = apiDef.flows[0]?.entrypoint?.uri || "/*"
    const version = "v1"
    const rm = apiDef.routing_mode || "path"

    const parts: string[] = []
    if (rm === "path" || rm === "both") {
      parts.push(`/${version}${cp}${flowUri}`)
    }
    if (rm === "header" || rm === "both") {
      parts.push(`${cp || "/"}${flowUri} (X-API-Version: ${version})`)
    }
    return parts
  }

  // --- Mode chooser ---
  if (mode === "choose") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create New API</h1>
          <p className="text-muted-foreground mt-1">
            Start from scratch or import an existing definition
          </p>
        </div>

        {/* Resume draft banner */}
        {hasDraft && (
          <div className="w-full max-w-2xl rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-center gap-4">
            <RotateCcw className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">You have an unsaved draft</p>
              <p className="text-xs text-muted-foreground">Continue where you left off or start fresh.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleDiscardDraft}>
                Discard
              </Button>
              <Button size="sm" onClick={handleResumeDraft}>
                Resume
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
          <button
            onClick={handleStartFromScratch}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed hover:border-primary/50 hover:bg-accent/50 transition-all text-center group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
              <PenLine className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">From Scratch</p>
              <p className="text-xs text-muted-foreground mt-1">
                Start with a blank API definition
              </p>
            </div>
          </button>

          <button
            onClick={() => handleImportClick("openapi")}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed hover:border-primary/50 hover:bg-accent/50 transition-all text-center group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 group-hover:bg-orange-500/20 transition-colors">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">Import OpenAPI</p>
              <p className="text-xs text-muted-foreground mt-1">
                Import from OpenAPI / Swagger spec
              </p>
            </div>
          </button>

          <button
            onClick={() => handleImportClick("fuseone")}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed hover:border-primary/50 hover:bg-accent/50 transition-all text-center group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 transition-colors">
              <Upload className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">Import FuseOne</p>
              <p className="text-xs text-muted-foreground mt-1">
                Import a previously exported definition
              </p>
            </div>
          </button>
        </div>

        <Button variant="outline" onClick={() => router.push("/apis")}>
          Cancel
        </Button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.yaml,.yml"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>
    )
  }

  // --- Configure step ---
  if (mode === "configure") {
    const previews = getResolvedPreview()

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Configure API Routing</h1>
          <p className="text-muted-foreground mt-1">
            Set the base path and version routing strategy
          </p>
        </div>

        <div className="w-full max-w-lg space-y-6">
          {/* Name & Description */}
          <div className="space-y-2">
            <Label>API Name</Label>
            <Input
              value={apiDef.name}
              onChange={(e) => setApiDef({ ...apiDef, name: e.target.value })}
              placeholder="My API"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={apiDef.description}
              onChange={(e) => setApiDef({ ...apiDef, description: e.target.value })}
              placeholder="What does this API do?"
            />
          </div>

          {/* Context Path */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
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
              Restrict to specific domains (Host header). Empty = accept all. Supports wildcards: *.example.com
            </p>
          </div>

          {/* Routing Mode */}
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
            <p className="text-xs text-muted-foreground">
              How consumers will specify the API version when making requests.
            </p>
          </div>

          {/* Default Version (only for header/both) */}
          {(apiDef.routing_mode === "header" || apiDef.routing_mode === "both") && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Default Version</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Serve this version when no X-API-Version header is sent
                </p>
              </div>
              <Switch
                checked={apiDef.is_default_version ?? true}
                onCheckedChange={(checked) => setApiDef({ ...apiDef, is_default_version: checked })}
              />
            </div>
          )}

          {/* Preview */}
          {previews.length > 0 && (apiDef.context_path || "").trim() && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Route Preview</p>
              {previews.map((p, i) => (
                <p key={i} className="text-sm font-mono text-foreground">{p}</p>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setMode("choose")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleConfigureDone}>
            Continue to Editor
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // --- Editor mode ---
  return (
    <div className="flex flex-col -m-8 h-[calc(100vh-4rem)]">
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

        <div className="flex items-center gap-3 shrink-0">
          {/* Properties popover */}
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
          {/* Routing config button */}
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
          <Button variant="outline" onClick={() => setMode("configure")}>
            Back
          </Button>
          <Button onClick={() => setShowConfirm(true)} disabled={saving || !canSave}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Creating..." : "Create API"}
          </Button>
        </div>
      </div>

      {/* Flow editor fills remaining space */}
      <div className="flex-1 min-h-0">
        <ApiFlowEditor api={apiDef} onChange={setApiDef} />
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
                  checked={apiDef.is_default_version ?? true}
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

      {/* Create confirmation dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API</DialogTitle>
            <DialogDescription>
              Choose how to create your API definition.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <button
              onClick={() => handleCreate(false)}
              className="flex items-start gap-3 p-3 rounded-lg border hover:border-primary/50 hover:bg-accent transition-colors text-left"
            >
              <Save className="h-5 w-5 mt-0.5 text-amber-500 shrink-0" />
              <div>
                <p className="font-medium text-sm">Create as Draft</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Save the API definition without deploying to the gateway. You can deploy it later.
                </p>
              </div>
            </button>
            <button
              onClick={() => handleCreate(true)}
              className="flex items-start gap-3 p-3 rounded-lg border hover:border-primary/50 hover:bg-accent transition-colors text-left"
            >
              <Rocket className="h-5 w-5 mt-0.5 text-green-500 shrink-0" />
              <div>
                <p className="font-medium text-sm">Create & Deploy</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Save the API definition and immediately deploy it to the API Gateway.
                </p>
              </div>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
