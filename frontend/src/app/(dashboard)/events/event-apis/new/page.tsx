"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { Zap, Save, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { PageHeader } from "@/components/page-header"
import { useEventApiStore } from "@/stores/event-api-store"
import { useKafkaStore } from "@/stores/kafka-store"
import { toast } from "sonner"
import Link from "next/link"

export default function NewEventApiPage() {
  const t = useTranslations("eventApis")
  const tf = useTranslations("eventApis.form")
  const tc = useTranslations("common")
  const router = useRouter()

  const { createEventApi } = useEventApiStore()
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
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  // Auto-generate slug from name
  useEffect(() => {
    if (name) {
      setSlug(
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      )
    }
  }, [name])

  async function handleCreate() {
    if (!name.trim()) { toast.error(tf("nameRequired")); return }
    if (!slug.trim()) { toast.error(tf("slugRequired")); return }
    if (!kafkaConnectionId) { toast.error(tf("connectionRequired")); return }
    if (!topicName.trim()) { toast.error(tf("topicRequired")); return }

    setSaving(true)
    try {
      const ea = await createEventApi({
        name,
        description,
        slug,
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
      })
      toast.success(tf("created"))
      router.push(`/events/event-apis/${ea.id}`)
    } catch {
      toast.error(tf("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tf("title")}
        description={tf("description")}
        icon={<Zap className="h-6 w-6" />}
        actions={
          <Button variant="outline" asChild>
            <Link href="/events/event-apis">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tc("back")}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tf("title")}</CardTitle>
            <CardDescription>{tf("description")}</CardDescription>
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
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleCreate} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? tc("saving") : tc("save")}
        </Button>
      </div>
    </div>
  )
}
