"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Plus, Save, X, ShieldCheck, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
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
import type { APISIXSSL } from "@/types/apisix"

const TLS_PROTOCOLS = [
  { value: "TLSv1.1", label: "TLS 1.1", deprecated: true },
  { value: "TLSv1.2", label: "TLS 1.2", deprecated: false },
  { value: "TLSv1.3", label: "TLS 1.3", deprecated: false },
] as const

function formatDate(epoch?: number): string {
  if (!epoch) return "—"
  return new Date(epoch * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getExpiryInfo(validity_end?: number) {
  if (!validity_end) return null
  const date = new Date(validity_end * 1000)
  const daysLeft = Math.ceil((date.getTime() - Date.now()) / 86400000)
  return {
    date,
    daysLeft,
    expired: daysLeft < 0,
    expiringSoon: daysLeft >= 0 && daysLeft < 30,
  }
}

export default function SSLDetailPage() {
  const t = useTranslations("ssl")
  const tc = useTranslations("common")
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [sslData, setSslData] = useState<APISIXSSL | null>(null)
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const data = (await api.getResource("ssls", id)) as APISIXSSL
      setSslData(data)
      setCertType(data.type || "server")
      setCert(data.cert || "")
      setKey(data.key || "")
      setSnis(data.snis || [])
      setEnabled(data.status === 1)
      setProtocols(data.ssl_protocols || ["TLSv1.2", "TLSv1.3"])

      if (data.client?.ca) {
        setEnableMtls(true)
        setClientCA(data.client.ca)
        setVerifyDepth(data.client.depth || 1)
        setSkipUris(data.client.skip_mtls_uri_regex || [])
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : tc("failedToLoad", { resource: t("certificate") })
      )
    } finally {
      setLoading(false)
    }
  }

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
      toast.error(t("validation.certRequired"))
      return
    }
    if (!key.trim()) {
      toast.error(t("validation.keyRequired"))
      return
    }
    if (snis.length === 0) {
      toast.error(t("validation.sniRequired"))
      return
    }
    if (enableMtls && !clientCA.trim()) {
      toast.error(t("validation.caRequired"))
      return
    }

    setSaving(true)
    try {
      await api.updateResource("ssls", id, {
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
      toast.success(t("toasts.saved"))
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : tc("failedToSave", { resource: t("certificate") })
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

  if (!sslData) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-lg font-medium text-muted-foreground">
          {t("notFound")}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/ssl")}
        >
          {t("backToList")}
        </Button>
      </div>
    )
  }

  const expiry = getExpiryInfo(sslData.validity_end)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("detailTitle")}: ${id}`}
        description={t("detailDescription")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/ssl")}>
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
        {/* Validity Info */}
        {(sslData.validity_start || sslData.validity_end) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {t("validity")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">{t("validFrom")}</p>
                  <p className="font-medium">
                    {formatDate(sslData.validity_start)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t("validUntil")}</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {formatDate(sslData.validity_end)}
                    </p>
                    {expiry && (
                      <Badge
                        variant={
                          expiry.expired
                            ? "destructive"
                            : expiry.expiringSoon
                              ? "secondary"
                              : "outline"
                        }
                        className="text-xs"
                      >
                        {expiry.expired
                          ? t("expired")
                          : t("daysLeft", { days: expiry.daysLeft })}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Certificate */}
        <Card>
          <CardHeader>
            <CardTitle>{t("certificate")}</CardTitle>
            <CardDescription>
              {t("certDetailDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{tc("type")}</Label>
              <Select
                value={certType}
                onValueChange={(v) => setCertType(v as "server" | "client")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="server">
                    {t("typeServer")}
                  </SelectItem>
                  <SelectItem value="client">
                    {t("typeClient")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("certPem")}</Label>
              <Textarea
                value={cert}
                onChange={(e) => setCert(e.target.value)}
                className="font-mono text-xs min-h-[140px]"
                placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("privateKeyPem")}</Label>
              <Textarea
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="font-mono text-xs min-h-[140px]"
                placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("sniDomains")}</Label>
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
                {t("sniDomainsHint")}
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
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    {t("mtls")}
                  </CardTitle>
                  <CardDescription>
                    {t("mtlsDescription")}
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
                  <Label>{t("caCertPem")}</Label>
                  <Textarea
                    value={clientCA}
                    onChange={(e) => setClientCA(e.target.value)}
                    className="font-mono text-xs min-h-[140px]"
                    placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("caCertHint")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t("verifyDepth")}</Label>
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
                    {t("verifyDepthHint")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t("skipMtlsUris")}</Label>
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
                    {t("skipMtlsUrisHint")}
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("settings")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("tlsProtocols")}</Label>
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
                <Label>{tc("status")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("statusHint")}
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
