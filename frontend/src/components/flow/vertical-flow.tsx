"use client"

import { useState, useMemo, useEffect } from "react"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  Settings,
  Trash2,
  Power,
  PowerOff,
  Server,
  Key,
  Lock,
  ShieldCheck,
  Fingerprint,
  KeyRound,
  ArrowRightLeft,
  Shield,
  Ban,
  Globe,
  ShieldAlert,
  UserX,
  Gauge,
  Users,
  Hash,
  GitBranch,
  Database,
  Replace,
  FileOutput,
  ArrowLeftRight,
  Bug,
  ExternalLink,
  BarChart3,
  Send,
  Radio,
  FileText,
  Network,
  Activity,
  type LucideIcon,
  CircleDot,
  Search,
  Puzzle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger as TooltipTrig,
} from "@/components/ui/tooltip"
import { getPluginDef, getCategoryMeta, PLUGIN_CATEGORIES } from "@/lib/constants"
import type { PluginPhase } from "@/lib/constants"
import {
  type EnrichedPlugin,
  getCachedPlugins,
  getDefaultPlugins,
  fetchAllPlugins,
} from "@/lib/plugin-registry"
import type { ApiFlow, ApiDefinition, PolicyInstance } from "@/types/api"

// Map icon name strings to actual Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  Key,
  Lock,
  ShieldCheck,
  Fingerprint,
  KeyRound,
  ArrowRightLeft,
  Shield,
  Ban,
  Globe,
  ShieldAlert,
  UserX,
  Gauge,
  Users,
  Hash,
  GitBranch,
  Database,
  Replace,
  FileOutput,
  ArrowLeftRight,
  Bug,
  ExternalLink,
  BarChart3,
  Send,
  Radio,
  FileText,
  Network,
  Activity,
}

function getIconComponent(iconName?: string): LucideIcon {
  if (!iconName) return CircleDot
  return ICON_MAP[iconName] || CircleDot
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Authentication: KeyRound,
  Security: Shield,
  "Traffic Control": Gauge,
  Transformation: Replace,
  Observability: Activity,
  Other: Puzzle,
}

// Category color mapping for icon backgrounds
const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "bg-blue-500": { bg: "bg-blue-500/15", border: "border-blue-500/40", text: "text-blue-500" },
  "bg-red-500": { bg: "bg-red-500/15", border: "border-red-500/40", text: "text-red-500" },
  "bg-amber-500": { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-500" },
  "bg-purple-500": { bg: "bg-purple-500/15", border: "border-purple-500/40", text: "text-purple-500" },
  "bg-green-500": { bg: "bg-green-500/15", border: "border-green-500/40", text: "text-green-500" },
}

export interface VerticalFlowProps {
  flow: ApiFlow
  endpoint: ApiDefinition["endpoint"]
  onConfigurePolicy: (policyId: string) => void
  onRemovePolicy: (policyId: string) => void
  onTogglePolicy: (policyId: string) => void
  onClickEndpoint: () => void
  onAddPlugin: (pluginName: string) => void
  existingPlugins?: string[]
  readOnly?: boolean
}

/* ── Edge-aligned policy row (Request = icon left, Response = icon right) ── */

function EdgePolicyCard({
  policy,
  onConfigure,
  onRemove,
  onToggle,
  readOnly,
  side,
}: {
  policy: PolicyInstance
  onConfigure: () => void
  onRemove: () => void
  onToggle: () => void
  readOnly?: boolean
  side: "left" | "right"
}) {
  const def = getPluginDef(policy.name)
  const catMeta = def ? getCategoryMeta(def.category) : null
  const colors = CATEGORY_COLORS[catMeta?.color || "bg-blue-500"] || CATEGORY_COLORS["bg-blue-500"]
  const IconComp = getIconComponent(def?.icon)

  const icon = (
    <div className="flex flex-col items-center shrink-0 z-10">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${colors.border} ${colors.bg}`}>
        <IconComp className={`h-4 w-4 ${colors.text}`} />
      </div>
    </div>
  )

  const card = (
    <div
      className={`group relative flex-1 min-w-0 rounded-xl border px-3 py-2.5 transition-all ${
        policy.enabled
          ? "bg-card border-border hover:border-primary/40 hover:shadow-md"
          : "bg-muted/50 border-dashed border-muted-foreground/30 opacity-60"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {catMeta && (
              <Badge
                variant="outline"
                className="text-[9px] uppercase tracking-wider font-semibold px-1 py-0"
                style={{
                  borderColor: `var(--color-${catMeta.color.replace("bg-", "")}, currentColor)`,
                }}
              >
                {catMeta.label.split(" ")[0]}
              </Badge>
            )}
            <span className="text-xs font-semibold truncate">
              {def?.label || policy.name}
            </span>
            {!policy.enabled && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0">
                off
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground truncate">
            {def?.description || policy.name}
          </p>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onConfigure}>
              <Settings className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggle}>
              {policy.enabled ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className={`flex items-center gap-3 ${side === "right" ? "flex-row-reverse" : ""}`}>
      {icon}
      {card}
    </div>
  )
}

/* ── Edge row: a node on the edge line with content beside it ── */

function EdgeRow({
  side,
  children,
  nodeContent,
}: {
  side: "left" | "right"
  children: React.ReactNode
  nodeContent: React.ReactNode
}) {
  return (
    <div className={`flex items-center gap-3 ${side === "right" ? "flex-row-reverse" : ""}`}>
      <div className="shrink-0 z-10">{nodeContent}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

/* ── Vertical edge line segment ── */

function EdgeLine({ side, height = "h-6" }: { side: "left" | "right"; height?: string }) {
  const animClass = side === "left" ? "edge-line-request" : "edge-line-response"
  const lineColor = side === "left" ? "bg-blue-500/25" : "bg-emerald-500/25"
  return (
    <div className={`relative ${height}`}>
      <div className={`absolute ${side === "right" ? "right-[17px]" : "left-[17px]"} -top-3 -bottom-3 w-[3px] ${lineColor} overflow-visible ${animClass}`} />
    </div>
  )
}

/* ── Drop zone with popover plugin picker ── */

function EdgeDropZone({
  label,
  phase,
  side,
  onAddPlugin,
  existingPlugins = [],
}: {
  label: string
  phase: PluginPhase
  side: "left" | "right"
  onAddPlugin: (pluginName: string) => void
  existingPlugins?: string[]
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [allPlugins, setAllPlugins] = useState<EnrichedPlugin[]>(getCachedPlugins() || getDefaultPlugins())

  // Fetch all plugins on mount
  useEffect(() => {
    if (getCachedPlugins()) return
    fetchAllPlugins().then((plugins) => setAllPlugins(plugins))
  }, [])

  // Show all plugins (same as PolicyGallery) — no phase filtering
  const filtered = useMemo(() => {
    if (!search) return allPlugins
    const q = search.toLowerCase()
    return allPlugins.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q)
    )
  }, [allPlugins, search])

  // Group by category
  const grouped = useMemo(() => {
    const groups: { label: string; color: string; plugins: EnrichedPlugin[] }[] = []
    for (const cat of PLUGIN_CATEGORIES) {
      const items = filtered.filter((p) => p.category === cat.value)
      if (items.length > 0) {
        groups.push({ label: cat.label, color: cat.color, plugins: items })
      }
    }
    // Also include uncategorized plugins
    const uncategorized = filtered.filter((p) => p.category === null)
    if (uncategorized.length > 0) {
      groups.push({ label: "Other", color: "bg-gray-500", plugins: uncategorized })
    }
    return groups
  }, [filtered])

  const handleAdd = (pluginName: string) => {
    onAddPlugin(pluginName)
    setOpen(false)
    setSearch("")
  }

  const trigger = (
    <div className={`flex items-center gap-3 ${side === "right" ? "flex-row-reverse" : ""}`}>
      <PopoverTrigger asChild>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 bg-background hover:border-primary/50 hover:bg-muted transition-colors cursor-pointer z-10"
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverTrigger asChild>
        <button
          className="relative z-10 flex-1 min-w-0 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-background px-3 py-2.5 text-center hover:border-primary/40 hover:bg-muted transition-all cursor-pointer group"
        >
          <p className="text-[11px] text-muted-foreground group-hover:text-primary transition-colors">
            {label}
          </p>
        </button>
      </PopoverTrigger>
    </div>
  )

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch("") }}>
      {trigger}
      <PopoverContent
        side={side === "left" ? "right" : "left"}
        align="start"
        className="w-[280px] p-0"
      >
        <div className="px-3 pt-3 pb-2 border-b">
          <p className="text-xs font-semibold mb-2 capitalize">{label}</p>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-7 text-xs"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[360px] overflow-y-auto px-2 py-1">
          {grouped.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No policies found</p>
          )}
          <Accordion type="single" collapsible>
            {grouped.map((group) => (
              <AccordionItem key={group.label} value={group.label} className="border-b-0">
                <AccordionTrigger className="py-1.5 hover:no-underline">
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const CatIcon = CATEGORY_ICONS[group.label] || Puzzle
                      return <CatIcon className="h-3 w-3 text-muted-foreground" />
                    })()}
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </span>
                    <span className="text-[9px] text-muted-foreground/60">
                      ({group.plugins.length})
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-1">
                  <div className="space-y-0.5">
                    <TooltipProvider delayDuration={300}>
                      {group.plugins.map((plugin) => {
                        const isAdded = existingPlugins.includes(plugin.name)
                        const IconComp = getIconComponent(plugin.icon ?? undefined)
                        const catMeta = plugin.category ? getCategoryMeta(plugin.category) : null
                        const colors = CATEGORY_COLORS[catMeta?.color || "bg-blue-500"] || CATEGORY_COLORS["bg-blue-500"]
                        return (
                          <Tooltip key={plugin.name}>
                            <TooltipTrig asChild>
                              <button
                                onClick={() => handleAdd(plugin.name)}
                                disabled={isAdded}
                                className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                                  isAdded
                                    ? "opacity-40 cursor-default"
                                    : "hover:bg-muted cursor-pointer"
                                }`}
                              >
                                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${colors.bg}`}>
                                  <IconComp className={`h-3 w-3 ${colors.text}`} />
                                </div>
                                <span className="text-xs font-medium truncate flex-1 min-w-0">{plugin.label}</span>
                                {isAdded && (
                                  <Badge variant="secondary" className="text-[8px] px-1 py-0 shrink-0">added</Badge>
                                )}
                              </button>
                            </TooltipTrig>
                            <TooltipContent side="right" sideOffset={8}>
                              {plugin.description}
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </TooltipProvider>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ── Section label on the edge ── */

function EdgeSectionLabel({
  label,
  color,
  side,
}: {
  label: string
  color: string
  side: "left" | "right"
}) {
  const textColor = color.replace("bg-", "text-")
  return (
    <div className={`flex items-center gap-2 py-1 ${side === "right" ? "justify-end pr-[48px]" : "pl-[48px]"}`}>
      <div className={`h-1.5 w-1.5 rounded-full ${color}`} />
      <span className={`text-[10px] font-bold uppercase tracking-widest ${textColor}`}>
        {label}
      </span>
    </div>
  )
}

export function VerticalFlow({
  flow,
  endpoint,
  onConfigurePolicy,
  onRemovePolicy,
  onTogglePolicy,
  onClickEndpoint,
  onAddPlugin,
  existingPlugins = [],
  readOnly = false,
}: VerticalFlowProps) {
  const requestPolicies = flow.policies.filter((p) => p.phase === "request")
  const responsePolicies = flow.policies.filter((p) => p.phase === "response")
  const firstNode = endpoint.nodes[0]

  return (
    <div className="py-6 px-6">
      {/* Three-column layout: Request | Endpoint | Response */}
      <div className="flex gap-0">
        {/* ═══ LEFT: Request Column (edge on left) ═══ */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Entry Point */}
          <EdgeRow side="left" nodeContent={
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-blue-500/40 bg-blue-500/15">
              <ArrowDownToLine className="h-4 w-4 text-blue-500" />
            </div>
          }>
            <div className="w-full rounded-xl border-2 border-blue-500/20 bg-blue-500/5 px-4 py-2.5">
              <p className="text-sm font-semibold">Entry Point</p>
              <p className="text-[11px] text-muted-foreground">Incoming Request</p>
            </div>
          </EdgeRow>

          <EdgeLine side="left" />
          <EdgeSectionLabel label="Request Policies" color="bg-blue-500" side="left" />
          <EdgeLine side="left" height="h-3" />

          {/* Request policies */}
          {requestPolicies.map((policy, i) => (
            <div key={policy.id}>
              <EdgePolicyCard
                policy={policy}
                onConfigure={() => onConfigurePolicy(policy.id)}
                onRemove={() => onRemovePolicy(policy.id)}
                onToggle={() => onTogglePolicy(policy.id)}
                readOnly={readOnly}
                side="left"
              />
              {(i < requestPolicies.length - 1 || !readOnly) && <EdgeLine side="left" />}
            </div>
          ))}

          {!readOnly && (
            <EdgeDropZone label="Add request policy" phase="request" side="left" onAddPlugin={onAddPlugin} existingPlugins={existingPlugins} />
          )}

          {requestPolicies.length === 0 && readOnly && (
            <div className="pl-12 py-4">
              <p className="text-[10px] text-muted-foreground/50">No request policies</p>
            </div>
          )}

          {/* Spacer to push bottom to same height as response column */}
          <div className="flex-1" />
        </div>

        {/* ═══ CENTER: Endpoint vertical column (rotated text) ═══ */}
        <div className="flex flex-col items-center mx-4 shrink-0 w-[56px]">
          <button
            onClick={onClickEndpoint}
            className="flex-1 w-full rounded-xl border-2 border-green-500/20 bg-green-500/5 hover:border-green-500/40 hover:shadow-md transition-all cursor-pointer flex flex-col items-center justify-center py-4 min-h-[120px]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-green-500/40 bg-green-500/15">
              <Server className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>

            {/* Rotated content */}
            <div className="flex-1 flex items-center justify-center my-2">
              <div className="flex items-center gap-1.5 [writing-mode:vertical-rl]">
                <span className="text-[10px] font-bold text-green-700 dark:text-green-300 uppercase tracking-widest">
                  Endpoint
                </span>
                <span className="text-[9px] text-foreground/30">·</span>
                <span className="text-[9px] text-foreground/70 dark:text-foreground/60 font-mono font-medium">
                  {endpoint.scheme}
                </span>
                <span className="text-[9px] text-foreground/30">·</span>
                <span className="text-[9px] text-foreground/70 dark:text-foreground/60 font-mono">
                  {firstNode ? `${firstNode.host}:${firstNode.port}` : "not set"}
                </span>
                {endpoint.nodes.length > 1 && (
                  <>
                    <span className="text-[9px] text-foreground/30">·</span>
                    <span className="text-[9px] text-foreground/60 dark:text-foreground/50">
                      +{endpoint.nodes.length - 1}
                    </span>
                  </>
                )}
                <span className="text-[9px] text-foreground/30">·</span>
                <span className="text-[9px] text-foreground/60 dark:text-foreground/50">
                  {endpoint.type}
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* ═══ RIGHT: Response Column (edge on right) ═══ */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Exit Point */}
          <EdgeRow side="right" nodeContent={
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-emerald-500/40 bg-emerald-500/15">
              <ArrowUpFromLine className="h-4 w-4 text-emerald-500" />
            </div>
          }>
            <div className="w-full rounded-xl border-2 border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
              <p className="text-sm font-semibold">Exit Point</p>
              <p className="text-[11px] text-muted-foreground">Outgoing Response</p>
            </div>
          </EdgeRow>

          <EdgeLine side="right" />
          <EdgeSectionLabel label="Response Policies" color="bg-emerald-500" side="right" />
          <EdgeLine side="right" height="h-3" />

          {/* Response policies */}
          {responsePolicies.map((policy, i) => (
            <div key={policy.id}>
              <EdgePolicyCard
                policy={policy}
                onConfigure={() => onConfigurePolicy(policy.id)}
                onRemove={() => onRemovePolicy(policy.id)}
                onToggle={() => onTogglePolicy(policy.id)}
                readOnly={readOnly}
                side="right"
              />
              {(i < responsePolicies.length - 1 || !readOnly) && <EdgeLine side="right" />}
            </div>
          ))}

          {!readOnly && (
            <EdgeDropZone label="Add response policy" phase="response" side="right" onAddPlugin={onAddPlugin} existingPlugins={existingPlugins} />
          )}

          {responsePolicies.length === 0 && readOnly && (
            <div className="pr-12 py-4 text-right">
              <p className="text-[10px] text-muted-foreground/50">No response policies</p>
            </div>
          )}

          {/* Spacer to push bottom to same height as request column */}
          <div className="flex-1" />
        </div>
      </div>

    </div>
  )
}
