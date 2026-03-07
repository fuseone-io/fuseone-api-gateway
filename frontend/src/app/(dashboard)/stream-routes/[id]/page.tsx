"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Plus, Save, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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
import { PageHeader } from "@/components/page-header"
import { api } from "@/lib/api-client"
import type { APISIXStreamRoute } from "@/types/apisix"

const STREAM_PLUGINS = [
  {
    name: "ip-restriction",
    label: "IP Restriction",
    description: "Whitelist or blacklist client IPs",
  },
  {
    name: "limit-conn",
    label: "Connection Limit",
    description: "Limit concurrent connections",
  },
  {
    name: "mqtt-proxy",
    label: "MQTT Proxy",
    description: "Dynamic routing based on MQTT client_id",
  },
  {
    name: "syslog",
    label: "Syslog",
    description: "Forward stream access logs to syslog",
  },
] as const

interface UpstreamNode {
  host: string
  port: number
  weight: number
}

export default function StreamRouteDetailPage() {
  const t = useTranslations("streamRoutes")
  const tc = useTranslations("common")
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [route, setRoute] = useState<APISIXStreamRoute | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Basic
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")

  // Match conditions
  const [remoteAddr, setRemoteAddr] = useState("")
  const [serverAddr, setServerAddr] = useState("")
  const [serverPort, setServerPort] = useState("")
  const [sni, setSni] = useState("")

  // Upstream
  const [upstreamMode, setUpstreamMode] = useState<"inline" | "ref">("inline")
  const [upstreamId, setUpstreamId] = useState("")
  const [nodes, setNodes] = useState<UpstreamNode[]>([
    { host: "", port: 0, weight: 1 },
  ])
  const [lbType, setLbType] = useState<"roundrobin" | "chash" | "least_conn">(
    "roundrobin"
  )
  const [upstreamScheme, setUpstreamScheme] = useState<"tcp" | "tls">("tcp")

  // Protocol (xRPC)
  const [enableProtocol, setEnableProtocol] = useState(false)
  const [protocolName, setProtocolName] = useState("redis")
  const [protocolConf, setProtocolConf] = useState("{}")

  // Plugins
  const [plugins, setPlugins] = useState<
    Record<string, Record<string, unknown>>
  >({})
  const [editingPlugin, setEditingPlugin] = useState<string | null>(null)
  const [pluginJson, setPluginJson] = useState("{}")

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const data = (await api.getResource(
        "stream-routes",
        id
      )) as APISIXStreamRoute
      setRoute(data)
      setName(data.name || "")
      setDesc(data.desc || "")
      setRemoteAddr(data.remote_addr || "")
      setServerAddr(data.server_addr || "")
      setServerPort(data.server_port ? String(data.server_port) : "")
      setSni(data.sni || "")

      if (data.upstream_id) {
        setUpstreamMode("ref")
        setUpstreamId(data.upstream_id)
      } else if (data.upstream) {
        setUpstreamMode("inline")
        setLbType(
          (data.upstream.type as "roundrobin" | "chash" | "least_conn") ||
            "roundrobin"
        )
        setUpstreamScheme(
          data.upstream.scheme === "tls" ? "tls" : "tcp"
        )
        if (Array.isArray(data.upstream.nodes)) {
          setNodes(
            data.upstream.nodes.map((n) => ({
              host: n.host,
              port: n.port,
              weight: n.weight,
            }))
          )
        } else if (data.upstream.nodes) {
          setNodes(
            Object.entries(data.upstream.nodes).map(([addr, weight]) => {
              const [host, port] = addr.split(":")
              return { host, port: parseInt(port) || 0, weight }
            })
          )
        }
      }

      if (data.protocol?.name) {
        setEnableProtocol(true)
        setProtocolName(data.protocol.name)
        setProtocolConf(
          JSON.stringify(data.protocol.conf || {}, null, 2)
        )
      }

      setPlugins(
        (data.plugins || {}) as Record<string, Record<string, unknown>>
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : tc("failedToLoad", { resource: t("streamRoute") })
      )
    } finally {
      setLoading(false)
    }
  }

  const handleAddNode = () => {
    setNodes([...nodes, { host: "", port: 0, weight: 1 }])
  }

  const handleRemoveNode = (index: number) => {
    setNodes(nodes.filter((_, i) => i !== index))
  }

  const handleNodeChange = (
    index: number,
    field: keyof UpstreamNode,
    value: string | number
  ) => {
    const updated = [...nodes]
    updated[index] = { ...updated[index], [field]: value }
    setNodes(updated)
  }

  const handleAddPlugin = (pluginName: string) => {
    if (plugins[pluginName]) return
    setEditingPlugin(pluginName)
    setPluginJson(JSON.stringify(getDefaultPluginConfig(pluginName), null, 2))
  }

  const handleSavePlugin = () => {
    if (!editingPlugin) return
    try {
      const config = JSON.parse(pluginJson || "{}")
      setPlugins({ ...plugins, [editingPlugin]: config })
      setEditingPlugin(null)
    } catch {
      toast.error("Invalid JSON")
    }
  }

  const handleRemovePlugin = (pluginName: string) => {
    const next = { ...plugins }
    delete next[pluginName]
    setPlugins(next)
  }

  const handleSave = async () => {
    const validNodes = nodes.filter((n) => n.host.trim() && n.port > 0)
    if (upstreamMode === "inline" && validNodes.length === 0) {
      toast.error(t("validation.nodeRequired"))
      return
    }
    if (upstreamMode === "ref" && !upstreamId.trim()) {
      toast.error(t("validation.upstreamIdRequired"))
      return
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {}
      if (name.trim()) body.name = name.trim()
      if (desc.trim()) body.desc = desc.trim()
      body.remote_addr = remoteAddr.trim() || undefined
      body.server_addr = serverAddr.trim() || undefined
      body.server_port = serverPort.trim()
        ? parseInt(serverPort)
        : undefined
      body.sni = sni.trim() || undefined

      if (upstreamMode === "inline") {
        body.upstream = {
          type: lbType,
          nodes: validNodes.map((n) => ({
            host: n.host.trim(),
            port: n.port,
            weight: n.weight,
          })),
          ...(upstreamScheme === "tls" ? { scheme: "tls" } : {}),
        }
        body.upstream_id = undefined
      } else {
        body.upstream_id = upstreamId.trim()
        body.upstream = undefined
      }

      if (enableProtocol && protocolName.trim()) {
        let conf: Record<string, unknown> | undefined
        try {
          const parsed = JSON.parse(protocolConf || "{}")
          if (Object.keys(parsed).length > 0) conf = parsed
        } catch {
          /* ignore */
        }
        body.protocol = {
          name: protocolName.trim(),
          ...(conf ? { conf } : {}),
        }
      } else {
        body.protocol = undefined
      }

      body.plugins =
        Object.keys(plugins).length > 0 ? plugins : undefined

      await api.updateResource("stream-routes", id, body)
      toast.success(t("toasts.saved"))
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : tc("failedToSave", { resource: t("streamRoute") })
      )
    } finally {
      setSaving(false)
    }
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

  if (!route) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-lg font-medium text-muted-foreground">
          {t("notFound")}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/stream-routes")}
        >
          {t("backToList")}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("detailTitle")}: ${name || id}`}
        description={t("detailDescription")}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/stream-routes")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tc("back")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? tc("saving") : tc("save")}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 max-w-2xl">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t("basicInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("nameOptional")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-tcp-route"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("descriptionOptional")}</Label>
              <Input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Route for MySQL traffic"
              />
            </div>
          </CardContent>
        </Card>

        {/* Match Conditions */}
        <Card>
          <CardHeader>
            <CardTitle>{t("matchConditions")}</CardTitle>
            <CardDescription>
              {t("matchConditionsDetailDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("clientIpCidr")}</Label>
              <Input
                value={remoteAddr}
                onChange={(e) => setRemoteAddr(e.target.value)}
                placeholder="192.168.0.0/24 or 10.0.0.1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("serverAddress")}</Label>
                <Input
                  value={serverAddr}
                  onChange={(e) => setServerAddr(e.target.value)}
                  placeholder="0.0.0.0"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("serverPort")}</Label>
                <Input
                  type="number"
                  value={serverPort}
                  onChange={(e) => setServerPort(e.target.value)}
                  placeholder="9100"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("sniLabel")}</Label>
              <Input
                value={sni}
                onChange={(e) => setSni(e.target.value)}
                placeholder="db.example.com"
              />
              <p className="text-xs text-muted-foreground">
                {t("sniHint")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Upstream */}
        <Card>
          <CardHeader>
            <CardTitle>{t("upstream")}</CardTitle>
            <CardDescription>
              {t("upstreamDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("mode")}</Label>
              <Select
                value={upstreamMode}
                onValueChange={(v) =>
                  setUpstreamMode(v as "inline" | "ref")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inline">
                    {t("modeInline")}
                  </SelectItem>
                  <SelectItem value="ref">
                    {t("modeReference")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {upstreamMode === "ref" ? (
              <div className="space-y-2">
                <Label>{t("upstreamId")}</Label>
                <Input
                  value={upstreamId}
                  onChange={(e) => setUpstreamId(e.target.value)}
                  placeholder={t("upstreamIdPlaceholder")}
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("loadBalancing")}</Label>
                    <Select
                      value={lbType}
                      onValueChange={(v) =>
                        setLbType(
                          v as "roundrobin" | "chash" | "least_conn"
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="roundrobin">
                          {t("lbRoundRobin")}
                        </SelectItem>
                        <SelectItem value="chash">
                          {t("lbConsistentHash")}
                        </SelectItem>
                        <SelectItem value="least_conn">
                          {t("lbLeastConn")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("upstreamScheme")}</Label>
                    <Select
                      value={upstreamScheme}
                      onValueChange={(v) =>
                        setUpstreamScheme(v as "tcp" | "tls")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tcp">
                          {t("schemeTcp")}
                        </SelectItem>
                        <SelectItem value="tls">
                          {t("schemeTls")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("nodes")}</Label>
                  <div className="space-y-2">
                    {nodes.map((node, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <Input
                          value={node.host}
                          onChange={(e) =>
                            handleNodeChange(i, "host", e.target.value)
                          }
                          placeholder="Host"
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={node.port || ""}
                          onChange={(e) =>
                            handleNodeChange(
                              i,
                              "port",
                              parseInt(e.target.value) || 0
                            )
                          }
                          placeholder="Port"
                          className="w-24"
                        />
                        <Input
                          type="number"
                          value={node.weight}
                          onChange={(e) =>
                            handleNodeChange(
                              i,
                              "weight",
                              parseInt(e.target.value) || 1
                            )
                          }
                          placeholder="Weight"
                          className="w-20"
                          min={0}
                        />
                        {nodes.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive shrink-0"
                            onClick={() => handleRemoveNode(i)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddNode}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t("addNode")}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      host : port : weight
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Protocol (xRPC) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("protocol")}</CardTitle>
                <CardDescription>
                  {t("protocolDetailDescription")}
                </CardDescription>
              </div>
              <Switch
                checked={enableProtocol}
                onCheckedChange={setEnableProtocol}
              />
            </div>
          </CardHeader>
          {enableProtocol && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("protocolLabel")}</Label>
                <Select
                  value={protocolName}
                  onValueChange={setProtocolName}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="redis">Redis</SelectItem>
                    <SelectItem value="dubbo">Dubbo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("protocolConfigJson")}</Label>
                <Textarea
                  value={protocolConf}
                  onChange={(e) => setProtocolConf(e.target.value)}
                  className="font-mono text-xs min-h-[100px]"
                  placeholder="{}"
                />
              </div>
            </CardContent>
          )}
        </Card>

        {/* Plugins / Access Control */}
        <Card>
          <CardHeader>
            <CardTitle>{t("plugins")}</CardTitle>
            <CardDescription>
              {t("pluginsDetailDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.keys(plugins).length > 0 &&
              Object.entries(plugins).map(([pluginName, config]) => {
                const def = STREAM_PLUGINS.find(
                  (p) => p.name === pluginName
                )
                return (
                  <div
                    key={pluginName}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {def?.label || pluginName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {def?.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingPlugin(pluginName)
                          setPluginJson(
                            JSON.stringify(config, null, 2)
                          )
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
              })}

            <div className="flex flex-wrap gap-2">
              {STREAM_PLUGINS.filter((p) => !plugins[p.name]).map(
                (plugin) => (
                  <Button
                    key={plugin.name}
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddPlugin(plugin.name)}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    {plugin.label}
                  </Button>
                )
              )}
            </div>

            {editingPlugin && (
              <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    {STREAM_PLUGINS.find(
                      (p) => p.name === editingPlugin
                    )?.label || editingPlugin}
                  </Label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setEditingPlugin(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Textarea
                  value={pluginJson}
                  onChange={(e) => setPluginJson(e.target.value)}
                  className="font-mono text-xs min-h-[120px]"
                  placeholder="{}"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSavePlugin}>
                    {t("apply")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingPlugin(null)}
                  >
                    {tc("cancel")}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function getDefaultPluginConfig(pluginName: string): Record<string, unknown> {
  switch (pluginName) {
    case "ip-restriction":
      return { whitelist: ["127.0.0.1", "10.0.0.0/8"] }
    case "limit-conn":
      return {
        conn: 100,
        burst: 50,
        default_conn_delay: 0.1,
        key_type: "var",
        key: "remote_addr",
      }
    case "mqtt-proxy":
      return { protocol_name: "MQTT", protocol_level: 4 }
    case "syslog":
      return {
        host: "127.0.0.1",
        port: 514,
        flush_limit: 4096,
      }
    default:
      return {}
  }
}
