"use client"

import { useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
  Variable,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AssertionBuilder } from "@/components/assertion-builder"
import type { TestStep, Assertion } from "@/types/testing"

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as const

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  PUT: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  DELETE: "bg-red-500/15 text-red-600 border-red-500/30",
  PATCH: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  HEAD: "bg-slate-500/15 text-slate-600 border-slate-500/30",
  OPTIONS: "bg-slate-500/15 text-slate-600 border-slate-500/30",
}

function hasBody(method: string): boolean {
  return ["POST", "PUT", "PATCH"].includes(method)
}

function createEmptyAssertion(): Assertion {
  return { type: "status_code", target: "", operator: "eq", expected: "200" }
}

function createEmptyStep(): TestStep {
  return {
    name: "",
    method: "GET",
    url: "",
    headers: {},
    body: "",
    assertions: [createEmptyAssertion()],
    extract_vars: {},
    delay_ms: 0,
  }
}

interface HeaderRow {
  key: string
  value: string
}

interface ExtractVarRow {
  key: string
  value: string
}

// ── Single step editor (expanded) ──
function StepForm({
  step,
  onChange,
}: {
  step: TestStep
  onChange: (step: TestStep) => void
}) {
  const headers: HeaderRow[] = Object.entries(step.headers || {}).map(([key, value]) => ({
    key,
    value,
  }))

  const extractVars: ExtractVarRow[] = Object.entries(step.extract_vars || {}).map(
    ([key, value]) => ({ key, value })
  )

  const updateHeaders = (rows: HeaderRow[]) => {
    const obj: Record<string, string> = {}
    rows.forEach((r) => {
      if (r.key.trim()) obj[r.key.trim()] = r.value
    })
    onChange({ ...step, headers: obj })
  }

  const updateExtractVars = (rows: ExtractVarRow[]) => {
    const obj: Record<string, string> = {}
    rows.forEach((r) => {
      if (r.key.trim()) obj[r.key.trim()] = r.value
    })
    onChange({ ...step, extract_vars: obj })
  }

  return (
    <div className="space-y-4 p-4 border-t bg-muted/10">
      {/* Name */}
      <div className="space-y-1.5">
        <Label className="text-xs">Nome do Step</Label>
        <Input
          className="h-8 text-sm"
          placeholder="Ex: Verificar listagem de APIs"
          value={step.name}
          onChange={(e) => onChange({ ...step, name: e.target.value })}
        />
      </div>

      {/* Method + URL */}
      <div className="flex gap-2">
        <div className="w-[130px]">
          <Label className="text-xs">Metodo</Label>
          <Select
            value={step.method}
            onValueChange={(v) => onChange({ ...step, method: v as TestStep["method"] })}
          >
            <SelectTrigger className="h-8 text-xs mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HTTP_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  <Badge variant="outline" className={`text-[10px] ${METHOD_COLORS[m]}`}>
                    {m}
                  </Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label className="text-xs">URL</Label>
          <Input
            className="h-8 text-xs font-mono mt-1.5"
            placeholder="https://api.exemplo.com/v1/resource"
            value={step.url}
            onChange={(e) => onChange({ ...step, url: e.target.value })}
          />
        </div>
      </div>

      {/* Headers */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Headers</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => updateHeaders([...headers, { key: "", value: "" }])}
          >
            <Plus className="h-3 w-3 mr-1" />
            Adicionar
          </Button>
        </div>
        {headers.map((h, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              className="h-7 text-xs flex-1"
              placeholder="Header name"
              value={h.key}
              onChange={(e) => {
                const updated = [...headers]
                updated[i] = { ...updated[i], key: e.target.value }
                updateHeaders(updated)
              }}
            />
            <Input
              className="h-7 text-xs flex-1"
              placeholder="Value"
              value={h.value}
              onChange={(e) => {
                const updated = [...headers]
                updated[i] = { ...updated[i], value: e.target.value }
                updateHeaders(updated)
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => {
                const updated = headers.filter((_, idx) => idx !== i)
                updateHeaders(updated)
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Body */}
      {hasBody(step.method) && (
        <div className="space-y-1.5">
          <Label className="text-xs">Body</Label>
          <Textarea
            className="font-mono text-xs min-h-[80px]"
            placeholder='{"key": "value"}'
            value={step.body || ""}
            onChange={(e) => onChange({ ...step, body: e.target.value })}
          />
        </div>
      )}

      {/* Delay */}
      <div className="space-y-1.5">
        <Label className="text-xs">Delay antes do step (ms)</Label>
        <Input
          type="number"
          className="h-8 text-xs w-[160px]"
          placeholder="0"
          min={0}
          value={step.delay_ms || 0}
          onChange={(e) => onChange({ ...step, delay_ms: parseInt(e.target.value) || 0 })}
        />
      </div>

      {/* Assertions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Assertions</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() =>
              onChange({
                ...step,
                assertions: [...step.assertions, createEmptyAssertion()],
              })
            }
          >
            <Plus className="h-3 w-3 mr-1" />
            Adicionar Assertion
          </Button>
        </div>
        {step.assertions.map((assertion, i) => (
          <AssertionBuilder
            key={i}
            assertion={assertion}
            onChange={(updated) => {
              const assertions = [...step.assertions]
              assertions[i] = updated
              onChange({ ...step, assertions })
            }}
            onRemove={() => {
              onChange({
                ...step,
                assertions: step.assertions.filter((_, idx) => idx !== i),
              })
            }}
          />
        ))}
      </div>

      {/* Extract Variables */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs flex items-center gap-1">
            <Variable className="h-3 w-3" />
            Extrair Variaveis
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => updateExtractVars([...extractVars, { key: "", value: "" }])}
          >
            <Plus className="h-3 w-3 mr-1" />
            Adicionar
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Extraia valores do response para usar em steps seguintes. Use JSONPath no valor.
        </p>
        {extractVars.map((v, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              className="h-7 text-xs flex-1"
              placeholder="Nome da variavel (ex: token)"
              value={v.key}
              onChange={(e) => {
                const updated = [...extractVars]
                updated[i] = { ...updated[i], key: e.target.value }
                updateExtractVars(updated)
              }}
            />
            <Input
              className="h-7 text-xs flex-1 font-mono"
              placeholder="JSONPath (ex: $.data.token)"
              value={v.value}
              onChange={(e) => {
                const updated = [...extractVars]
                updated[i] = { ...updated[i], value: e.target.value }
                updateExtractVars(updated)
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => {
                const updated = extractVars.filter((_, idx) => idx !== i)
                updateExtractVars(updated)
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main multi-step editor ──
interface TestStepEditorProps {
  steps: TestStep[]
  onChange: (steps: TestStep[]) => void
}

export function TestStepEditor({ steps, onChange }: TestStepEditorProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(
    steps.length > 0 ? 0 : null
  )

  const addStep = () => {
    const updated = [...steps, createEmptyStep()]
    onChange(updated)
    setExpandedIndex(updated.length - 1)
  }

  const removeStep = (index: number) => {
    const updated = steps.filter((_, i) => i !== index)
    onChange(updated)
    if (expandedIndex === index) setExpandedIndex(null)
    else if (expandedIndex !== null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1)
    }
  }

  const moveStep = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= steps.length) return
    const updated = [...steps]
    ;[updated[index], updated[newIndex]] = [updated[newIndex], updated[index]]
    onChange(updated)
    setExpandedIndex(newIndex)
  }

  const updateStep = (index: number, step: TestStep) => {
    const updated = [...steps]
    updated[index] = step
    onChange(updated)
  }

  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const isExpanded = expandedIndex === i
        return (
          <div key={i} className="rounded-lg border overflow-hidden">
            {/* Collapsed header */}
            <div
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setExpandedIndex(isExpanded ? null : i)}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              <span className="text-xs text-muted-foreground font-mono w-6 shrink-0">
                #{i + 1}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] shrink-0 ${METHOD_COLORS[step.method] || ""}`}
              >
                {step.method}
              </Badge>
              <span className="text-sm truncate flex-1">
                {step.name || step.url || "Step sem nome"}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {step.assertions.length} assertion{step.assertions.length !== 1 ? "s" : ""}
              </span>

              {/* Reorder buttons */}
              <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={i === 0}
                  onClick={() => moveStep(i, "up")}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={i === steps.length - 1}
                  onClick={() => moveStep(i, "down")}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => removeStep(i)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </div>

            {/* Expanded form */}
            {isExpanded && (
              <StepForm step={step} onChange={(updated) => updateStep(i, updated)} />
            )}
          </div>
        )
      })}

      <Button type="button" variant="outline" className="w-full" onClick={addStep}>
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Step
      </Button>
    </div>
  )
}
