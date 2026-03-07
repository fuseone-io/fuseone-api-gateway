"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Loader2, Save } from "lucide-react"
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
import { api } from "@/lib/api-client"
import { toast } from "sonner"

interface GeneralSettings {
  site_name: string
  default_page_size: number
  timezone: string
  date_format: string
}

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New York (EST)" },
  { value: "America/Chicago", label: "America/Chicago (CST)" },
  { value: "America/Denver", label: "America/Denver (MST)" },
  { value: "America/Los_Angeles", label: "America/Los Angeles (PST)" },
  { value: "America/Sao_Paulo", label: "America/Sao Paulo (BRT)" },
  { value: "Europe/London", label: "Europe/London (GMT)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (CST)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST)" },
]

const DATE_FORMATS = [
  { value: "iso", label: "ISO 8601 (2026-03-02)" },
  { value: "us", label: "US (03/02/2026)" },
  { value: "eu", label: "EU (02/03/2026)" },
  { value: "br", label: "BR (02/03/2026)" },
]

const PAGE_SIZES = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
]

const DEFAULTS: GeneralSettings = {
  site_name: "FuseOne API Gateway",
  default_page_size: 20,
  timezone: "UTC",
  date_format: "iso",
}

export default function GeneralContent() {
  const t = useTranslations("settings.general")
  const tc = useTranslations("common")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [siteName, setSiteName] = useState(DEFAULTS.site_name)
  const [defaultPageSize, setDefaultPageSize] = useState(String(DEFAULTS.default_page_size))
  const [timezone, setTimezone] = useState(DEFAULTS.timezone)
  const [dateFormat, setDateFormat] = useState(DEFAULTS.date_format)

  const [original, setOriginal] = useState<GeneralSettings>(DEFAULTS)

  const fetchSettings = useCallback(async () => {
    try {
      const data = (await api.getSetting("general")) as GeneralSettings | null
      if (data) {
        const merged = { ...DEFAULTS, ...data }
        setSiteName(merged.site_name)
        setDefaultPageSize(String(merged.default_page_size))
        setTimezone(merged.timezone)
        setDateFormat(merged.date_format)
        setOriginal(merged)
      }
    } catch {
      // Setting may not exist yet — use defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const hasChanges =
    siteName !== original.site_name ||
    defaultPageSize !== String(original.default_page_size) ||
    timezone !== original.timezone ||
    dateFormat !== original.date_format

  const handleSave = async () => {
    if (!siteName.trim()) {
      toast.error(t("gatewayNameRequired"))
      return
    }

    setSaving(true)
    try {
      const value: GeneralSettings = {
        site_name: siteName.trim(),
        default_page_size: parseInt(defaultPageSize, 10),
        timezone,
        date_format: dateFormat,
      }
      await api.updateSetting("general", value)
      setOriginal(value)
      toast.success(t("settingsSaved"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedToSaveSettings"))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">{t("heading")}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <Skeleton className="h-[160px] rounded-lg" />
        <Skeleton className="h-[250px] rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t("heading")}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1.5" />
          )}
          {saving ? tc("saving") : tc("saveChanges")}
        </Button>
      </div>

      {/* Identity Card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-5">
          <h4 className="text-sm font-semibold">{t("identity")}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("identityDescription")}
          </p>
        </div>
        <div className="grid gap-4 max-w-lg">
          <div className="space-y-2">
            <Label>{t("gatewayName")}</Label>
            <Input
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="FuseOne API Gateway"
            />
            <p className="text-xs text-muted-foreground">
              {t("gatewayNameHint")}
            </p>
          </div>
        </div>
      </div>

      {/* Preferences Card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-5">
          <h4 className="text-sm font-semibold">{t("preferences")}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("preferencesDescription")}
          </p>
        </div>
        <div className="grid gap-5 max-w-lg">
          <div className="space-y-2">
            <Label>{t("timeZone")}</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectTimezone")} />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("dateFormat")}</Label>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectFormat")} />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("defaultPageSize")}</Label>
            <Select value={defaultPageSize} onValueChange={setDefaultPageSize}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectPageSize")} />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((ps) => (
                  <SelectItem key={ps.value} value={ps.value}>
                    {t("itemsPerPage", { count: ps.label })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("defaultPageSizeHint")}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
