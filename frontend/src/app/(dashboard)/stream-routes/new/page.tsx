"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Plus, Save, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import { api } from "@/lib/api-client"

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

export default function NewStreamRoutePage() {
  const router = useRouter()
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
      toast.error("At least one upstream node is required")
      return
    }
    if (upstreamMode === "ref" && !upstreamId.trim()) {
      toast.error("Upstream ID is required")
      return
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {}
      if (name.trim()) body.name = name.trim()
      if (desc.trim()) body.desc = desc.trim()
      if (remoteAddr.trim()) body.remote_addr = remoteAddr.trim()
      if (serverAddr.trim()) body.server_addr = serverAddr.trim()
      if (serverPort.trim()) body.server_port = parseInt(serverPort)
      if (sni.trim()) body.sni = sni.trim()

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
      } else {
        body.upstream_id = upstreamId.trim()
      }

      if (enableProtocol && protocolName.trim()) {
        let conf: Record<string, unknown> | undefined
        try {
          const parsed = JSON.parse(protocolConf || "{}")
          if (Object.keys(parsed).length > 0) conf = parsed
        } catch {
          /* ignore */
        }
        body.protocol = { name: protocolName.trim(), ...(conf ? { conf } : {}) }
      }

      if (Object.keys(plugins).length > 0) {
        body.plugins = plugins
      }

      await api.createResource("stream-routes", body)
      toast.success("Stream route created")
      router.push("/stream-routes")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create stream route"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Stream Route"
        description="Create a TCP/UDP Layer 4 proxy route"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/stream-routes")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Creating..." : "Create Route"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 max-w-2xl">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Info</CardTitle>
            <CardDescription>
              Name and description for this stream route
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name (optional)</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-tcp-route"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
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
            <CardTitle>Match Conditions</CardTitle>
            <CardDescription>
              Filter incoming connections by L4 attributes. Leave empty to match
              all traffic on the stream listen port.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Client IP / CIDR</Label>
              <Input
                value={remoteAddr}
                onChange={(e) => setRemoteAddr(e.target.value)}
                placeholder="192.168.0.0/24 or 10.0.0.1"
              />
              <p className="text-xs text-muted-foreground">
                Match connections from this client IP address or CIDR range
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Server Address</Label>
                <Input
                  value={serverAddr}
                  onChange={(e) => setServerAddr(e.target.value)}
                  placeholder="0.0.0.0"
                />
                <p className="text-xs text-muted-foreground">
                  The gateway address that accepted the connection
                </p>
              </div>
              <div className="space-y-2">
                <Label>Server Port</Label>
                <Input
                  type="number"
                  value={serverPort}
                  onChange={(e) => setServerPort(e.target.value)}
                  placeholder="9100"
                />
                <p className="text-xs text-muted-foreground">
                  The gateway listening port
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>SNI (TLS Server Name)</Label>
              <Input
                value={sni}
                onChange={(e) => setSni(e.target.value)}
                placeholder="db.example.com"
              />
              <p className="text-xs text-muted-foreground">
                Match by TLS Server Name Indication. Requires TLS-enabled
                stream listener.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Upstream */}
        <Card>
          <CardHeader>
            <CardTitle>Upstream</CardTitle>
            <CardDescription>
              Where to forward matched TCP/UDP connections
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Mode</Label>
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
                    Inline — Define nodes here
                  </SelectItem>
                  <SelectItem value="ref">
                    Reference — Use existing upstream
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {upstreamMode === "ref" ? (
              <div className="space-y-2">
                <Label>Upstream ID</Label>
                <Input
                  value={upstreamId}
                  onChange={(e) => setUpstreamId(e.target.value)}
                  placeholder="Enter upstream ID"
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Load Balancing</Label>
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
                        <SelectItem value="roundrobin">Round Robin</SelectItem>
                        <SelectItem value="chash">
                          Consistent Hash
                        </SelectItem>
                        <SelectItem value="least_conn">
                          Least Connections
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Upstream Scheme</Label>
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
                        <SelectItem value="tcp">TCP (plain)</SelectItem>
                        <SelectItem value="tls">TLS (encrypted)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Nodes</Label>
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
                      Add Node
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
                <CardTitle>Protocol (xRPC)</CardTitle>
                <CardDescription>
                  Enable application-layer protocol awareness on the TCP stream
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
                <Label>Protocol</Label>
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
                <p className="text-xs text-muted-foreground">
                  Enables protocol-aware routing, metrics, and fault injection
                </p>
              </div>
              <div className="space-y-2">
                <Label>Protocol Configuration (JSON, optional)</Label>
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
            <CardTitle>Plugins</CardTitle>
            <CardDescription>
              Access control, connection limits, and logging for this stream
              route
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.keys(plugins).length > 0 &&
              Object.entries(plugins).map(([pluginName, config]) => {
                const def = STREAM_PLUGINS.find((p) => p.name === pluginName)
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
                          setPluginJson(JSON.stringify(config, null, 2))
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
              })}

            <div className="flex flex-wrap gap-2">
              {STREAM_PLUGINS.filter((p) => !plugins[p.name]).map((plugin) => (
                <Button
                  key={plugin.name}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddPlugin(plugin.name)}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {plugin.label}
                </Button>
              ))}
            </div>

            {editingPlugin && (
              <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    {STREAM_PLUGINS.find((p) => p.name === editingPlugin)
                      ?.label || editingPlugin}
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
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingPlugin(null)}
                  >
                    Cancel
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
