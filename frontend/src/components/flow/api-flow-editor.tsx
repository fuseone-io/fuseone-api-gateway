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
import { getPluginDef } from "@/lib/constants"
import type { PluginPhase } from "@/lib/constants"
import type { ApiDefinition, ApiFlow, PolicyInstance } from "@/types/api"

interface ApiFlowEditorProps {
  api: ApiDefinition
  onChange: (api: ApiDefinition) => void
  readOnly?: boolean
}

type RightPanel =
  | { type: "gallery"; phaseFilter?: PluginPhase }
  | { type: "policy-config"; policyId: string }

export function ApiFlowEditor({ api: apiDef, onChange, readOnly = false }: ApiFlowEditorProps) {
  const [selectedFlowId, setSelectedFlowId] = useState<string>(apiDef.flows[0]?.id || "")
  const [rightPanel, setRightPanel] = useState<RightPanel>({ type: "gallery" })
  const [addFlowDialogOpen, setAddFlowDialogOpen] = useState(false)
  const [showObservability, setShowObservability] = useState(false)
  const [showEndpoint, setShowEndpoint] = useState(false)

  const selectedFlow = apiDef.flows.find((f) => f.id === selectedFlowId) || apiDef.flows[0]

  // --- Flow CRUD ---
  const createFlow = useCallback((uri: string, copyPolicies: boolean) => {
    const sourceFlow = apiDef.flows[0]
    const newFlow: ApiFlow = {
      id: crypto.randomUUID(),
      name: `Flow ${apiDef.flows.length + 1}`,
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
          <div className="p-4 space-y-5">
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
        onCreate={(uri, copyPolicies) => {
          createFlow(uri, copyPolicies)
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
      className={`group relative w-full text-left rounded-lg border px-3 py-2 transition-all cursor-pointer ${
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
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
              className="text-xs font-medium truncate"
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
          <p className="text-[10px] text-muted-foreground font-mono truncate">
            {flow.entrypoint.uri || "/"}
          </p>
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
  onCreate: (uri: string, copyPolicies: boolean) => void
}) {
  const [uri, setUri] = useState("/")
  const [copyPolicies, setCopyPolicies] = useState(false)

  const normalizedUri = uri.trim() || "/"
  const conflict = existingUris.some(
    (existing) => existing === normalizedUri
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (conflict) return
    onCreate(normalizedUri, copyPolicies)
    setUri("/")
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
            {/* URI Input */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">URI Path</Label>
              <Input
                autoFocus
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
            {apiDef.endpoint.nodes.length} {apiDef.endpoint.nodes.length === 1 ? "node" : "nodes"}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Sheet content */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-3 space-y-4">
          {/* Scheme + Balance */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-muted-foreground shrink-0">Scheme</Label>
              <Select
                value={apiDef.endpoint.scheme}
                onValueChange={(v) =>
                  onChange({ ...apiDef, endpoint: { ...apiDef.endpoint, scheme: v as "http" } })
                }
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
                value={apiDef.endpoint.type}
                onValueChange={(v) =>
                  onChange({ ...apiDef, endpoint: { ...apiDef.endpoint, type: v as "roundrobin" } })
                }
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
                value={apiDef.endpoint.retries ?? ""}
                onChange={(e) =>
                  onChange({
                    ...apiDef,
                    endpoint: {
                      ...apiDef.endpoint,
                      retries: e.target.value ? parseInt(e.target.value) : undefined,
                    },
                  })
                }
                disabled={readOnly}
                className="h-7 text-xs w-[70px]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Switch
                checked={apiDef.endpoint.healthCheck?.enabled ?? false}
                onCheckedChange={(checked) =>
                  onChange({
                    ...apiDef,
                    endpoint: {
                      ...apiDef.endpoint,
                      healthCheck: checked
                        ? { enabled: true, path: "/health", interval: 5 }
                        : undefined,
                    },
                  })
                }
                disabled={readOnly}
              />
              <Label className="text-[10px] text-muted-foreground">Health Check</Label>
            </div>
            {apiDef.endpoint.healthCheck?.enabled && (
              <>
                <div className="flex items-center gap-1.5">
                  <Label className="text-[10px] text-muted-foreground shrink-0">Path</Label>
                  <Input
                    value={apiDef.endpoint.healthCheck.path}
                    onChange={(e) =>
                      onChange({
                        ...apiDef,
                        endpoint: {
                          ...apiDef.endpoint,
                          healthCheck: { ...apiDef.endpoint.healthCheck!, path: e.target.value },
                        },
                      })
                    }
                    disabled={readOnly}
                    className="h-7 text-xs w-[100px]"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-[10px] text-muted-foreground shrink-0">Interval</Label>
                  <Input
                    type="number"
                    value={apiDef.endpoint.healthCheck.interval}
                    onChange={(e) =>
                      onChange({
                        ...apiDef,
                        endpoint: {
                          ...apiDef.endpoint,
                          healthCheck: {
                            ...apiDef.endpoint.healthCheck!,
                            interval: parseInt(e.target.value) || 5,
                          },
                        },
                      })
                    }
                    disabled={readOnly}
                    className="h-7 text-xs w-[60px]"
                  />
                  <span className="text-[10px] text-muted-foreground">s</span>
                </div>
              </>
            )}
          </div>

          {/* Upstream Nodes - horizontal cards */}
          <div className="flex flex-wrap gap-2">
            {apiDef.endpoint.nodes.map((node, i) => (
              <div key={i} className="rounded-lg border p-2 space-y-1.5 min-w-[180px]">
                <div className="flex items-center gap-1.5">
                  <Input
                    placeholder="host"
                    value={node.host}
                    onChange={(e) => {
                      const nodes = [...apiDef.endpoint.nodes]
                      nodes[i] = { ...nodes[i], host: e.target.value }
                      onChange({ ...apiDef, endpoint: { ...apiDef.endpoint, nodes } })
                    }}
                    disabled={readOnly}
                    className="h-7 text-xs flex-1"
                  />
                  {!readOnly && apiDef.endpoint.nodes.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-destructive"
                      onClick={() =>
                        onChange({
                          ...apiDef,
                          endpoint: {
                            ...apiDef.endpoint,
                            nodes: apiDef.endpoint.nodes.filter((_, j) => j !== i),
                          },
                        })
                      }
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-[10px] text-muted-foreground shrink-0">Port</span>
                    <Input
                      type="number"
                      value={node.port}
                      onChange={(e) => {
                        const nodes = [...apiDef.endpoint.nodes]
                        nodes[i] = { ...nodes[i], port: parseInt(e.target.value) || 80 }
                        onChange({ ...apiDef, endpoint: { ...apiDef.endpoint, nodes } })
                      }}
                      disabled={readOnly}
                      className="h-6 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-[10px] text-muted-foreground shrink-0">W</span>
                    <Input
                      type="number"
                      value={node.weight}
                      onChange={(e) => {
                        const nodes = [...apiDef.endpoint.nodes]
                        nodes[i] = { ...nodes[i], weight: parseInt(e.target.value) || 1 }
                        onChange({ ...apiDef, endpoint: { ...apiDef.endpoint, nodes } })
                      }}
                      disabled={readOnly}
                      className="h-6 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
            {!readOnly && (
              <button
                onClick={() =>
                  onChange({
                    ...apiDef,
                    endpoint: {
                      ...apiDef.endpoint,
                      nodes: [...apiDef.endpoint.nodes, { host: "", port: 80, weight: 1 }],
                    },
                  })
                }
                className="flex items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 px-4 py-3 min-w-[120px] hover:border-primary/40 hover:bg-muted transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                <span className="text-xs text-muted-foreground">Add node</span>
              </button>
            )}
          </div>
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
}: {
  flow: ApiFlow
  onUpdateFlow: (changes: Partial<ApiFlow>) => void
  readOnly: boolean
  showObservability: boolean
  onToggleObservability: () => void
  observabilityCount: number
  showEndpoint: boolean
  onToggleEndpoint: () => void
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
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-card shrink-0">
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

        {/* URI display */}
        <span className="font-mono text-sm text-muted-foreground truncate flex-1">
          {flow.entrypoint.uri || "/"}
        </span>

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
              placeholder="/api/v1/*"
              className="h-8 font-mono text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Use /* para wildcard matching
            </p>
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
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// PolicyConfigPanel is now imported from ./plugin-config-panel
