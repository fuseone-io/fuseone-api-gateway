"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  BarChart3,
  Check,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Key,
  Lock,
  Pause,
  Plus,
  Save,
  ShieldCheck,
  Fingerprint,
  Shuffle,
  Trash2,
  X,
  XCircle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api } from "@/lib/api-client"
import type { APISIXConsumer, APISIXConsumerGroup } from "@/types/apisix"
import type { Subscription } from "@/types/subscription"
import type { ApiDefRecord } from "@/types/api"

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
  const t = useTranslations("applications")
  const tc = useTranslations("common")
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

  // Subscriptions
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false)
  const [availableApis, setAvailableApis] = useState<ApiDefRecord[]>([])
  const [selectedApiId, setSelectedApiId] = useState("")
  const [selectedSubPlan, setSelectedSubPlan] = useState("")
  const [subNotes, setSubNotes] = useState("")
  const [subscribing, setSubscribing] = useState(false)

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

      // Load subscriptions
      try {
        const subs = await api.listSubscriptions({ consumer_username: id })
        setSubscriptions(subs || [])
      } catch {
        // subscriptions endpoint may not be available yet
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc("failedToLoad", { resource: t("title") }))
    } finally {
      setLoading(false)
    }
  }

  const SUB_STATUS_BADGE: Record<string, { label: string; className: string }> = {
    pending: { label: t("subscriptions.statusPending"), className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
    active: { label: t("subscriptions.statusActive"), className: "bg-green-500/15 text-green-600 border-green-500/30" },
    suspended: { label: t("subscriptions.statusSuspended"), className: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
    revoked: { label: t("subscriptions.statusRevoked"), className: "bg-red-500/15 text-red-600 border-red-500/30" },
  }

  const openSubscribeDialog = async () => {
    setShowSubscribeDialog(true)
    try {
      const result = await api.listApis({ page_size: "100" })
      setAvailableApis(result.data || [])
    } catch {
      toast.error(tc("failedToLoad", { resource: "APIs" }))
    }
  }

  const handleSubscribe = async () => {
    if (!selectedApiId) return
    setSubscribing(true)
    try {
      const sub = await api.createSubscription({
        consumer_username: id,
        api_definition_id: selectedApiId,
        plan_id: selectedSubPlan || undefined,
        notes: subNotes || undefined,
      })
      setSubscriptions((prev) => [sub, ...prev])
      setShowSubscribeDialog(false)
      setSelectedApiId("")
      setSelectedSubPlan("")
      setSubNotes("")
      toast.success(t("subscriptions.created"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("subscriptions.failedSubscribe"))
    } finally {
      setSubscribing(false)
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
        username: id,
        desc: description || undefined,
        group_id: planId && planId !== "none" ? planId : undefined,
        plugins: Object.keys(plugins).length > 0 ? plugins : undefined,
      })
      toast.success(t("toasts.saved"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc("failedToSave", { resource: t("title") }))
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
          {t("notFound")}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/applications")}
        >
          {t("backToList")}
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
        title={`${t("detailTitle")}: ${id}`}
        description={t("detailDescription")}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/applications")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tc("back")}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/applications/${id}/analytics`)}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              {t("analytics")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? tc("saving") : tc("save")}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 max-w-2xl">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle>{t("identity")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{tc("name")}</Label>
              <Input value={id} readOnly className="font-mono bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>{tc("description")}</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("descriptionPlaceholder")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Plan */}
        <Card>
          <CardHeader>
            <CardTitle>{t("plan")}</CardTitle>
            <CardDescription>
              {t("planDetailDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={planId || "none"}
              onValueChange={(v) => setPlanId(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("noPlan")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("noPlan")}</SelectItem>
                {plans.filter((p) => !!p.id).map((p) => (
                  <SelectItem key={p.id} value={p.id!}>
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
                  {t("viewPlanDetails")}
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
              {t("credentials")}
              {authMeta && (
                <Badge variant="outline" className="text-xs font-normal">
                  {authMeta.label}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {t("credentialsDescription")}
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
                        {t("hide")}
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" />
                        {t("show")}
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
                            {t("apiKey")}
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
                            {t("regenerate")}
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
                              toast.success(t("toasts.apiKeyCopied"))
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
                      {t("credentialsHidden")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {!authMethod && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t("noAuthMethod")}
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
                      {t("policyOverrides")}
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
                      {t("policyOverridesDescription")}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {showPolicies ? t("collapse") : t("expand")}
                  </Badge>
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-3">
                {Object.keys(policyPlugins).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {t("noPolicyOverrides")}
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
                              {tc("edit")}
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
                  {t("addOverride")}
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* API Subscriptions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("subscriptions.title")}</CardTitle>
                <CardDescription>
                  {t("subscriptions.description")}
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={openSubscribeDialog}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("subscriptions.subscribe")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {subscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t("subscriptions.noSubscriptions")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("subscriptions.api")}</TableHead>
                    <TableHead>{t("plan")}</TableHead>
                    <TableHead>{tc("status")}</TableHead>
                    <TableHead>{t("subscriptions.date")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((sub) => {
                    const status = SUB_STATUS_BADGE[sub.status] || SUB_STATUS_BADGE.pending
                    return (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <Link
                            href={`/apis/${sub.api_definition_id}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {sub.api_definition_id.slice(0, 8)}...
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {sub.plan_id || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${status.className}`}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(sub.requested_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Subscribe Dialog */}
      <Dialog open={showSubscribeDialog} onOpenChange={setShowSubscribeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("subscriptions.subscribeToApi")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("subscriptions.api")}</Label>
              <Select value={selectedApiId} onValueChange={setSelectedApiId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("subscriptions.selectApi")} />
                </SelectTrigger>
                <SelectContent>
                  {availableApis.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("subscriptions.planOptional")}</Label>
              <Select value={selectedSubPlan || "none"} onValueChange={(v) => setSelectedSubPlan(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("subscriptions.noPlan")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("subscriptions.noPlan")}</SelectItem>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id || "unknown"}>
                      {p.desc || p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("subscriptions.notesOptional")}</Label>
              <Input
                value={subNotes}
                onChange={(e) => setSubNotes(e.target.value)}
                placeholder={t("subscriptions.notesPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubscribeDialog(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleSubscribe} disabled={!selectedApiId || subscribing}>
              {subscribing ? t("subscriptions.subscribing") : t("subscriptions.subscribe")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Policy Picker Sheet */}
      <Sheet open={showPicker} onOpenChange={setShowPicker}>
        <SheetContent side="right" className="p-0 sm:max-w-sm">
          <SheetTitle className="sr-only">{t("addPolicy")}</SheetTitle>
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
                <Label>{t("configurationJson")}</Label>
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
              {tc("cancel")}
            </Button>
            <Button onClick={handleSavePlugin}>{t("apply")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
