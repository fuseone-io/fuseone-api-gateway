"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  Copy,
  Eye,
  EyeOff,
  Key,
  Lock,
  Plus,
  Save,
  ShieldCheck,
  Fingerprint,
  Shuffle,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { PageHeader } from "@/components/page-header"
import { PLUGINS, getCategoryMeta, AUTH_PLUGINS } from "@/lib/constants"
import { PLUGIN_FORM_REGISTRY } from "@/lib/plugin-forms"
import { PluginFormRenderer } from "@/components/flow/plugin-form-renderer"
import { PolicyGallery } from "@/components/flow/policy-gallery"
import { api } from "@/lib/api-client"
import type { APISIXConsumer, APISIXConsumerGroup } from "@/types/apisix"

type AuthMethod = (typeof AUTH_PLUGINS)[number]

const AUTH_LABELS: Record<AuthMethod, { label: string; icon: typeof Key }> = {
  "key-auth": { label: "API Key", icon: Key },
  "basic-auth": { label: "Basic Auth", icon: Lock },
  "jwt-auth": { label: "JWT", icon: ShieldCheck },
  "hmac-auth": { label: "HMAC", icon: Fingerprint },
}

function getAuthMethod(plugins?: Record<string, unknown>): AuthMethod | null {
  if (!plugins) return null
  return AUTH_PLUGINS.find((p) => plugins[p]) || null
}

function getNonAuthPlugins(
  plugins?: Record<string, unknown>
): Record<string, Record<string, unknown>> {
  if (!plugins) return {}
  const result: Record<string, Record<string, unknown>> = {}
  for (const [key, value] of Object.entries(plugins)) {
    if (!AUTH_PLUGINS.includes(key as AuthMethod)) {
      result[key] = value as Record<string, unknown>
    }
  }
  return result
}

function generateApiKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export default function ApplicationDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [consumer, setConsumer] = useState<APISIXConsumer | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [description, setDescription] = useState("")
  const [planId, setPlanId] = useState("")
  const [plans, setPlans] = useState<APISIXConsumerGroup[]>([])
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null)
  const [authConfig, setAuthConfig] = useState<Record<string, unknown>>({})
  const [showCredentials, setShowCredentials] = useState(false)
  const [policyPlugins, setPolicyPlugins] = useState<Record<string, Record<string, unknown>>>({})
  const [showPicker, setShowPicker] = useState(false)
  const [editingPlugin, setEditingPlugin] = useState<string | null>(null)
  const [editingConfig, setEditingConfig] = useState<Record<string, unknown>>({})
  const [jsonFallback, setJsonFallback] = useState("")
  const [showPolicies, setShowPolicies] = useState(false)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [consumerRes, plansRes] = await Promise.all([
        api.getResource("consumers", id),
        api.listResource("consumer-groups"),
      ])
      const data = consumerRes as APISIXConsumer
      setConsumer(data)
      setDescription(data.desc || "")
      setPlanId(data.group_id || "")

      const auth = getAuthMethod(data.plugins)
      setAuthMethod(auth)
      if (auth && data.plugins) {
        setAuthConfig((data.plugins[auth] || {}) as Record<string, unknown>)
      }

      setPolicyPlugins(getNonAuthPlugins(data.plugins))

      const groups = (plansRes?.list || []).map(
        (n) => n.value as APISIXConsumerGroup
      )
      setPlans(groups)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load application")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const plugins: Record<string, unknown> = { ...policyPlugins }
      if (authMethod) {
        plugins[authMethod] = authConfig
      }

      await api.updateResource("consumers", id, {
        desc: description || undefined,
        group_id: planId && planId !== "none" ? planId : undefined,
        plugins: Object.keys(plugins).length > 0 ? plugins : undefined,
      })
      toast.success("Application saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save application")
    } finally {
      setSaving(false)
    }
  }

  const handleAddPolicy = (pluginName: string) => {
    setShowPicker(false)
    setEditingPlugin(pluginName)
    setEditingConfig(policyPlugins[pluginName] || {})
    if (!PLUGIN_FORM_REGISTRY[pluginName]) {
      setJsonFallback(JSON.stringify(policyPlugins[pluginName] || {}, null, 2))
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
    setPolicyPlugins({ ...policyPlugins, [editingPlugin]: config })
    setEditingPlugin(null)
  }

  const handleRemovePlugin = (pluginName: string) => {
    const next = { ...policyPlugins }
    delete next[pluginName]
    setPolicyPlugins(next)
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

  if (!consumer) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-lg font-medium text-muted-foreground">
          Application not found
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/applications")}
        >
          Back to Applications
        </Button>
      </div>
    )
  }

  const currentPlan = planId ? plans.find((p) => p.id === planId) : null
  const authMeta = authMethod ? AUTH_LABELS[authMethod] : null
  const AuthIcon = authMeta?.icon || Key
  const existingPolicyNames = [
    ...Object.keys(policyPlugins),
    ...AUTH_PLUGINS, // hide auth plugins from policy picker
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Application: ${id}`}
        description="Edit application settings and credentials"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/applications")}
            >
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
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={id} readOnly className="font-mono bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Application description"
              />
            </div>
          </CardContent>
        </Card>

        {/* Plan */}
        <Card>
          <CardHeader>
            <CardTitle>Plan</CardTitle>
            <CardDescription>
              Shared policies and rate limits from the assigned plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={planId || "none"}
              onValueChange={(v) => setPlanId(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No plan (standalone)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No plan (standalone)</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id || ""}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{p.id}</span>
                      {p.desc && (
                        <span className="text-muted-foreground">
                          — {p.desc}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentPlan && (
              <p className="text-xs text-muted-foreground mt-2">
                <Link
                  href={`/plans/${currentPlan.id}`}
                  className="text-primary hover:underline"
                >
                  View plan details
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AuthIcon className="h-4 w-4" />
              Credentials
              {authMeta && (
                <Badge variant="outline" className="text-xs font-normal">
                  {authMeta.label}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Authentication credentials for this application
            </CardDescription>
          </CardHeader>
          <CardContent>
            {authMethod && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">
                    {authMeta?.label} Configuration
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setShowCredentials(!showCredentials)}
                  >
                    {showCredentials ? (
                      <>
                        <EyeOff className="h-3 w-3" />
                        Hide
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" />
                        Show
                      </>
                    )}
                  </Button>
                </div>

                {showCredentials ? (
                  <div className="rounded-lg border p-4">
                    {authMethod === "key-auth" ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-medium">
                            API Key
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              setAuthConfig({
                                ...authConfig,
                                key: generateApiKey(),
                              })
                            }
                          >
                            <Shuffle className="mr-1.5 h-3 w-3" />
                            Regenerate
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            value={(authConfig.key as string) || ""}
                            onChange={(e) =>
                              setAuthConfig({
                                ...authConfig,
                                key: e.target.value,
                              })
                            }
                            className="font-mono text-xs"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                (authConfig.key as string) || ""
                              )
                              toast.success("API key copied")
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      PLUGIN_FORM_REGISTRY[authMethod] && (
                        <PluginFormRenderer
                          formDef={PLUGIN_FORM_REGISTRY[authMethod]}
                          config={authConfig}
                          onChange={setAuthConfig}
                          readOnly={false}
                        />
                      )
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Credentials are hidden. Click &quot;Show&quot; to view and
                      edit.
                    </p>
                  </div>
                )}
              </div>
            )}

            {!authMethod && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No authentication method configured for this application.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Policy Overrides */}
        <Collapsible open={showPolicies} onOpenChange={setShowPolicies}>
          <Card>
            <CardHeader>
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full text-left">
                  <div>
                    <CardTitle className="text-base">
                      Policy Overrides
                      {Object.keys(policyPlugins).length > 0 && (
                        <Badge
                          variant="secondary"
                          className="ml-2 text-xs font-normal"
                        >
                          {Object.keys(policyPlugins).length}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Additional plugins that override the plan&apos;s policies
                      for this application
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {showPolicies ? "Collapse" : "Expand"}
                  </Badge>
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-3">
                {Object.keys(policyPlugins).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No policy overrides. The plan&apos;s policies apply as-is.
                  </p>
                ) : (
                  Object.entries(policyPlugins).map(
                    ([pluginName, config]) => {
                      const def = PLUGINS.find((p) => p.name === pluginName)
                      const cat = def
                        ? getCategoryMeta(def.category)
                        : null
                      return (
                        <div
                          key={pluginName}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="flex items-center gap-3">
                            {cat && (
                              <div
                                className={`h-2 w-2 rounded-full ${cat.color}`}
                              />
                            )}
                            <div>
                              <p className="text-sm font-medium">
                                {def?.label || pluginName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {def?.description}
                              </p>
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
                                  setJsonFallback(
                                    JSON.stringify(config, null, 2)
                                  )
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
                    }
                  )
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPicker(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Override
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Policy Picker Sheet */}
      <Sheet open={showPicker} onOpenChange={setShowPicker}>
        <SheetContent side="right" className="p-0 sm:max-w-sm">
          <SheetTitle className="sr-only">Add Policy</SheetTitle>
          <PolicyGallery
            onAddPolicy={handleAddPolicy}
            existingPolicies={existingPolicyNames}
            excludeCategories={["authentication"]}
          />
        </SheetContent>
      </Sheet>

      {/* Policy Config Editor */}
      <Dialog
        open={!!editingPlugin}
        onOpenChange={() => setEditingPlugin(null)}
      >
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Configure{" "}
              {PLUGINS.find((p) => p.name === editingPlugin)?.label ||
                editingPlugin}
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
            <Button
              variant="outline"
              onClick={() => setEditingPlugin(null)}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePlugin}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
