"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Save, Sliders } from "lucide-react"
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
import { Separator } from "@/components/ui/separator"
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
      toast.error("Gateway name is required")
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
      toast.success("Settings saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">General Settings</h3>
          <p className="text-sm text-muted-foreground mt-1">Gateway name, preferences, and defaults</p>
        </div>
        <Skeleton className="h-[300px] rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">General Settings</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Gateway name, preferences, and defaults
          </p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1.5" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="rounded-lg border p-6 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <Sliders className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-medium">Identity</h4>
        </div>

        <div className="grid gap-4 max-w-lg">
          <div className="space-y-2">
            <Label>Gateway Name</Label>
            <Input
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="FuseOne API Gateway"
            />
            <p className="text-xs text-muted-foreground">
              Displayed in the sidebar and page headers
            </p>
          </div>
        </div>

        <Separator />

        <div className="flex items-center gap-2 mb-2">
          <Sliders className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-medium">Preferences</h4>
        </div>

        <div className="grid gap-4 max-w-lg">
          <div className="space-y-2">
            <Label>Time Zone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue placeholder="Select timezone..." />
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
            <Label>Date Format</Label>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger>
                <SelectValue placeholder="Select format..." />
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
            <Label>Default Page Size</Label>
            <Select value={defaultPageSize} onValueChange={setDefaultPageSize}>
              <SelectTrigger>
                <SelectValue placeholder="Select page size..." />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((ps) => (
                  <SelectItem key={ps.value} value={ps.value}>
                    {ps.label} items per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Default number of items shown in tables
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
