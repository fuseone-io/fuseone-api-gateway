"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { Save, Rocket, FileText, Upload, PenLine, ArrowRight, Globe, Route, X, RotateCcw, ScrollText, Network, Bot } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { PageHeader } from "@/components/page-header"
import { ApiFlowEditor } from "@/components/flow/api-flow-editor"
import {
  parseFileContent,
  detectFormat,
  openAPIToApi,
  parseFuseOneJson,
} from "@/lib/openapi-converter"
import type { ApiDefinition, RoutingMode } from "@/types/api"
import type { GeneratedAPIConfig } from "@/types/llm"
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
  const t = useTranslations("apis")
  const tc = useTranslations("common")
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [apiDef, setApiDef] = useState<ApiDefinition>(DEFAULT_API)
  const [showConfirm, setShowConfirm] = useState(false)
  const [mode, setMode] = useState<CreateMode>("choose")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importType, setImportType] = useState<"openapi" | "fuseone" | null>(null)
  const [showRoutingConfig, setShowRoutingConfig] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [designFirst, setDesignFirst] = useState(false)
  const initialized = useRef(false)
  const [aiAvailable, setAiAvailable] = useState(false)
  const [showAIDialog, setShowAIDialog] = useState(false)
  const [aiDescription, setAiDescription] = useState("")
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiResult, setAiResult] = useState<GeneratedAPIConfig | null>(null)

  // Restore draft on mount + handle query params
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Check for query params
    const params = new URLSearchParams(window.location.search)
    const modeParam = params.get("mode")
    if (modeParam === "design") {
      setDesignFirst(true)
      setMode("configure")
      return
    }
    if (modeParam === "import") {
      fileInputRef.current?.click()
      return
    }
    // Auto-resume only from mindmap (mode=from-mindmap query param)
    if (modeParam === "from-mindmap") {
      const draft = loadDraft()
      if (draft && draft.mode === "editor") {
        setApiDef(draft.apiDef)
        setMode("editor")
        return
      }
    }

    // For normal visits, show draft banner but never auto-resume
    const draft = loadDraft()
    if (draft && draft.mode !== "choose") {
      setHasDraft(true)
    }
  }, [])

  // Check AI availability
  useEffect(() => {
    api.checkAIStatus().then((s) => setAiAvailable(s.available)).catch(() => {})
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
      toast.error(t("new.apiNameRequired"))
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
        toast.success(t("new.apiCreatedDeployed"))
      } else {
        toast.success(t("new.apiCreatedDraft"))
      }

      clearDraft()
      router.push(`/apis/${record.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("new.failedToCreate"))
    } finally {
      setSaving(false)
    }
  }

  const handleStartFromScratch = () => {
    setApiDef(DEFAULT_API)
    setDesignFirst(false)
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
        toast.success(t("new.importedOpenApi", { name: imported.name }))
      } else if (importType === "fuseone" || format === "fuseone") {
        imported = parseFuseOneJson(parsed)
        toast.success(t("new.importedFuseOne", { name: imported.name }))
      } else {
        // Auto-detect
        if (format === "unknown") {
          toast.error(t("new.unrecognizedFormat"))
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
      toast.error(err instanceof Error ? err.message : t("new.failedToParse"))
    } finally {
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleConfigureDone = () => {
    // Validate context path
    const cp = apiDef.context_path?.trim() || ""
    if (cp && !cp.startsWith("/")) {
      toast.error(t("new.contextPathSlash"))
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

  const handleGenerateAI = async () => {
    if (!aiDescription.trim()) return
    setAiGenerating(true)
    setAiResult(null)
    try {
      const result = await api.generateAPI(aiDescription.trim())
      setAiResult(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("new.ai.generateFailed"))
    } finally {
      setAiGenerating(false)
    }
  }

  const handleUseAIConfig = () => {
    if (!aiResult) return
    const name = aiResult.name || aiDescription.trim().split(" ").slice(0, 4).join(" ")
    const contextPath = (aiResult.route as { uri?: string })?.uri?.replace(/\*$/, "") ?? ""
    const upstreamNodes = (aiResult.upstream as { nodes?: Record<string, number> })?.nodes
    const firstNode = upstreamNodes ? Object.keys(upstreamNodes)[0] : "127.0.0.1:80"
    const [host, portStr] = (firstNode || "127.0.0.1:80").split(":")

    setApiDef({
      ...DEFAULT_API,
      name,
      context_path: contextPath.startsWith("/") ? contextPath : `/${contextPath}`,
      endpoint: {
        nodes: [{ host: host || "127.0.0.1", port: parseInt(portStr || "80") || 80, weight: 1 }],
        type: "roundrobin",
        scheme: "http",
      },
    })
    setAiDescription("")
    setAiResult(null)
    setShowAIDialog(false)
    setMode("configure")
  }

  // --- Mode chooser ---
  if (mode === "choose") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <div className="text-center">
          <PageHeader
            title={t("new.createNewApi")}
            description={t("new.createDescription")}
          />
        </div>

        {/* Resume draft banner */}
        {hasDraft && (
          <div className="w-full max-w-2xl rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-center gap-4">
            <RotateCcw className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t("new.unsavedDraft")}</p>
              <p className="text-xs text-muted-foreground">{t("new.resumeDraft")}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleDiscardDraft}>
                {t("new.discard")}
              </Button>
              <Button size="sm" onClick={handleResumeDraft}>
                {t("new.resume")}
              </Button>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-2 sm:grid-cols-3 ${aiAvailable ? "xl:grid-cols-6" : "xl:grid-cols-5"} gap-3 max-w-6xl w-full`}>
          <button
            onClick={handleStartFromScratch}
            className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed hover:border-primary/50 hover:bg-accent/50 transition-all text-center group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
              <PenLine className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">{t("new.fromScratch")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("new.fromScratchDescription")}
              </p>
            </div>
          </button>

          <button
            onClick={() => {
              setApiDef(DEFAULT_API)
              setMode("configure")
              setDesignFirst(true)
            }}
            className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-all text-center group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 transition-colors">
              <ScrollText className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">{t("new.designFirst")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("new.designFirstDescription")}
              </p>
            </div>
          </button>

          <button
            onClick={() => handleImportClick("openapi")}
            className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed hover:border-primary/50 hover:bg-accent/50 transition-all text-center group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 group-hover:bg-orange-500/20 transition-colors">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">{t("new.importOpenApi")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("new.importOpenApiDescription")}
              </p>
            </div>
          </button>

          <button
            onClick={() => handleImportClick("fuseone")}
            className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed hover:border-primary/50 hover:bg-accent/50 transition-all text-center group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20 transition-colors">
              <Upload className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">{t("new.importFuseOne")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("new.importFuseOneDescription")}
              </p>
            </div>
          </button>

          <button
            onClick={() => router.push("/design/mindmap")}
            className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed hover:border-purple-500/50 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 transition-all text-center group"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 group-hover:bg-purple-500/20 transition-colors">
              <Network className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">{t("new.apiMindmap")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("new.apiMindmapDescription")}
              </p>
            </div>
          </button>

          {aiAvailable && (
            <button
              onClick={() => setShowAIDialog(true)}
              className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed hover:border-[#950fb8]/50 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 transition-all text-center group"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#950fb8]/10 group-hover:bg-[#950fb8]/20 transition-colors">
                <Bot className="h-6 w-6 text-[#950fb8]" />
              </div>
              <div>
                <p className="font-semibold">{t("new.ai.button")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("new.ai.buttonDescription")}
                </p>
              </div>
            </button>
          )}
        </div>

        <Button variant="outline" onClick={() => router.push("/apis")}>
          {tc("cancel")}
        </Button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.yaml,.yml"
          className="hidden"
          onChange={handleFileSelected}
        />

        {/* AI Generate Dialog */}
        <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-[#950fb8]" />
                {t("new.ai.dialogTitle")}
              </DialogTitle>
              <DialogDescription>{t("new.ai.dialogDescription")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="ai-desc">{t("new.ai.descriptionLabel")}</Label>
                <Textarea
                  id="ai-desc"
                  placeholder={t("new.ai.descriptionPlaceholder")}
                  rows={4}
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  disabled={aiGenerating}
                />
              </div>
              {aiResult && (
                <div className="space-y-2">
                  <Label>{t("new.ai.generatedConfig")}</Label>
                  <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs font-mono">
                    {JSON.stringify(aiResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAIDialog(false); setAiResult(null); setAiDescription("") }}>
                {tc("cancel")}
              </Button>
              {aiResult ? (
                <Button onClick={handleUseAIConfig} style={{ backgroundColor: "#950fb8" }}>
                  {t("new.ai.useConfig")}
                </Button>
              ) : (
                <Button onClick={handleGenerateAI} disabled={!aiDescription.trim() || aiGenerating} style={{ backgroundColor: "#950fb8" }}>
                  {aiGenerating ? t("new.ai.generating") : t("new.ai.generate")}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // --- Configure step ---
  if (mode === "configure") {
    const previews = getResolvedPreview()

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <div className="text-center">
          <PageHeader
            title={t("new.configureRouting")}
            description={t("new.configureRoutingDescription")}
          />
        </div>

        <div className="w-full max-w-lg space-y-6">
          {/* Name & Description */}
          <div className="space-y-2">
            <Label>{t("new.apiName")}</Label>
            <Input
              value={apiDef.name}
              onChange={(e) => setApiDef({ ...apiDef, name: e.target.value })}
              placeholder="My API"
            />
          </div>
          <div className="space-y-2">
            <Label>{tc("description")}</Label>
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
              {t("new.contextPath")}
            </Label>
            <Input
              value={apiDef.context_path || ""}
              onChange={(e) => setApiDef({ ...apiDef, context_path: e.target.value })}
              placeholder="/payments"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              {t("new.contextPathDescription")}
            </p>
          </div>

          {/* Virtual Hosts */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t("new.virtualHosts")}
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
              {t("new.virtualHostsDescription")}
            </p>
          </div>

          {/* Routing Mode */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Route className="h-4 w-4" />
              {t("new.versionRouting")}
            </Label>
            <Select
              value={apiDef.routing_mode || "path"}
              onValueChange={(v) => setApiDef({ ...apiDef, routing_mode: v as RoutingMode })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="path">{t("new.versionInPath")}</SelectItem>
                <SelectItem value="header">{t("new.versionByHeader")}</SelectItem>
                <SelectItem value="both">{t("new.versionBoth")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("new.versionRoutingDescription")}
            </p>
          </div>

          {/* Default Version (only for header/both) */}
          {(apiDef.routing_mode === "header" || apiDef.routing_mode === "both") && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>{t("new.defaultVersion")}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("new.defaultVersionDescription")}
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
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("new.routePreview")}</p>
              {previews.map((p, i) => (
                <p key={i} className="text-sm font-mono text-foreground">{p}</p>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button onClick={handleConfigureDone}>
            {t("new.continueToEditor")}
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
            {apiDef.name || <span className="text-muted-foreground">{t("untitledApi")}</span>}
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
                <span className="text-muted-foreground">{t("new.properties")}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{tc("name")}</Label>
                <Input
                  value={apiDef.name}
                  onChange={(e) => setApiDef({ ...apiDef, name: e.target.value })}
                  placeholder="API name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{tc("description")}</Label>
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
                {apiDef.hosts.length === 1 ? apiDef.hosts[0] : `${apiDef.hosts.length} ${tc("more")}`}
              </span>
            )}
            {!apiDef.context_path && (!apiDef.hosts || apiDef.hosts.length === 0) && (
              <span className="text-muted-foreground">{t("new.routing")}</span>
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
          {designFirst && (
            <Badge variant="outline" className="text-[10px] border-blue-400/50 text-blue-600 bg-blue-500/5">
              <ScrollText className="h-3 w-3 mr-1" />
              {t("new.designFirst")}
            </Badge>
          )}
          <Button onClick={() => setShowConfirm(true)} disabled={saving || !canSave}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? t("new.creating") : t("new.createApi")}
          </Button>
        </div>
      </div>

      {/* Flow editor fills remaining space */}
      <div className="flex-1 min-h-0">
        <ApiFlowEditor api={apiDef} onChange={setApiDef} openContractOnMount={designFirst} />
      </div>

      {/* Routing configuration dialog */}
      <Dialog open={showRoutingConfig} onOpenChange={setShowRoutingConfig}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("new.routingConfig")}</DialogTitle>
            <DialogDescription>
              {t("new.routingConfigDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Context Path */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Route className="h-4 w-4" />
                {t("new.contextPath")}
              </Label>
              <Input
                value={apiDef.context_path || ""}
                onChange={(e) => setApiDef({ ...apiDef, context_path: e.target.value })}
                placeholder="/payments"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {t("new.contextPathDescription")}
              </p>
            </div>

            {/* Virtual Hosts */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {t("new.virtualHosts")}
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
                {t("new.virtualHostsDescription")}
              </p>
            </div>

            {/* Version Routing */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Route className="h-4 w-4" />
                {t("new.versionRouting")}
              </Label>
              <Select
                value={apiDef.routing_mode || "path"}
                onValueChange={(v) => setApiDef({ ...apiDef, routing_mode: v as RoutingMode })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="path">{t("new.versionInPath")}</SelectItem>
                  <SelectItem value="header">{t("new.versionByHeader")}</SelectItem>
                  <SelectItem value="both">{t("new.versionBoth")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Default Version */}
            {(apiDef.routing_mode === "header" || apiDef.routing_mode === "both") && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>{t("new.defaultVersion")}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("new.defaultVersionDescription")}
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
              {t("new.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create confirmation dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("new.createApiDialog")}</DialogTitle>
            <DialogDescription>
              {t("new.createApiDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <button
              onClick={() => handleCreate(false)}
              className="flex items-start gap-3 p-3 rounded-lg border hover:border-primary/50 hover:bg-accent transition-colors text-left"
            >
              <Save className="h-5 w-5 mt-0.5 text-amber-500 shrink-0" />
              <div>
                <p className="font-medium text-sm">{t("new.createAsDraft")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("new.createAsDraftDescription")}
                </p>
              </div>
            </button>
            <button
              onClick={() => handleCreate(true)}
              className="flex items-start gap-3 p-3 rounded-lg border hover:border-primary/50 hover:bg-accent transition-colors text-left"
            >
              <Rocket className="h-5 w-5 mt-0.5 text-green-500 shrink-0" />
              <div>
                <p className="font-medium text-sm">{t("new.createAndDeploy")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("new.createAndDeployDescription")}
                </p>
              </div>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              {tc("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
