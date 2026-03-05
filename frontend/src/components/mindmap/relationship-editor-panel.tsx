"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
import { Trash2, ArrowRight } from "lucide-react"
import { useMindmapStore } from "@/stores/mindmap-store"
import type { RelationshipCardinality } from "@/types/mindmap"

interface RelationshipEditorPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  relationshipId: string | null
}

export function RelationshipEditorPanel({
  open,
  onOpenChange,
  relationshipId,
}: RelationshipEditorPanelProps) {
  const doc = useMindmapStore((s) => s.currentDocument)
  const updateRelationship = useMindmapStore((s) => s.updateRelationship)
  const removeRelationship = useMindmapStore((s) => s.removeRelationship)

  const rel = doc?.relationships.find((r) => r.id === relationshipId)
  const sourceEntity = doc?.entities.find((e) => e.id === rel?.sourceEntityId)
  const targetEntity = doc?.entities.find((e) => e.id === rel?.targetEntityId)

  if (!rel || !sourceEntity || !targetEntity) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[360px] sm:max-w-[360px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle className="text-sm flex items-center gap-2">
            {sourceEntity.name}
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            {targetEntity.name}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4 pt-3 pb-4 overflow-y-auto flex-1">
          {/* Cardinality */}
          <div className="space-y-1.5">
            <Label className="text-xs">Cardinality</Label>
            <Select
              value={rel.cardinality}
              onValueChange={(v) => updateRelationship(rel.id, { cardinality: v as RelationshipCardinality })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1:1" className="text-sm">
                  <span className="font-mono mr-2">1:1</span> One to One
                </SelectItem>
                <SelectItem value="1:N" className="text-sm">
                  <span className="font-mono mr-2">1:N</span> One to Many
                </SelectItem>
                <SelectItem value="N:N" className="text-sm">
                  <span className="font-mono mr-2">N:N</span> Many to Many
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              {rel.cardinality === "1:N" && `One ${sourceEntity.name} has many ${targetEntity.name}s`}
              {rel.cardinality === "1:1" && `One ${sourceEntity.name} has one ${targetEntity.name}`}
              {rel.cardinality === "N:N" && `Many ${sourceEntity.name}s relate to many ${targetEntity.name}s`}
            </p>
          </div>

          {/* Source field */}
          <div className="space-y-1.5">
            <Label className="text-xs">Source Field ({sourceEntity.name})</Label>
            <Select
              value={rel.sourceField || "__none__"}
              onValueChange={(v) => updateRelationship(rel.id, { sourceField: v === "__none__" ? undefined : v })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select field..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-xs text-muted-foreground">
                  None
                </SelectItem>
                {sourceEntity.fields.map((f) => (
                  <SelectItem key={f.id} value={f.name} className="text-xs font-mono">
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target field */}
          <div className="space-y-1.5">
            <Label className="text-xs">Target Field ({targetEntity.name})</Label>
            <Select
              value={rel.targetField || "__none__"}
              onValueChange={(v) => updateRelationship(rel.id, { targetField: v === "__none__" ? undefined : v })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select field..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-xs text-muted-foreground">
                  None
                </SelectItem>
                {targetEntity.fields.map((f) => (
                  <SelectItem key={f.id} value={f.name} className="text-xs font-mono">
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Label */}
          <div className="space-y-1.5">
            <Label className="text-xs">Custom Label</Label>
            <Input
              value={rel.label || ""}
              onChange={(e) => updateRelationship(rel.id, { label: e.target.value || undefined })}
              placeholder={rel.cardinality}
              className="h-8 text-sm"
            />
          </div>

          {/* Delete */}
          <Button
            variant="destructive"
            size="sm"
            className="w-full mt-4 gap-1.5"
            onClick={() => {
              removeRelationship(rel.id)
              onOpenChange(false)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove Relationship
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
