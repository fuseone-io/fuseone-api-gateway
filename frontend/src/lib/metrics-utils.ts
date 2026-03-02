import type { TimeRange, DateRangeValue } from "@/types/metrics"

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  if (i === 0) return `${bytes} B`
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

export function formatLatency(ms: number): string {
  if (ms === 0) return "0 ms"
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`
  if (ms < 1) return `${ms.toFixed(2)} ms`
  return `${Math.round(ms)} ms`
}

export function formatErrorRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

export function formatTimestamp(ts: string, range_: TimeRange): string {
  const d = new Date(ts)
  if (range_ === "1h" || range_ === "6h") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }
  if (range_ === "24h") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit" })
}

export function formatTimestampForSpan(ts: string, spanHours: number): string {
  const d = new Date(ts)
  if (spanHours <= 24) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }
  if (spanHours <= 7 * 24) {
    return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit" })
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" })
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// Converts DateRangeValue to query params for the API client.
export function dateRangeToParams(value: DateRangeValue): { range?: TimeRange; from?: string; to?: string } {
  if (value.type === "preset") {
    return { range: value.preset }
  }
  return { from: value.from.toISOString(), to: value.to.toISOString() }
}

// Returns span in hours for a DateRangeValue (used for timestamp formatting).
const PRESET_HOURS: Record<TimeRange, number> = { "1h": 1, "6h": 6, "24h": 24, "7d": 168 }
export function dateRangeSpanHours(value: DateRangeValue): number {
  if (value.type === "preset") return PRESET_HOURS[value.preset]
  return (value.to.getTime() - value.from.getTime()) / (1000 * 60 * 60)
}
