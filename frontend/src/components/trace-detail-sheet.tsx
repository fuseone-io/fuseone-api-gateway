"use client"

import { useMemo, useState } from "react"
import { Copy, Clock, Activity } from "lucide-react"
import { AIInsightButton } from "@/components/ai-assistant/AIInsightButton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TraceWaterfall } from "./trace-waterfall"
import type { RequestTrace } from "@/types/trace"
import { toast } from "sonner"

function nsToMs(ns: number): string {
  const ms = ns / 1_000_000
  if (ms < 1) return `${(ns / 1_000).toFixed(0)}µs`
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function statusColor(code: number): string {
  if (code >= 200 && code < 300) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
  if (code >= 300 && code < 400) return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
  if (code >= 400 && code < 500) return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
  return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
}

function methodColor(method: string): string {
  switch (method?.toUpperCase()) {
    case "GET": return "text-emerald-600"
    case "POST": return "text-blue-600"
    case "PUT": return "text-amber-600"
    case "DELETE": return "text-red-600"
    case "PATCH": return "text-purple-600"
    default: return "text-muted-foreground"
  }
}

interface TraceDetailSheetProps {
  trace: RequestTrace | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TraceDetailSheet({ trace, open, onOpenChange }: TraceDetailSheetProps) {
  const [tab, setTab] = useState("waterfall")

  const sortedSpans = useMemo(() => {
    if (!trace) return []
    return [...trace.spans].sort((a, b) => b.duration_ns - a.duration_ns)
  }, [trace])

  if (!trace) return null

  const handleCopyTraceId = () => {
    navigator.clipboard.writeText(trace.trace_id)
    toast.success("Trace ID copied")
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="!w-[50vw] !max-w-[50vw] p-0 flex flex-col">
        <SheetHeader className="px-6 pr-12 py-4 border-b shrink-0">
          <SheetTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="flex-1">Request Trace</span>
            <AIInsightButton
              variant="ghost"
              buildPrompt={() => {
                const durationMs = (trace.duration_ns / 1e6).toFixed(1)
                const slowSpans = sortedSpans.slice(0, 3).map((s) => `  - ${s.name}: ${(s.duration_ns / 1e6).toFixed(1)}ms`).join("\n")
                return `Analyze this request trace:\n- ${trace.method} ${trace.uri} → ${trace.status_code}\n- Total duration: ${durationMs}ms\n- Spans: ${trace.spans.length}\n- Service: ${trace.service_name}\n\nSlowest spans:\n${slowSpans || "  (none)"}\n\n${trace.status_code >= 400 ? `This request failed with status ${trace.status_code}. ` : ""}What is causing ${parseFloat(durationMs) > 500 ? "the high latency" : "any issues"} and how can I fix it?`
              }}
            />
          </SheetTitle>

          {/* Request summary */}
          <div className="flex items-center gap-2 mt-2">
            <span className={`font-mono text-sm font-bold ${methodColor(trace.method)}`}>
              {trace.method || "???"}
            </span>
            <span className="text-sm font-mono truncate flex-1">{trace.uri || "/"}</span>
            {trace.status_code > 0 && (
              <Badge className={`text-[10px] ${statusColor(trace.status_code)}`}>
                {trace.status_code}
              </Badge>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {nsToMs(trace.duration_ns)}
            </div>
            <div>{trace.spans.length} spans</div>
            <div className="flex items-center gap-1">
              <span className="font-mono text-[10px]">{trace.trace_id.substring(0, 16)}...</span>
              <Button variant="ghost" size="icon" className="h-4 w-4" onClick={handleCopyTraceId}>
                <Copy className="h-2.5 w-2.5" />
              </Button>
            </div>
            <div className="text-[10px]">
              {new Date(trace.created_at).toLocaleString()}
            </div>
          </div>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="mx-6 mt-3 w-fit">
            <TabsTrigger value="waterfall" className="gap-1.5 text-xs">
              <Activity className="h-3 w-3" />
              Waterfall
            </TabsTrigger>
            <TabsTrigger value="spans" className="gap-1.5 text-xs">
              <Clock className="h-3 w-3" />
              Spans
            </TabsTrigger>
          </TabsList>

          <TabsContent value="waterfall" className="flex-1 overflow-auto px-6 pb-6 mt-3">
            <TraceWaterfall spans={trace.spans} />
          </TabsContent>

          <TabsContent value="spans" className="flex-1 overflow-auto px-6 pb-6 mt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs w-16">Kind</TableHead>
                  <TableHead className="text-xs w-20 text-right">Duration</TableHead>
                  <TableHead className="text-xs w-16">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSpans.map((span) => (
                  <TableRow key={span.span_id}>
                    <TableCell className="text-xs font-mono">{span.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {span.kind}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-right">
                      {nsToMs(span.duration_ns)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          span.status_code === "ERROR"
                            ? "border-red-400 text-red-600"
                            : span.status_code === "OK"
                              ? "border-emerald-400 text-emerald-600"
                              : ""
                        }`}
                      >
                        {span.status_code || "UNSET"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>


        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
