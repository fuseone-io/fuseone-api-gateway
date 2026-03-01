"use client"

import { useEffect, useState, useMemo } from "react"
import { toast } from "sonner"
import {
  Search,
  Puzzle,
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
  CircleDot,
  Loader2,
  Info,
  CheckCircle2,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { api } from "@/lib/api-client"
import { PageHeader } from "@/components/page-header"
import {
  PLUGINS,
  PLUGIN_CATEGORIES,
  type PluginCategory,
  type PluginDefinition,
} from "@/lib/constants"
import { PLUGIN_DOCS } from "@/lib/plugin-docs"

// --- Icon map ---

const ICON_MAP: Record<string, LucideIcon> = {
  Key, Lock, ShieldCheck, Fingerprint, KeyRound, ArrowRightLeft,
  Shield, Ban, Globe, ShieldAlert, UserX, Gauge, Users, Hash,
  GitBranch, Database, Replace, FileOutput, ArrowLeftRight, Bug,
  ExternalLink, BarChart3, Send, Radio, FileText, Network, Activity,
}

function getIcon(iconName?: string): LucideIcon {
  if (!iconName) return CircleDot
  return ICON_MAP[iconName] || CircleDot
}

// --- Extended plugin descriptions (covers all APISIX plugins beyond our 26) ---

const EXTRA_DESCRIPTIONS: Record<string, string> = {
  "authz-keycloak": "Authorization with Keycloak",
  "authz-casbin": "Authorization with Casbin",
  "wolf-rbac": "Role-based access control with Wolf",
  "ua-restriction": "Restrict access by User-Agent",
  "referer-restriction": "Restrict access by Referer header",
  "grpc-web": "Support gRPC-Web protocol",
  "echo": "Echo request back as response",
  "serverless-pre-function": "Run serverless functions before proxying",
  "serverless-post-function": "Run serverless functions after proxying",
  "batch-requests": "Batch multiple requests into one",
  "proxy-mirror": "Mirror traffic to another upstream",
  "skywalking": "Distributed tracing with SkyWalking",
  "datadog": "Send metrics to Datadog",
  "node-status": "Expose node status information",
  "tcp-logger": "Log requests to TCP endpoint",
  "udp-logger": "Log requests to UDP endpoint",
  "rocketmq-logger": "Log requests to RocketMQ",
  "file-logger": "Log requests to file",
  "sls-logger": "Log requests to Alibaba Cloud SLS",
  "google-cloud-logging": "Log requests to Google Cloud Logging",
  "loggly": "Log requests to Loggly",
  "splunk-hec-logging": "Log requests to Splunk HEC",
  "elasticsearch-logger": "Log requests to Elasticsearch",
  "clickhouse-logger": "Log requests to ClickHouse",
  "real-ip": "Dynamically determine client real IP",
  "ext-plugin-pre-req": "External plugin before request",
  "ext-plugin-post-req": "External plugin after request",
  "ext-plugin-post-resp": "External plugin after response",
  "gzip": "Compress responses with gzip",
  "api-breaker": "Circuit breaker for upstream protection",
  "mocking": "Mock API responses",
  "client-control": "Control client request behavior",
  "proxy-control": "Control proxy behavior",
  "workflow": "Complex condition-based workflow",
}

// --- Category classification for plugins not in our constants ---

function classifyPlugin(name: string): PluginCategory | null {
  if (name.includes("auth") || name.includes("rbac") || name === "openid-connect") return "authentication"
  if (name.includes("restriction") || name === "cors" || name === "csrf" || name === "uri-blocker") return "security"
  if (name.includes("limit") || name.includes("traffic") || name.includes("cache") || name === "request-id" || name === "api-breaker" || name === "proxy-mirror" || name === "client-control" || name === "proxy-control") return "traffic"
  if (name.includes("rewrite") || name.includes("redirect") || name.includes("transcode") || name.includes("grpc") || name === "fault-injection" || name === "echo" || name === "mocking" || name.includes("serverless") || name === "batch-requests" || name === "workflow" || name === "gzip" || name === "real-ip") return "transformation"
  if (name.includes("logger") || name.includes("log") || name === "prometheus" || name === "datadog" || name === "zipkin" || name === "skywalking" || name === "opentelemetry" || name === "node-status") return "observability"
  return null
}

// --- Category badge styles ---

const CATEGORY_BADGE_STYLES: Record<PluginCategory, { bg: string; text: string; border: string }> = {
  authentication: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20" },
  security: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/20" },
  traffic: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20" },
  transformation: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/20" },
  observability: { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", border: "border-green-500/20" },
  ai: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/20" },
}

const PHASE_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  request: { bg: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400" },
  response: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400" },
  observability: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
}

// --- Enriched plugin type ---

interface EnrichedPlugin {
  name: string
  label: string
  description: string
  category: PluginCategory | null
  phase: string | null
  icon: string | null
  isManaged: boolean // exists in our PLUGINS constant
}

function enrichPlugin(name: string): EnrichedPlugin {
  const def = PLUGINS.find((p) => p.name === name)
  if (def) {
    return {
      name: def.name,
      label: def.label,
      description: def.description,
      category: def.category,
      phase: def.phase,
      icon: def.icon,
      isManaged: true,
    }
  }
  return {
    name,
    label: name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
    description: EXTRA_DESCRIPTIONS[name] || "API Gateway plugin",
    category: classifyPlugin(name),
    phase: null,
    icon: null,
    isManaged: false,
  }
}

// --- Constants ---

const ITEMS_PER_PAGE = 20

// --- Main Component ---

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<PluginCategory | "all">("all")
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const [detailPlugin, setDetailPlugin] = useState<string | null>(null)

  const detailData = useMemo(() => {
    if (!detailPlugin) return null
    return enrichPlugin(detailPlugin)
  }, [detailPlugin, plugins])

  useEffect(() => {
    api
      .listPlugins()
      .then((data) => {
        if (Array.isArray(data)) {
          setPlugins(data as string[])
        } else {
          setPlugins([])
        }
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Enrich all plugins
  const enriched = useMemo(() => plugins.map(enrichPlugin), [plugins])

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: enriched.length }
    for (const cat of PLUGIN_CATEGORIES) {
      counts[cat.value] = enriched.filter((p) => p.category === cat.value).length
    }
    counts["other"] = enriched.filter((p) => p.category === null).length
    return counts
  }, [enriched])

  // Filter
  const filtered = useMemo(() => {
    return enriched.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.label.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase())
      const matchesCategory =
        activeCategory === "all" || p.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [enriched, search, activeCategory])

  // Visible items (load more pattern)
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])
  const hasMore = visibleCount < filtered.length

  // Reset visible count when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setVisibleCount(ITEMS_PER_PAGE)
  }

  const handleCategoryChange = (cat: PluginCategory | "all") => {
    setActiveCategory(cat)
    setVisibleCount(ITEMS_PER_PAGE)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Policy Catalog"
        description="Discover available policies for your API Gateway."
      />

      {/* Search bar — full width */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, category, or description..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Category filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterChip
          label="All Plugins"
          count={categoryCounts.all}
          active={activeCategory === "all"}
          onClick={() => handleCategoryChange("all")}
        />
        {PLUGIN_CATEGORIES.map((cat) => (
          <FilterChip
            key={cat.value}
            label={cat.label}
            count={categoryCounts[cat.value] || 0}
            active={activeCategory === cat.value}
            color={cat.color}
            onClick={() => handleCategoryChange(cat.value)}
          />
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="px-4 py-3.5">
              <div className="flex items-start gap-3 mb-2">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex items-center gap-2 mt-3">
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Puzzle className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">No plugins found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search
                ? "Try adjusting your search or clearing the filters."
                : "No plugins are currently available."}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Results count */}
          <p className="text-sm text-muted-foreground">
            Showing {visible.length} of {filtered.length} plugins
          </p>

          {/* Cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <TooltipProvider delayDuration={300}>
              {visible.map((plugin) => (
                <PluginCard
                  key={plugin.name}
                  plugin={plugin}
                  onDetail={() => setDetailPlugin(plugin.name)}
                />
              ))}
            </TooltipProvider>
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="flex flex-col items-center gap-2 pt-4">
              <Button
                variant="outline"
                className="px-8"
                onClick={() => setVisibleCount((v) => v + ITEMS_PER_PAGE)}
              >
                <Loader2 className="h-4 w-4 mr-2" />
                Load more plugins
              </Button>
              <p className="text-xs text-muted-foreground">
                {filtered.length - visibleCount} remaining
              </p>
            </div>
          )}
        </>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!detailPlugin} onOpenChange={() => setDetailPlugin(null)}>
        <SheetContent side="right" className="overflow-y-auto" style={{ maxWidth: "36rem" }}>
          <SheetTitle className="sr-only">Policy Details</SheetTitle>
          {detailData && (
            <PluginDetailSheet
              plugin={detailData}
              onNavigate={(name) => setDetailPlugin(name)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// --- Plugin Detail Sheet ---

function PluginDetailSheet({
  plugin,
  onNavigate,
}: {
  plugin: EnrichedPlugin
  onNavigate: (name: string) => void
}) {
  const IconComp = getIcon(plugin.icon ?? undefined)
  const catStyle = plugin.category ? CATEGORY_BADGE_STYLES[plugin.category] : null
  const phaseStyle = plugin.phase ? PHASE_BADGE_STYLES[plugin.phase] : null
  const catMeta = plugin.category
    ? PLUGIN_CATEGORIES.find((c) => c.value === plugin.category)
    : null
  const doc = PLUGIN_DOCS[plugin.name]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            catStyle ? catStyle.bg : "bg-muted"
          }`}
        >
          <IconComp className={`h-5 w-5 ${catStyle ? catStyle.text : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold">{plugin.label}</h2>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {catMeta && (
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 font-semibold uppercase tracking-wider border ${catStyle?.border} ${catStyle?.bg} ${catStyle?.text}`}
              >
                {catMeta.label}
              </Badge>
            )}
            {phaseStyle && plugin.phase && (
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 font-semibold uppercase tracking-wider ${phaseStyle.bg} ${phaseStyle.text} border-transparent`}
              >
                {plugin.phase}
              </Badge>
            )}
            {plugin.isManaged && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Managed
              </Badge>
            )}
          </div>
        </div>
      </div>

      {doc ? (
        <>
          {/* Overview */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Overview</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {doc.overview}
            </p>
          </div>

          {/* Use Cases */}
          {doc.useCases.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Common Use Cases</h3>
              <ul className="space-y-1.5">
                {doc.useCases.map((uc, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary mt-0.5 shrink-0">•</span>
                    {uc}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Configuration Examples */}
          {doc.examples.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Configuration Examples</h3>
              {doc.examples.map((ex, i) => (
                <div key={i} className="space-y-1.5">
                  <p className="text-sm font-medium">{ex.title}</p>
                  <p className="text-xs text-muted-foreground">{ex.description}</p>
                  <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto font-mono">
                    {JSON.stringify(ex.config, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {/* Best Practices */}
          {doc.bestPractices.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Best Practices</h3>
              <ul className="space-y-1.5">
                {doc.bestPractices.map((bp, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                    {bp}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cautions */}
          {doc.cautions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Cautions</h3>
              <ul className="space-y-1.5">
                {doc.cautions.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Related Plugins */}
          {doc.relatedPlugins && doc.relatedPlugins.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Related Policies</h3>
              <div className="flex flex-wrap gap-1.5">
                {doc.relatedPlugins.map((name) => {
                  const related = PLUGINS.find((p) => p.name === name)
                  return (
                    <Badge
                      key={name}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => onNavigate(name)}
                    >
                      {related?.label || name}
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Overview</h3>
          <p className="text-sm text-muted-foreground">{plugin.description}</p>
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 mt-4">
            <Info className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              Detailed documentation for this policy will be available in a future update.
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-4 border-t">
        <code className="text-xs text-muted-foreground font-mono">{plugin.name}</code>
      </div>
    </div>
  )
}

// --- Filter Chip ---

function FilterChip({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  color?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-card text-foreground border-border hover:border-primary/40 hover:shadow-sm"
      }`}
    >
      {color && !active && (
        <span className={`h-2 w-2 rounded-full ${color} shrink-0`} />
      )}
      {label}
      <span
        className={`inline-flex items-center justify-center rounded-full px-1.5 text-xs font-semibold min-w-[1.25rem] ${
          active
            ? "bg-primary-foreground/20 text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </button>
  )
}

// --- Plugin Card ---

function PluginCard({ plugin, onDetail }: { plugin: EnrichedPlugin; onDetail: () => void }) {
  const IconComp = getIcon(plugin.icon ?? undefined)
  const catStyle = plugin.category ? CATEGORY_BADGE_STYLES[plugin.category] : null
  const phaseStyle = plugin.phase ? PHASE_BADGE_STYLES[plugin.phase] : null
  const catMeta = plugin.category
    ? PLUGIN_CATEGORIES.find((c) => c.value === plugin.category)
    : null

  return (
    <Card className="group relative flex flex-col px-4 py-3.5 hover:border-primary/40 hover:shadow-md transition-all">
      {/* Top row: icon + badges */}
      <div className="flex items-start justify-between mb-2">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            catStyle ? catStyle.bg : "bg-muted"
          }`}
        >
          <IconComp className={`h-4 w-4 ${catStyle ? catStyle.text : "text-muted-foreground"}`} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {catMeta && (
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 font-semibold uppercase tracking-wider border ${catStyle?.border} ${catStyle?.bg} ${catStyle?.text}`}
            >
              {catMeta.label}
            </Badge>
          )}
          {phaseStyle && plugin.phase && (
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 font-semibold uppercase tracking-wider ${phaseStyle.bg} ${phaseStyle.text} border-transparent`}
            >
              {plugin.phase}
            </Badge>
          )}
        </div>
      </div>

      {/* Name */}
      <h3 className="text-sm font-semibold leading-tight mb-1">{plugin.label}</h3>

      {/* Description */}
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
            {plugin.description}
          </p>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {plugin.description}
        </TooltipContent>
      </Tooltip>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t -mx-4 px-4 -mb-3.5 pb-2.5 bg-muted/40 rounded-b-xl">
        <code className="text-[10px] text-muted-foreground font-mono">{plugin.name}</code>
        <div className="flex items-center gap-1">
          {plugin.isManaged && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
              Managed
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onDetail}
          >
            Details
          </Button>
        </div>
      </div>
    </Card>
  )
}

