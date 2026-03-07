"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Plus, Send, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { useKafkaStore } from "@/stores/kafka-store"
import type { KafkaMessage } from "@/types/kafka"

function ExpandableValue({ value }: { value: string }) {
  const t = useTranslations("kafka")
  const [expanded, setExpanded] = useState(false)
  const truncated = value.length > 120

  if (!truncated) {
    return <code className="text-xs font-mono break-all">{value}</code>
  }

  return (
    <div>
      <code className="text-xs font-mono break-all">
        {expanded ? value : `${value.slice(0, 120)}...`}
      </code>
      <button
        className="text-xs text-primary hover:underline ml-1"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? t("topicDetail.collapse") : t("topicDetail.expand")}
      </button>
    </div>
  )
}

function DetailsTab() {
  const t = useTranslations("kafka")
  const { currentTopic, loadingTopic } = useKafkaStore()

  if (loadingTopic) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!currentTopic || !currentTopic.partitions?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">{t("topicDetail.noPartitionInfo")}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("topicDetail.partitions")}</CardTitle>
        <CardDescription>
          {t("topicDetail.partitionCount", { count: currentTopic.partitions.length, topic: currentTopic.name })}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("topicDetail.partition")}</TableHead>
              <TableHead>{t("topicDetail.leader")}</TableHead>
              <TableHead>{t("topicDetail.replicas")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentTopic.partitions.map((p) => (
              <TableRow key={p.partition}>
                <TableCell className="font-mono">{p.partition}</TableCell>
                <TableCell className="font-mono">{p.leader}</TableCell>
                <TableCell className="font-mono text-xs">
                  {p.replicas?.join(", ") || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ProduceTab({ connectionId, topic }: { connectionId: string; topic: string }) {
  const t = useTranslations("kafka")
  const { produceMessage, producing } = useKafkaStore()
  const [key, setKey] = useState("")
  const [value, setValue] = useState("")
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([])

  const handleAddHeader = () => {
    setHeaders((prev) => [...prev, { key: "", value: "" }])
  }

  const handleRemoveHeader = (index: number) => {
    setHeaders((prev) => prev.filter((_, i) => i !== index))
  }

  const handleHeaderChange = (index: number, field: "key" | "value", val: string) => {
    setHeaders((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: val } : h))
    )
  }

  const handleSend = async () => {
    if (!value.trim()) {
      toast.error(t("topicDetail.produce.valueRequired"))
      return
    }

    const headersMap: Record<string, string> = {}
    for (const h of headers) {
      if (h.key.trim()) {
        headersMap[h.key.trim()] = h.value
      }
    }

    try {
      await produceMessage(connectionId, topic, {
        key: key || undefined,
        value,
        headers: Object.keys(headersMap).length > 0 ? headersMap : undefined,
      })
      toast.success(t("topicDetail.produce.messageSent"))
      setValue("")
      setKey("")
      setHeaders([])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("topicDetail.produce.sendFailed"))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("topicDetail.produce.title")}</CardTitle>
        <CardDescription>
          {t("topicDetail.produce.description", { topic })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="msg-key">{t("topicDetail.produce.keyLabel")}</Label>
          <Input
            id="msg-key"
            placeholder={t("topicDetail.produce.keyPlaceholder")}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="msg-value">{t("topicDetail.produce.valueLabel")}</Label>
          <Textarea
            id="msg-value"
            placeholder='{"event": "example", "data": {}}'
            rows={6}
            className="font-mono text-sm"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t("topicDetail.produce.headers")}</Label>
            <Button variant="outline" size="sm" onClick={handleAddHeader}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t("topicDetail.produce.addHeader")}
            </Button>
          </div>
          {headers.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder={t("topicDetail.produce.headerKey")}
                value={h.key}
                onChange={(e) => handleHeaderChange(i, "key", e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder={t("topicDetail.produce.headerValue")}
                value={h.value}
                onChange={(e) => handleHeaderChange(i, "value", e.target.value)}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                onClick={() => handleRemoveHeader(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <Button onClick={handleSend} disabled={producing}>
          <Send className="h-4 w-4 mr-2" />
          {producing ? t("topicDetail.produce.sending") : t("topicDetail.produce.sendMessage")}
        </Button>
      </CardContent>
    </Card>
  )
}

function ConsumeTab({ connectionId, topic }: { connectionId: string; topic: string }) {
  const t = useTranslations("kafka")
  const { consumeMessages, messages, loadingMessages } = useKafkaStore()
  const [maxMessages, setMaxMessages] = useState("")

  const handleConsume = async () => {
    try {
      await consumeMessages(connectionId, topic, {
        max_messages: maxMessages ? Number(maxMessages) : undefined,
      })
      toast.success(t("topicDetail.consume.messagesConsumed"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("topicDetail.consume.consumeFailed"))
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("topicDetail.consume.title")}</CardTitle>
          <CardDescription>
            {t("topicDetail.consume.description", { topic })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="consume-max">{t("topicDetail.consume.maxMessagesLabel")}</Label>
              <Input
                id="consume-max"
                type="number"
                placeholder="50"
                className="w-40"
                value={maxMessages}
                onChange={(e) => setMaxMessages(e.target.value)}
              />
            </div>
            <Button onClick={handleConsume} disabled={loadingMessages}>
              {loadingMessages ? t("topicDetail.consume.consuming") : t("topicDetail.consume.consumeButton")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {messages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("topicDetail.consume.messagesCount", { count: messages.length })}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">{t("topicDetail.consume.offset")}</TableHead>
                  <TableHead className="w-[80px]">{t("topicDetail.partition")}</TableHead>
                  <TableHead className="w-[120px]">{t("topicDetail.consume.key")}</TableHead>
                  <TableHead>{t("topicDetail.consume.value")}</TableHead>
                  <TableHead className="w-[140px]">{t("topicDetail.produce.headers")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((msg: KafkaMessage, idx: number) => (
                  <TableRow key={`${msg.partition}-${msg.offset}-${idx}`}>
                    <TableCell className="font-mono text-xs">{msg.offset}</TableCell>
                    <TableCell className="font-mono text-xs">{msg.partition}</TableCell>
                    <TableCell className="font-mono text-xs">{msg.key || "-"}</TableCell>
                    <TableCell>
                      <ExpandableValue value={msg.value} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {msg.headers && Object.keys(msg.headers).length > 0
                        ? Object.entries(msg.headers)
                            .map(([k, v]) => `${k}=${v}`)
                            .join(", ")
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function KafkaTopicDetailPage() {
  const t = useTranslations("kafka")
  const tc = useTranslations("common")
  const { connectionId, topic: rawTopic } = useParams<{ connectionId: string; topic: string }>()
  const topic = decodeURIComponent(rawTopic)
  const { fetchTopic, connections, fetchConnections } = useKafkaStore()

  useEffect(() => {
    if (connections.length === 0) {
      fetchConnections()
    }
  }, [connections.length, fetchConnections])

  useEffect(() => {
    if (connectionId && topic) {
      fetchTopic(connectionId, topic)
    }
  }, [connectionId, topic, fetchTopic])

  const connection = connections.find((c) => c.id === connectionId)

  return (
    <div className="space-y-6">
      <PageHeader
        title={topic}
        description={t("topicDetail.description", { connection: connection?.name || connectionId })}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/kafka/${connectionId}/topics`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tc("back")}
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{tc("details")}</TabsTrigger>
          <TabsTrigger value="produce">{t("topicDetail.produce.tab")}</TabsTrigger>
          <TabsTrigger value="consume">{t("topicDetail.consume.tab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <DetailsTab />
        </TabsContent>

        <TabsContent value="produce" className="mt-4">
          <ProduceTab connectionId={connectionId} topic={topic} />
        </TabsContent>

        <TabsContent value="consume" className="mt-4">
          <ConsumeTab connectionId={connectionId} topic={topic} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
