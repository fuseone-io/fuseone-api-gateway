"use client"

import { useState, useEffect, useRef } from "react"
import {
  X,
  CircleDot,
  type LucideIcon,
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getPluginDef, getCategoryMeta } from "@/lib/constants"
import { PLUGIN_FORM_REGISTRY, type PluginFormDef } from "@/lib/plugin-forms"
import { PluginFormRenderer } from "./plugin-form-renderer"
import { jsonSchemaToFormDef } from "./schema-to-form"
import { api } from "@/lib/api-client"
import type { PolicyInstance } from "@/types/api"

// --- Icon map (same as policy-gallery) ---

const ICON_MAP: Record<string, LucideIcon> = {
  Key, Lock, ShieldCheck, Fingerprint, KeyRound, ArrowRightLeft,
  Shield, Ban, Globe, ShieldAlert, UserX, Gauge, Users, Hash,
  GitBranch, Database, Replace, FileOutput, ArrowLeftRight, Bug,
  ExternalLink, BarChart3, Send, Radio, FileText, Network, Activity,
}

function getIcon(iconName?: string): LucideIcon {
  return (iconName && ICON_MAP[iconName]) || CircleDot
}

// --- Category badge colors ---

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "bg-blue-500": { bg: "bg-blue-500/15", text: "text-blue-500" },
  "bg-red-500": { bg: "bg-red-500/15", text: "text-red-500" },
  "bg-amber-500": { bg: "bg-amber-500/15", text: "text-amber-500" },
  "bg-purple-500": { bg: "bg-purple-500/15", text: "text-purple-500" },
  "bg-green-500": { bg: "bg-green-500/15", text: "text-green-500" },
}

// --- Schema cache ---

const schemaCache = new Map<string, PluginFormDef | null>()

// --- Component ---

interface PluginConfigPanelProps {
  policy: PolicyInstance
  onUpdateConfig: (config: Record<string, unknown>) => void
  readOnly: boolean
  onClose: () => void
}

export function PluginConfigPanel({
  policy,
  onUpdateConfig,
  readOnly,
  onClose,
}: PluginConfigPanelProps) {
  const def = getPluginDef(policy.name)
  const catMeta = def ? getCategoryMeta(def.category) : null
  const colors = CATEGORY_COLORS[catMeta?.color || "bg-blue-500"] || CATEGORY_COLORS["bg-blue-500"]
  const IconComp = getIcon(def?.icon)

  // 3-tier form resolution
  const customForm = PLUGIN_FORM_REGISTRY[policy.name] ?? null
  const [schemaForm, setSchemaForm] = useState<PluginFormDef | null>(null)
  const [schemaLoading, setSchemaLoading] = useState(false)

  // JSON tab state
  const [jsonStr, setJsonStr] = useState(JSON.stringify(policy.config, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)

  // Track which policy we're viewing (reset JSON when policy changes)
  const prevPolicyRef = useRef(policy.id)
  useEffect(() => {
    if (prevPolicyRef.current !== policy.id) {
      prevPolicyRef.current = policy.id
      setJsonStr(JSON.stringify(policy.config, null, 2))
      setJsonError(null)
    }
  }, [policy.id, policy.config])

  // Fetch schema for auto-generation when no custom form exists
  useEffect(() => {
    if (customForm) return

    if (schemaCache.has(policy.name)) {
      setSchemaForm(schemaCache.get(policy.name) ?? null)
      return
    }

    setSchemaLoading(true)
    api
      .getPluginSchema(policy.name)
      .then((data) => {
        const formDef = jsonSchemaToFormDef(policy.name, data)
        schemaCache.set(policy.name, formDef)
        setSchemaForm(formDef)
      })
      .catch(() => {
        schemaCache.set(policy.name, null)
        setSchemaForm(null)
      })
      .finally(() => setSchemaLoading(false))
  }, [policy.name, customForm])

  const formDef = customForm || schemaForm
  const hasForm = formDef && formDef.groups.some((g) => g.fields.length > 0)

  // Handle JSON editing
  const handleJsonChange = (value: string) => {
    setJsonStr(value)
    try {
      const parsed = JSON.parse(value)
      setJsonError(null)
      onUpdateConfig(parsed)
    } catch {
      setJsonError("Invalid JSON")
    }
  }

  // Sync JSON string when config changes from form
  const handleFormChange = (config: Record<string, unknown>) => {
    onUpdateConfig(config)
    setJsonStr(JSON.stringify(config, null, 2))
    setJsonError(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colors.bg}`}>
          <IconComp className={`h-4 w-4 ${colors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">{def?.label || policy.name}</h3>
          <p className="text-[10px] text-muted-foreground truncate">{def?.description}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <Badge variant="outline" className="text-[10px] capitalize">{policy.phase}</Badge>
        <Badge variant={policy.enabled ? "default" : "secondary"} className="text-[10px]">
          {policy.enabled ? "enabled" : "disabled"}
        </Badge>
      </div>

      {/* Loading state */}
      {schemaLoading && !customForm && (
        <div className="p-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-full" />
        </div>
      )}

      {/* Content with Form/JSON tabs */}
      {!schemaLoading && (
        <>
          {hasForm ? (
            <Tabs defaultValue="form" className="flex-1 min-h-0 flex flex-col">
              <TabsList className="mx-4 mt-2 shrink-0">
                <TabsTrigger value="form" className="text-xs">Form</TabsTrigger>
                <TabsTrigger value="json" className="text-xs">JSON</TabsTrigger>
              </TabsList>
              <TabsContent value="form" className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="p-4">
                    <PluginFormRenderer
                      formDef={formDef!}
                      config={policy.config}
                      onChange={handleFormChange}
                      readOnly={readOnly}
                    />
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="json" className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-2">
                    <JsonEditor
                      value={jsonStr}
                      onChange={handleJsonChange}
                      error={jsonError}
                      readOnly={readOnly}
                    />
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          ) : (
            // No form available — JSON only
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                <JsonEditor
                  value={jsonStr}
                  onChange={handleJsonChange}
                  error={jsonError}
                  readOnly={readOnly}
                />
              </div>
            </ScrollArea>
          )}
        </>
      )}
    </div>
  )
}

// --- JSON Editor (shared by both modes) ---

function JsonEditor({
  value,
  onChange,
  error,
  readOnly,
}: {
  value: string
  onChange: (value: string) => void
  error: string | null
  readOnly: boolean
}) {
  return (
    <>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly}
        rows={14}
        className="w-full rounded-md border bg-muted/50 p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none"
        spellCheck={false}
      />
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <p className="text-[10px] text-muted-foreground">
        Configure the plugin using JSON format.
      </p>
    </>
  )
}
