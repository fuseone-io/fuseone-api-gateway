"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
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
import { PLUGINS, getCategoryMeta } from "@/lib/constants"
import { PLUGIN_FORM_REGISTRY } from "@/lib/plugin-forms"
import { PluginFormRenderer } from "@/components/flow/plugin-form-renderer"
import { PolicyGallery } from "@/components/flow/policy-gallery"
import { api } from "@/lib/api-client"

export default function NewPlanPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [plugins, setPlugins] = useState<Record<string, Record<string, unknown>>>({})
  const [showPicker, setShowPicker] = useState(false)
  const [editingPlugin, setEditingPlugin] = useState<string | null>(null)
  const [editingConfig, setEditingConfig] = useState<Record<string, unknown>>({})
  const [jsonFallback, setJsonFallback] = useState("")

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Plan name is required")
      return
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name.trim())) {
      toast.error("Plan name must contain only letters, numbers, hyphens and underscores")
      return
    }
    setSaving(true)
    try {
      await api.createResource("consumer-groups", {
        id: name.trim(),
        desc: description,
        plugins: Object.keys(plugins).length > 0 ? plugins : undefined,
      })
      toast.success("Plan created")
      router.push(`/plans/${name.trim()}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create plan")
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Plan"
        description="Define shared policies and rate limits"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/plans")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Creating..." : "Create Plan"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 max-w-2xl">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>Basic plan information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="free-tier"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier. Use lowercase with hyphens (e.g., free-tier, pro-plan).
              </p>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Free tier with basic rate limits"
              />
            </div>
          </CardContent>
        </Card>

        {/* Policies */}
        <Card>
          <CardHeader>
            <CardTitle>Policies</CardTitle>
            <CardDescription>
              Plugins applied to all applications in this plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.keys(plugins).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No policies configured. Add rate limits, IP restrictions, or other plugins.
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
                          const formDef = PLUGIN_FORM_REGISTRY[pluginName]
                          if (!formDef) {
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
