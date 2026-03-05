"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2, Key, GripVertical } from "lucide-react"
import { useMindmapStore } from "@/stores/mindmap-store"
import type { EntityField, FieldType, CrudOperation, CustomOperation } from "@/types/mindmap"
import {
  FIELD_TYPE_LABELS,
  CRUD_LABELS,
  ENTITY_COLORS,
  getEntityColor,
} from "@/types/mindmap"

// ---- Field type options ----

const FIELD_TYPES = Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]

const ALL_CRUD: CrudOperation[] = ["list", "getById", "create", "update", "delete"]

// ---- Component ----

interface EntityEditorPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityId: string | null
}

export function EntityEditorPanel({ open, onOpenChange, entityId }: EntityEditorPanelProps) {
  const doc = useMindmapStore((s) => s.currentDocument)
  const updateEntity = useMindmapStore((s) => s.updateEntity)
  const addField = useMindmapStore((s) => s.addField)
  const updateField = useMindmapStore((s) => s.updateField)
  const removeField = useMindmapStore((s) => s.removeField)
  const toggleCrudOperation = useMindmapStore((s) => s.toggleCrudOperation)
  const addCustomOperation = useMindmapStore((s) => s.addCustomOperation)
  const removeCustomOperation = useMindmapStore((s) => s.removeCustomOperation)

  const entity = doc?.entities.find((e) => e.id === entityId)

  // Custom operation form
  const [newOpName, setNewOpName] = useState("")
  const [newOpMethod, setNewOpMethod] = useState("POST")
  const [newOpPath, setNewOpPath] = useState("")

  if (!entity) return null

  const handleAddField = () => {
    const field: EntityField = {
      id: crypto.randomUUID(),
      name: "",
      type: "string",
      required: false,
    }
    addField(entity.id, field)
  }

  const handleAddIdField = () => {
    const field: EntityField = {
      id: crypto.randomUUID(),
      name: "id",
      type: "uuid",
      required: true,
      isIdentifier: true,
    }
    addField(entity.id, field)
  }

  const handleAddCustomOp = () => {
    if (!newOpName.trim()) return
    const op: CustomOperation = {
      id: crypto.randomUUID(),
      name: newOpName.trim(),
      method: newOpMethod,
      pathSuffix: newOpPath || `/:id/${newOpName.toLowerCase().replace(/\s+/g, "-")}`,
    }
    addCustomOperation(entity.id, op)
    setNewOpName("")
    setNewOpPath("")
  }

  const color = getEntityColor(entity.color)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${color.dot}`} />
            {entity.name || "Entity"}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="fields" className="flex-1 overflow-y-auto px-4 pt-3 pb-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fields" className="text-xs">Fields</TabsTrigger>
            <TabsTrigger value="operations" className="text-xs">Operations</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
          </TabsList>

          {/* ── Fields Tab ── */}
          <TabsContent value="fields" className="space-y-3 mt-3">
            {entity.fields.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                <p>No fields yet</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={handleAddIdField} className="text-xs gap-1">
                    <Key className="h-3 w-3" /> Add ID Field
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleAddField} className="text-xs gap-1">
                    <Plus className="h-3 w-3" /> Add Field
                  </Button>
                </div>
              </div>
            )}

            {entity.fields.map((field) => (
              <div key={field.id} className="flex items-start gap-1.5 p-2 rounded-md border bg-muted/30">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-1.5 shrink-0" />

                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={field.name}
                      onChange={(e) => updateField(entity.id, field.id, { name: e.target.value })}
                      placeholder="field name"
                      className="h-7 text-xs font-mono flex-1"
                    />
                    <Select
                      value={field.type}
                      onValueChange={(v) => updateField(entity.id, field.id, { type: v as FieldType })}
                    >
                      <SelectTrigger className="h-7 w-[100px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map(([value, label]) => (
                          <SelectItem key={value} value={value} className="text-xs">
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[11px]">
                      <Checkbox
                        checked={field.required}
                        onCheckedChange={(c) => updateField(entity.id, field.id, { required: !!c })}
                        className="h-3 w-3"
                      />
                      Required
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px]">
                      <Checkbox
                        checked={field.isIdentifier}
                        onCheckedChange={(c) => updateField(entity.id, field.id, { isIdentifier: !!c })}
                        className="h-3 w-3"
                      />
                      <Key className="h-2.5 w-2.5 text-amber-500" /> PK
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px]">
                      <Checkbox
                        checked={field.isArray}
                        onCheckedChange={(c) => updateField(entity.id, field.id, { isArray: !!c })}
                        className="h-3 w-3"
                      />
                      Array
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-auto"
                      onClick={() => removeField(entity.id, field.id)}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {entity.fields.length > 0 && (
              <Button size="sm" variant="outline" onClick={handleAddField} className="w-full text-xs gap-1">
                <Plus className="h-3 w-3" /> Add Field
              </Button>
            )}
          </TabsContent>

          {/* ── Operations Tab ── */}
          <TabsContent value="operations" className="space-y-4 mt-3">
            <div>
              <Label className="text-xs font-semibold mb-2 block">CRUD Operations</Label>
              <div className="space-y-2">
                {ALL_CRUD.map((op) => {
                  const info = CRUD_LABELS[op]
                  const enabled = entity.crudOperations.includes(op)
                  return (
                    <label
                      key={op}
                      className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={enabled}
                        onCheckedChange={() => toggleCrudOperation(entity.id, op)}
                      />
                      <span className="text-[10px] font-mono font-medium bg-muted rounded px-1.5 py-0.5 w-12 text-center">
                        {info.method}
                      </span>
                      <div className="flex-1">
                        <span className="text-xs font-medium">{info.label}</span>
                        <p className="text-[10px] text-muted-foreground">{info.description}</p>
                      </div>
                    </label>
                  )
                })}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[10px]"
                  onClick={() => {
                    for (const op of ALL_CRUD) {
                      if (!entity.crudOperations.includes(op)) toggleCrudOperation(entity.id, op)
                    }
                  }}
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[10px]"
                  onClick={() => {
                    for (const op of entity.crudOperations) {
                      toggleCrudOperation(entity.id, op)
                    }
                  }}
                >
                  Clear All
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-2 block">Custom Operations</Label>
              {entity.customOperations.map((cop) => (
                <div key={cop.id} className="flex items-center gap-2 p-2 rounded-md border mb-1.5">
                  <span className="text-[10px] font-mono font-medium bg-muted rounded px-1.5 py-0.5">
                    {cop.method}
                  </span>
                  <span className="text-xs flex-1 truncate">{cop.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
                    {cop.pathSuffix}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={() => removeCustomOperation(entity.id, cop.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}

              <div className="flex items-center gap-1.5 mt-2">
                <Input
                  value={newOpName}
                  onChange={(e) => setNewOpName(e.target.value)}
                  placeholder="Operation name"
                  className="h-7 text-xs flex-1"
                />
                <Select value={newOpMethod} onValueChange={setNewOpMethod}>
                  <SelectTrigger className="h-7 w-[80px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                      <SelectItem key={m} value={m} className="text-xs">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={handleAddCustomOp}
                  disabled={!newOpName.trim()}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── Settings Tab ── */}
          <TabsContent value="settings" className="space-y-4 mt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Entity Name</Label>
              <Input
                value={entity.name}
                onChange={(e) => updateEntity(entity.id, { name: e.target.value })}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Plural Name</Label>
              <Input
                value={entity.pluralName || ""}
                onChange={(e) => updateEntity(entity.id, { pluralName: e.target.value || undefined })}
                placeholder={`Auto: ${entity.name.toLowerCase()}s`}
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Used in URL paths (e.g., /users, /products)
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {ENTITY_COLORS.map((c) => (
                  <button
                    key={c.key}
                    className={`h-6 w-6 rounded-full ${c.dot} transition-all ${
                      entity.color === c.key ? "ring-2 ring-offset-2 ring-primary" : "hover:scale-110"
                    }`}
                    onClick={() => updateEntity(entity.id, { color: c.key })}
                  />
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
