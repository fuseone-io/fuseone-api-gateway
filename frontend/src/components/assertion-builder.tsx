"use client"

import { Trash2 } from "lucide-react"
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
import type { Assertion } from "@/types/testing"

const ASSERTION_TYPES: { value: Assertion["type"]; label: string }[] = [
  { value: "status_code", label: "Status Code" },
  { value: "header", label: "Header" },
  { value: "body_json", label: "Body (JSONPath)" },
  { value: "body_contains", label: "Body (Contém)" },
  { value: "response_time", label: "Tempo de Resposta (ms)" },
]

const OPERATORS: { value: Assertion["operator"]; label: string }[] = [
  { value: "eq", label: "Igual (=)" },
  { value: "neq", label: "Diferente (!=)" },
  { value: "gt", label: "Maior que (>)" },
  { value: "lt", label: "Menor que (<)" },
  { value: "gte", label: "Maior ou igual (>=)" },
  { value: "lte", label: "Menor ou igual (<=)" },
  { value: "contains", label: "Contém" },
  { value: "matches", label: "Regex" },
]

function getTargetPlaceholder(type: Assertion["type"]): string {
  switch (type) {
    case "status_code":
      return "Ex: 200"
    case "header":
      return "Nome do header (ex: Content-Type)"
    case "body_json":
      return "JSONPath (ex: $.data.id)"
    case "body_contains":
      return "Texto a procurar"
    case "response_time":
      return "Tempo em ms"
    default:
      return ""
  }
}

function getExpectedPlaceholder(type: Assertion["type"]): string {
  switch (type) {
    case "status_code":
      return "200"
    case "header":
      return "application/json"
    case "body_json":
      return "Valor esperado"
    case "body_contains":
      return "Texto esperado"
    case "response_time":
      return "500"
    default:
      return "Valor esperado"
  }
}

function getPreviewText(assertion: Assertion): string {
  const typeLabel = ASSERTION_TYPES.find((t) => t.value === assertion.type)?.label || assertion.type
  const opLabel = OPERATORS.find((o) => o.value === assertion.operator)?.label || assertion.operator

  switch (assertion.type) {
    case "status_code":
      return `${typeLabel} ${opLabel} ${assertion.expected || "?"}`
    case "header":
      return `Header "${assertion.target || "?"}" ${opLabel} "${assertion.expected || "?"}"`
    case "body_json":
      return `${assertion.target || "?"} ${opLabel} "${assertion.expected || "?"}"`
    case "body_contains":
      return `Body contém "${assertion.expected || "?"}"`
    case "response_time":
      return `Tempo de resposta ${opLabel} ${assertion.expected || "?"}ms`
    default:
      return `${typeLabel}: ${assertion.target} ${opLabel} ${assertion.expected}`
  }
}

function showTargetField(type: Assertion["type"]): boolean {
  return type === "header" || type === "body_json"
}

interface AssertionBuilderProps {
  assertion: Assertion
  onChange: (assertion: Assertion) => void
  onRemove: () => void
}

export function AssertionBuilder({ assertion, onChange, onRemove }: AssertionBuilderProps) {
  const update = (patch: Partial<Assertion>) => {
    onChange({ ...assertion, ...patch })
  }

  return (
    <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground font-mono truncate flex-1">
          {getPreviewText(assertion)}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={assertion.type}
            onValueChange={(v) =>
              update({
                type: v as Assertion["type"],
                target: v === "status_code" || v === "response_time" ? "" : assertion.target,
              })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSERTION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Operador</Label>
          <Select
            value={assertion.operator}
            onValueChange={(v) => update({ operator: v as Assertion["operator"] })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showTargetField(assertion.type) && (
        <div className="space-y-1.5">
          <Label className="text-xs">Alvo</Label>
          <Input
            className="h-8 text-xs"
            placeholder={getTargetPlaceholder(assertion.type)}
            value={assertion.target}
            onChange={(e) => update({ target: e.target.value })}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Valor Esperado</Label>
        <Input
          className="h-8 text-xs"
          placeholder={getExpectedPlaceholder(assertion.type)}
          value={assertion.expected}
          onChange={(e) => update({ expected: e.target.value })}
        />
      </div>
    </div>
  )
}
