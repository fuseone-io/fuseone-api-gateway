"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { FileJson, ExternalLink, Info, X, Save, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/lib/api-client"
import type { APISIXPluginConfig } from "@/types/apisix"
import type { PolicyInstance } from "@/types/api"

interface PolicyTemplateSelectorProps {
  selectedTemplateId?: string
  selectedTemplateName?: string
  onSelect: (id: string, name: string, plugins: Record<string, unknown>) => void
  onClear: () => void
  readOnly?: boolean
  currentPolicies?: PolicyInstance[]
}

interface TemplateOption {
  id: string
  name: string
  pluginCount: number
  pluginNames: string[]
  plugins: Record<string, unknown>
}

export function PolicyTemplateSelector({
  selectedTemplateId,
  selectedTemplateName,
  onSelect,
  onClear,
  readOnly = false,
  currentPolicies = [],
}: PolicyTemplateSelectorProps) {
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [saving, setSaving] = useState(false)

  const fetchTemplates = () => {
    api
      .listResource("plugin-configs")
      .then((data) => {
        const items = (data?.list || []).map((node) => {
          const tpl = node.value as APISIXPluginConfig
          const plugins = (tpl.plugins || {}) as Record<string, unknown>
          return {
            id: tpl.id!,
            name: tpl.desc || `Template ${tpl.id}`,
            pluginCount: Object.keys(plugins).length,
            pluginNames: Object.keys(plugins),
            plugins,
          }
        })
        setTemplates(items)
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const selectedTemplate = selectedTemplateId
    ? templates.find((t) => t.id === selectedTemplateId)
    : null

  const displayName = selectedTemplate?.name || selectedTemplateName || selectedTemplateId

  // Build plugins map from current flow policies (only enabled ones)
  const enabledPolicies = currentPolicies.filter((p) => p.enabled)

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Name is required")
      return
    }
    if (enabledPolicies.length === 0) {
      toast.error("No enabled policies to save")
      return
    }

    const plugins: Record<string, unknown> = {}
    for (const p of enabledPolicies) {
      plugins[p.name] = p.config
    }

    setSaving(true)
    try {
      const generatedId = String(Date.now())
      await api.createResource("plugin-configs", {
        id: generatedId,
        desc: templateName.trim(),
        plugins,
      })
      toast.success("Policy template created")
      setSaveDialogOpen(false)
      setTemplateName("")
      // Refresh templates list and select the new one
      fetchTemplates()
      onSelect(generatedId, templateName.trim(), plugins)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create template")
    } finally {
      setSaving(false)
    }
  }

  if (loading && !selectedTemplateId) return null

  return (
    <>
      <div className="rounded-lg border border-dashed border-purple-500/30 bg-purple-500/5 px-3 py-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <FileJson className="h-4 w-4 text-purple-500 shrink-0" />
          <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
            Policy Template
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">
                  Template policies are merged with this flow&apos;s policies. If both define the same
                  plugin, the flow&apos;s version takes precedence.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex-1" />
          {selectedTemplateId && !readOnly && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs text-muted-foreground"
              onClick={onClear}
            >
              <X className="h-3 w-3 mr-1" />
              Remove
            </Button>
          )}
        </div>

        {readOnly ? (
          selectedTemplateId ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{displayName}</span>
              {selectedTemplate && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {selectedTemplate.pluginCount} plugin{selectedTemplate.pluginCount !== 1 ? "s" : ""}
                </Badge>
              )}
              <Link
                href={`/plugin-configs/${selectedTemplateId}`}
                className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
              >
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No template applied</p>
          )
        ) : (
          <div className="flex items-center gap-2">
            <Select
              value={selectedTemplateId || "none"}
              onValueChange={(value) => {
                if (value === "none") {
                  onClear()
                } else {
                  const tpl = templates.find((t) => t.id === value)
                  if (tpl) {
                    onSelect(tpl.id, tpl.name, tpl.plugins)
                  }
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    <span className="flex items-center gap-2">
                      {tpl.name}
                      <span className="text-muted-foreground">
                        ({tpl.pluginCount} plugin{tpl.pluginCount !== 1 ? "s" : ""})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplateId && (
              <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
                <Link href={`/plugin-configs/${selectedTemplateId}`}>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>
        )}

        {/* Show inherited plugin names */}
        {selectedTemplate && selectedTemplate.pluginNames.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedTemplate.pluginNames.map((name) => (
              <Badge
                key={name}
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-dashed border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/5"
              >
                {name}
              </Badge>
            ))}
          </div>
        )}

        {/* Save current policies as template */}
        {!readOnly && enabledPolicies.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-700 hover:bg-purple-500/10 w-full"
            onClick={() => {
              setTemplateName("")
              setSaveDialogOpen(true)
            }}
          >
            <Save className="h-3 w-3 mr-1.5" />
            Save current policies as template ({enabledPolicies.length})
          </Button>
        )}
      </div>

      {/* Save as Template Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as Policy Template</DialogTitle>
            <DialogDescription>
              Create a reusable template from this flow&apos;s {enabledPolicies.length} enabled{" "}
              {enabledPolicies.length === 1 ? "policy" : "policies"}. The template can be applied to other flows.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Template Name</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Auth + Rate Limit"
                onKeyDown={(e) => e.key === "Enter" && handleSaveAsTemplate()}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Policies to include</Label>
              <div className="flex flex-wrap gap-1">
                {enabledPolicies.map((p) => (
                  <Badge key={p.id} variant="secondary" className="text-xs">
                    {p.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAsTemplate}
              disabled={saving || !templateName.trim()}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
