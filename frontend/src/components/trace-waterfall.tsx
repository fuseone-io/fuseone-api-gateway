"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import type { TraceSpan } from "@/types/trace"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface SpanNode {
  span: TraceSpan
  children: SpanNode[]
  depth: number
}

function buildTree(spans: TraceSpan[]): SpanNode[] {
  const byId = new Map<string, SpanNode>()
  const roots: SpanNode[] = []

  for (const span of spans) {
    byId.set(span.span_id, { span, children: [], depth: 0 })
  }

  for (const node of byId.values()) {
    if (node.span.parent_span_id && byId.has(node.span.parent_span_id)) {
      const parent = byId.get(node.span.parent_span_id)!
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  function setDepth(node: SpanNode, depth: number) {
    node.depth = depth
    node.children.sort((a, b) => a.span.start_time_ns - b.span.start_time_ns)
    for (const child of node.children) {
      setDepth(child, depth + 1)
    }
  }
  roots.sort((a, b) => a.span.start_time_ns - b.span.start_time_ns)
  for (const root of roots) setDepth(root, 0)

  return roots
}

function flattenTree(nodes: SpanNode[]): SpanNode[] {
  const result: SpanNode[] = []
  function walk(node: SpanNode) {
    result.push(node)
    for (const child of node.children) walk(child)
  }
  for (const root of nodes) walk(root)
  return result
}

function nsToMs(ns: number): string {
  const ms = ns / 1_000_000
  if (ms < 1) return `${(ns / 1_000).toFixed(0)}µs`
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

const KIND_COLORS: Record<string, { bg: string; border: string }> = {
  server: { bg: "bg-blue-500/80", border: "border-blue-600" },
  client: { bg: "bg-emerald-500/80", border: "border-emerald-600" },
  internal: { bg: "bg-slate-400/80", border: "border-slate-500" },
}

const ERROR_COLORS = { bg: "bg-red-500/80", border: "border-red-600" }

interface TraceWaterfallProps {
  spans: TraceSpan[]
  className?: string
}

export function TraceWaterfall({ spans, className }: TraceWaterfallProps) {
  const { flat, minTime, maxTime, totalDuration } = useMemo(() => {
    const tree = buildTree(spans)
    const flat = flattenTree(tree)
    let minT = Infinity
    let maxT = -Infinity
    for (const s of spans) {
      if (s.start_time_ns < minT) minT = s.start_time_ns
      if (s.end_time_ns > maxT) maxT = s.end_time_ns
    }
    return { flat, minTime: minT, maxTime: maxT, totalDuration: maxT - minT }
  }, [spans])

  if (flat.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        No spans available
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("space-y-0.5", className)}>
        {/* Header */}
        <div className="flex items-center text-[10px] text-muted-foreground px-2 pb-1 border-b">
          <div className="w-[200px] shrink-0 font-medium">Span</div>
          <div className="flex-1 flex justify-between">
            <span>0ms</span>
            <span>{nsToMs(totalDuration)}</span>
          </div>
        </div>

        {/* Spans */}
        {flat.map((node) => {
          const { span } = node
          const offsetPct = ((span.start_time_ns - minTime) / totalDuration) * 100
          const widthPct = Math.max((span.duration_ns / totalDuration) * 100, 0.5)
          const isError = span.status_code === "ERROR"
          const colors = isError ? ERROR_COLORS : (KIND_COLORS[span.kind] || KIND_COLORS.internal)
          const pct = totalDuration > 0 ? ((span.duration_ns / totalDuration) * 100).toFixed(0) : "0"

          return (
            <Tooltip key={span.span_id}>
              <TooltipTrigger asChild>
                <div className="flex items-center hover:bg-muted/50 rounded px-2 py-1 cursor-default group">
                  {/* Label */}
                  <div
                    className="w-[200px] shrink-0 text-xs truncate"
                    style={{ paddingLeft: `${node.depth * 16}px` }}
                  >
                    {node.depth > 0 && (
                      <span className="text-muted-foreground mr-1">
                        {node.depth === 1 ? "├─" : "│ ".repeat(node.depth - 1) + "├─"}
                      </span>
                    )}
                    <span className={cn("font-medium", isError && "text-red-500")}>
                      {span.name}
                    </span>
                  </div>

                  {/* Bar */}
                  <div className="flex-1 relative h-5">
                    <div
                      className={cn(
                        "absolute top-0.5 h-4 rounded-sm border",
                        colors.bg,
                        colors.border,
                        "transition-opacity group-hover:opacity-90"
                      )}
                      style={{
                        left: `${offsetPct}%`,
                        width: `${widthPct}%`,
                        minWidth: "4px",
                      }}
                    />
                    {/* Duration label */}
                    <span
                      className="absolute top-0.5 text-[10px] text-foreground/70 whitespace-nowrap"
                      style={{
                        left: `${Math.min(offsetPct + widthPct + 0.5, 85)}%`,
                      }}
                    >
                      {nsToMs(span.duration_ns)} ({pct}%)
                    </span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-sm">
                <div className="space-y-1 text-xs">
                  <div className="font-semibold">{span.name}</div>
                  <div className="text-muted-foreground">
                    Kind: {span.kind} | Status: {span.status_code || "UNSET"}
                  </div>
                  <div>Duration: {nsToMs(span.duration_ns)}</div>
                  {span.attributes && Object.keys(span.attributes).length > 0 && (
                    <div className="border-t pt-1 mt-1">
                      {Object.entries(span.attributes).slice(0, 8).map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <span className="text-muted-foreground">{k}:</span>
                          <span className="truncate">{v}</span>
                        </div>
                      ))}
                      {Object.keys(span.attributes).length > 8 && (
                        <div className="text-muted-foreground">
                          +{Object.keys(span.attributes).length - 8} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}

        {/* Legend */}
        <div className="flex items-center gap-4 pt-2 px-2 border-t text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-blue-500/80" /> Server
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-emerald-500/80" /> Client
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-slate-400/80" /> Internal
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm bg-red-500/80" /> Error
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
