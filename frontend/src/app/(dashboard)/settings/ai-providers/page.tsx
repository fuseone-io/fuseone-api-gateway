"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Bot, Eye, EyeOff, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
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
} from "@/components/ui/alert-dialog"
import { api } from "@/lib/api-client"
import type { LLMConfig, LLMProvider, LLMUsageSummary } from "@/types/llm"

const PROVIDERS: { id: LLMProvider; label: string; models: string[] }[] = [
  { id: "openai",    label: "OpenAI",        models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1"] },
  { id: "anthropic", label: "Anthropic",     models: ["claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001"] },
  { id: "google",    label: "Google Gemini", models: ["gemini-2.5-pro", "gemini-2.5-flash"] },
  { id: "groq",      label: "Groq",          models: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"] },
]

const DEFAULT_PROVIDER: LLMProvider = "openai"

interface FormState {
  provider: LLMProvider
  model: string
  apiKey: string
  showKey: boolean
  enabled: boolean
  dailyQuota: number
  saving: boolean
}

function defaultForm(provider: LLMProvider): FormState {
  const p = PROVIDERS.find((x) => x.id === provider)!
  return {
    provider,
    model: p.models[0],
    apiKey: "",
    showKey: false,
    enabled: false,
    dailyQuota: 100,
    saving: false,
  }
}

export default function AIProvidersPage() {
  const t = useTranslations("settings.aiProviders")
  const tc = useTranslations("common")

  const [configs, setConfigs] = useState<LLMConfig[]>([])
  const [usage, setUsage] = useState<LLMUsageSummary[]>([])
  const [form, setForm] = useState<FormState>(defaultForm(DEFAULT_PROVIDER))
  const [deleteTarget, setDeleteTarget] = useState<LLMProvider | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [cfgs, usageSummaries] = await Promise.all([
        api.listLLMConfigs(),
        api.getLLMUsage().catch(() => [] as LLMUsageSummary[]),
      ])
      setConfigs(cfgs)
      setUsage(usageSummaries)
    } finally {
      setLoading(false)
    }
  }

  // When user picks a different provider, pre-fill with existing config if any
  function handleProviderChange(provider: LLMProvider) {
    const p = PROVIDERS.find((x) => x.id === provider)!
    const existing = configs.find((c) => c.provider === provider)
    setForm({
      provider,
      model: existing?.model ?? p.models[0],
      apiKey: "",
      showKey: false,
      enabled: existing?.enabled ?? false,
      dailyQuota: existing?.daily_quota ?? 100,
      saving: false,
    })
  }

  // When user clicks a configured provider row → select it in the form
  function handleSelectConfigured(provider: LLMProvider) {
    handleProviderChange(provider)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function patch(partial: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...partial }))
  }

  async function handleSave() {
    const existing = configs.find((c) => c.provider === form.provider)
    if (!form.apiKey.trim() && !existing) {
      toast.error(t("apiKeyRequired"))
      return
    }
    patch({ saving: true })
    try {
      await api.upsertLLMConfig(form.provider, {
        model: form.model,
        api_key: form.apiKey,
        enabled: form.enabled,
        daily_quota: form.dailyQuota,
      })
      toast.success(t("saved"))
      patch({ apiKey: "" })
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"))
    } finally {
      patch({ saving: false })
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await api.deleteLLMConfig(deleteTarget)
      toast.success(t("deleted"))
      setDeleteTarget(null)
      // If we just deleted the currently selected provider, reset form
      if (deleteTarget === form.provider) {
        setForm(defaultForm(DEFAULT_PROVIDER))
      }
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("deleteFailed"))
    }
  }

  const selectedProvider = PROVIDERS.find((p) => p.id === form.provider)!
  const existingConfig = configs.find((c) => c.provider === form.provider)

  if (loading) {
    return <div className="text-sm text-muted-foreground">{tc("loading")}</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {/* Single configuration card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" style={{ color: "#950fb8" }} />
            {t("configureTitle")}
          </CardTitle>
          <CardDescription>{t("configureDescription")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Provider selector */}
          <div className="space-y-2">
            <Label>{t("provider")}</Label>
            <Select value={form.provider} onValueChange={(v) => handleProviderChange(v as LLMProvider)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => {
                  const configured = configs.find((c) => c.provider === p.id)
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        {p.label}
                        {configured?.enabled && (
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            {tc("active")}
                          </span>
                        )}
                        {configured && !configured.enabled && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {t("configured")}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Dynamic fields for selected provider */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("model")}</Label>
              <Select value={form.model} onValueChange={(v) => patch({ model: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedProvider.models.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quota">{t("dailyQuota")}</Label>
              <Input
                id="quota"
                type="number"
                min={0}
                value={form.dailyQuota}
                onChange={(e) => patch({ dailyQuota: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">
              {t("apiKey")}
              {existingConfig && (
                <span className="ml-1 text-xs text-muted-foreground">({t("leaveBlankToKeep")})</span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={form.showKey ? "text" : "password"}
                placeholder={existingConfig ? "••••••••••••••••" : t("apiKeyPlaceholder")}
                value={form.apiKey}
                onChange={(e) => patch({ apiKey: e.target.value })}
                className="pr-10"
              />
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="absolute right-1 top-1 h-7 w-7"
                onClick={() => patch({ showKey: !form.showKey })}
              >
                {form.showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              <Switch
                id="enabled"
                checked={form.enabled}
                onCheckedChange={(v) => patch({ enabled: v })}
              />
              <Label htmlFor="enabled" className="cursor-pointer">
                {t("enableProvider")}
              </Label>
            </div>

            <div className="flex items-center gap-2">
              {existingConfig && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(form.provider)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {tc("delete")}
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={form.saving}>
                {form.saving ? tc("saving") : tc("save")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configured providers summary */}
      {configs.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">{t("configuredProviders")}</h4>
          <div className="space-y-2">
            {configs.map((cfg) => {
              const label = PROVIDERS.find((p) => p.id === cfg.provider)?.label ?? cfg.provider
              const usageSummary = usage.find((u) => u.provider === cfg.provider)
              return (
                <button
                  key={cfg.provider}
                  onClick={() => handleSelectConfigured(cfg.provider)}
                  className="w-full rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground">{cfg.model}</span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        cfg.enabled
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {cfg.enabled ? tc("active") : tc("disabled")}
                    </span>
                  </div>
                  {usageSummary && usageSummary.daily_quota > 0 && (
                    <div className="mt-2">
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>{t("usageLabel", { today: usageSummary.today_usage, quota: usageSummary.daily_quota })}</span>
                        <span>{Math.round(usageSummary.quota_percent)}%</span>
                      </div>
                      <Progress value={Math.min(usageSummary.quota_percent, 100)} className="h-1.5" />
                    </div>
                  )}
                  {usageSummary && usageSummary.daily_quota === 0 && usageSummary.today_usage > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("usageUnlimited", { today: usageSummary.today_usage })}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirm", { provider: PROVIDERS.find((p) => p.id === deleteTarget)?.label ?? deleteTarget ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{tc("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
