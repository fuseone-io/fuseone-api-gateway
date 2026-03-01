"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Plus, Save, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
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

const TLS_PROTOCOLS = [
  { value: "TLSv1.1", label: "TLS 1.1", deprecated: true },
  { value: "TLSv1.2", label: "TLS 1.2", deprecated: false },
  { value: "TLSv1.3", label: "TLS 1.3", deprecated: false },
] as const

export default function NewSSLPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  // Certificate
  const [certType, setCertType] = useState<"server" | "client">("server")
  const [cert, setCert] = useState("")
  const [key, setKey] = useState("")
  const [snis, setSnis] = useState<string[]>([])
  const [sniInput, setSniInput] = useState("")

  // mTLS
  const [enableMtls, setEnableMtls] = useState(false)
  const [clientCA, setClientCA] = useState("")
  const [verifyDepth, setVerifyDepth] = useState(1)
  const [skipUris, setSkipUris] = useState<string[]>([])
  const [skipUriInput, setSkipUriInput] = useState("")

  // Settings
  const [protocols, setProtocols] = useState<string[]>(["TLSv1.2", "TLSv1.3"])
  const [enabled, setEnabled] = useState(true)

  const handleAddSni = () => {
    const value = sniInput.trim()
    if (!value || snis.includes(value)) return
    setSnis([...snis, value])
    setSniInput("")
  }

  const handleRemoveSni = (sni: string) => {
    setSnis(snis.filter((s) => s !== sni))
  }

  const handleAddSkipUri = () => {
    const value = skipUriInput.trim()
    if (!value || skipUris.includes(value)) return
    setSkipUris([...skipUris, value])
    setSkipUriInput("")
  }

  const handleRemoveSkipUri = (uri: string) => {
    setSkipUris(skipUris.filter((u) => u !== uri))
  }

  const toggleProtocol = (protocol: string) => {
    setProtocols((prev) =>
      prev.includes(protocol)
        ? prev.filter((p) => p !== protocol)
        : [...prev, protocol]
    )
  }

  const handleSave = async () => {
    if (!cert.trim()) {
      toast.error("Certificate is required")
      return
    }
    if (!key.trim()) {
      toast.error("Private key is required")
      return
    }
    if (snis.length === 0) {
      toast.error("At least one SNI domain is required")
      return
    }
    if (enableMtls && !clientCA.trim()) {
      toast.error("CA certificate is required for mTLS")
      return
    }

    setSaving(true)
    try {
      await api.createResource("ssls", {
        cert: cert.trim(),
        key: key.trim(),
        snis,
        type: certType,
        client: enableMtls
          ? {
              ca: clientCA.trim(),
              depth: verifyDepth,
              skip_mtls_uri_regex:
                skipUris.length > 0 ? skipUris : undefined,
            }
          : undefined,
        ssl_protocols: protocols.length > 0 ? protocols : undefined,
        status: enabled ? 1 : 0,
      })
      toast.success("Certificate created")
      router.push("/ssl")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create certificate"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Certificate"
        description="Add an SSL/TLS certificate for HTTPS termination"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/ssl")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !cert || !key || snis.length === 0}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Creating..." : "Create Certificate"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 max-w-2xl">
        {/* Certificate */}
        <Card>
          <CardHeader>
            <CardTitle>Certificate</CardTitle>
            <CardDescription>
              Upload the PEM-encoded certificate and private key
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={certType}
                onValueChange={(v) => setCertType(v as "server" | "client")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="server">
                    Server — Inbound TLS termination
                  </SelectItem>
                  <SelectItem value="client">
                    Client — Upstream mTLS identity
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {certType === "server"
                  ? "Used to terminate HTTPS connections from clients to the API Gateway"
                  : "Used as client certificate when the API Gateway connects to upstream services"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Certificate (PEM)</Label>
              <Textarea
                value={cert}
                onChange={(e) => setCert(e.target.value)}
                className="font-mono text-xs min-h-[140px]"
                placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
              />
            </div>

            <div className="space-y-2">
              <Label>Private Key (PEM)</Label>
              <Textarea
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="font-mono text-xs min-h-[140px]"
                placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"}
              />
            </div>

            <div className="space-y-2">
              <Label>SNI Domains</Label>
              <div className="flex gap-2">
                <Input
                  value={sniInput}
                  onChange={(e) => setSniInput(e.target.value)}
                  placeholder="api.example.com"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddSni()
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddSni}
                  disabled={!sniInput.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {snis.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {snis.map((sni) => (
                    <Badge
                      key={sni}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {sni}
                      <button
                        onClick={() => handleRemoveSni(sni)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Domains that this certificate will serve. Supports wildcards
                (e.g. *.example.com).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* mTLS — only for server type */}
        {certType === "server" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Mutual TLS (mTLS)</CardTitle>
                  <CardDescription>
                    Require clients to present a certificate
                  </CardDescription>
                </div>
                <Switch
                  checked={enableMtls}
                  onCheckedChange={setEnableMtls}
                />
              </div>
            </CardHeader>
            {enableMtls && (
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>CA Certificate (PEM)</Label>
                  <Textarea
                    value={clientCA}
                    onChange={(e) => setClientCA(e.target.value)}
                    className="font-mono text-xs min-h-[140px]"
                    placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
                  />
                  <p className="text-xs text-muted-foreground">
                    The CA certificate used to verify client certificates
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Verification Depth</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={verifyDepth}
                    onChange={(e) =>
                      setVerifyDepth(parseInt(e.target.value) || 1)
                    }
                    className="w-24"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum depth of the certificate chain to verify
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Skip mTLS for URIs (optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={skipUriInput}
                      onChange={(e) => setSkipUriInput(e.target.value)}
                      placeholder="/health|/public/.*"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleAddSkipUri()
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleAddSkipUri}
                      disabled={!skipUriInput.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {skipUris.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {skipUris.map((uri) => (
                        <Badge
                          key={uri}
                          variant="secondary"
                          className="gap-1 pr-1 font-mono text-xs"
                        >
                          {uri}
                          <button
                            onClick={() => handleRemoveSkipUri(uri)}
                            className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Regex patterns for URIs that should bypass mTLS verification
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>TLS Protocols</Label>
              <div className="flex flex-wrap gap-4">
                {TLS_PROTOCOLS.map((proto) => (
                  <label
                    key={proto.value}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={protocols.includes(proto.value)}
                      onCheckedChange={() => toggleProtocol(proto.value)}
                    />
                    <span>
                      {proto.label}
                      {proto.deprecated && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (deprecated)
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Status</Label>
                <p className="text-xs text-muted-foreground">
                  Enable or disable this certificate
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
