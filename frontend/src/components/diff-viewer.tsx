"use client"

import type { DiffResult, DiffEntry } from "@/types/promotion"
import { Badge } from "@/components/ui/badge"

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "null"
  if (typeof val === "string") return `"${val}"`
  if (typeof val === "object") return JSON.stringify(val, null, 2)
  return String(val)
}

function DiffEntryRow({ entry, type }: { entry: DiffEntry; type: "added" | "removed" | "changed" }) {
  const colors = {
    added: { bg: "bg-green-500/10", text: "text-green-600", badge: "bg-green-500/20 text-green-700" },
    removed: { bg: "bg-red-500/10", text: "text-red-600", badge: "bg-red-500/20 text-red-700" },
    changed: { bg: "bg-amber-500/10", text: "text-amber-600", badge: "bg-amber-500/20 text-amber-700" },
  }
  const c = colors[type]

  return (
    <div className={`${c.bg} rounded-md px-3 py-2 text-sm`}>
      <div className="flex items-center gap-2 mb-1">
        <Badge variant="outline" className={`text-[10px] ${c.badge} border-0`}>
          {type}
        </Badge>
        <code className={`font-mono text-xs ${c.text}`}>{entry.path}</code>
      </div>
      {type === "changed" && (
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          <div className="text-xs">
            <span className="text-muted-foreground">old: </span>
            <code className="text-red-500 break-all">{formatValue(entry.old_value)}</code>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">new: </span>
            <code className="text-green-500 break-all">{formatValue(entry.new_value)}</code>
          </div>
        </div>
      )}
      {type === "added" && entry.new_value !== undefined && (
        <div className="text-xs mt-1">
          <code className="text-green-500 break-all">{formatValue(entry.new_value)}</code>
        </div>
      )}
      {type === "removed" && entry.old_value !== undefined && (
        <div className="text-xs mt-1">
          <code className="text-red-500 break-all">{formatValue(entry.old_value)}</code>
        </div>
      )}
    </div>
  )
}

export function DiffViewer({ diff }: { diff: DiffResult }) {
  const totalChanges =
    (diff.added?.length || 0) + (diff.removed?.length || 0) + (diff.changed?.length || 0)

  if (totalChanges === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        No differences found
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
        {(diff.added?.length || 0) > 0 && (
          <span className="text-green-600">+{diff.added!.length} added</span>
        )}
        {(diff.removed?.length || 0) > 0 && (
          <span className="text-red-600">-{diff.removed!.length} removed</span>
        )}
        {(diff.changed?.length || 0) > 0 && (
          <span className="text-amber-600">~{diff.changed!.length} changed</span>
        )}
      </div>
      {diff.added?.map((e, i) => (
        <DiffEntryRow key={`a-${i}`} entry={e} type="added" />
      ))}
      {diff.removed?.map((e, i) => (
        <DiffEntryRow key={`r-${i}`} entry={e} type="removed" />
      ))}
      {diff.changed?.map((e, i) => (
        <DiffEntryRow key={`c-${i}`} entry={e} type="changed" />
      ))}
    </div>
  )
}
