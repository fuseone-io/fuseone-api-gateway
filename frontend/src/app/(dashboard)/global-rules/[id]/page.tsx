"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PageHeader } from "@/components/page-header"
import { PLUGINS, getCategoryMeta, GLOBAL_POLICY_EXCLUDED_PLUGINS } from "@/lib/constants"
import { PLUGIN_FORM_REGISTRY } from "@/lib/plugin-forms"
import { PluginFormRenderer } from "@/components/flow/plugin-form-renderer"
import { PolicyGallery } from "@/components/flow/policy-gallery"
import { api } from "@/lib/api-client"
import type { APISIXGlobalRule } from "@/types/apisix"

export default function GlobalPolicyDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [rule, setRule] = useState<APISIXGlobalRule | null>(null)
  const [plugins, setPlugins] = useState<Record<string, Record<string, unknown>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [editingPlugin, setEditingPlugin] = useState<string | null>(null)
  const [editingConfig, setEditingConfig] = useState<Record<string, unknown>>({})
  const [jsonFallback, setJsonFallback] = useState("")

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const data = (await api.getResource("global-rules", id)) as APISIXGlobalRule
      setRule(data)
      setPlugins((data.plugins || {}) as Record<string, Record<string, unknown>>)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load global policy")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (Object.keys(plugins).length === 0) {
      toast.error("Add at least one policy")
      return
    }
    setSaving(true)
    try {
      await api.updateResource("global-rules", id, { plugins })
      toast.success("Global policy saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save global policy")
    } finally {
      setSaving(false)
    }
  }

  const handleAddPolicy = (pluginName: string) => {
    setShowPicker(false)
    setEditingPlugin(pluginName)
    setEditingConfig(plugins[pluginName] || {})
    if (!PLUGIN_FORM_REGISTRY[pluginName]) {
      setJsonFallback(JSON.stringify(plugins[pluginName] || {}, null, 2))
    }
  }

  const handleSavePlugin = () => {
    if (!editingPlugin) return
    const formDef = PLUGIN_FORM_REGISTRY[editingPlugin]
    let config: Record<string, unknown>
    if (formDef) {
      config = editingConfig
    } else {
      try {
        config = JSON.parse(jsonFallback || "{}")
      } catch {
        toast.error("Invalid JSON")
        return
      }
    }
    setPlugins({ ...plugins, [editingPlugin]: config })
    setEditingPlugin(null)
  }

  const handleRemovePlugin = (pluginName: string) => {
    const next = { ...plugins }
    delete next[pluginName]
    setPlugins(next)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[200px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    )
  }

  if (!rule) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-lg font-medium text-muted-foreground">Global policy not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/global-rules")}>
          Back to Global Policies
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Global Policy: ${id}`}
        description="Edit policies applied globally to all API traffic"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/global-rules")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 max-w-2xl">
        {/* Policies */}
        <Card>
          <CardHeader>
            <CardTitle>Policies</CardTitle>
            <CardDescription>
              These policies are applied to all API requests globally
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.keys(plugins).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No policies configured.
              </p>
            ) : (
              Object.entries(plugins).map(([pluginName, config]) => {
                const def = PLUGINS.find((p) => p.name === pluginName)
                const cat = def ? getCategoryMeta(def.category) : null
                return (
                  <div
                    key={pluginName}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      {cat && (
                        <div className={`h-2 w-2 rounded-full ${cat.color}`} />
                      )}
                      <div>
                        <p className="text-sm font-medium">{def?.label || pluginName}</p>
                        <p className="text-xs text-muted-foreground">{def?.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingPlugin(pluginName)
                          setEditingConfig(config)
                          if (!PLUGIN_FORM_REGISTRY[pluginName]) {
                            setJsonFallback(JSON.stringify(config, null, 2))
                          }
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemovePlugin(pluginName)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPicker(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Policy
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Policy Picker Sheet */}
      <Sheet open={showPicker} onOpenChange={setShowPicker}>
        <SheetContent side="right" className="p-0 sm:max-w-sm">
          <SheetTitle className="sr-only">Add Policy</SheetTitle>
          <PolicyGallery
            onAddPolicy={handleAddPolicy}
            existingPolicies={Object.keys(plugins)}
            excludePlugins={[...GLOBAL_POLICY_EXCLUDED_PLUGINS]}
            excludeCategories={["authentication", "other"]}
          />
        </SheetContent>
      </Sheet>

      {/* Policy Config Editor */}
      <Dialog open={!!editingPlugin} onOpenChange={() => setEditingPlugin(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Configure {PLUGINS.find((p) => p.name === editingPlugin)?.label || editingPlugin}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {editingPlugin && PLUGIN_FORM_REGISTRY[editingPlugin] ? (
              <PluginFormRenderer
                formDef={PLUGIN_FORM_REGISTRY[editingPlugin]}
                config={editingConfig}
                onChange={setEditingConfig}
                readOnly={false}
              />
            ) : (
              <div className="space-y-2">
                <Label>Configuration (JSON)</Label>
                <Textarea
                  value={jsonFallback}
                  onChange={(e) => setJsonFallback(e.target.value)}
                  className="font-mono text-sm min-h-[200px]"
                  placeholder="{}"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlugin(null)}>
              Cancel
            </Button>
            <Button onClick={handleSavePlugin}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
