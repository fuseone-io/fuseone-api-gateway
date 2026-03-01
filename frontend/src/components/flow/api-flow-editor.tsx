"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import {
  Plus,
  Trash2,
  X,
  GitBranch,
  Settings2,
  ChevronDown,
  Copy,
  FileText,
  Activity,
  Server,
  Clock,
  Hash,
  Wifi,
  Lock,
  Search,
  HeartPulse,
  FileJson,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { VerticalFlow } from "./vertical-flow"
import { PolicyGallery } from "./policy-gallery"
import { PluginConfigPanel } from "./plugin-config-panel"
import { PolicyTemplateSelector } from "./policy-template-selector"
import { getPluginDef } from "@/lib/constants"
import type { PluginPhase } from "@/lib/constants"
import type { ApiDefinition, ApiFlow, PolicyInstance } from "@/types/api"

interface ApiFlowEditorProps {
  api: ApiDefinition
  onChange: (api: ApiDefinition) => void
  readOnly?: boolean
  version?: string // e.g. "v1" — for resolved URI preview
}

type RightPanel =
  | { type: "gallery"; phaseFilter?: PluginPhase }
  | { type: "policy-config"; policyId: string }

// Persist panel open state across navigation within the same session
function getPanelState(apiId: string | undefined, key: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return sessionStorage.getItem(`fuseone:panel:${key}:${apiId || "new"}`) === "1"
  } catch { return false }
}

function setPanelState(apiId: string | undefined, key: string, open: boolean) {
  if (typeof window === "undefined") return
  try {
    const k = `fuseone:panel:${key}:${apiId || "new"}`
    if (open) sessionStorage.setItem(k, "1")
    else sessionStorage.removeItem(k)
  } catch { /* ignore */ }
}

export function ApiFlowEditor({ api: apiDef, onChange, readOnly = false, version = "v1" }: ApiFlowEditorProps) {
  const [selectedFlowId, setSelectedFlowId] = useState<string>(apiDef.flows[0]?.id || "")
  const [rightPanel, setRightPanel] = useState<RightPanel>({ type: "gallery" })
  const [addFlowDialogOpen, setAddFlowDialogOpen] = useState(false)
  const [showObservability, _setShowObs] = useState(() => getPanelState(apiDef.id, "obs"))
  const [showEndpoint, _setShowEp] = useState(() => getPanelState(apiDef.id, "ep"))

  const setShowObservability = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    _setShowObs((prev) => {
      const next = typeof v === "function" ? v(prev) : v
      setPanelState(apiDef.id, "obs", next)
      return next
    })
  }, [apiDef.id])

  const setShowEndpoint = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    _setShowEp((prev) => {
      const next = typeof v === "function" ? v(prev) : v
      setPanelState(apiDef.id, "ep", next)
      return next
    })
  }, [apiDef.id])

  const selectedFlow = apiDef.flows.find((f) => f.id === selectedFlowId) || apiDef.flows[0]

  // --- Flow CRUD ---
  const createFlow = useCallback((uri: string, name: string, description: string, copyPolicies: boolean) => {
    const sourceFlow = apiDef.flows[0]
    const newFlow: ApiFlow = {
      id: crypto.randomUUID(),
      name: name || `Flow ${apiDef.flows.length + 1}`,
      description: description || undefined,
      entrypoint: { uri, hosts: [], methods: [] },
      policies: copyPolicies && sourceFlow
        ? sourceFlow.policies.map((p) => ({ ...p, id: crypto.randomUUID() }))
        : [],
    }
    onChange({ ...apiDef, flows: [...apiDef.flows, newFlow] })
    setSelectedFlowId(newFlow.id)
  }, [apiDef, onChange])

  const openAddFlowDialog = useCallback(() => {
    setAddFlowDialogOpen(true)
  }, [])

  const removeFlow = useCallback(
    (flowId: string) => {
      if (apiDef.flows.length <= 1) {
        toast.error("An API must have at least one flow")
        return
      }
      const updated = { ...apiDef, flows: apiDef.flows.filter((f) => f.id !== flowId) }
      onChange(updated)
      if (selectedFlowId === flowId) {
        setSelectedFlowId(updated.flows[0]?.id || "")
      }
    },
    [apiDef, onChange, selectedFlowId]
  )

  const updateFlow = useCallback(
    (flowId: string, changes: Partial<ApiFlow>) => {
      onChange({
        ...apiDef,
        flows: apiDef.flows.map((f) => (f.id === flowId ? { ...f, ...changes } : f)),
      })
    },
    [apiDef, onChange]
  )

  // --- Policy management (scoped to selected flow) ---
  const addPolicy = useCallback(
    (pluginName: string) => {
      if (!selectedFlow) return

      const def = getPluginDef(pluginName)
      const label = def?.label || pluginName.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      const phase = def?.phase || "request"

      const newPolicy: PolicyInstance = {
        id: crypto.randomUUID(),
        name: pluginName,
        phase,
        enabled: true,
        config: {},
      }

      updateFlow(selectedFlow.id, {
        policies: [...selectedFlow.policies, newPolicy],
      })
      toast.success(`Added ${label}`)
    },
    [selectedFlow, updateFlow]
  )

  const removePolicy = useCallback(
    (policyId: string) => {
      if (!selectedFlow) return
      updateFlow(selectedFlow.id, {
        policies: selectedFlow.policies.filter((p) => p.id !== policyId),
      })
      if (
        typeof rightPanel === "object" &&
        rightPanel.type === "policy-config" &&
        rightPanel.policyId === policyId
      ) {
        setRightPanel({ type: "gallery" })
      }
    },
    [selectedFlow, updateFlow, rightPanel]
  )

  const togglePolicy = useCallback(
    (policyId: string) => {
      if (!selectedFlow) return
      updateFlow(selectedFlow.id, {
        policies: selectedFlow.policies.map((p) =>
          p.id === policyId ? { ...p, enabled: !p.enabled } : p
        ),
      })
    },
    [selectedFlow, updateFlow]
  )

  const configurePolicy = useCallback((policyId: string) => {
    setRightPanel({ type: "policy-config", policyId })
  }, [])

  const updatePolicyConfig = useCallback(
    (policyId: string, config: Record<string, unknown>) => {
      if (!selectedFlow) return
      updateFlow(selectedFlow.id, {
        policies: selectedFlow.policies.map((p) =>
          p.id === policyId ? { ...p, config } : p
        ),
      })
    },
    [selectedFlow, updateFlow]
  )

  // --- Policy Template management ---
  const [templatePluginCache, setTemplatePluginCache] = useState<Record<string, number>>({})

  const handleSelectTemplate = useCallback(
    (templateId: string, templateName: string, templatePlugins: Record<string, unknown>) => {
      if (!selectedFlow) return
      updateFlow(selectedFlow.id, {
        policyTemplateId: templateId,
        policyTemplateName: templateName,
      })
      setTemplatePluginCache((prev) => ({
        ...prev,
        [templateId]: Object.keys(templatePlugins).length,
      }))
    },
    [selectedFlow, updateFlow]
  )

  const handleClearTemplate = useCallback(() => {
    if (!selectedFlow) return
    updateFlow(selectedFlow.id, {
      policyTemplateId: undefined,
      policyTemplateName: undefined,
    })
  }, [selectedFlow, updateFlow])

  // Current policy being configured
  const configuredPolicy =
    typeof rightPanel === "object" && rightPanel.type === "policy-config" && selectedFlow
      ? selectedFlow.policies.find((p) => p.id === rightPanel.policyId)
      : null

  return (
    <div className="flex h-full min-h-0">
      {/* Left Panel - Flow List */}
      <div className="w-[260px] shrink-0 border-r bg-muted/30 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-5 max-w-[260px]">
            {/* Flow List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <GitBranch className="h-3 w-3" />
                  Flows
                </h3>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={openAddFlowDialog}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div className="space-y-1.5">
                {apiDef.flows.map((flow) => (
                  <FlowListItem
                    key={flow.id}
                    flow={flow}
                    isSelected={flow.id === selectedFlowId}
                    onSelect={() => {
                      setSelectedFlowId(flow.id)
                      setRightPanel({ type: "gallery" })
                    }}
                    onDelete={() => removeFlow(flow.id)}
                    onRename={(name) => updateFlow(flow.id, { name })}
                    readOnly={readOnly}
                    canDelete={apiDef.flows.length > 1}
                  />
                ))}
              </div>

              {!readOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={openAddFlowDialog}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add flow
                </Button>
              )}
            </div>

          </div>
        </ScrollArea>
      </div>

      {/* Center Panel - Route Header + Vertical Flow */}
      <div className="flex-1 min-w-0 flex flex-col bg-muted/10">
        {selectedFlow ? (
          <>
            <FlowRouteHeader
              flow={selectedFlow}
              onUpdateFlow={(changes) => updateFlow(selectedFlow.id, changes)}
              readOnly={readOnly}
              showObservability={showObservability}
              onToggleObservability={() => setShowObservability((v) => !v)}
              observabilityCount={selectedFlow.policies.filter((p) => p.phase === "observability").length}
              showEndpoint={showEndpoint}
              onToggleEndpoint={() => setShowEndpoint((v) => !v)}
              contextPath={apiDef.context_path}
              routingMode={apiDef.routing_mode}
              version={version}
              onSelectTemplate={handleSelectTemplate}
              onClearTemplate={handleClearTemplate}
            />
            <div className="relative flex-1 min-h-0">
              {/* Flow canvas — always full height */}
              <div className="absolute inset-0 overflow-auto">
                <div className="w-full">
                  <VerticalFlow
                    flow={selectedFlow}
                    endpoint={apiDef.endpoint}
                    onConfigurePolicy={configurePolicy}
                    onRemovePolicy={removePolicy}
                    onTogglePolicy={togglePolicy}
                    onClickEndpoint={() => setShowEndpoint((v) => !v)}
                    onAddPlugin={addPolicy}
                    existingPlugins={selectedFlow.policies.map((p) => p.name)}
                    readOnly={readOnly}
                    templateName={selectedFlow.policyTemplateId ? selectedFlow.policyTemplateName : undefined}
                    templatePluginCount={selectedFlow.policyTemplateId ? templatePluginCache[selectedFlow.policyTemplateId] : undefined}
                  />
                </div>
              </div>

              {/* Bottom sheets — overlay on top of canvas */}
              {showEndpoint && (
                <div className="absolute inset-x-0 bottom-0 z-10 h-[55%] shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
                  <EndpointSheet
                    apiDef={apiDef}
                    onChange={onChange}
                    readOnly={readOnly}
                    onClose={() => setShowEndpoint(false)}
                  />
                </div>
              )}
              {showObservability && (
                <div className="absolute inset-x-0 bottom-0 z-10 h-[55%] shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
                  <ObservabilitySheet
                    policies={selectedFlow.policies.filter((p) => p.phase === "observability")}
                    onConfigurePolicy={configurePolicy}
                    onRemovePolicy={removePolicy}
                    onTogglePolicy={togglePolicy}
                    onAddPolicy={() => setRightPanel({ type: "gallery", phaseFilter: "observability" })}
                    onClose={() => setShowObservability(false)}
                    readOnly={readOnly}
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No flow selected
          </div>
        )}
      </div>

      {/* Right Panel - Gallery / Policy Config */}
      <div className="w-[300px] shrink-0 border-l bg-card overflow-hidden">
        {rightPanel.type === "gallery" && (
          <PolicyGallery
            onAddPolicy={addPolicy}
            existingPolicies={selectedFlow?.policies.map((p) => p.name) || []}
            phaseFilter={rightPanel.phaseFilter}
          />
        )}

        {configuredPolicy && (
          <PluginConfigPanel
            policy={configuredPolicy}
            onUpdateConfig={(config) => updatePolicyConfig(configuredPolicy.id, config)}
            readOnly={readOnly}
            onClose={() => setRightPanel({ type: "gallery" })}
          />
        )}
      </div>

      {/* Add Flow Dialog */}
      <AddFlowDialog
        open={addFlowDialogOpen}
        onOpenChange={setAddFlowDialogOpen}
        hasExistingPolicies={(apiDef.flows[0]?.policies.length ?? 0) > 0}
        existingUris={apiDef.flows.map((f) => f.entrypoint.uri || "/")}
        onCreate={(uri, name, description, copyPolicies) => {
          createFlow(uri, name, description, copyPolicies)
          setAddFlowDialogOpen(false)
        }}
      />
    </div>
  )
}

// --- Flow list item ---

function FlowListItem({
  flow,
  isSelected,
  onSelect,
  onDelete,
  onRename,
  readOnly,
  canDelete,
}: {
  flow: ApiFlow
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (name: string) => void
  readOnly: boolean
  canDelete: boolean
}) {
  const [editing, setEditing] = useState(false)

  return (
    <div
      onClick={onSelect}
      className={`group relative w-full text-left rounded-lg border px-3 py-2 transition-all cursor-pointer overflow-hidden ${
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <div className="w-0 flex-1 overflow-hidden">
          {editing ? (
            <Input
              autoFocus
              value={flow.name}
              onChange={(e) => onRename(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
              className="h-5 text-xs px-1 py-0 border-0 bg-transparent focus-visible:ring-0"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p
              className="text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap"
              title={flow.name}
              onDoubleClick={(e) => {
                if (!readOnly) {
                  e.stopPropagation()
                  setEditing(true)
                }
              }}
            >
              {flow.name || "Untitled"}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground font-mono overflow-hidden text-ellipsis whitespace-nowrap" title={flow.entrypoint.uri || "/"}>
            {flow.entrypoint.uri || "/"}
          </p>
          {flow.description && (
            <p className="text-[10px] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap" title={flow.description}>
              {flow.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {flow.entrypoint.methods.length > 0 ? (
            <Badge variant="outline" className="text-[8px] px-1 py-0">
              {flow.entrypoint.methods.length}M
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[8px] px-1 py-0">
              ALL
            </Badge>
          )}
          {flow.policies.length > 0 && (
            <Badge variant="secondary" className="text-[8px] px-1 py-0">
              {flow.policies.length}P
            </Badge>
          )}
          {!readOnly && canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <Trash2 className="h-2.5 w-2.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Add Flow Dialog ---

function AddFlowDialog({
  open,
  onOpenChange,
  hasExistingPolicies,
  existingUris,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  hasExistingPolicies: boolean
  existingUris: string[]
  onCreate: (uri: string, name: string, description: string, copyPolicies: boolean) => void
}) {
  const [uri, setUri] = useState("/")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [copyPolicies, setCopyPolicies] = useState(false)

  const normalizedUri = uri.trim() || "/"
  const conflict = existingUris.some(
    (existing) => existing === normalizedUri
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (conflict) return
    onCreate(normalizedUri, name.trim(), description.trim(), copyPolicies)
    setUri("/")
    setName("")
    setDescription("")
    setCopyPolicies(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo Flow</DialogTitle>
            <DialogDescription>
              Defina a rota e as configuracoes iniciais do novo flow.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Nome</Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Listar usuarios, Criar pedido..."
                className="text-sm"
              />
            </div>

            {/* URI Input */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">URI Path</Label>
              <Input
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                placeholder="/api/v1/resource/*"
                className={`font-mono text-sm ${conflict ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
              />
              {conflict ? (
                <p className="text-[11px] text-destructive font-medium">
                  Ja existe um flow com a rota &quot;{normalizedUri}&quot;. Escolha uma URI diferente.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Use /* para wildcard matching. Ex: /api/v1/users/*
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                Descricao <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Comentario sobre esta rota..."
                className="text-sm"
              />
            </div>

            {/* Copy Policies Option */}
            {hasExistingPolicies && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Policies iniciais</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCopyPolicies(false)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors ${
                      !copyPolicies
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <FileText className="h-5 w-5" />
                    <span className="text-xs font-medium">Iniciar vazio</span>
                    <span className="text-[10px] text-muted-foreground">Sem policies</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCopyPolicies(true)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors ${
                      copyPolicies
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <Copy className="h-5 w-5" />
                    <span className="text-xs font-medium">Copiar do Flow 1</span>
                    <span className="text-[10px] text-muted-foreground">Duplicar policies</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={conflict}>Criar flow</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Observability Sheet (bottom panel) ---

function ObservabilitySheet({
  policies,
  onConfigurePolicy,
  onRemovePolicy,
  onTogglePolicy,
  onAddPolicy,
  onClose,
  readOnly,
}: {
  policies: PolicyInstance[]
  onConfigurePolicy: (policyId: string) => void
  onRemovePolicy: (policyId: string) => void
  onTogglePolicy: (policyId: string) => void
  onAddPolicy: () => void
  onClose: () => void
  readOnly: boolean
}) {
  return (
    <div className="border-t bg-card flex flex-col h-full">
      {/* Sheet header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-green-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
            Observability
          </span>
          {policies.length > 0 && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
              {policies.length}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Sheet content - scrollable */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-3">
          {policies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {policies.map((policy) => {
                const def = getPluginDef(policy.name)
                return (
                  <div
                    key={policy.id}
                    className={`group relative flex items-center gap-2 rounded-lg border px-3 py-2 transition-all ${
                      policy.enabled
                        ? "bg-card border-border hover:border-green-500/40"
                        : "bg-muted/50 border-dashed border-muted-foreground/30 opacity-60"
                    }`}
                  >
                    <Activity className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{def?.label || policy.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{def?.description}</p>
                    </div>
                    {!readOnly && (
                      <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onConfigurePolicy(policy.id)}>
                          <Settings2 className="h-2.5 w-2.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onTogglePolicy(policy.id)}>
                          {policy.enabled ? <X className="h-2.5 w-2.5" /> : <Activity className="h-2.5 w-2.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-destructive hover:text-destructive"
                          onClick={() => onRemovePolicy(policy.id)}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Nenhuma policy de observabilidade configurada.
            </p>
          )}

          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 h-7 text-xs"
              onClick={onAddPolicy}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add observability policy
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// --- Endpoint Section (collapsible) ---

function EndpointSection({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 w-full py-1.5 hover:text-foreground transition-colors group">
          <ChevronDown
            className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
          />
          {icon}
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground">
            {title}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-1 pb-2 pl-5 space-y-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// --- Endpoint Sheet (bottom panel) ---

function EndpointSheet({
  apiDef,
  onChange,
  readOnly,
  onClose,
}: {
  apiDef: ApiDefinition
  onChange: (api: ApiDefinition) => void
  readOnly: boolean
  onClose: () => void
}) {
  const ep = apiDef.endpoint

  const updateEndpoint = useCallback(
    (patch: Partial<ApiDefinition["endpoint"]>) => {
      onChange({ ...apiDef, endpoint: { ...apiDef.endpoint, ...patch } })
    },
    [apiDef, onChange]
  )

  const updateNode = useCallback(
    (index: number, patch: Partial<ApiDefinition["endpoint"]["nodes"][0]>) => {
      const nodes = [...ep.nodes]
      nodes[index] = { ...nodes[index], ...patch }
      updateEndpoint({ nodes })
    },
    [ep.nodes, updateEndpoint]
  )

  return (
    <div className="border-t bg-card flex flex-col h-full">
      {/* Sheet header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <Server className="h-3.5 w-3.5 text-green-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
            Shared Endpoint
          </span>
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
            {ep.nodes.length} {ep.nodes.length === 1 ? "node" : "nodes"}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Sheet content */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-3 space-y-3">
          {/* Basic fields — always visible */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-muted-foreground shrink-0">Scheme</Label>
              <Select
                value={ep.scheme}
                onValueChange={(v) => updateEndpoint({ scheme: v as "http" })}
                disabled={readOnly}
              >
                <SelectTrigger className="h-7 text-xs w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="http">HTTP</SelectItem>
                  <SelectItem value="https">HTTPS</SelectItem>
                  <SelectItem value="grpc">gRPC</SelectItem>
                  <SelectItem value="grpcs">gRPCS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-muted-foreground shrink-0">Balance</Label>
              <Select
                value={ep.type}
                onValueChange={(v) => updateEndpoint({ type: v as "roundrobin" })}
                disabled={readOnly}
              >
                <SelectTrigger className="h-7 text-xs w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="roundrobin">Round Robin</SelectItem>
                  <SelectItem value="chash">Consistent Hash</SelectItem>
                  <SelectItem value="ewma">EWMA</SelectItem>
                  <SelectItem value="least_conn">Least Conn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-muted-foreground shrink-0">Retries</Label>
              <Input
                type="number"
                placeholder="Auto"
                value={ep.retries ?? ""}
                onChange={(e) =>
                  updateEndpoint({ retries: e.target.value ? parseInt(e.target.value) : undefined })
                }
                disabled={readOnly}
                className="h-7 text-xs w-[70px]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-muted-foreground shrink-0">Host Header</Label>
              <Select
                value={ep.pass_host || "pass"}
                onValueChange={(v) =>
                  updateEndpoint({
                    pass_host: v as "pass" | "node" | "rewrite",
                    upstream_host: v === "rewrite" ? ep.upstream_host || "" : undefined,
                  })
                }
                disabled={readOnly}
              >
                <SelectTrigger className="h-7 text-xs w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pass">Pass</SelectItem>
                  <SelectItem value="node">Node</SelectItem>
                  <SelectItem value="rewrite">Rewrite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {ep.pass_host === "rewrite" && (
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-muted-foreground shrink-0">Upstream Host</Label>
                <Input
                  placeholder="example.com"
                  value={ep.upstream_host || ""}
                  onChange={(e) => updateEndpoint({ upstream_host: e.target.value || undefined })}
                  disabled={readOnly}
                  className="h-7 text-xs w-[160px]"
                />
              </div>
            )}
          </div>

          {/* Consistent Hashing — only when type=chash */}
          {ep.type === "chash" && (
            <EndpointSection title="Consistent Hashing" icon={<Hash className="h-3 w-3 text-muted-foreground" />} defaultOpen>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Label className="text-[10px] text-muted-foreground shrink-0">Hash On</Label>
                  <Select
                    value={ep.hash_on || "vars"}
                    onValueChange={(v) => updateEndpoint({ hash_on: v as "vars" })}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-7 text-xs w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vars">Nginx Var</SelectItem>
                      <SelectItem value="header">Header</SelectItem>
                      <SelectItem value="cookie">Cookie</SelectItem>
                      <SelectItem value="consumer">Consumer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {ep.hash_on !== "consumer" && (
                  <div className="flex items-center gap-1.5">
                    <Label className="text-[10px] text-muted-foreground shrink-0">Key</Label>
                    <Input
                      placeholder={
                        ep.hash_on === "header"
                          ? "X-Forwarded-For"
                          : ep.hash_on === "cookie"
                            ? "session_id"
                            : "remote_addr"
                      }
                      value={ep.key || ""}
                      onChange={(e) => updateEndpoint({ key: e.target.value || undefined })}
                      disabled={readOnly}
                      className="h-7 text-xs w-[160px]"
                    />
                  </div>
                )}
              </div>
            </EndpointSection>
          )}

          {/* Timeouts */}
          <EndpointSection title="Timeouts" icon={<Clock className="h-3 w-3 text-muted-foreground" />}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-muted-foreground shrink-0">Connect</Label>
                <Input
                  type="number"
                  placeholder="60"
                  value={ep.timeout?.connect ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? parseFloat(e.target.value) : undefined
                    if (v === undefined && !ep.timeout?.send && !ep.timeout?.read) {
                      updateEndpoint({ timeout: undefined })
                    } else {
                      updateEndpoint({
                        timeout: { connect: v ?? 60, send: ep.timeout?.send ?? 60, read: ep.timeout?.read ?? 60 },
                      })
                    }
                  }}
                  disabled={readOnly}
                  className="h-7 text-xs w-[70px]"
                />
                <span className="text-[10px] text-muted-foreground">s</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-muted-foreground shrink-0">Send</Label>
                <Input
                  type="number"
                  placeholder="60"
                  value={ep.timeout?.send ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? parseFloat(e.target.value) : undefined
                    if (v === undefined && !ep.timeout?.connect && !ep.timeout?.read) {
                      updateEndpoint({ timeout: undefined })
                    } else {
                      updateEndpoint({
                        timeout: { connect: ep.timeout?.connect ?? 60, send: v ?? 60, read: ep.timeout?.read ?? 60 },
                      })
                    }
                  }}
                  disabled={readOnly}
                  className="h-7 text-xs w-[70px]"
                />
                <span className="text-[10px] text-muted-foreground">s</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-muted-foreground shrink-0">Read</Label>
                <Input
                  type="number"
                  placeholder="60"
                  value={ep.timeout?.read ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? parseFloat(e.target.value) : undefined
                    if (v === undefined && !ep.timeout?.connect && !ep.timeout?.send) {
                      updateEndpoint({ timeout: undefined })
                    } else {
                      updateEndpoint({
                        timeout: { connect: ep.timeout?.connect ?? 60, send: ep.timeout?.send ?? 60, read: v ?? 60 },
                      })
                    }
                  }}
                  disabled={readOnly}
                  className="h-7 text-xs w-[70px]"
                />
                <span className="text-[10px] text-muted-foreground">s</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-muted-foreground shrink-0">Retry Timeout</Label>
                <Input
                  type="number"
                  placeholder="—"
                  value={ep.retry_timeout ?? ""}
                  onChange={(e) =>
                    updateEndpoint({ retry_timeout: e.target.value ? parseFloat(e.target.value) : undefined })
                  }
                  disabled={readOnly}
                  className="h-7 text-xs w-[70px]"
                />
                <span className="text-[10px] text-muted-foreground">s</span>
              </div>
            </div>
          </EndpointSection>

          {/* Health Checks */}
          <EndpointSection title="Health Checks" icon={<HeartPulse className="h-3 w-3 text-muted-foreground" />}>
            {/* Active Health Check */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!ep.checks?.active}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      updateEndpoint({
                        checks: {
                          ...ep.checks,
                          active: {
                            type: "http",
                            http_path: "/health",
                            healthy: { interval: 5, successes: 2 },
                            unhealthy: { interval: 5, http_failures: 3 },
                          },
                        },
                      })
                    } else {
                      const newChecks = ep.checks?.passive
                        ? { passive: ep.checks.passive }
                        : undefined
                      updateEndpoint({ checks: newChecks })
                    }
                  }}
                  disabled={readOnly}
                />
                <Label className="text-[10px] text-muted-foreground font-semibold">Active Health Check</Label>
              </div>
              {ep.checks?.active && (
                <div className="pl-4 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-[10px] text-muted-foreground shrink-0">Type</Label>
                      <Select
                        value={ep.checks.active.type}
                        onValueChange={(v) =>
                          updateEndpoint({
                            checks: { ...ep.checks, active: { ...ep.checks!.active!, type: v as "http" } },
                          })
                        }
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-7 text-xs w-[90px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="http">HTTP</SelectItem>
                          <SelectItem value="https">HTTPS</SelectItem>
                          <SelectItem value="tcp">TCP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {ep.checks.active.type !== "tcp" && (
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-muted-foreground shrink-0">Path</Label>
                        <Input
                          value={ep.checks.active.http_path || ""}
                          onChange={(e) =>
                            updateEndpoint({
                              checks: {
                                ...ep.checks,
                                active: { ...ep.checks!.active!, http_path: e.target.value || undefined },
                              },
                            })
                          }
                          placeholder="/health"
                          disabled={readOnly}
                          className="h-7 text-xs w-[100px]"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Label className="text-[10px] text-muted-foreground shrink-0">Host</Label>
                      <Input
                        value={ep.checks.active.host || ""}
                        onChange={(e) =>
                          updateEndpoint({
                            checks: {
                              ...ep.checks,
                              active: { ...ep.checks!.active!, host: e.target.value || undefined },
                            },
                          })
                        }
                        placeholder="Auto"
                        disabled={readOnly}
                        className="h-7 text-xs w-[100px]"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-[10px] text-muted-foreground shrink-0">Port</Label>
                      <Input
                        type="number"
                        value={ep.checks.active.port ?? ""}
                        onChange={(e) =>
                          updateEndpoint({
                            checks: {
                              ...ep.checks,
                              active: { ...ep.checks!.active!, port: e.target.value ? parseInt(e.target.value) : undefined },
                            },
                          })
                        }
                        placeholder="Auto"
                        disabled={readOnly}
                        className="h-7 text-xs w-[70px]"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-[10px] text-muted-foreground shrink-0">Timeout</Label>
                      <Input
                        type="number"
                        value={ep.checks.active.timeout ?? ""}
                        onChange={(e) =>
                          updateEndpoint({
                            checks: {
                              ...ep.checks,
                              active: { ...ep.checks!.active!, timeout: e.target.value ? parseFloat(e.target.value) : undefined },
                            },
                          })
                        }
                        placeholder="1"
                        disabled={readOnly}
                        className="h-7 text-xs w-[60px]"
                      />
                      <span className="text-[10px] text-muted-foreground">s</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-[10px] text-muted-foreground shrink-0">Concurrency</Label>
                      <Input
                        type="number"
                        value={ep.checks.active.concurrency ?? ""}
                        onChange={(e) =>
                          updateEndpoint({
                            checks: {
                              ...ep.checks,
                              active: { ...ep.checks!.active!, concurrency: e.target.value ? parseInt(e.target.value) : undefined },
                            },
                          })
                        }
                        placeholder="10"
                        disabled={readOnly}
                        className="h-7 text-xs w-[60px]"
                      />
                    </div>
                  </div>
                  {/* Healthy thresholds */}
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium mb-1">Healthy</p>
                    <div className="flex items-center gap-3 flex-wrap pl-2">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-muted-foreground shrink-0">Interval</Label>
                        <Input
                          type="number"
                          value={ep.checks.active.healthy?.interval ?? ""}
                          onChange={(e) =>
                            updateEndpoint({
                              checks: {
                                ...ep.checks,
                                active: {
                                  ...ep.checks!.active!,
                                  healthy: { ...ep.checks!.active!.healthy, interval: e.target.value ? parseInt(e.target.value) : undefined },
                                },
                              },
                            })
                          }
                          placeholder="1"
                          disabled={readOnly}
                          className="h-7 text-xs w-[60px]"
                        />
                        <span className="text-[10px] text-muted-foreground">s</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-muted-foreground shrink-0">Successes</Label>
                        <Input
                          type="number"
                          value={ep.checks.active.healthy?.successes ?? ""}
                          onChange={(e) =>
                            updateEndpoint({
                              checks: {
                                ...ep.checks,
                                active: {
                                  ...ep.checks!.active!,
                                  healthy: { ...ep.checks!.active!.healthy, successes: e.target.value ? parseInt(e.target.value) : undefined },
                                },
                              },
                            })
                          }
                          placeholder="2"
                          disabled={readOnly}
                          className="h-7 text-xs w-[60px]"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Unhealthy thresholds */}
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium mb-1">Unhealthy</p>
                    <div className="flex items-center gap-3 flex-wrap pl-2">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-muted-foreground shrink-0">Interval</Label>
                        <Input
                          type="number"
                          value={ep.checks.active.unhealthy?.interval ?? ""}
                          onChange={(e) =>
                            updateEndpoint({
                              checks: {
                                ...ep.checks,
                                active: {
                                  ...ep.checks!.active!,
                                  unhealthy: { ...ep.checks!.active!.unhealthy, interval: e.target.value ? parseInt(e.target.value) : undefined },
                                },
                              },
                            })
                          }
                          placeholder="1"
                          disabled={readOnly}
                          className="h-7 text-xs w-[60px]"
                        />
                        <span className="text-[10px] text-muted-foreground">s</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-muted-foreground shrink-0">HTTP Failures</Label>
                        <Input
                          type="number"
                          value={ep.checks.active.unhealthy?.http_failures ?? ""}
                          onChange={(e) =>
                            updateEndpoint({
                              checks: {
                                ...ep.checks,
                                active: {
                                  ...ep.checks!.active!,
                                  unhealthy: { ...ep.checks!.active!.unhealthy, http_failures: e.target.value ? parseInt(e.target.value) : undefined },
                                },
                              },
                            })
                          }
                          placeholder="3"
                          disabled={readOnly}
                          className="h-7 text-xs w-[60px]"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-muted-foreground shrink-0">TCP Failures</Label>
                        <Input
                          type="number"
                          value={ep.checks.active.unhealthy?.tcp_failures ?? ""}
                          onChange={(e) =>
                            updateEndpoint({
                              checks: {
                                ...ep.checks,
                                active: {
                                  ...ep.checks!.active!,
                                  unhealthy: { ...ep.checks!.active!.unhealthy, tcp_failures: e.target.value ? parseInt(e.target.value) : undefined },
                                },
                              },
                            })
                          }
                          placeholder="2"
                          disabled={readOnly}
                          className="h-7 text-xs w-[60px]"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-muted-foreground shrink-0">Timeouts</Label>
                        <Input
                          type="number"
                          value={ep.checks.active.unhealthy?.timeouts ?? ""}
                          onChange={(e) =>
                            updateEndpoint({
                              checks: {
                                ...ep.checks,
                                active: {
                                  ...ep.checks!.active!,
                                  unhealthy: { ...ep.checks!.active!.unhealthy, timeouts: e.target.value ? parseInt(e.target.value) : undefined },
                                },
                              },
                            })
                          }
                          placeholder="3"
                          disabled={readOnly}
                          className="h-7 text-xs w-[60px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Passive Health Check */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!ep.checks?.passive}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      updateEndpoint({
                        checks: {
                          ...ep.checks,
                          passive: {
                            type: "http",
                            unhealthy: { http_failures: 3, tcp_failures: 3, timeouts: 3 },
                          },
                        },
                      })
                    } else {
                      const newChecks = ep.checks?.active
                        ? { active: ep.checks.active }
                        : undefined
                      updateEndpoint({ checks: newChecks })
                    }
                  }}
                  disabled={readOnly}
                />
                <Label className="text-[10px] text-muted-foreground font-semibold">Passive Health Check</Label>
              </div>
              {ep.checks?.passive && (
                <div className="pl-4 space-y-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium mb-1">Healthy</p>
                    <div className="flex items-center gap-3 flex-wrap pl-2">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-muted-foreground shrink-0">Successes</Label>
                        <Input
                          type="number"
                          value={ep.checks.passive.healthy?.successes ?? ""}
                          onChange={(e) =>
                            updateEndpoint({
                              checks: {
                                ...ep.checks,
                                passive: {
                                  ...ep.checks!.passive!,
                                  healthy: { ...ep.checks!.passive!.healthy, successes: e.target.value ? parseInt(e.target.value) : undefined },
                                },
                              },
                            })
                          }
                          placeholder="5"
                          disabled={readOnly}
                          className="h-7 text-xs w-[60px]"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium mb-1">Unhealthy</p>
                    <div className="flex items-center gap-3 flex-wrap pl-2">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-muted-foreground shrink-0">HTTP Failures</Label>
                        <Input
                          type="number"
                          value={ep.checks.passive.unhealthy?.http_failures ?? ""}
                          onChange={(e) =>
                            updateEndpoint({
                              checks: {
                                ...ep.checks,
                                passive: {
                                  ...ep.checks!.passive!,
                                  unhealthy: { ...ep.checks!.passive!.unhealthy, http_failures: e.target.value ? parseInt(e.target.value) : undefined },
                                },
                              },
                            })
                          }
                          placeholder="3"
                          disabled={readOnly}
                          className="h-7 text-xs w-[60px]"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-muted-foreground shrink-0">TCP Failures</Label>
                        <Input
                          type="number"
                          value={ep.checks.passive.unhealthy?.tcp_failures ?? ""}
                          onChange={(e) =>
                            updateEndpoint({
                              checks: {
                                ...ep.checks,
                                passive: {
                                  ...ep.checks!.passive!,
                                  unhealthy: { ...ep.checks!.passive!.unhealthy, tcp_failures: e.target.value ? parseInt(e.target.value) : undefined },
                                },
                              },
                            })
                          }
                          placeholder="3"
                          disabled={readOnly}
                          className="h-7 text-xs w-[60px]"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-muted-foreground shrink-0">Timeouts</Label>
                        <Input
                          type="number"
                          value={ep.checks.passive.unhealthy?.timeouts ?? ""}
                          onChange={(e) =>
                            updateEndpoint({
                              checks: {
                                ...ep.checks,
                                passive: {
                                  ...ep.checks!.passive!,
                                  unhealthy: { ...ep.checks!.passive!.unhealthy, timeouts: e.target.value ? parseInt(e.target.value) : undefined },
                                },
                              },
                            })
                          }
                          placeholder="3"
                          disabled={readOnly}
                          className="h-7 text-xs w-[60px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </EndpointSection>

          {/* Keepalive Pool */}
          <EndpointSection title="Keepalive Pool" icon={<Wifi className="h-3 w-3 text-muted-foreground" />}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-muted-foreground shrink-0">Size</Label>
                <Input
                  type="number"
                  placeholder="320"
                  value={ep.keepalive_pool?.size ?? ""}
                  onChange={(e) => {
                    const size = e.target.value ? parseInt(e.target.value) : undefined
                    if (size === undefined && !ep.keepalive_pool?.idle_timeout && !ep.keepalive_pool?.requests) {
                      updateEndpoint({ keepalive_pool: undefined })
                    } else {
                      updateEndpoint({
                        keepalive_pool: {
                          size: size ?? 320,
                          idle_timeout: ep.keepalive_pool?.idle_timeout ?? 60,
                          requests: ep.keepalive_pool?.requests ?? 1000,
                        },
                      })
                    }
                  }}
                  disabled={readOnly}
                  className="h-7 text-xs w-[70px]"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-muted-foreground shrink-0">Idle Timeout</Label>
                <Input
                  type="number"
                  placeholder="60"
                  value={ep.keepalive_pool?.idle_timeout ?? ""}
                  onChange={(e) => {
                    const idle = e.target.value ? parseInt(e.target.value) : undefined
                    if (idle === undefined && !ep.keepalive_pool?.size && !ep.keepalive_pool?.requests) {
                      updateEndpoint({ keepalive_pool: undefined })
                    } else {
                      updateEndpoint({
                        keepalive_pool: {
                          size: ep.keepalive_pool?.size ?? 320,
                          idle_timeout: idle ?? 60,
                          requests: ep.keepalive_pool?.requests ?? 1000,
                        },
                      })
                    }
                  }}
                  disabled={readOnly}
                  className="h-7 text-xs w-[70px]"
                />
                <span className="text-[10px] text-muted-foreground">s</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-muted-foreground shrink-0">Requests</Label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={ep.keepalive_pool?.requests ?? ""}
                  onChange={(e) => {
                    const reqs = e.target.value ? parseInt(e.target.value) : undefined
                    if (reqs === undefined && !ep.keepalive_pool?.size && !ep.keepalive_pool?.idle_timeout) {
                      updateEndpoint({ keepalive_pool: undefined })
                    } else {
                      updateEndpoint({
                        keepalive_pool: {
                          size: ep.keepalive_pool?.size ?? 320,
                          idle_timeout: ep.keepalive_pool?.idle_timeout ?? 60,
                          requests: reqs ?? 1000,
                        },
                      })
                    }
                  }}
                  disabled={readOnly}
                  className="h-7 text-xs w-[70px]"
                />
              </div>
            </div>
          </EndpointSection>

          {/* TLS / mTLS */}
          <EndpointSection title="TLS / mTLS" icon={<Lock className="h-3 w-3 text-muted-foreground" />}>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Client Certificate (PEM)</Label>
                <textarea
                  value={ep.tls?.client_cert || ""}
                  onChange={(e) =>
                    updateEndpoint({
                      tls: {
                        ...ep.tls,
                        client_cert: e.target.value || undefined,
                        client_cert_id: e.target.value ? undefined : ep.tls?.client_cert_id,
                      },
                    })
                  }
                  placeholder="-----BEGIN CERTIFICATE-----"
                  disabled={readOnly}
                  rows={2}
                  className="w-full rounded-md border bg-transparent px-2 py-1.5 font-mono text-[10px] focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Client Key (PEM)</Label>
                <textarea
                  value={ep.tls?.client_key || ""}
                  onChange={(e) =>
                    updateEndpoint({
                      tls: { ...ep.tls, client_key: e.target.value || undefined },
                    })
                  }
                  placeholder="-----BEGIN PRIVATE KEY-----"
                  disabled={readOnly}
                  rows={2}
                  className="w-full rounded-md border bg-transparent px-2 py-1.5 font-mono text-[10px] focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none"
                  spellCheck={false}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-muted-foreground shrink-0">Or Cert ID</Label>
                <Input
                  value={ep.tls?.client_cert_id || ""}
                  onChange={(e) =>
                    updateEndpoint({
                      tls: {
                        ...ep.tls,
                        client_cert_id: e.target.value || undefined,
                        client_cert: e.target.value ? undefined : ep.tls?.client_cert,
                        client_key: e.target.value ? undefined : ep.tls?.client_key,
                      },
                    })
                  }
                  placeholder="Reference to stored certificate"
                  disabled={readOnly}
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </EndpointSection>

          {/* Service Discovery */}
          <EndpointSection title="Service Discovery" icon={<Search className="h-3 w-3 text-muted-foreground" />}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-muted-foreground shrink-0">Discovery Type</Label>
                <Select
                  value={ep.discovery_type || "none"}
                  onValueChange={(v) =>
                    updateEndpoint({
                      discovery_type: v === "none" ? undefined : v,
                      service_name: v === "none" ? undefined : (ep.service_name || ""),
                    })
                  }
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-7 text-xs w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="dns">DNS</SelectItem>
                    <SelectItem value="consul">Consul</SelectItem>
                    <SelectItem value="nacos">Nacos</SelectItem>
                    <SelectItem value="kubernetes">Kubernetes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {ep.discovery_type && (
                <div className="flex items-center gap-1.5">
                  <Label className="text-[10px] text-muted-foreground shrink-0">Service Name</Label>
                  <Input
                    value={ep.service_name || ""}
                    onChange={(e) => updateEndpoint({ service_name: e.target.value || undefined })}
                    placeholder="my-service"
                    disabled={readOnly}
                    className="h-7 text-xs w-[180px]"
                  />
                </div>
              )}
            </div>
            {ep.discovery_type && (
              <p className="text-[10px] text-muted-foreground mt-1">
                When service discovery is configured, nodes are resolved automatically.
              </p>
            )}
          </EndpointSection>

          {/* Upstream Nodes — hidden when service discovery is active */}
          {!ep.discovery_type && <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Nodes
            </p>
            {/* Header row */}
            <div className="flex items-center gap-1.5 px-1 mb-1">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex-1 min-w-0">Host</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider w-[70px] shrink-0 text-center">Port</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider w-[55px] shrink-0 text-center">Weight</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider w-[55px] shrink-0 text-center" title="Lower = higher priority. Negative for backup nodes.">Priority</span>
              {!readOnly && <span className="w-6 shrink-0" />}
            </div>
            <div className="space-y-1">
              {ep.nodes.map((node, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input
                    placeholder="127.0.0.1"
                    value={node.host}
                    onChange={(e) => updateNode(i, { host: e.target.value })}
                    disabled={readOnly}
                    className="h-7 text-xs flex-1 min-w-0"
                  />
                  <Input
                    type="number"
                    value={node.port}
                    onChange={(e) => updateNode(i, { port: parseInt(e.target.value) || 80 })}
                    disabled={readOnly}
                    className="h-7 text-xs w-[70px] shrink-0"
                  />
                  <Input
                    type="number"
                    value={node.weight}
                    onChange={(e) => updateNode(i, { weight: parseInt(e.target.value) || 1 })}
                    disabled={readOnly}
                    className="h-7 text-xs w-[55px] shrink-0"
                  />
                  <Input
                    type="number"
                    value={node.priority ?? ""}
                    onChange={(e) => updateNode(i, { priority: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="0"
                    disabled={readOnly}
                    className="h-7 text-xs w-[55px] shrink-0"
                  />
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => updateEndpoint({ nodes: ep.nodes.filter((_, j) => j !== i) })}
                      disabled={ep.nodes.length <= 1}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <button
                  onClick={() =>
                    updateEndpoint({ nodes: [...ep.nodes, { host: "", port: 80, weight: 1 }] })
                  }
                  className="flex items-center gap-1 py-1 px-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add node</span>
                </button>
              )}
            </div>
          </div>}
        </div>
      </ScrollArea>
    </div>
  )
}

// --- Flow Route Header (top strip above the flow) ---

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as const

function FlowRouteHeader({
  flow,
  onUpdateFlow,
  readOnly,
  showObservability,
  onToggleObservability,
  observabilityCount,
  showEndpoint,
  onToggleEndpoint,
  contextPath,
  routingMode,
  version,
  onSelectTemplate,
  onClearTemplate,
}: {
  flow: ApiFlow
  onUpdateFlow: (changes: Partial<ApiFlow>) => void
  readOnly: boolean
  showObservability: boolean
  onToggleObservability: () => void
  observabilityCount: number
  showEndpoint: boolean
  onToggleEndpoint: () => void
  contextPath?: string
  routingMode?: string
  version?: string
  onSelectTemplate: (id: string, name: string, plugins: Record<string, unknown>) => void
  onClearTemplate: () => void
}) {
  const [optionsOpen, setOptionsOpen] = useState(false)

  const toggleMethod = (m: string) => {
    const methods = flow.entrypoint.methods.includes(m)
      ? flow.entrypoint.methods.filter((x) => x !== m)
      : [...flow.entrypoint.methods, m]
    onUpdateFlow({ entrypoint: { ...flow.entrypoint, methods } })
  }

  return (
    <Collapsible open={optionsOpen} onOpenChange={setOptionsOpen}>
      {/* Main strip - read-only display */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-card shrink-0 overflow-hidden">
        {/* Method badges */}
        <div className="flex items-center gap-1 shrink-0">
          {flow.entrypoint.methods.length > 0 ? (
            flow.entrypoint.methods.map((m) => (
              <Badge key={m} variant="default" className="text-[9px] px-1.5 py-0 font-mono">
                {m}
              </Badge>
            ))
          ) : (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono">
              ALL
            </Badge>
          )}
        </div>

        {/* URI + description */}
        <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
          <span className="font-mono text-sm text-muted-foreground truncate shrink-0 max-w-[50%]" title={flow.entrypoint.uri || "/"}>
            {flow.entrypoint.uri || "/"}
          </span>
          {flow.description && (
            <span className="text-xs text-muted-foreground truncate min-w-0" title={flow.description}>
              — {flow.description}
            </span>
          )}
        </div>

        {/* Template indicator */}
        {flow.policyTemplateId && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 border-dashed border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/5">
            <FileJson className="h-2.5 w-2.5 mr-1" />
            {flow.policyTemplateName || "Template"}
          </Badge>
        )}

        {/* Endpoint toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onToggleEndpoint}
        >
          <Server className={`h-3.5 w-3.5 transition-colors ${showEndpoint ? "text-green-500" : ""}`} />
        </Button>

        {/* Observability toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 relative"
          onClick={onToggleObservability}
        >
          <Activity className={`h-3.5 w-3.5 transition-colors ${showObservability ? "text-green-500" : ""}`} />
          {observabilityCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-500 text-[8px] font-bold text-white">
              {observabilityCount}
            </span>
          )}
        </Button>

        {/* Route options toggle */}
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
            <Settings2 className={`h-3.5 w-3.5 transition-transform ${optionsOpen ? "text-primary" : ""}`} />
          </Button>
        </CollapsibleTrigger>
      </div>

      {/* Expandable options */}
      <CollapsibleContent>
        <div className="px-4 py-3 border-b bg-card space-y-3">
          {/* URI */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              URI Path
            </Label>
            <Input
              value={flow.entrypoint.uri}
              onChange={(e) =>
                onUpdateFlow({ entrypoint: { ...flow.entrypoint, uri: e.target.value } })
              }
              disabled={readOnly}
              placeholder={contextPath ? "/:id" : "/api/v1/users/*"}
              className="h-8 font-mono text-sm"
            />
            {/* Resolved URI preview */}
            {contextPath && flow.entrypoint.uri && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="shrink-0">Resolved:</span>
                {(routingMode === "path" || routingMode === "both" || !routingMode) && (
                  <code className="font-mono bg-muted px-1.5 py-0.5 rounded">
                    /{version || "v1"}{contextPath}{flow.entrypoint.uri}
                  </code>
                )}
                {(routingMode === "header" || routingMode === "both") && (
                  <code className="font-mono bg-muted px-1.5 py-0.5 rounded">
                    {contextPath}{flow.entrypoint.uri} <span className="text-blue-500">(header)</span>
                  </code>
                )}
              </div>
            )}
            {!readOnly && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground shrink-0">Quick:</span>
                {(contextPath ? ["/:id", "/*", "/list"] : ["/api/v1/*", "/api/v1/users/*", "/*"]).map((example) => (
                  <button
                    key={example}
                    onClick={() =>
                      onUpdateFlow({ entrypoint: { ...flow.entrypoint, uri: example } })
                    }
                    className="px-1.5 py-0.5 rounded border text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    {example}
                  </button>
                ))}
                <span className="text-[10px] text-muted-foreground ml-1">
                  {contextPath ? "Relative to context path" : <>Use <code className="font-mono bg-muted px-1 rounded">/*</code> at the end for prefix matching</>}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Description
            </Label>
            <Input
              value={flow.description || ""}
              onChange={(e) =>
                onUpdateFlow({ description: e.target.value || undefined })
              }
              disabled={readOnly}
              placeholder="Optional comment about this flow..."
              className="h-8 text-sm"
            />
          </div>

          {/* HTTP Methods */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              HTTP Methods
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {HTTP_METHODS.map((m) => {
                const active = flow.entrypoint.methods.includes(m)
                return (
                  <button
                    key={m}
                    onClick={() => !readOnly && toggleMethod(m)}
                    disabled={readOnly}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-medium border transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                    } ${readOnly ? "cursor-default" : "cursor-pointer"}`}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Nenhum selecionado = aceita todos os metodos
            </p>
          </div>

          {/* Policy Template */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Policy Template
            </Label>
            <PolicyTemplateSelector
              selectedTemplateId={flow.policyTemplateId}
              selectedTemplateName={flow.policyTemplateName}
              onSelect={onSelectTemplate}
              onClear={onClearTemplate}
              readOnly={readOnly}
              currentPolicies={flow.policies}
            />
          </div>

        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// PolicyConfigPanel is now imported from ./plugin-config-panel
