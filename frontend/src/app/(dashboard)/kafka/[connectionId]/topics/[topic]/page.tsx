"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
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
        {expanded ? "Recolher" : "Expandir"}
      </button>
    </div>
  )
}

function DetailsTab() {
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
          <p className="text-muted-foreground">Nenhuma informacao de particao disponivel</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Particoes</CardTitle>
        <CardDescription>
          {currentTopic.partitions.length} particao(es) no topico {currentTopic.name}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Particao</TableHead>
              <TableHead>Lider</TableHead>
              <TableHead>Replicas</TableHead>
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
      toast.error("O valor da mensagem e obrigatorio")
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
      toast.success("Mensagem enviada com sucesso")
      setValue("")
      setKey("")
      setHeaders([])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar mensagem")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Produzir Mensagem</CardTitle>
        <CardDescription>
          Envie uma mensagem para o topico {topic}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="msg-key">Chave (opcional)</Label>
          <Input
            id="msg-key"
            placeholder="Chave da mensagem"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="msg-value">Valor *</Label>
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
            <Label>Headers</Label>
            <Button variant="outline" size="sm" onClick={handleAddHeader}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Adicionar
            </Button>
          </div>
          {headers.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="Chave"
                value={h.key}
                onChange={(e) => handleHeaderChange(i, "key", e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Valor"
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
          {producing ? "Enviando..." : "Enviar Mensagem"}
        </Button>
      </CardContent>
    </Card>
  )
}

function ConsumeTab({ connectionId, topic }: { connectionId: string; topic: string }) {
  const { consumeMessages, messages, loadingMessages } = useKafkaStore()
  const [groupId, setGroupId] = useState("")
  const [maxBytes, setMaxBytes] = useState("")

  const handleConsume = async () => {
    if (!groupId.trim()) {
      toast.error("Group ID e obrigatorio")
      return
    }

    try {
      await consumeMessages(connectionId, topic, {
        group_id: groupId.trim(),
        max_bytes: maxBytes ? Number(maxBytes) : undefined,
      })
      toast.success("Mensagens consumidas")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao consumir mensagens")
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consumir Mensagens</CardTitle>
          <CardDescription>
            Consuma mensagens do topico {topic}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="consume-group">Group ID *</Label>
              <Input
                id="consume-group"
                placeholder="my-consumer-group"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consume-max">Max Bytes</Label>
              <Input
                id="consume-max"
                type="number"
                placeholder="1048576"
                value={maxBytes}
                onChange={(e) => setMaxBytes(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleConsume} disabled={loadingMessages}>
            {loadingMessages ? "Consumindo..." : "Consumir"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {messages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mensagens ({messages.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Offset</TableHead>
                  <TableHead className="w-[80px]">Particao</TableHead>
                  <TableHead className="w-[120px]">Chave</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="w-[140px]">Headers</TableHead>
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
        description={`Topico na conexao ${connection?.name || connectionId}`}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/kafka/${connectionId}/topics`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Detalhes</TabsTrigger>
          <TabsTrigger value="produce">Produzir</TabsTrigger>
          <TabsTrigger value="consume">Consumir</TabsTrigger>
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
