"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Braces,
  FileJson,
  Sparkles,
  List,
} from "lucide-react"
import type { JsonSchemaDefinition, JsonSchemaType } from "@/types/api"
import { inferSchemaFromJson, generateExampleFromSchema } from "@/lib/contract-utils"

// --- Constants ---

const SCHEMA_TYPES: { value: JsonSchemaType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "integer", label: "Integer" },
  { value: "boolean", label: "Boolean" },
  { value: "array", label: "Array" },
  { value: "object", label: "Object" },
  { value: "null", label: "Null" },
]

const STRING_FORMATS = [
  { value: "__none__", label: "None" },
  { value: "date-time", label: "Date-Time" },
  { value: "date", label: "Date" },
  { value: "email", label: "Email" },
  { value: "uri", label: "URI" },
  { value: "uuid", label: "UUID" },
  { value: "hostname", label: "Hostname" },
  { value: "ipv4", label: "IPv4" },
  { value: "ipv6", label: "IPv6" },
]

// --- Props ---

export interface SchemaEditorProps {
  schema: JsonSchemaDefinition | undefined
  onChange: (schema: JsonSchemaDefinition) => void
  example?: unknown
  onExampleChange?: (example: unknown) => void
  readOnly?: boolean
  maxDepth?: number
  showExample?: boolean
}

// --- Property Editor (recursive) ---

function PropertyRow({
  name,
  schema,
  required,
  onNameChange,
  onSchemaChange,
  onRequiredChange,
  onRemove,
  readOnly,
  depth,
  maxDepth,
}: {
  name: string
  schema: JsonSchemaDefinition
  required: boolean
  onNameChange: (newName: string) => void
  onSchemaChange: (s: JsonSchemaDefinition) => void
  onRequiredChange: (v: boolean) => void
  onRemove: () => void
  readOnly?: boolean
  depth: number
  maxDepth: number
}) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = schema.type === "object" || schema.type === "array"
  const canExpand = hasChildren && depth < maxDepth

  return (
    <div className="border rounded-md">
      {/* Main row */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        {canExpand ? (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="p-0.5 hover:bg-accent rounded"
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-[18px]" />
        )}

        {/* Name */}
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="field_name"
          className="h-7 text-xs font-mono w-32 shrink-0"
          disabled={readOnly}
        />

        {/* Type */}
        <Select
          value={schema.type}
          onValueChange={(v) => {
            const newSchema: JsonSchemaDefinition = { ...schema, type: v as JsonSchemaType }
            if (v === "object" && !newSchema.properties) newSchema.properties = {}
            if (v === "array" && !newSchema.items) newSchema.items = { type: "string" }
            if (v !== "object") delete newSchema.properties
            if (v !== "array") delete newSchema.items
            if (v !== "string") delete newSchema.format
            onSchemaChange(newSchema)
          }}
          disabled={readOnly}
        >
          <SelectTrigger className="h-7 text-xs w-24 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCHEMA_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Format (string only) */}
        {schema.type === "string" && (
          <Select
            value={schema.format || "__none__"}
            onValueChange={(v) => onSchemaChange({ ...schema, format: v === "__none__" ? undefined : v })}
            disabled={readOnly}
          >
            <SelectTrigger className="h-7 text-xs w-24 shrink-0">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent>
              {STRING_FORMATS.map((f) => (
                <SelectItem key={f.value} value={f.value} className="text-xs">
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Required */}
        <div className="flex items-center gap-1 shrink-0">
          <Checkbox
            id={`req-${name}-${depth}`}
            checked={required}
            onCheckedChange={(v) => onRequiredChange(!!v)}
            disabled={readOnly}
            className="h-3.5 w-3.5"
          />
          <label htmlFor={`req-${name}-${depth}`} className="text-[10px] text-muted-foreground">
            Req
          </label>
        </div>

        {/* Description */}
        <Input
          value={schema.description || ""}
          onChange={(e) => onSchemaChange({ ...schema, description: e.target.value || undefined })}
          placeholder="Description"
          className="h-7 text-xs flex-1 min-w-0"
          disabled={readOnly}
        />

        {/* Remove */}
        {!readOnly && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-destructive/70 hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Children (object properties or array items) */}
      {canExpand && open && (
        <div className="pl-6 pr-2 pb-2 space-y-1.5">
          {schema.type === "object" && (
            <ObjectPropertiesEditor
              schema={schema}
              onChange={onSchemaChange}
              readOnly={readOnly}
              depth={depth + 1}
              maxDepth={maxDepth}
            />
          )}
          {schema.type === "array" && schema.items && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <List className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium">Array Items</span>
              </div>
              <PropertyRow
                name="[item]"
                schema={schema.items}
                required={false}
                onNameChange={() => {}}
                onSchemaChange={(s) => onSchemaChange({ ...schema, items: s })}
                onRequiredChange={() => {}}
                onRemove={() => onSchemaChange({ ...schema, items: { type: "string" } })}
                readOnly={readOnly}
                depth={depth + 1}
                maxDepth={maxDepth}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- Object Properties Editor ---

function ObjectPropertiesEditor({
  schema,
  onChange,
  readOnly,
  depth,
  maxDepth,
}: {
  schema: JsonSchemaDefinition
  onChange: (s: JsonSchemaDefinition) => void
  readOnly?: boolean
  depth: number
  maxDepth: number
}) {
  const properties = schema.properties || {}
  const required = schema.required || []

  const addProperty = () => {
    const existing = Object.keys(properties)
    let newName = "new_field"
    let idx = 1
    while (existing.includes(newName)) {
      newName = `new_field_${idx++}`
    }
    onChange({
      ...schema,
      properties: { ...properties, [newName]: { type: "string" } },
    })
  }

  const renameProperty = (oldName: string, newName: string) => {
    if (oldName === newName || !newName) return
    const entries = Object.entries(properties)
    const newProps: Record<string, JsonSchemaDefinition> = {}
    for (const [k, v] of entries) {
      newProps[k === oldName ? newName : k] = v
    }
    const newRequired = required.map((r) => (r === oldName ? newName : r))
    onChange({ ...schema, properties: newProps, required: newRequired.length > 0 ? newRequired : undefined })
  }

  const updateProperty = (name: string, propSchema: JsonSchemaDefinition) => {
    onChange({ ...schema, properties: { ...properties, [name]: propSchema } })
  }

  const toggleRequired = (name: string, isRequired: boolean) => {
    const newRequired = isRequired
      ? [...required, name]
      : required.filter((r) => r !== name)
    onChange({ ...schema, required: newRequired.length > 0 ? newRequired : undefined })
  }

  const removeProperty = (name: string) => {
    const newProps = { ...properties }
    delete newProps[name]
    const newRequired = required.filter((r) => r !== name)
    onChange({
      ...schema,
      properties: Object.keys(newProps).length > 0 ? newProps : undefined,
      required: newRequired.length > 0 ? newRequired : undefined,
    })
  }

  return (
    <div className="space-y-1.5">
      {Object.entries(properties).map(([name, propSchema]) => (
        <PropertyRow
          key={name}
          name={name}
          schema={propSchema}
          required={required.includes(name)}
          onNameChange={(newName) => renameProperty(name, newName)}
          onSchemaChange={(s) => updateProperty(name, s)}
          onRequiredChange={(v) => toggleRequired(name, v)}
          onRemove={() => removeProperty(name)}
          readOnly={readOnly}
          depth={depth}
          maxDepth={maxDepth}
        />
      ))}
      {!readOnly && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1 w-full border-dashed"
          onClick={addProperty}
        >
          <Plus className="h-3 w-3" />
          Add Property
        </Button>
      )}
    </div>
  )
}

// --- Main Schema Editor ---

export default function SchemaEditor({
  schema,
  onChange,
  example,
  onExampleChange,
  readOnly,
  maxDepth = 4,
  showExample = true,
}: SchemaEditorProps) {
  const [exampleText, setExampleText] = useState(() =>
    example !== undefined ? JSON.stringify(example, null, 2) : ""
  )
  const [exampleError, setExampleError] = useState("")
  const [showInfer, setShowInfer] = useState(false)
  const [inferText, setInferText] = useState("")
  const [inferError, setInferError] = useState("")

  const currentSchema: JsonSchemaDefinition = schema || { type: "object", properties: {} }

  const handleExampleChange = useCallback(
    (text: string) => {
      setExampleText(text)
      if (!text.trim()) {
        setExampleError("")
        onExampleChange?.(undefined)
        return
      }
      try {
        const parsed = JSON.parse(text)
        setExampleError("")
        onExampleChange?.(parsed)
      } catch {
        setExampleError("Invalid JSON")
      }
    },
    [onExampleChange]
  )

  const handleInfer = () => {
    try {
      const parsed = JSON.parse(inferText)
      const inferred = inferSchemaFromJson(parsed)
      onChange(inferred)
      onExampleChange?.(parsed)
      setExampleText(JSON.stringify(parsed, null, 2))
      setExampleError("")
      setInferError("")
      setShowInfer(false)
      setInferText("")
    } catch {
      setInferError("Invalid JSON — paste a valid JSON example")
    }
  }

  const handleGenerateExample = () => {
    const generated = generateExampleFromSchema(currentSchema)
    const text = JSON.stringify(generated, null, 2)
    setExampleText(text)
    setExampleError("")
    onExampleChange?.(generated)
  }

  return (
    <div className="space-y-3">
      {/* Header with type + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Braces className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium">Schema</span>
          <Badge variant="outline" className="text-[10px]">{currentSchema.type}</Badge>
        </div>
        <div className="flex items-center gap-1">
          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1"
              onClick={() => setShowInfer(!showInfer)}
            >
              <Sparkles className="h-3 w-3" />
              Infer from JSON
            </Button>
          )}
        </div>
      </div>

      {/* Infer from JSON panel */}
      {showInfer && (
        <div className="border rounded-md p-3 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
          <Label className="text-xs">Paste a JSON example to auto-generate schema</Label>
          <textarea
            value={inferText}
            onChange={(e) => {
              setInferText(e.target.value)
              setInferError("")
            }}
            placeholder='{"id": 1, "name": "John", "email": "john@example.com"}'
            className="w-full h-28 rounded-md border bg-background p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            spellCheck={false}
          />
          {inferError && <p className="text-[10px] text-destructive">{inferError}</p>}
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 text-xs gap-1" onClick={handleInfer}>
              <Sparkles className="h-3 w-3" />
              Generate Schema
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setShowInfer(false); setInferText(""); setInferError("") }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Root type selector */}
      <div className="flex items-center gap-2">
        <Label className="text-xs shrink-0">Root Type</Label>
        <Select
          value={currentSchema.type}
          onValueChange={(v) => {
            const newSchema: JsonSchemaDefinition = { type: v as JsonSchemaType }
            if (v === "object") newSchema.properties = currentSchema.properties || {}
            if (v === "array") newSchema.items = currentSchema.items || { type: "string" }
            onChange(newSchema)
          }}
          disabled={readOnly}
        >
          <SelectTrigger className="h-7 text-xs w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCHEMA_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentSchema.description !== undefined && (
          <Input
            value={currentSchema.description || ""}
            onChange={(e) => onChange({ ...currentSchema, description: e.target.value || undefined })}
            placeholder="Schema description"
            className="h-7 text-xs flex-1"
            disabled={readOnly}
          />
        )}
      </div>

      {/* Properties editor (for object) */}
      {currentSchema.type === "object" && (
        <ObjectPropertiesEditor
          schema={currentSchema}
          onChange={onChange}
          readOnly={readOnly}
          depth={0}
          maxDepth={maxDepth}
        />
      )}

      {/* Items editor (for array) */}
      {currentSchema.type === "array" && currentSchema.items && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <List className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Array Items</span>
          </div>
          {currentSchema.items.type === "object" ? (
            <div className="pl-2">
              <ObjectPropertiesEditor
                schema={currentSchema.items}
                onChange={(s) => onChange({ ...currentSchema, items: s })}
                readOnly={readOnly}
                depth={1}
                maxDepth={maxDepth}
              />
            </div>
          ) : (
            <PropertyRow
              name="[item]"
              schema={currentSchema.items}
              required={false}
              onNameChange={() => {}}
              onSchemaChange={(s) => onChange({ ...currentSchema, items: s })}
              onRequiredChange={() => {}}
              onRemove={() => onChange({ ...currentSchema, items: { type: "string" } })}
              readOnly={readOnly}
              depth={1}
              maxDepth={maxDepth}
            />
          )}
        </div>
      )}

      {/* Example JSON */}
      {showExample && (
        <>
          <Separator />
          <Collapsible defaultOpen={!!example}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium hover:underline">
                <FileJson className="h-3.5 w-3.5 text-muted-foreground" />
                Example
              </CollapsibleTrigger>
              {!readOnly && currentSchema.type === "object" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1"
                  onClick={handleGenerateExample}
                >
                  <Sparkles className="h-3 w-3" />
                  Generate from Schema
                </Button>
              )}
            </div>
            <CollapsibleContent className="mt-2">
              <textarea
                value={exampleText}
                onChange={(e) => handleExampleChange(e.target.value)}
                placeholder='{"id": 1, "name": "Example"}'
                className="w-full h-32 rounded-md border bg-muted/50 p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                spellCheck={false}
                disabled={readOnly}
              />
              {exampleError && <p className="text-[10px] text-destructive mt-1">{exampleError}</p>}
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  )
}
