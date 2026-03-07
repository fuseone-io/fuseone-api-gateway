"use client"

import { useCallback, useEffect, useState, useMemo } from "react"
import { useTranslations } from "next-intl"
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Database,
  Info,
  Loader2,
  Plug,
  Save,
  Search,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSearchParams, useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import type { TracingStatus, AnalyticsBackendType, MetricsBackendType, BackendConfig } from "@/types/trace"
import { toast } from "sonner"

const RETENTION_DAYS = ["1", "3", "7", "14", "30", "60", "90"]

const DEFAULTS: TracingStatus = {
  enabled: true,
  sample_rate: 1.0,
  retention_days: 7,
}

const TRACE_BACKEND_KEYS: { value: AnalyticsBackendType; label: string; descKey: string }[] = [
  { value: "postgresql", label: "PostgreSQL", descKey: "postgresqlTraceDesc" },
  { value: "clickhouse", label: "ClickHouse", descKey: "clickhouseDesc" },
  { value: "elasticsearch", label: "Elasticsearch", descKey: "elasticsearchDesc" },
]

const METRICS_BACKEND_KEYS: { value: MetricsBackendType; label: string; descKey: string }[] = [
  { value: "postgresql", label: "PostgreSQL", descKey: "postgresqlMetricsDesc" },
  { value: "clickhouse", label: "ClickHouse", descKey: "clickhouseMetricsDesc" },
  { value: "elasticsearch", label: "Elasticsearch", descKey: "elasticsearchMetricsDesc" },
  { value: "prometheus", label: "Prometheus", descKey: "prometheusDesc" },
  { value: "victoriametrics", label: "VictoriaMetrics", descKey: "victoriaMetricsDesc" },
]

const VALID_SUBTABS = new Set(["traces", "metrics"])

export default function TracingContent() {
  const t = useTranslations("settings.tracing")
  const tc = useTranslations("common")
  const searchParams = useSearchParams()
  const router = useRouter()

  const activeSubtab = useMemo(() => {
    const st = searchParams.get("subtab")
    return st && VALID_SUBTABS.has(st) ? st : "traces"
  }, [searchParams])

  const handleSubtabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "traces") {
      params.delete("subtab")
    } else {
      params.set("subtab", value)
    }
    const qs = params.toString()
    router.replace(`/settings${qs ? `?${qs}` : ""}`, { scroll: false })
  }

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Tracing settings
  const [enabled, setEnabled] = useState(DEFAULTS.enabled)
  const [sampleRate, setSampleRate] = useState(DEFAULTS.sample_rate)
  const [retentionDays, setRetentionDays] = useState(String(DEFAULTS.retention_days))
  const [original, setOriginal] = useState<TracingStatus>(DEFAULTS)

  // Trace backend
  const [activeTraceBackend, setActiveTraceBackend] = useState<AnalyticsBackendType>("postgresql")
  const [selectedTraceBackend, setSelectedTraceBackend] = useState<AnalyticsBackendType>("postgresql")
  const [traceSaving, setTraceSaving] = useState(false)

  // Metrics backend
  const [activeMetricsBackend, setActiveMetricsBackend] = useState<MetricsBackendType>("postgresql")
  const [selectedMetricsBackend, setSelectedMetricsBackend] = useState<MetricsBackendType>("postgresql")
  const [metricsSaving, setMetricsSaving] = useState(false)

  // ClickHouse settings (shared)
  const [chAddr, setChAddr] = useState("localhost:9000")
  const [chDatabase, setChDatabase] = useState("fuseone_analytics")
  const [chUser, setChUser] = useState("fuseone")
  const [chPassword, setChPassword] = useState("")
  const [chTesting, setChTesting] = useState(false)
  const [chTestResult, setChTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Elasticsearch settings (shared)
  const [esAddresses, setEsAddresses] = useState("http://localhost:9200")
  const [esUsername, setEsUsername] = useState("")
  const [esPassword, setEsPassword] = useState("")
  const [esApiKey, setEsApiKey] = useState("")
  const [esIndexPrefix, setEsIndexPrefix] = useState("fuseone")
  const [esTesting, setEsTesting] = useState(false)
  const [esTestResult, setEsTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Prometheus settings
  const [promUrl, setPromUrl] = useState("http://localhost:9090")
  const [promUsername, setPromUsername] = useState("")
  const [promPassword, setPromPassword] = useState("")
  const [promTesting, setPromTesting] = useState(false)
  const [promTestResult, setPromTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const [tracingData, backendStatus, backendSettings] = await Promise.all([
        api.getTracingStatus().catch(() => null),
        api.getAnalyticsBackendStatus().catch(() => null),
        (api.getSetting("analytics_backend") as Promise<Record<string, unknown> | null>).catch(() => null),
      ])
      if (tracingData) {
        setEnabled(tracingData.enabled)
        setSampleRate(tracingData.sample_rate)
        setRetentionDays(String(tracingData.retention_days))
        setOriginal(tracingData)
      }
      if (backendStatus) {
        const traceType = (backendStatus.trace_backend || backendStatus.type || "postgresql") as AnalyticsBackendType
        const metricsType = (backendStatus.metrics_backend || backendStatus.type || "postgresql") as MetricsBackendType
        setActiveTraceBackend(traceType)
        setSelectedTraceBackend(traceType)
        setActiveMetricsBackend(metricsType)
        setSelectedMetricsBackend(metricsType)
      }
      if (backendSettings) {
        const tb = backendSettings.trace_backend as Record<string, unknown> | undefined
        const mb = backendSettings.metrics_backend as Record<string, unknown> | undefined
        const chConfig = (tb?.clickhouse || mb?.clickhouse || backendSettings.clickhouse) as Record<string, string> | undefined
        const esConfig = (tb?.elasticsearch || mb?.elasticsearch || backendSettings.elasticsearch) as Record<string, unknown> | undefined
        const promConfig = (mb?.prometheus) as Record<string, string> | undefined
        if (chConfig) {
          setChAddr(chConfig.addr || "localhost:9000")
          setChDatabase(chConfig.database || "fuseone_analytics")
          setChUser(chConfig.user || "fuseone")
          setChPassword(chConfig.password || "")
        }
        if (esConfig) {
          setEsAddresses((esConfig.addresses as string[])?.join(", ") || "http://localhost:9200")
          setEsUsername((esConfig.username as string) || "")
          setEsPassword((esConfig.password as string) || "")
          setEsApiKey((esConfig.api_key as string) || "")
          setEsIndexPrefix((esConfig.index_prefix as string) || "fuseone")
        }
        if (promConfig) {
          setPromUrl(promConfig.url || "http://localhost:9090")
          setPromUsername(promConfig.username || "")
          setPromPassword(promConfig.password || "")
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const hasTracingChanges =
    enabled !== original.enabled ||
    sampleRate !== original.sample_rate ||
    retentionDays !== String(original.retention_days)

  const handleSaveTracing = async () => {
    setSaving(true)
    try {
      const result = await api.updateTracingSettings({
        enabled, sample_rate: sampleRate, retention_days: parseInt(retentionDays, 10),
      })
      setOriginal(result)
      toast.success(enabled ? t("tracingEnabledSaved") : t("tracingDisabled"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedToSaveTracing"))
    } finally { setSaving(false) }
  }

  const handleTestClickHouse = async () => {
    setChTesting(true); setChTestResult(null)
    try {
      const result = await api.testClickHouseConnection({
        addr: chAddr.trim(), database: chDatabase.trim(), user: chUser.trim(), password: chPassword,
      })
      setChTestResult(result)
      result.ok ? toast.success(t("connectionSuccessful")) : toast.error(result.message)
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("connectionTestFailed")
      setChTestResult({ ok: false, message: msg }); toast.error(msg)
    } finally { setChTesting(false) }
  }

  const handleTestElasticsearch = async () => {
    setEsTesting(true); setEsTestResult(null)
    try {
      const result = await api.testElasticsearchConnection({
        addresses: esAddresses.split(",").map((a) => a.trim()).filter(Boolean),
        username: esUsername.trim(), password: esPassword, api_key: esApiKey.trim(),
      })
      setEsTestResult(result)
      result.ok ? toast.success(t("connectionSuccessful")) : toast.error(result.message)
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("connectionTestFailed")
      setEsTestResult({ ok: false, message: msg }); toast.error(msg)
    } finally { setEsTesting(false) }
  }

  const handleTestPrometheus = async () => {
    setPromTesting(true); setPromTestResult(null)
    try {
      const result = await api.testPrometheusConnection({
        url: promUrl.trim(), username: promUsername.trim(), password: promPassword,
      })
      setPromTestResult(result)
      result.ok ? toast.success(t("connectionSuccessful")) : toast.error(result.message)
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("connectionTestFailed")
      setPromTestResult({ ok: false, message: msg }); toast.error(msg)
    } finally { setPromTesting(false) }
  }

  const buildBackendConfig = (backendType: string): BackendConfig => {
    const config: BackendConfig = { type: backendType }
    if (backendType === "clickhouse") {
      config.clickhouse = { addr: chAddr.trim(), database: chDatabase.trim(), user: chUser.trim(), password: chPassword }
    } else if (backendType === "elasticsearch") {
      config.elasticsearch = {
        addresses: esAddresses.split(",").map((a) => a.trim()).filter(Boolean),
        username: esUsername.trim(), password: esPassword,
        api_key: esApiKey.trim(), index_prefix: esIndexPrefix.trim() || "fuseone",
      }
    } else if (backendType === "prometheus" || backendType === "victoriametrics") {
      config.prometheus = { url: promUrl.trim(), username: promUsername.trim(), password: promPassword }
    }
    return config
  }

  const handleSwitchTraceBackend = async () => {
    setTraceSaving(true)
    try {
      await api.switchTraceBackend(buildBackendConfig(selectedTraceBackend))
      setActiveTraceBackend(selectedTraceBackend)
      toast.success(t("traceSwitchedTo", { backend: TRACE_BACKEND_KEYS.find((o) => o.value === selectedTraceBackend)?.label || "" }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedToSwitchBackend"))
    } finally { setTraceSaving(false) }
  }

  const handleSwitchMetricsBackend = async () => {
    setMetricsSaving(true)
    try {
      await api.switchMetricsBackend(buildBackendConfig(selectedMetricsBackend))
      setActiveMetricsBackend(selectedMetricsBackend)
      toast.success(t("metricsSwitchedTo", { backend: METRICS_BACKEND_KEYS.find((o) => o.value === selectedMetricsBackend)?.label || "" }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedToSwitchBackend"))
    } finally { setMetricsSaving(false) }
  }

  const isExternalMetrics = selectedMetricsBackend === "prometheus" || selectedMetricsBackend === "victoriametrics"

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">{t("title")}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <Skeleton className="h-[40px] w-[240px] rounded-lg" />
        <Skeleton className="h-[300px] rounded-lg" />
        <Skeleton className="h-[300px] rounded-lg" />
      </div>
    )
  }

  // --- Shared config renderers ---

  const renderClickHouseConfig = () => (
    <div className="grid gap-4 max-w-lg pt-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("serverAddress")}</Label>
          <Input value={chAddr} onChange={(e) => setChAddr(e.target.value)} placeholder="localhost:9000" />
          <p className="text-xs text-muted-foreground">{t("hostPortHint")}</p>
        </div>
        <div className="space-y-2">
          <Label>{t("database")}</Label>
          <Input value={chDatabase} onChange={(e) => setChDatabase(e.target.value)} placeholder="fuseone_analytics" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{tc("username")}</Label>
          <Input value={chUser} onChange={(e) => setChUser(e.target.value)} placeholder="default" />
        </div>
        <div className="space-y-2">
          <Label>{tc("password")}</Label>
          <Input type="password" value={chPassword} onChange={(e) => setChPassword(e.target.value)} placeholder={t("leaveEmptyIfNone")} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={handleTestClickHouse} disabled={chTesting || !chAddr.trim()}>
          {chTesting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plug className="h-3.5 w-3.5 mr-1.5" />}
          {t("testConnection")}
        </Button>
        {chTestResult && (
          <div className={`flex items-center gap-1.5 text-xs ${chTestResult.ok ? "text-emerald-600" : "text-destructive"}`}>
            {chTestResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            <span>{chTestResult.message}</span>
          </div>
        )}
      </div>
    </div>
  )

  const renderElasticsearchConfig = () => (
    <div className="grid gap-4 max-w-lg pt-2">
      <div className="space-y-2">
        <Label>{t("serverUrls")}</Label>
        <Input value={esAddresses} onChange={(e) => setEsAddresses(e.target.value)} placeholder="http://localhost:9200" />
        <p className="text-xs text-muted-foreground">{t("esUrlsHint")}</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{tc("username")}</Label>
          <Input value={esUsername} onChange={(e) => setEsUsername(e.target.value)} placeholder={tc("optional")} />
        </div>
        <div className="space-y-2">
          <Label>{tc("password")}</Label>
          <Input type="password" value={esPassword} onChange={(e) => setEsPassword(e.target.value)} placeholder={tc("optional")} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("apiKey")}</Label>
          <Input type="password" value={esApiKey} onChange={(e) => setEsApiKey(e.target.value)} placeholder={t("alternativeToUserPassword")} />
        </div>
        <div className="space-y-2">
          <Label>{t("indexPrefix")}</Label>
          <Input value={esIndexPrefix} onChange={(e) => setEsIndexPrefix(e.target.value)} placeholder="fuseone" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={handleTestElasticsearch} disabled={esTesting || !esAddresses.trim()}>
          {esTesting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
          {t("testConnection")}
        </Button>
        {esTestResult && (
          <div className={`flex items-center gap-1.5 text-xs ${esTestResult.ok ? "text-emerald-600" : "text-destructive"}`}>
            {esTestResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            <span>{esTestResult.message}</span>
          </div>
        )}
      </div>
    </div>
  )

  const renderPrometheusConfig = () => (
    <div className="grid gap-4 max-w-lg pt-2">
      <div className="space-y-2">
        <Label>{t("serverUrl")}</Label>
        <Input value={promUrl} onChange={(e) => setPromUrl(e.target.value)} placeholder="http://prometheus:9090" />
        <p className="text-xs text-muted-foreground">
          {t("apiEndpoint", { name: selectedMetricsBackend === "victoriametrics" ? "VictoriaMetrics" : "Prometheus" })}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{tc("username")}</Label>
          <Input value={promUsername} onChange={(e) => setPromUsername(e.target.value)} placeholder={tc("optional")} />
        </div>
        <div className="space-y-2">
          <Label>{tc("password")}</Label>
          <Input type="password" value={promPassword} onChange={(e) => setPromPassword(e.target.value)} placeholder={tc("optional")} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={handleTestPrometheus} disabled={promTesting || !promUrl.trim()}>
          {promTesting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plug className="h-3.5 w-3.5 mr-1.5" />}
          {t("testConnection")}
        </Button>
        {promTestResult && (
          <div className={`flex items-center gap-1.5 text-xs ${promTestResult.ok ? "text-emerald-600" : "text-destructive"}`}>
            {promTestResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            <span>{promTestResult.message}</span>
          </div>
        )}
      </div>
    </div>
  )

  // --- Render ---

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{t("title")}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("heading")}
        </p>
      </div>

      <Tabs value={activeSubtab} onValueChange={handleSubtabChange} orientation="horizontal" className="!flex-col space-y-6">
        <TabsList className="!flex-row !h-8 w-fit">
          <TabsTrigger value="traces" className="gap-1.5 !w-auto">
            <Activity className="h-3.5 w-3.5" />
            {t("traces")}
          </TabsTrigger>
          <TabsTrigger value="metrics" className="gap-1.5 !w-auto">
            <BarChart3 className="h-3.5 w-3.5" />
            {t("metrics")}
          </TabsTrigger>
        </TabsList>

        {/* ===== TRACES TAB ===== */}
        <TabsContent value="traces" className="space-y-6 mt-0">
          {/* Tracing Status */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h4 className="text-sm font-semibold">{t("tracingConfiguration")}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("tracingConfigDescription")}
                </p>
              </div>
              <Button size="sm" onClick={handleSaveTracing} disabled={saving || !hasTracingChanges}>
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                {saving ? tc("saving") : tc("saveChanges")}
              </Button>
            </div>

            <div className="space-y-6">
              {/* Enable toggle */}
              <div className="flex items-center justify-between max-w-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="tracing-enabled" className="text-sm font-medium">{t("enableTracing")}</Label>
                  <p className="text-xs text-muted-foreground">{t("enableTracingDescription")}</p>
                </div>
                <Switch id="tracing-enabled" checked={enabled} onCheckedChange={setEnabled} />
              </div>

              {/* Sampling */}
              <div className="max-w-lg space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t("sampleRate")}</Label>
                  <span className="text-sm font-mono font-medium text-primary">{(sampleRate * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[sampleRate * 100]}
                  onValueChange={([v]) => setSampleRate(v / 100)}
                  min={1} max={100} step={1} disabled={!enabled}
                />
                <p className="text-xs text-muted-foreground">
                  {t("sampleRateDescription")}
                </p>
              </div>

              {/* Retention */}
              <div className="max-w-lg space-y-2">
                <Label>{t("retentionPeriod")}</Label>
                <Select value={retentionDays} onValueChange={setRetentionDays}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectRetention")} />
                  </SelectTrigger>
                  <SelectContent>
                    {RETENTION_DAYS.map((d) => (
                      <SelectItem key={d} value={d}>{t("retentionDaysOption", { count: parseInt(d) })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("retentionDescription")}</p>
              </div>
            </div>
          </div>

          {/* Trace Storage */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">{t("traceStorage")}</h4>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                    activeTraceBackend === "clickhouse" ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" :
                    activeTraceBackend === "elasticsearch" ? "bg-purple-500/10 text-purple-600 border-purple-200" : ""
                  }`}>
                    {TRACE_BACKEND_KEYS.find((o) => o.value === activeTraceBackend)?.label || "PostgreSQL"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{t("traceStorageDescription")}</p>
              </div>
              <Button size="sm" onClick={handleSwitchTraceBackend} disabled={traceSaving || selectedTraceBackend === activeTraceBackend}>
                {traceSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                {traceSaving ? t("switching") : t("apply")}
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 max-w-lg">
                {TRACE_BACKEND_KEYS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
                      selectedTraceBackend === opt.value
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <input
                      type="radio" name="trace-backend" value={opt.value}
                      checked={selectedTraceBackend === opt.value}
                      onChange={() => setSelectedTraceBackend(opt.value)}
                      className="mt-0.5 accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{opt.label}</span>
                        {opt.value === activeTraceBackend && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{tc("active")}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{t(opt.descKey)}</p>
                    </div>
                  </label>
                ))}
              </div>

              {selectedTraceBackend === "clickhouse" && renderClickHouseConfig()}
              {selectedTraceBackend === "elasticsearch" && renderElasticsearchConfig()}

              {selectedTraceBackend !== "postgresql" && (
                <div className="flex items-start gap-2.5 rounded-md bg-blue-500/5 border border-blue-200/50 px-3 py-2.5 max-w-lg">
                  <Database className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    {t("newDataNotice")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ===== METRICS TAB ===== */}
        <TabsContent value="metrics" className="space-y-6 mt-0">
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">{t("metricsStorage")}</h4>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                    activeMetricsBackend === "clickhouse" ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" :
                    activeMetricsBackend === "elasticsearch" ? "bg-purple-500/10 text-purple-600 border-purple-200" :
                    activeMetricsBackend === "prometheus" ? "bg-orange-500/10 text-orange-600 border-orange-200" :
                    activeMetricsBackend === "victoriametrics" ? "bg-cyan-500/10 text-cyan-600 border-cyan-200" : ""
                  }`}>
                    {METRICS_BACKEND_KEYS.find((o) => o.value === activeMetricsBackend)?.label || "PostgreSQL"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("metricsStorageDescription")}
                </p>
              </div>
              <Button size="sm" onClick={handleSwitchMetricsBackend} disabled={metricsSaving || selectedMetricsBackend === activeMetricsBackend}>
                {metricsSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                {metricsSaving ? t("switching") : t("apply")}
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 max-w-lg">
                {METRICS_BACKEND_KEYS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
                      selectedMetricsBackend === opt.value
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <input
                      type="radio" name="metrics-backend" value={opt.value}
                      checked={selectedMetricsBackend === opt.value}
                      onChange={() => setSelectedMetricsBackend(opt.value as MetricsBackendType)}
                      className="mt-0.5 accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{opt.label}</span>
                        {opt.value === activeMetricsBackend && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{tc("active")}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{t(opt.descKey)}</p>
                    </div>
                  </label>
                ))}
              </div>

              {selectedMetricsBackend === "clickhouse" && renderClickHouseConfig()}
              {selectedMetricsBackend === "elasticsearch" && renderElasticsearchConfig()}
              {(selectedMetricsBackend === "prometheus" || selectedMetricsBackend === "victoriametrics") && renderPrometheusConfig()}

              {isExternalMetrics && (
                <div className="flex items-start gap-2.5 rounded-md bg-amber-500/5 border border-amber-200/50 px-3 py-2.5 max-w-lg">
                  <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {t("externalMetricsNotice", { name: selectedMetricsBackend === "victoriametrics" ? "VictoriaMetrics" : "Prometheus" })}
                  </p>
                </div>
              )}

              {selectedMetricsBackend !== "postgresql" && !isExternalMetrics && (
                <div className="flex items-start gap-2.5 rounded-md bg-blue-500/5 border border-blue-200/50 px-3 py-2.5 max-w-lg">
                  <Database className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    {t("newDataNotice")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
