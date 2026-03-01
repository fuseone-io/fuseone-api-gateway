"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import {
  Search,
  Plus,
  ChevronDown,
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
  Loader2,
  Puzzle,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  PLUGIN_CATEGORIES,
  getCategoryMeta,
  type PluginCategory,
  type PluginPhase,
} from "@/lib/constants"
import {
  type EnrichedPlugin,
  getCachedPlugins,
  getDefaultPlugins,
  fetchAllPlugins,
  groupByCategory,
} from "@/lib/plugin-registry"

const ICON_MAP: Record<string, LucideIcon> = {
  Key, Lock, ShieldCheck, Fingerprint, KeyRound, ArrowRightLeft,
  Shield, Ban, Globe, ShieldAlert, UserX, Gauge, Users, Hash,
  GitBranch, Database, Replace, FileOutput, ArrowLeftRight, Bug,
  ExternalLink, BarChart3, Send, Radio, FileText, Network, Activity,
}

function getIconComponent(iconName?: string): LucideIcon {
  if (!iconName) return CircleDot
  return ICON_MAP[iconName] || CircleDot
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  authentication: KeyRound,
  security: Shield,
  traffic: Gauge,
  transformation: Replace,
  observability: Activity,
  other: Puzzle,
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "bg-blue-500": { bg: "bg-blue-500/15", text: "text-blue-500" },
  "bg-red-500": { bg: "bg-red-500/15", text: "text-red-500" },
  "bg-amber-500": { bg: "bg-amber-500/15", text: "text-amber-500" },
  "bg-purple-500": { bg: "bg-purple-500/15", text: "text-purple-500" },
  "bg-green-500": { bg: "bg-green-500/15", text: "text-green-500" },
  "bg-gray-500": { bg: "bg-gray-500/15", text: "text-gray-500" },
}

interface PolicyGalleryProps {
  onAddPolicy: (pluginName: string) => void
  /** Plugin names already added, to show "added" state */
  existingPolicies?: string[]
  /** Optional phase filter — when set, only shows plugins matching this phase */
  phaseFilter?: PluginPhase
  /** Plugin names to hide from the gallery entirely */
  excludePlugins?: string[]
  /** Categories to hide entirely from the gallery (use "other" for uncategorized) */
  excludeCategories?: (PluginCategory | "other")[]
}

function PluginCard({
  plugin,
  onAdd,
  isAdded,
}: {
  plugin: EnrichedPlugin
  onAdd: () => void
  isAdded: boolean
}) {
  const catMeta = plugin.category ? getCategoryMeta(plugin.category) : null
  const colors = CATEGORY_COLORS[catMeta?.color || "bg-blue-500"] || CATEGORY_COLORS["bg-blue-500"]
  const IconComp = getIconComponent(plugin.icon ?? undefined)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onAdd}
          disabled={isAdded}
          className={`w-full text-left rounded-lg border px-3 py-2 transition-all ${
            isAdded
              ? "bg-muted/50 border-dashed opacity-50 cursor-default"
              : "bg-card hover:border-primary/40 hover:shadow-sm cursor-pointer"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${colors.bg}`}>
              <IconComp className={`h-3.5 w-3.5 ${colors.text}`} />
            </div>
            <span className="text-sm font-medium truncate flex-1 min-w-0">{plugin.label}</span>
            {isAdded ? (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">
                added
              </Badge>
            ) : (
              <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8}>
        {plugin.description}
      </TooltipContent>
    </Tooltip>
  )
}

export function PolicyGallery({ onAddPolicy, existingPolicies = [], phaseFilter, excludePlugins = [], excludeCategories = [] }: PolicyGalleryProps) {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<PluginCategory | "all">("all")
  const [highlight, setHighlight] = useState(false)
  const [allPlugins, setAllPlugins] = useState<EnrichedPlugin[]>(getCachedPlugins() || getDefaultPlugins())
  const [loading, setLoading] = useState(!getCachedPlugins())
  const prevPhaseRef = useRef(phaseFilter)

  // Fetch all plugins from the API
  useEffect(() => {
    if (getCachedPlugins()) return

    fetchAllPlugins()
      .then((plugins) => setAllPlugins(plugins))
      .finally(() => setLoading(false))
  }, [])

  // Flash highlight when phaseFilter changes (user clicked a drop zone)
  useEffect(() => {
    if (phaseFilter !== prevPhaseRef.current) {
      prevPhaseRef.current = phaseFilter
      setHighlight(true)
      const timer = setTimeout(() => setHighlight(false), 600)
      return () => clearTimeout(timer)
    }
  }, [phaseFilter])

  const filtered = useMemo(() => {
    return allPlugins.filter((p) => {
      if (excludePlugins.length > 0 && excludePlugins.includes(p.name)) return false
      if (excludeCategories.length > 0) {
        if (p.category && excludeCategories.includes(p.category)) return false
        if (!p.category && excludeCategories.includes("other")) return false
      }
      const matchesSearch =
        !search ||
        p.label.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.name.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = activeCategory === "all" || p.category === activeCategory
      const matchesPhase = !phaseFilter || p.phase === phaseFilter
      return matchesSearch && matchesCategory && matchesPhase
    })
  }, [search, activeCategory, phaseFilter, allPlugins, excludePlugins, excludeCategories])

  // Group by category for display
  const grouped = useMemo(() => {
    const groups: { category: PluginCategory | "other"; label: string; color: string; plugins: EnrichedPlugin[] }[] = []
    for (const cat of PLUGIN_CATEGORIES) {
      const plugins = filtered.filter((p) => p.category === cat.value)
      if (plugins.length > 0) {
        groups.push({ category: cat.value, label: cat.label, color: cat.color, plugins })
      }
    }
    // "Other" group for uncategorized plugins
    const uncategorized = filtered.filter((p) => p.category === null)
    if (uncategorized.length > 0) {
      groups.push({ category: "other", label: "Other", color: "bg-gray-500", plugins: uncategorized })
    }
    return groups
  }, [filtered])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`px-4 py-3 border-b transition-colors duration-500 ${highlight ? "bg-primary/10" : ""}`}>
        <h3 className="text-sm font-semibold mb-2">
          Policy Gallery
          {phaseFilter && (
            <span className={`ml-1.5 text-xs font-normal capitalize transition-colors duration-500 ${highlight ? "text-primary" : "text-muted-foreground"}`}>
              ({phaseFilter})
            </span>
          )}
        </h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search policies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Category filter chips */}
      {(() => {
        const visibleCats = PLUGIN_CATEGORIES.filter(
          (c) => !excludeCategories.includes(c.value)
        )
        const inlineChips = visibleCats.slice(0, 2)
        const moreChips = visibleCats.slice(2)
        return (
          <div className="px-4 py-2 border-b flex items-center gap-1">
            <button
              onClick={() => setActiveCategory("all")}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors shrink-0 ${
                activeCategory === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent border-border hover:border-primary/40"
              }`}
            >
              All
            </button>
            {inlineChips.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors shrink-0 ${
                  activeCategory === cat.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent border-border hover:border-primary/40"
                }`}
              >
                {cat.label.split(" ")[0]}
              </button>
            ))}
            {moreChips.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors shrink-0 flex items-center gap-0.5 ${
                      moreChips.some((c) => c.value === activeCategory)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-transparent border-border hover:border-primary/40"
                    }`}
                  >
                    {moreChips.find((c) => c.value === activeCategory)?.label.split(" ")[0] || "More"}
                    <ChevronDown className="h-2.5 w-2.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[140px]">
                  {moreChips.map((cat) => {
                    const CatIcon = CATEGORY_ICONS[cat.value] || Puzzle
                    return (
                      <DropdownMenuItem
                        key={cat.value}
                        onClick={() => setActiveCategory(cat.value)}
                        className="text-xs gap-2"
                      >
                        <CatIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                        {cat.label}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )
      })()}

      {/* Plugin list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 py-2">
          {loading && (
            <div className="flex items-center justify-center py-6 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Loading plugins...</span>
            </div>
          )}
          {!loading && grouped.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              No policies match your search
            </p>
          )}
          {!loading && grouped.length > 0 && (
            <TooltipProvider delayDuration={400}>
              <Accordion type="single" collapsible>
                {grouped.map((group) => (
                  <AccordionItem key={group.category} value={group.category} className="border-b-0">
                    <AccordionTrigger className="py-2 hover:no-underline">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const CatIcon = CATEGORY_ICONS[group.category] || Puzzle
                          return <CatIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        })()}
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ({group.plugins.length})
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-1.5 pb-1">
                        {group.plugins.map((plugin) => (
                          <PluginCard
                            key={plugin.name}
                            plugin={plugin}
                            onAdd={() => onAddPolicy(plugin.name)}
                            isAdded={existingPolicies.includes(plugin.name)}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  )
}
