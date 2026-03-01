"use client"

import { useState, useCallback } from "react"
import {
  Eye,
  EyeOff,
  X,
  Plus,
  ChevronDown,
  KeyRound,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
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
import type {
  PluginFormDef,
  PluginFieldDef,
  PluginFieldGroup,
} from "@/lib/plugin-forms"
import { SecretSelector } from "./secret-selector"

// --- Helpers for nested paths (e.g., "abort.http_status") ---

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".")
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const parts = path.split(".")
  const result = { ...obj }

  if (parts.length === 1) {
    if (value === undefined || value === "" || value === null) {
      const { [parts[0]]: _, ...rest } = result
      return rest
    }
    result[parts[0]] = value
    return result
  }

  // Nested path
  const [head, ...rest] = parts
  const nested = (result[head] && typeof result[head] === "object")
    ? { ...(result[head] as Record<string, unknown>) }
    : {}
  const updatedNested = setNestedValue(nested, rest.join("."), value)
  if (Object.keys(updatedNested).length === 0) {
    const { [head]: _, ...remaining } = result
    return remaining
  }
  result[head] = updatedNested
  return result
}

// --- Visibility check ---

function isVisible(
  condition: PluginFieldDef["visibleWhen"],
  config: Record<string, unknown>
): boolean {
  if (!condition) return true
  const currentValue = getNestedValue(config, condition.field)
  if (condition.notValue !== undefined) return currentValue !== condition.notValue
  if (condition.value !== undefined) return currentValue === condition.value
  return true
}

// --- Main Renderer ---

interface PluginFormRendererProps {
  formDef: PluginFormDef
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  readOnly: boolean
}

export function PluginFormRenderer({
  formDef,
  config,
  onChange,
  readOnly,
}: PluginFormRendererProps) {
  const setField = useCallback(
    (key: string, value: unknown) => {
      onChange(setNestedValue(config, key, value))
    },
    [config, onChange]
  )

  return (
    <div className="space-y-4">
      {formDef.groups
        .filter((g) => isVisible(g.visibleWhen, config))
        .map((group) => (
          <FieldGroupRenderer
            key={group.title}
            group={group}
            config={config}
            setField={setField}
            readOnly={readOnly}
          />
        ))}
    </div>
  )
}

// --- Group Renderer ---

function FieldGroupRenderer({
  group,
  config,
  setField,
  readOnly,
}: {
  group: PluginFieldGroup
  config: Record<string, unknown>
  setField: (key: string, value: unknown) => void
  readOnly: boolean
}) {
  const visibleFields = group.fields.filter((f) => isVisible(f.visibleWhen, config))

  if (visibleFields.length === 0 && !group.description) return null

  const content = (
    <div className="space-y-3">
      {group.description && (
        <p className="text-[10px] text-muted-foreground">{group.description}</p>
      )}
      {visibleFields.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={getNestedValue(config, field.key)}
          onChange={(v) => setField(field.key, v)}
          readOnly={readOnly}
        />
      ))}
    </div>
  )

  if (group.collapsible) {
    return (
      <CollapsibleGroup
        title={group.title}
        defaultOpen={group.defaultOpen}
      >
        {content}
      </CollapsibleGroup>
    )
  }

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {group.title}
      </p>
      {content}
    </div>
  )
}

// --- Collapsible Group ---

function CollapsibleGroup({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 w-full py-1 hover:text-foreground transition-colors group">
          <ChevronDown
            className={`h-3 w-3 text-muted-foreground transition-transform ${
              open ? "" : "-rotate-90"
            }`}
          />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground">
            {title}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pt-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// --- Field Renderer (dispatches by type) ---

function FieldRenderer({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: PluginFieldDef
  value: unknown
  onChange: (value: unknown) => void
  readOnly: boolean
}) {
  switch (field.type) {
    case "string":
      return <StringField field={field} value={value} onChange={onChange} readOnly={readOnly} />
    case "number":
    case "integer":
      return <NumberField field={field} value={value} onChange={onChange} readOnly={readOnly} />
    case "boolean":
      return <BooleanField field={field} value={value} onChange={onChange} readOnly={readOnly} />
    case "enum":
      return <EnumField field={field} value={value} onChange={onChange} readOnly={readOnly} />
    case "password":
      return <PasswordField field={field} value={value} onChange={onChange} readOnly={readOnly} />
    case "string-array":
      return <StringArrayField field={field} value={value} onChange={onChange} readOnly={readOnly} />
    case "text":
      return <TextareaField field={field} value={value} onChange={onChange} readOnly={readOnly} />
    default:
      return <StringField field={field} value={value} onChange={onChange} readOnly={readOnly} />
  }
}

// --- Individual Field Components ---

function FieldWrapper({
  label,
  required,
  description,
  suffix,
  children,
}: {
  label: string
  required?: boolean
  description?: string
  suffix?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
        {suffix && (
          <Badge variant="outline" className="text-[8px] px-1 py-0 font-normal ml-auto">
            {suffix}
          </Badge>
        )}
      </Label>
      {children}
      {description && (
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
    </div>
  )
}

function StringField({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: PluginFieldDef
  value: unknown
  onChange: (value: unknown) => void
  readOnly: boolean
}) {
  return (
    <FieldWrapper label={field.label} required={field.required} description={field.description} suffix={field.suffix}>
      <Input
        type="text"
        value={(value as string) ?? (field.defaultValue as string) ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={field.placeholder}
        disabled={readOnly}
        className="h-7 text-xs"
      />
    </FieldWrapper>
  )
}

function NumberField({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: PluginFieldDef
  value: unknown
  onChange: (value: unknown) => void
  readOnly: boolean
}) {
  const numValue = value != null ? Number(value) : undefined
  const displayValue = numValue != null && !isNaN(numValue) ? numValue : (field.defaultValue as number) ?? ""

  return (
    <FieldWrapper label={field.label} required={field.required} description={field.description} suffix={field.suffix}>
      <Input
        type="number"
        value={displayValue}
        onChange={(e) => {
          const v = e.target.value
          if (v === "") {
            onChange(undefined)
          } else {
            onChange(field.type === "integer" ? parseInt(v) : parseFloat(v))
          }
        }}
        min={field.min}
        max={field.max}
        step={field.step}
        placeholder={field.placeholder}
        disabled={readOnly}
        className="h-7 text-xs"
      />
    </FieldWrapper>
  )
}

function BooleanField({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: PluginFieldDef
  value: unknown
  onChange: (value: unknown) => void
  readOnly: boolean
}) {
  const checked = value != null ? Boolean(value) : Boolean(field.defaultValue)

  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <div className="space-y-0.5 flex-1 min-w-0">
        <Label className="text-xs font-medium">{field.label}</Label>
        {field.description && (
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {field.description}
          </p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={(v) => onChange(v)}
        disabled={readOnly}
      />
    </div>
  )
}

function EnumField({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: PluginFieldDef
  value: unknown
  onChange: (value: unknown) => void
  readOnly: boolean
}) {
  const currentValue = (value as string) ?? (field.defaultValue as string) ?? ""

  return (
    <FieldWrapper label={field.label} required={field.required} description={field.description}>
      <Select
        value={currentValue}
        onValueChange={(v) => onChange(v || undefined)}
        disabled={readOnly}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {field.options?.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  )
}

function PasswordField({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: PluginFieldDef
  value: unknown
  onChange: (value: unknown) => void
  readOnly: boolean
}) {
  const strValue = (value as string) ?? ""
  const isSecretRef = strValue.startsWith("$secret://")
  const [show, setShow] = useState(false)
  const [secretMode, setSecretMode] = useState(isSecretRef)

  return (
    <FieldWrapper label={field.label} required={field.required} description={field.description}>
      {secretMode ? (
        /* Secret reference mode */
        <div className="space-y-1">
          <SecretSelector
            value={strValue}
            onChange={(v) => {
              if (!v) {
                setSecretMode(false)
                onChange(undefined)
              } else {
                onChange(v)
              }
            }}
            readOnly={readOnly}
            fieldLabel={field.label}
          />
          <button
            type="button"
            onClick={() => {
              setSecretMode(false)
              if (isSecretRef) onChange(undefined)
            }}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Switch to raw value
          </button>
        </div>
      ) : (
        /* Normal password input */
        <div className="space-y-1">
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              value={strValue}
              onChange={(e) => onChange(e.target.value || undefined)}
              placeholder={field.placeholder}
              disabled={readOnly}
              className="h-7 text-xs pr-14"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setSecretMode(true)}
                className="text-muted-foreground hover:text-primary transition-colors p-0.5 rounded"
                tabIndex={-1}
                title="Use secret reference"
              >
                <KeyRound className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                tabIndex={-1}
              >
                {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </FieldWrapper>
  )
}

function StringArrayField({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: PluginFieldDef
  value: unknown
  onChange: (value: unknown) => void
  readOnly: boolean
}) {
  const items = Array.isArray(value) ? (value as string[]) : []
  const [inputValue, setInputValue] = useState("")

  const addItem = () => {
    const trimmed = inputValue.trim()
    if (!trimmed || items.includes(trimmed)) return
    onChange([...items, trimmed])
    setInputValue("")
  }

  const removeItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index)
    onChange(updated.length > 0 ? updated : undefined)
  }

  return (
    <FieldWrapper label={field.label} required={field.required} description={field.description}>
      {/* Existing items as chips */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {items.map((item, i) => (
            <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 gap-1 font-mono">
              {item}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="hover:text-destructive transition-colors"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
      {/* Add input */}
      {!readOnly && (
        <div className="flex items-center gap-1">
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addItem()
              }
            }}
            placeholder={field.placeholder}
            className="h-7 text-xs flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={addItem}
            disabled={!inputValue.trim()}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </FieldWrapper>
  )
}

function TextareaField({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: PluginFieldDef
  value: unknown
  onChange: (value: unknown) => void
  readOnly: boolean
}) {
  return (
    <FieldWrapper label={field.label} required={field.required} description={field.description}>
      <textarea
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={field.placeholder}
        disabled={readOnly}
        rows={3}
        className="w-full rounded-md border bg-transparent px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none"
        spellCheck={false}
      />
    </FieldWrapper>
  )
}
