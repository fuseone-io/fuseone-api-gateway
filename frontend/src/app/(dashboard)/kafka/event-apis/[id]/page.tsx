"use client"

import { useEffect, useState, useCallback, use } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import {
  Zap, Save, Trash2, Rocket, CloudOff, ArrowLeft, ExternalLink,
  Webhook, Plus, Eye, Pencil, CheckCircle2, XCircle, Clock, BarChart3,
  Users, RefreshCw, RotateCcw, ChevronDown, ChevronRight, FileJson, Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { useEventApiStore } from "@/stores/event-api-store"
import { useKafkaStore } from "@/stores/kafka-store"
import { useWebhookStore } from "@/stores/webhook-store"
import type { WebhookSubscription } from "@/types/webhook"
import type { EventApiMetricsSummary, ConsumerGroupInfo, EventSchema, EventApiPermission } from "@/types/event-api"
import { api } from "@/lib/api-client"
import { toast } from "sonner"
import Link from "next/link"

export default function EventApiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const t = useTranslations("eventApis")
  const tf = useTranslations("eventApis.form")
  const tc = useTranslations("common")
  const router = useRouter()

  const {
    currentEventApi, loading, deploying,
    fetchEventApi, updateEventApi, deleteEventApi,
    deployEventApi, undeployEventApi,
  } = useEventApiStore()
  const { connections, fetchConnections } = useKafkaStore()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [slug, setSlug] = useState("")
  const [kafkaConnectionId, setKafkaConnectionId] = useState("")
  const [topicName, setTopicName] = useState("")
  const [contextPath, setContextPath] = useState("/events")
  const [consumerGroupPrefix, setConsumerGroupPrefix] = useState("fuseone-eg")
  const [autoOffsetReset, setAutoOffsetReset] = useState("latest")
  const [restProduce, setRestProduce] = useState(true)
  const [restConsume, setRestConsume] = useState(false)
  const [sseEnabled, setSseEnabled] = useState(true)
  const [websocketEnabled, setWebsocketEnabled] = useState(false)
  const [webhookEnabled, setWebhookEnabled] = useState(false)
  const [schemaValidation, setSchemaValidation] = useState(false)
  const [saving, setSaving] = useState(false)

  // Webhook state
  const {
    webhooks, deliveries,
    fetchWebhooks, createWebhook, updateWebhook, deleteWebhook, fetchDeliveries,
  } = useWebhookStore()
  const [whDialogOpen, setWhDialogOpen] = useState(false)
  const [whEditing, setWhEditing] = useState<WebhookSubscription | null>(null)
  const [whUrl, setWhUrl] = useState("")
  const [whSecret, setWhSecret] = useState("")
  const [whDescription, setWhDescription] = useState("")
  const [whActive, setWhActive] = useState(true)
  const [whFilterExpression, setWhFilterExpression] = useState("")
  const [whCircuitThreshold, setWhCircuitThreshold] = useState(5)
  const [whDeliveriesOpen, setWhDeliveriesOpen] = useState<string | null>(null)

  // Metrics state
  const [metricsSummary, setMetricsSummary] = useState<EventApiMetricsSummary | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)

  // Consumer groups state
  const [consumerGroups, setConsumerGroups] = useState<ConsumerGroupInfo[]>([])
  const [cgLoading, setCgLoading] = useState(false)
  const [cgExpanded, setCgExpanded] = useState<string | null>(null)
  const [cgDetail, setCgDetail] = useState<ConsumerGroupInfo | null>(null)
  const [cgDetailLoading, setCgDetailLoading] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState<string | null>(null)
  const [resetStrategy, setResetStrategy] = useState("latest")

  // Schema state
  const [schemas, setSchemas] = useState<EventSchema[]>([])
  const [schemasLoading, setSchemasLoading] = useState(false)
  const [schemaDialogOpen, setSchemaDialogOpen] = useState(false)
  const [schemaContent, setSchemaContent] = useState("")
  const [schemaDesc, setSchemaDesc] = useState("")

  // Permissions state
  const [permissions, setPermissions] = useState<EventApiPermission[]>([])
  const [permDialogOpen, setPermDialogOpen] = useState(false)
  const [editingPerm, setEditingPerm] = useState<EventApiPermission | null>(null)
  const [permConsumerName, setPermConsumerName] = useState("")
  const [permCanProduce, setPermCanProduce] = useState(false)
  const [permCanConsume, setPermCanConsume] = useState(false)
  const [permCanStream, setPermCanStream] = useState(false)
  const [permRateLimit, setPermRateLimit] = useState(0)
  const [permRateWindowSec, setPermRateWindowSec] = useState(60)

  useEffect(() => {
    fetchEventApi(id)
    fetchConnections()
  }, [id, fetchEventApi, fetchConnections])

  useEffect(() => {
    if (currentEventApi?.webhook_enabled) {
      fetchWebhooks(id)
    }
  }, [id, currentEventApi?.webhook_enabled, fetchWebhooks])

  const fetchMetricsSummary = useCallback(async () => {
    setMetricsLoading(true)
    try {
      const summary = await api.getEventApiMetricsSummary(id, "24h")
      setMetricsSummary(summary)
    } catch {
      // Silently fail — metrics are informational
    } finally {
      setMetricsLoading(false)
    }
  }, [id])

  const fetchConsumerGroups = useCallback(async () => {
    setCgLoading(true)
    try {
      const groups = await api.listConsumerGroups(id)
      setConsumerGroups(groups)
    } catch {
      // Silently fail
    } finally {
      setCgLoading(false)
    }
  }, [id])

  const fetchGroupDetail = useCallback(async (groupId: string) => {
    setCgDetailLoading(true)
    try {
      const detail = await api.describeConsumerGroup(id, groupId)
      setCgDetail(detail)
    } catch {
      setCgDetail(null)
    } finally {
      setCgDetailLoading(false)
    }
  }, [id])

  async function handleResetOffsets(groupId: string) {
    try {
      await api.resetConsumerGroupOffsets(id, groupId, resetStrategy)
      toast.success(t("offsetsReset"))
      setResetDialogOpen(null)
      fetchConsumerGroups()
    } catch {
      toast.error(t("offsetsResetFailed"))
    }
  }

  function handleExpandGroup(groupId: string) {
    if (cgExpanded === groupId) {
      setCgExpanded(null)
      setCgDetail(null)
    } else {
      setCgExpanded(groupId)
      fetchGroupDetail(groupId)
    }
  }

  const fetchSchemas = useCallback(async () => {
    setSchemasLoading(true)
    try {
      const data = await api.listSchemas(id)
      setSchemas(data)
    } catch {
      // Silently fail
    } finally {
      setSchemasLoading(false)
    }
  }, [id])

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await api.listPermissions(id)
      setPermissions(res.data || [])
    } catch {}
  }, [id])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  useEffect(() => {
    if (currentEventApi?.schema_validation) {
      fetchSchemas()
    }
  }, [currentEventApi?.schema_validation, fetchSchemas])

  async function handleCreateSchema() {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(schemaContent)
    } catch {
      toast.error(t("schemaInvalidJson"))
      return
    }
    try {
      await api.createSchema(id, {
        schema_content: parsed,
        description: schemaDesc,
        is_active: true,
      })
      toast.success(t("schemaCreated"))
      setSchemaDialogOpen(false)
      setSchemaContent("")
      setSchemaDesc("")
      fetchSchemas()
    } catch {
      toast.error(t("schemaCreateFailed"))
    }
  }

  async function handleDeactivateSchema(version: number) {
    try {
      await api.deactivateSchema(id, version)
      toast.success(t("schemaDeactivated"))
      fetchSchemas()
    } catch {
      toast.error(t("schemaDeactivateFailed"))
    }
  }

  const openPermDialog = (perm?: EventApiPermission) => {
    if (perm) {
      setEditingPerm(perm)
      setPermConsumerName(perm.consumer_name)
      setPermCanProduce(perm.can_produce)
      setPermCanConsume(perm.can_consume)
      setPermCanStream(perm.can_stream)
      setPermRateLimit(perm.rate_limit)
      setPermRateWindowSec(perm.rate_window_sec)
    } else {
      setEditingPerm(null)
      setPermConsumerName("")
      setPermCanProduce(false)
      setPermCanConsume(false)
      setPermCanStream(false)
      setPermRateLimit(0)
      setPermRateWindowSec(60)
    }
    setPermDialogOpen(true)
  }

  const handlePermSave = async () => {
    try {
      await api.upsertPermission(id, {
        consumer_name: permConsumerName,
        can_produce: permCanProduce,
        can_consume: permCanConsume,
        can_stream: permCanStream,
        rate_limit: permRateLimit,
        rate_window_sec: permRateWindowSec,
      })
      toast.success(t("permissionSaved"))
      setPermDialogOpen(false)
      fetchPermissions()
    } catch {
      toast.error(t("permissionSaveFailed"))
    }
  }

  const handlePermDelete = async (permId: string) => {
    try {
      await api.deletePermission(id, permId)
      toast.success(t("permissionDeleted"))
      fetchPermissions()
    } catch {
      toast.error(t("permissionDeleteFailed"))
    }
  }

  useEffect(() => {
    if (currentEventApi?.status === "active") {
      fetchMetricsSummary()
      fetchConsumerGroups()
    }
  }, [currentEventApi?.status, fetchMetricsSummary, fetchConsumerGroups])

  useEffect(() => {
    if (currentEventApi) {
      setName(currentEventApi.name)
      setDescription(currentEventApi.description)
      setSlug(currentEventApi.slug)
      setKafkaConnectionId(currentEventApi.kafka_connection_id)
      setTopicName(currentEventApi.topic_name)
      setContextPath(currentEventApi.context_path)
      setConsumerGroupPrefix(currentEventApi.consumer_group_prefix)
      setAutoOffsetReset(currentEventApi.auto_offset_reset)
      setRestProduce(currentEventApi.rest_produce)
      setRestConsume(currentEventApi.rest_consume)
      setSseEnabled(currentEventApi.sse_enabled)
      setWebsocketEnabled(currentEventApi.websocket_enabled)
      setWebhookEnabled(currentEventApi.webhook_enabled)
      setSchemaValidation(currentEventApi.schema_validation)
    }
  }, [currentEventApi])

  async function handleSave() {
    if (!name.trim()) { toast.error(tf("nameRequired")); return }
    if (!slug.trim()) { toast.error(tf("slugRequired")); return }
    if (!topicName.trim()) { toast.error(tf("topicRequired")); return }

    setSaving(true)
    try {
      await updateEventApi(id, {
        name, description, slug,
        kafka_connection_id: kafkaConnectionId,
        topic_name: topicName,
        context_path: contextPath,
        consumer_group_prefix: consumerGroupPrefix,
        auto_offset_reset: autoOffsetReset,
        rest_produce: restProduce,
        rest_consume: restConsume,
        sse_enabled: sseEnabled,
        websocket_enabled: websocketEnabled,
        webhook_enabled: webhookEnabled,
        schema_validation: schemaValidation,
      })
      toast.success(tf("updated"))
    } catch {
      toast.error(tf("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeploy() {
    try {
      await deployEventApi(id)
      toast.success(t("deployed"))
    } catch {
      toast.error(t("deployFailed"))
    }
  }

  async function handleUndeploy() {
    try {
      await undeployEventApi(id)
      toast.success(t("undeployed"))
    } catch {
      toast.error(t("undeployFailed"))
    }
  }

  async function handleDelete() {
    try {
      await deleteEventApi(id)
      toast.success(t("deleted"))
      router.push("/kafka/event-apis")
    } catch {
      toast.error(t("deleteFailed"))
    }
  }

  function openWhDialog(wh?: WebhookSubscription) {
    if (wh) {
      setWhEditing(wh)
      setWhUrl(wh.url)
      setWhSecret(wh.secret || "")
      setWhDescription(wh.description)
      setWhActive(wh.is_active)
      setWhFilterExpression(wh.filter_expression || "")
      setWhCircuitThreshold(wh.circuit_breaker_threshold ?? 5)
    } else {
      setWhEditing(null)
      setWhUrl("")
      setWhSecret("")
      setWhDescription("")
      setWhActive(true)
      setWhFilterExpression("")
      setWhCircuitThreshold(5)
    }
    setWhDialogOpen(true)
  }

  async function handleWhSave() {
    if (!whUrl.trim()) { toast.error(t("webhookUrlRequired")); return }
    try {
      const payload = {
        url: whUrl, secret: whSecret, description: whDescription, is_active: whActive,
        filter_expression: whFilterExpression || undefined,
        circuit_breaker_threshold: whCircuitThreshold,
      }
      if (whEditing) {
        await updateWebhook(id, whEditing.id, payload)
        toast.success(t("webhookUpdated"))
      } else {
        await createWebhook(id, payload)
        toast.success(t("webhookCreated"))
      }
      setWhDialogOpen(false)
    } catch {
      toast.error(t("webhookSaveFailed"))
    }
  }

  async function handleWhDelete(whId: string) {
    try {
      await deleteWebhook(id, whId)
      toast.success(t("webhookDeleted"))
    } catch {
      toast.error(t("webhookDeleteFailed"))
    }
  }

  async function handleViewDeliveries(whId: string) {
    setWhDeliveriesOpen(whId)
    await fetchDeliveries(id, whId)
  }

  if (loading || !currentEventApi) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-60 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  const isActive = currentEventApi.status === "active"

  return (
    <div className="space-y-6">
      <PageHeader
        title={currentEventApi.name}
        description={currentEventApi.slug}
        icon={<Zap className="h-6 w-6" />}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/kafka/event-apis">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {tc("back")}
              </Link>
            </Button>
            {isActive ? (
              <Button variant="outline" onClick={handleUndeploy} disabled={deploying}>
                <CloudOff className="mr-2 h-4 w-4" />
                {deploying ? t("undeploying") : t("undeploy")}
              </Button>
            ) : (
              <Button onClick={handleDeploy} disabled={deploying}>
                <Rocket className="mr-2 h-4 w-4" />
                {deploying ? t("deploying") : t("deploy")}
              </Button>
            )}
          </div>
        }
      />

      {/* Status banner */}
      <div className="flex items-center gap-3">
        {isActive ? (
          <Badge className="bg-emerald-600">
            <Rocket className="mr-1 h-3 w-3" />
            {tc("active")}
          </Badge>
        ) : (
          <Badge variant="secondary">
            <CloudOff className="mr-1 h-3 w-3" />
            Draft
          </Badge>
        )}
        {currentEventApi.deployed_at && (
          <span className="text-xs text-muted-foreground">
            Deployed {new Date(currentEventApi.deployed_at).toLocaleString()}
          </span>
        )}
      </div>

      {/* Endpoints card (visible when active) */}
      {isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("endpointsTitle")}</CardTitle>
            <CardDescription>{t("endpointsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {restProduce && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs w-16 justify-center">POST</Badge>
                  <code className="text-sm font-mono text-muted-foreground">
                    {contextPath}/{slug}/produce
                  </code>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
              {restConsume && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs w-16 justify-center">POST</Badge>
                  <code className="text-sm font-mono text-muted-foreground">
                    {contextPath}/{slug}/consume
                  </code>
                </div>
              )}
              {sseEnabled && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs w-16 justify-center">GET</Badge>
                  <code className="text-sm font-mono text-muted-foreground">
                    {contextPath}/{slug}/stream
                  </code>
                  <Badge variant="secondary" className="text-[10px]">SSE</Badge>
                </div>
              )}
              {websocketEnabled && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs w-16 justify-center">GET</Badge>
                  <code className="text-sm font-mono text-muted-foreground">
                    {contextPath}/{slug}/ws
                  </code>
                  <Badge variant="secondary" className="text-[10px]">WS</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics section (only when active) */}
      {isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t("metricsTitle")}
            </CardTitle>
            <CardDescription>{t("metricsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : !metricsSummary ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("metricsNoData")}</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Produce */}
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{t("metricsProduceTotal")}</p>
                  <p className="text-2xl font-bold">{metricsSummary.produce_total.toLocaleString()}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{t("metricsProduceErrors")}: {metricsSummary.produce_errors.toLocaleString()}</span>
                    <span>{t("metricsProduceLatency")}: {metricsSummary.produce_latency_avg.toFixed(1)}ms</span>
                  </div>
                </div>
                {/* Consume */}
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{t("metricsConsumeTotal")}</p>
                  <p className="text-2xl font-bold">{metricsSummary.consume_total.toLocaleString()}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{t("metricsConsumeMessages")}: {metricsSummary.consume_messages.toLocaleString()}</span>
                  </div>
                </div>
                {/* Connections */}
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{t("metricsSseConnections")}</p>
                  <p className="text-2xl font-bold">{metricsSummary.sse_connections.toLocaleString()}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{t("metricsWsConnections")}: {metricsSummary.ws_connections.toLocaleString()}</span>
                  </div>
                </div>
                {/* Webhook */}
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{t("metricsWebhookTotal")}</p>
                  <p className="text-2xl font-bold">{metricsSummary.webhook_total.toLocaleString()}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{t("metricsWebhookSuccess")}: {metricsSummary.webhook_success.toLocaleString()}</span>
                    <span>{t("metricsWebhookFailed")}: {metricsSummary.webhook_failed.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Consumer Groups (only when active) */}
      {isActive && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t("consumerGroupsTitle")}
              </CardTitle>
              <CardDescription>{t("consumerGroupsDescription")}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchConsumerGroups} disabled={cgLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${cgLoading ? "animate-spin" : ""}`} />
              {t("refreshConsumerGroups")}
            </Button>
          </CardHeader>
          <CardContent>
            {cgLoading && consumerGroups.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : consumerGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("noConsumerGroups")}</p>
            ) : (
              <div className="space-y-2">
                {consumerGroups.map((group) => (
                  <div key={group.group_id} className="rounded-lg border">
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                      onClick={() => handleExpandGroup(group.group_id)}
                    >
                      <div className="flex items-center gap-3">
                        {cgExpanded === group.group_id ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-mono text-sm">{group.group_id}</span>
                        <Badge variant={group.state === "Stable" ? "default" : "secondary"} className="text-xs">
                          {group.state}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{t("members")}: {group.members}</span>
                        <span className={group.total_lag > 0 ? "text-amber-600 font-medium" : ""}>
                          {t("lag")}: {group.total_lag.toLocaleString()}
                        </span>
                        <AlertDialog open={resetDialogOpen === group.group_id} onOpenChange={(open) => setResetDialogOpen(open ? group.group_id : null)}>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); setResetDialogOpen(group.group_id) }}
                              title={t("resetOffsets")}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("resetOffsets")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("resetOffsetsConfirm", { groupId: group.group_id })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="space-y-2 py-2">
                              <Label>{t("resetStrategy")}</Label>
                              <Select value={resetStrategy} onValueChange={setResetStrategy}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="latest">{t("resetToLatest")}</SelectItem>
                                  <SelectItem value="earliest">{t("resetToEarliest")}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleResetOffsets(group.group_id)}>
                                {t("resetOffsets")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {/* Expanded partition details */}
                    {cgExpanded === group.group_id && (
                      <div className="border-t px-3 py-2">
                        {cgDetailLoading ? (
                          <div className="space-y-2 py-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <Skeleton key={i} className="h-8 w-full" />
                            ))}
                          </div>
                        ) : cgDetail?.partitions && cgDetail.partitions.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[80px]">{t("partition")}</TableHead>
                                <TableHead>{t("currentOffset")}</TableHead>
                                <TableHead>{t("logEndOffset")}</TableHead>
                                <TableHead>{t("lag")}</TableHead>
                                <TableHead>{t("memberId")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {cgDetail.partitions.map((p) => (
                                <TableRow key={p.partition}>
                                  <TableCell className="font-mono text-xs">{p.partition}</TableCell>
                                  <TableCell className="font-mono text-xs">{p.current_offset.toLocaleString()}</TableCell>
                                  <TableCell className="font-mono text-xs">{p.log_end_offset.toLocaleString()}</TableCell>
                                  <TableCell className={`font-mono text-xs ${p.lag > 0 ? "text-amber-600 font-medium" : ""}`}>
                                    {p.lag.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs truncate max-w-[200px]">
                                    {p.member_id || "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">{t("noConsumerGroups")}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tf("editTitle")}</CardTitle>
            <CardDescription>{tf("editDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{tc("name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={tf("namePlaceholder")} />
            </div>
            <div className="space-y-2">
              <Label>{tc("description")}</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={tf("descriptionPlaceholder")} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>{tf("slugLabel")}</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={tf("slugPlaceholder")} />
              <p className="text-xs text-muted-foreground">{tf("slugHelp")}</p>
            </div>
            <div className="space-y-2">
              <Label>{tf("kafkaConnection")}</Label>
              <Select value={kafkaConnectionId} onValueChange={setKafkaConnectionId}>
                <SelectTrigger>
                  <SelectValue placeholder={tf("selectConnection")} />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>{conn.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tf("topicNameLabel")}</Label>
              <Input value={topicName} onChange={(e) => setTopicName(e.target.value)} placeholder={tf("topicNamePlaceholder")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tf("contextPathLabel")}</Label>
                <Input value={contextPath} onChange={(e) => setContextPath(e.target.value)} placeholder={tf("contextPathPlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label>{tf("autoOffsetLabel")}</Label>
                <Select value={autoOffsetReset} onValueChange={setAutoOffsetReset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest">latest</SelectItem>
                    <SelectItem value="earliest">earliest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tf("consumerGroupLabel")}</Label>
              <Input value={consumerGroupPrefix} onChange={(e) => setConsumerGroupPrefix(e.target.value)} placeholder={tf("consumerGroupPlaceholder")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("protocols")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{tf("restProduce")}</p>
                <p className="text-xs text-muted-foreground">{tf("restProduceDesc")}</p>
              </div>
              <Switch checked={restProduce} onCheckedChange={setRestProduce} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{tf("restConsume")}</p>
                <p className="text-xs text-muted-foreground">{tf("restConsumeDesc")}</p>
              </div>
              <Switch checked={restConsume} onCheckedChange={setRestConsume} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{tf("sseEnabled")}</p>
                <p className="text-xs text-muted-foreground">{tf("sseEnabledDesc")}</p>
              </div>
              <Switch checked={sseEnabled} onCheckedChange={setSseEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{tf("websocketEnabled")}</p>
                <p className="text-xs text-muted-foreground">{tf("websocketEnabledDesc")}</p>
              </div>
              <Switch checked={websocketEnabled} onCheckedChange={setWebsocketEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{tf("webhookEnabled")}</p>
                <p className="text-xs text-muted-foreground">{tf("webhookEnabledDesc")}</p>
              </div>
              <Switch checked={webhookEnabled} onCheckedChange={setWebhookEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t("schemaValidation")}</p>
                <p className="text-xs text-muted-foreground">{t("schemaValidationDesc")}</p>
              </div>
              <Switch checked={schemaValidation} onCheckedChange={setSchemaValidation} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Webhooks section */}
      {webhookEnabled && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Webhook className="h-4 w-4" />
                {t("webhooksTitle")}
              </CardTitle>
              <CardDescription>{t("webhooksDescription")}</CardDescription>
            </div>
            <Button size="sm" onClick={() => openWhDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              {t("addWebhook")}
            </Button>
          </CardHeader>
          <CardContent>
            {webhooks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("noWebhooks")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>{tc("description")}</TableHead>
                    <TableHead>{tc("status")}</TableHead>
                    <TableHead className="w-[140px]">{tc("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((wh) => (
                    <TableRow key={wh.id}>
                      <TableCell className="font-mono text-xs max-w-[300px] truncate">{wh.url}</TableCell>
                      <TableCell className="text-sm">{wh.description || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          {wh.is_active ? (
                            <Badge className="bg-emerald-600">{tc("active")}</Badge>
                          ) : (
                            <Badge variant="secondary">{t("inactive")}</Badge>
                          )}
                          {wh.circuit_status === "closed" && (
                            <Badge className="bg-emerald-600">{t("kafka.circuitClosed")}</Badge>
                          )}
                          {wh.circuit_status === "open" && (
                            <Badge variant="destructive">{t("kafka.circuitOpen")}</Badge>
                          )}
                          {wh.circuit_status === "half-open" && (
                            <Badge className="bg-amber-500 text-white">{t("kafka.circuitHalfOpen")}</Badge>
                          )}
                          {wh.consecutive_failures > 0 && (
                            <span className="text-xs text-destructive font-medium">
                              {wh.consecutive_failures} {t("kafka.consecutiveFailures")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {wh.circuit_status !== "closed" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                try {
                                  await api.resetWebhookCircuitBreaker(id, wh.id)
                                  toast.success(t("kafka.circuitBreakerReset"))
                                  fetchWebhooks(id)
                                } catch {
                                  toast.error(t("kafka.circuitBreakerResetFailed"))
                                }
                              }}
                              title={t("kafka.resetCircuitBreaker")}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleViewDeliveries(wh.id)} title={t("viewDeliveries")}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openWhDialog(wh)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleWhDelete(wh.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Webhook create/edit dialog */}
      <Dialog open={whDialogOpen} onOpenChange={setWhDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{whEditing ? t("editWebhook") : t("addWebhook")}</DialogTitle>
            <DialogDescription>{t("webhookDialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={whUrl} onChange={(e) => setWhUrl(e.target.value)} placeholder="https://example.com/webhook" />
            </div>
            <div className="space-y-2">
              <Label>Secret (HMAC-SHA256)</Label>
              <Input value={whSecret} onChange={(e) => setWhSecret(e.target.value)} placeholder={t("webhookSecretPlaceholder")} type="password" />
              <p className="text-xs text-muted-foreground">{t("webhookSecretHelp")}</p>
            </div>
            <div className="space-y-2">
              <Label>{tc("description")}</Label>
              <Input value={whDescription} onChange={(e) => setWhDescription(e.target.value)} placeholder={t("webhookDescPlaceholder")} />
            </div>
            <div className="space-y-2">
              <Label>{t("kafka.filterExpression")}</Label>
              <Input
                value={whFilterExpression}
                onChange={(e) => setWhFilterExpression(e.target.value)}
                placeholder={t("kafka.filterExpressionPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("kafka.filterExpressionHelp")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("kafka.circuitBreakerThreshold")}</Label>
              <Input
                type="number"
                min={1}
                value={whCircuitThreshold}
                onChange={(e) => setWhCircuitThreshold(Number(e.target.value) || 5)}
              />
              <p className="text-xs text-muted-foreground">{t("kafka.circuitBreakerThresholdHelp")}</p>
            </div>
            <div className="flex items-center justify-between">
              <Label>{tc("active")}</Label>
              <Switch checked={whActive} onCheckedChange={setWhActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhDialogOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleWhSave}>{tc("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliveries dialog */}
      <Dialog open={!!whDeliveriesOpen} onOpenChange={() => setWhDeliveriesOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("deliveriesTitle")}</DialogTitle>
            <DialogDescription>{t("deliveriesDescription")}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {deliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("noDeliveries")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tc("status")}</TableHead>
                    <TableHead>Offset</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>{t("attempts")}</TableHead>
                    <TableHead>{tc("createdAt")}</TableHead>
                    <TableHead className="w-[80px]">{tc("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        {d.status === "success" && <Badge className="bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" />{tc("success")}</Badge>}
                        {d.status === "failed" && <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />{t("failed")}</Badge>}
                        {d.status === "pending" && <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />{t("pending")}</Badge>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{d.kafka_partition}:{d.kafka_offset}</TableCell>
                      <TableCell className="font-mono text-xs">{d.last_status_code || "—"}</TableCell>
                      <TableCell>{d.attempts}</TableCell>
                      <TableCell className="text-xs">{new Date(d.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {d.status === "failed" && whDeliveriesOpen && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                await api.retryWebhookDelivery(id, whDeliveriesOpen, d.id)
                                toast.success(t("kafka.deliveryRetried"))
                                fetchDeliveries(id, whDeliveriesOpen)
                              } catch {
                                toast.error(t("kafka.deliveryRetryFailed"))
                              }
                            }}
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            {t("kafka.retry")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Schemas section */}
      {schemaValidation && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileJson className="h-4 w-4" />
                {t("schemaTitle")}
              </CardTitle>
              <CardDescription>{t("schemaDescription")}</CardDescription>
            </div>
            <Button size="sm" onClick={() => setSchemaDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("addSchema")}
            </Button>
          </CardHeader>
          <CardContent>
            {schemasLoading && schemas.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : schemas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("noSchemas")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("schemaVersion")}</TableHead>
                    <TableHead>{tc("description")}</TableHead>
                    <TableHead>{tc("status")}</TableHead>
                    <TableHead>{tc("createdAt")}</TableHead>
                    <TableHead className="w-[100px]">{tc("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schemas.map((schema) => (
                    <TableRow key={schema.id}>
                      <TableCell className="font-mono text-sm">v{schema.version}</TableCell>
                      <TableCell className="text-sm">{schema.description || "—"}</TableCell>
                      <TableCell>
                        {schema.is_active ? (
                          <Badge className="bg-emerald-600">{t("schemaActive")}</Badge>
                        ) : (
                          <Badge variant="secondary">{t("schemaInactive")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{new Date(schema.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {schema.is_active && (
                          <Button variant="ghost" size="sm" onClick={() => handleDeactivateSchema(schema.version)}>
                            <XCircle className="mr-1 h-4 w-4" />
                            {t("schemaInactive")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Schema create dialog */}
      <Dialog open={schemaDialogOpen} onOpenChange={setSchemaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("schemaDialogTitle")}</DialogTitle>
            <DialogDescription>{t("schemaDialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("schemaContentLabel")}</Label>
              <Textarea
                value={schemaContent}
                onChange={(e) => setSchemaContent(e.target.value)}
                placeholder={t("schemaContentPlaceholder")}
                rows={10}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("schemaDescriptionLabel")}</Label>
              <Input
                value={schemaDesc}
                onChange={(e) => setSchemaDesc(e.target.value)}
                placeholder={t("schemaDescriptionPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchemaDialogOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleCreateSchema}>{tc("create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Access Control section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {t("accessControlTitle")}
            </CardTitle>
            <CardDescription>{t("accessControlDescription")}</CardDescription>
          </div>
          <Button size="sm" onClick={() => openPermDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addPermission")}
          </Button>
        </CardHeader>
        <CardContent>
          {permissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("noPermissions")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("consumerName")}</TableHead>
                  <TableHead>{t("produce")}</TableHead>
                  <TableHead>{t("consume")}</TableHead>
                  <TableHead>{t("stream")}</TableHead>
                  <TableHead>{t("rateLimit")}</TableHead>
                  <TableHead className="w-[100px]">{tc("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.map((perm) => (
                  <TableRow key={perm.id}>
                    <TableCell className="font-mono text-sm">{perm.consumer_name}</TableCell>
                    <TableCell>
                      {perm.can_produce ? (
                        <Badge className="bg-emerald-600">Yes</Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {perm.can_consume ? (
                        <Badge className="bg-emerald-600">Yes</Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {perm.can_stream ? (
                        <Badge className="bg-emerald-600">Yes</Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {perm.rate_limit > 0
                        ? `${perm.rate_limit} / ${perm.rate_window_sec}s`
                        : t("unlimited")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openPermDialog(perm)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handlePermDelete(perm.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Permission create/edit dialog */}
      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPerm ? t("editPermission") : t("addPermission")}</DialogTitle>
            <DialogDescription>{t("permissionDialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("consumerName")}</Label>
              <Input
                value={permConsumerName}
                onChange={(e) => setPermConsumerName(e.target.value)}
                placeholder={t("consumerNamePlaceholder")}
                disabled={!!editingPerm}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("canProduce")}</Label>
              <Switch checked={permCanProduce} onCheckedChange={setPermCanProduce} />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("canConsume")}</Label>
              <Switch checked={permCanConsume} onCheckedChange={setPermCanConsume} />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("canStream")}</Label>
              <Switch checked={permCanStream} onCheckedChange={setPermCanStream} />
            </div>
            <div className="space-y-2">
              <Label>{t("rateLimit")}</Label>
              <Input
                type="number"
                min={0}
                value={permRateLimit}
                onChange={(e) => setPermRateLimit(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("rateWindowSec")}</Label>
              <Input
                type="number"
                min={1}
                value={permRateWindowSec}
                onChange={(e) => setPermRateWindowSec(Number(e.target.value) || 60)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermDialogOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handlePermSave}>{tc("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              {tc("delete")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("deleteConfirm", { name: currentEventApi.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>{tc("delete")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? tc("saving") : tc("save")}
        </Button>
      </div>
    </div>
  )
}
