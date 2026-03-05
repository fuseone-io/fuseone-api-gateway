"use client"

import { memo } from "react"
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react"
import type { RelationshipCardinality } from "@/types/mindmap"

// ---- Edge data type ----

export type RelationshipEdgeData = {
  cardinality: RelationshipCardinality
  sourceField?: string
  targetField?: string
  label?: string
  onEdit: (edgeId: string) => void
}

// ---- Style by cardinality ----

function edgeStyle(cardinality: RelationshipCardinality) {
  switch (cardinality) {
    case "1:1":
      return { stroke: "hsl(var(--primary))", strokeWidth: 2, strokeDasharray: undefined }
    case "1:N":
      return { stroke: "hsl(210, 100%, 50%)", strokeWidth: 2, strokeDasharray: undefined }
    case "N:N":
      return { stroke: "hsl(280, 80%, 55%)", strokeWidth: 2, strokeDasharray: "6 3" }
  }
}

function badgeColor(cardinality: RelationshipCardinality) {
  switch (cardinality) {
    case "1:1":
      return "bg-primary/10 text-primary border-primary/30"
    case "1:N":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
    case "N:N":
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30"
  }
}

// ---- Custom edge component ----

function RelationshipEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<Edge<RelationshipEdgeData>>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const cardinality = data?.cardinality || "1:N"
  const style = edgeStyle(cardinality)
  const fieldMapping =
    data?.sourceField && data?.targetField
      ? `${data.sourceField} → ${data.targetField}`
      : undefined

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerEnd="url(#arrowhead)"
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto cursor-pointer"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          onDoubleClick={() => data?.onEdit?.(id)}
        >
          <div
            className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-1 text-[10px] font-medium shadow-sm bg-card ${badgeColor(cardinality)}`}
          >
            <span>{data?.label || cardinality}</span>
            {fieldMapping && (
              <span className="text-[9px] text-muted-foreground font-mono">{fieldMapping}</span>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const RelationshipEdge = memo(RelationshipEdgeComponent)

export const mindmapEdgeTypes = {
  relationshipEdge: RelationshipEdge,
}
