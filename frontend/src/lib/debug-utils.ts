export function statusColor(status: number): string {
  if (status < 300) return "text-emerald-600"
  if (status < 400) return "text-blue-600"
  if (status < 500) return "text-amber-600"
  return "text-red-600"
}

export function statusBadgeVariant(status: number): "default" | "secondary" | "destructive" | "outline" {
  if (status < 300) return "default"
  if (status < 400) return "secondary"
  if (status < 500) return "outline"
  return "destructive"
}

export function methodColor(method: string): string {
  switch (method.toUpperCase()) {
    case "GET": return "text-emerald-600"
    case "POST": return "text-blue-600"
    case "PUT": return "text-amber-600"
    case "PATCH": return "text-purple-600"
    case "DELETE": return "text-red-600"
    default: return "text-muted-foreground"
  }
}

export function formatLatency(ms: number): string {
  if (ms < 1) return "<1ms"
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function tryFormatJSON(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    return s
  }
}

export function statusBadgeClass(status: number): string {
  if (status < 300) return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
  if (status < 400) return "bg-blue-500/15 text-blue-600 border-blue-500/30"
  if (status < 500) return "bg-amber-500/15 text-amber-600 border-amber-500/30"
  return "bg-red-500/15 text-red-600 border-red-500/30"
}

export interface DebugStats {
  totalRequests: number
  avgLatency: number
  errorRate: number
  p95Latency: number
}

export function computeDebugStats(logs: { latency_total: number; resp_status: number }[], total: number): DebugStats {
  if (logs.length === 0) {
    return { totalRequests: total, avgLatency: 0, errorRate: 0, p95Latency: 0 }
  }

  const latencies = logs.map((l) => l.latency_total).sort((a, b) => a - b)
  const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
  const errorCount = logs.filter((l) => l.resp_status >= 400).length
  const errorRate = Math.round((errorCount / logs.length) * 100)
  const p95Index = Math.ceil(latencies.length * 0.95) - 1
  const p95Latency = latencies[p95Index] || 0

  return { totalRequests: total, avgLatency, errorRate, p95Latency }
}
