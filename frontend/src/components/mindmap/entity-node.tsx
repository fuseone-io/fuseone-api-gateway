"use client"

import { memo } from "react"
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import { Box, Key } from "lucide-react"
import type { MindmapEntity } from "@/types/mindmap"
import { getEntityColor, FIELD_TYPE_LABELS, CRUD_LABELS, type CrudOperation } from "@/types/mindmap"

// ---- Node data type ----

export type EntityNodeData = {
  entity: MindmapEntity
  isSelected: boolean
  onEdit: (entityId: string) => void
}

// ---- CRUD operation dots ----

const CRUD_OPS: CrudOperation[] = ["list", "getById", "create", "update", "delete"]

function CrudDots({ operations }: { operations: CrudOperation[] }) {
  return (
    <div className="flex items-center gap-1">
      {CRUD_OPS.map((op) => {
        const enabled = operations.includes(op)
        return (
          <div
            key={op}
            className={`h-2 w-2 rounded-full transition-colors ${
              enabled ? "bg-emerald-500" : "bg-muted-foreground/20"
            }`}
            title={`${CRUD_LABELS[op].method} ${CRUD_LABELS[op].label}${enabled ? " (enabled)" : ""}`}
          />
        )
      })}
    </div>
  )
}

// ---- Max visible fields ----

const MAX_VISIBLE_FIELDS = 5

// ---- Entity node component ----

function EntityNodeComponent({ data }: NodeProps<Node<EntityNodeData>>) {
  const { entity, isSelected, onEdit } = data
  const color = getEntityColor(entity.color)
  const visibleFields = entity.fields.slice(0, MAX_VISIBLE_FIELDS)
  const overflow = entity.fields.length - MAX_VISIBLE_FIELDS

  return (
    <div
      className={`w-[280px] rounded-lg border-2 bg-card shadow-sm transition-shadow cursor-pointer select-none ${
        isSelected ? "ring-2 ring-primary shadow-md" : "hover:shadow-md"
      } ${color.border}`}
      onDoubleClick={() => onEdit(entity.id)}
    >
      {/* Handles — source + target at each position so connections work from any side */}
      <Handle id="top-target" type="target" position={Position.Top} className="!bg-primary !w-2.5 !h-2.5" />
      <Handle id="top-source" type="source" position={Position.Top} className="!bg-primary !w-2.5 !h-2.5 !opacity-0" />
      <Handle id="right-target" type="target" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5" />
      <Handle id="right-source" type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5 !opacity-0" />
      <Handle id="bottom-target" type="target" position={Position.Bottom} className="!bg-primary !w-2.5 !h-2.5" />
      <Handle id="bottom-source" type="source" position={Position.Bottom} className="!bg-primary !w-2.5 !h-2.5 !opacity-0" />
      <Handle id="left-target" type="target" position={Position.Left} className="!bg-primary !w-2.5 !h-2.5" />
      <Handle id="left-source" type="source" position={Position.Left} className="!bg-primary !w-2.5 !h-2.5 !opacity-0" />

      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t-[6px] ${color.bg}`}>
        <Box className={`h-4 w-4 shrink-0 ${color.text}`} />
        <span className={`text-sm font-semibold truncate ${color.text}`}>{entity.name}</span>
        {entity.customOperations.length > 0 && (
          <span className="ml-auto text-[10px] font-medium text-muted-foreground">
            +{entity.customOperations.length}
          </span>
        )}
      </div>

      {/* Fields */}
      <div className="px-3 py-1.5 space-y-0.5 min-h-[28px]">
        {visibleFields.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic">No fields defined</p>
        )}
        {visibleFields.map((field) => (
          <div key={field.id} className="flex items-center gap-1.5 text-[11px]">
            {field.isIdentifier && (
              <Key className="h-2.5 w-2.5 text-amber-500 shrink-0" />
            )}
            <span className="font-mono text-foreground truncate flex-1">
              {field.name}
            </span>
            {field.required && (
              <span className="text-red-500 text-[9px]">*</span>
            )}
            <span className="text-[9px] font-medium text-muted-foreground bg-muted rounded px-1 py-[1px] shrink-0">
              {FIELD_TYPE_LABELS[field.type] || field.type}
            </span>
          </div>
        ))}
        {overflow > 0 && (
          <p className="text-[10px] text-muted-foreground">+{overflow} more</p>
        )}
      </div>

      {/* Footer: CRUD dots */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/50">
        <CrudDots operations={entity.crudOperations} />
        <span className="text-[9px] text-muted-foreground">
          {entity.crudOperations.length + entity.customOperations.length} ops
        </span>
      </div>
    </div>
  )
}

export const EntityNode = memo(EntityNodeComponent)

export const mindmapNodeTypes = {
  entityNode: EntityNode,
}
