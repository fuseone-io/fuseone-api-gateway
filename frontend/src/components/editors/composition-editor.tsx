"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Plus, Trash2, GripVertical, ChevronRight, GitMerge,
  ArrowDown, Shuffle, Settings2, Code2, AlertCircle,
} from "lucide-react"
import type { CustomEditorProps } from "../flow/plugin-config-panel"

interface CompositionStep {
  id: string
  uri: string
  method: string
  headers: Record<string, string>
  body: string
  timeout: number
  extract: Array<{ source: string; target: string }>
  on_error: "skip" | "abort" | "fallback"
  fallback_value: string
}

interface CompositionConfig {
  steps: CompositionStep[]
  execution: "parallel" | "sequential"
  response_template: string
  response_status: number
  response_content_type: string
}

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"]

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  POST: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  PUT: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  DELETE: "bg-red-500/10 text-red-600 border-red-500/30",
  PATCH: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  HEAD: "bg-gray-500/10 text-gray-600 border-gray-500/30",
}

function defaultStep(idx: number): CompositionStep {
  return {
    id: `step_${idx + 1}`,
    uri: "",
    method: "GET",
    headers: {},
    body: "",
    timeout: 3000,
    extract: [],
    on_error: "skip",
    fallback_value: "",
  }
}

function extractConfig(config: Record<string, unknown>): CompositionConfig {
  return {
    steps: (config.steps as CompositionStep[]) || [],
    execution: (config.execution as "parallel" | "sequential") || "sequential",
    response_template: (config.response_template as string) || '{\n  "data": "composed"\n}',
    response_status: (config.response_status as number) || 200,
    response_content_type: (config.response_content_type as string) || "application/json",
  }
}

export default function CompositionEditor({ config, onChange, readOnly }: CustomEditorProps) {
  const [comp, setComp] = useState(() => extractConfig(config))
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [showTemplate, setShowTemplate] = useState(false)

  const sync = useCallback(
    (next: CompositionConfig) => {
      setComp(next)
      onChange(next as unknown as Record<string, unknown>)
    },
    [onChange]
  )

  const addStep = () => {
    const next = { ...comp, steps: [...comp.steps, defaultStep(comp.steps.length)] }
    sync(next)
    setSelectedIdx(next.steps.length - 1)
  }

  const removeStep = (idx: number) => {
    const steps = comp.steps.filter((_, i) => i !== idx)
    const next = { ...comp, steps }
    sync(next)
    setSelectedIdx(null)
  }

  const updateStep = (idx: number, update: Partial<CompositionStep>) => {
    const steps = comp.steps.map((s, i) => (i === idx ? { ...s, ...update } : s))
    sync({ ...comp, steps })
  }

  const addExtract = (stepIdx: number) => {
    const step = comp.steps[stepIdx]
    updateStep(stepIdx, { extract: [...step.extract, { source: "$.data", target: "result" }] })
  }

  const removeExtract = (stepIdx: number, extractIdx: number) => {
    const step = comp.steps[stepIdx]
    updateStep(stepIdx, { extract: step.extract.filter((_, i) => i !== extractIdx) })
  }

  const updateExtract = (stepIdx: number, extractIdx: number, field: "source" | "target", value: string) => {
    const step = comp.steps[stepIdx]
    const extract = step.extract.map((e, i) => (i === extractIdx ? { ...e, [field]: value } : e))
    updateStep(stepIdx, { extract })
  }

  const addStepHeader = (stepIdx: number) => {
    const step = comp.steps[stepIdx]
    updateStep(stepIdx, { headers: { ...step.headers, "": "" } })
  }

  const updateStepHeader = (stepIdx: number, oldKey: string, newKey: string, value: string) => {
    const step = comp.steps[stepIdx]
    const headers = { ...step.headers }
    if (oldKey !== newKey) delete headers[oldKey]
    headers[newKey] = value
    updateStep(stepIdx, { headers })
  }

  const removeStepHeader = (stepIdx: number, key: string) => {
    const step = comp.steps[stepIdx]
    const headers = { ...step.headers }
    delete headers[key]
    updateStep(stepIdx, { headers })
  }

  const selected = selectedIdx !== null ? comp.steps[selectedIdx] : null

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <GitMerge className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium">API Composition</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 bg-muted rounded-md p-0.5">
          <button
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              comp.execution === "sequential"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground"
            }`}
            onClick={() => sync({ ...comp, execution: "sequential" })}
            disabled={readOnly}
          >
            <ArrowDown className="h-3 w-3 inline mr-1" />
            Sequential
          </button>
          <button
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              comp.execution === "parallel"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground"
            }`}
            onClick={() => sync({ ...comp, execution: "parallel" })}
            disabled={readOnly}
          >
            <Shuffle className="h-3 w-3 inline mr-1" />
            Parallel
          </button>
        </div>
        <Button
          variant={showTemplate ? "secondary" : "outline"}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => { setShowTemplate(!showTemplate); setSelectedIdx(null) }}
        >
          <Code2 className="h-3.5 w-3.5" />
          Response
        </Button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Step list */}
        <div className="w-48 border-r flex flex-col shrink-0">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <span className="text-xs font-semibold">Steps</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={addStep}
              disabled={readOnly}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {comp.steps.length === 0 && (
                <div className="text-center py-6">
                  <GitMerge className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-[10px] text-muted-foreground">No steps yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 text-xs"
                    onClick={addStep}
                    disabled={readOnly}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Step
                  </Button>
                </div>
              )}
              {comp.steps.map((step, i) => (
                <button
                  key={i}
                  className={`w-full text-left rounded-md p-2 transition-colors ${
                    selectedIdx === i && !showTemplate
                      ? "bg-accent ring-1 ring-ring"
                      : "hover:bg-accent/50"
                  }`}
                  onClick={() => { setSelectedIdx(i); setShowTemplate(false) }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground font-mono w-4">{i + 1}</span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1 py-0 font-mono ${METHOD_COLORS[step.method] || ""}`}
                    >
                      {step.method}
                    </Badge>
                    <span className="text-xs font-mono truncate flex-1">
                      {step.id || `step_${i + 1}`}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5 pl-5">
                    {step.uri || "(no URL)"}
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Step detail / Response template */}
        <div className="flex-1 min-w-0">
          {showTemplate ? (
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                <div>
                  <Label className="text-xs">Response Template</Label>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Build the aggregated response using $ctx.step_id to reference step results
                  </p>
                  <textarea
                    value={comp.response_template}
                    onChange={(e) => sync({ ...comp, response_template: e.target.value })}
                    className="w-full h-48 rounded-md border bg-muted/50 p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    spellCheck={false}
                    disabled={readOnly}
                    placeholder={'{\n  "user": $ctx.get_user,\n  "orders": $ctx.get_orders\n}'}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Status Code</Label>
                    <Input
                      type="number"
                      value={comp.response_status}
                      onChange={(e) => sync({ ...comp, response_status: Number(e.target.value) })}
                      className="h-8 text-xs mt-1"
                      min={100}
                      max={599}
                      disabled={readOnly}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Content-Type</Label>
                    <Input
                      value={comp.response_content_type}
                      onChange={(e) => sync({ ...comp, response_content_type: e.target.value })}
                      className="h-8 text-xs mt-1"
                      disabled={readOnly}
                    />
                  </div>
                </div>
                {comp.steps.length > 0 && (
                  <div>
                    <Label className="text-xs mb-2 block">Available Context Variables</Label>
                    <div className="space-y-1">
                      {comp.steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">
                            $ctx.{step.id}
                          </code>
                          <span className="text-muted-foreground">— Full response from step {i + 1}</span>
                        </div>
                      ))}
                      {comp.steps.flatMap((step) =>
                        step.extract.map((e) => (
                          <div key={`${step.id}-${e.target}`} className="flex items-center gap-2 text-xs">
                            <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">
                              $ctx.{e.target}
                            </code>
                            <span className="text-muted-foreground">
                              — Extracted from {step.id} via {e.source}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : selected && selectedIdx !== null ? (
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {/* Step ID & Method */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <Label className="text-xs">Step ID</Label>
                    <Input
                      value={selected.id}
                      onChange={(e) => updateStep(selectedIdx, { id: e.target.value.replace(/\s+/g, "_") })}
                      className="h-8 text-xs font-mono mt-1"
                      placeholder="step_name"
                      disabled={readOnly}
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="text-xs">Method</Label>
                    <Select
                      value={selected.method}
                      onValueChange={(v) => updateStep(selectedIdx, { method: v })}
                      disabled={readOnly}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {METHODS.map((m) => (
                          <SelectItem key={m} value={m} className="text-xs font-mono">
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    <Label className="text-xs">Timeout (ms)</Label>
                    <Input
                      type="number"
                      value={selected.timeout}
                      onChange={(e) => updateStep(selectedIdx, { timeout: Number(e.target.value) })}
                      className="h-8 text-xs mt-1"
                      min={100}
                      max={60000}
                      disabled={readOnly}
                    />
                  </div>
                </div>

                {/* URI */}
                <div>
                  <Label className="text-xs">URL</Label>
                  <Input
                    value={selected.uri}
                    onChange={(e) => updateStep(selectedIdx, { uri: e.target.value })}
                    className="h-8 text-xs font-mono mt-1"
                    placeholder="http://service:8080/api/resource/$http_x_user_id"
                    disabled={readOnly}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Use $var for nginx variables, $ctx.step_id for previous step results
                  </p>
                </div>

                {/* Body (for POST/PUT/PATCH) */}
                {["POST", "PUT", "PATCH"].includes(selected.method) && (
                  <div>
                    <Label className="text-xs">Request Body</Label>
                    <textarea
                      value={selected.body}
                      onChange={(e) => updateStep(selectedIdx, { body: e.target.value })}
                      className="w-full h-20 rounded-md border bg-muted/50 p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none mt-1"
                      spellCheck={false}
                      disabled={readOnly}
                      placeholder='{"key": "value"}'
                    />
                  </div>
                )}

                {/* Headers */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">Headers</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() => addStepHeader(selectedIdx)}
                      disabled={readOnly}
                    >
                      <Plus className="h-3 w-3 mr-0.5" />
                      Add
                    </Button>
                  </div>
                  {Object.keys(selected.headers).length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">No custom headers</p>
                  ) : (
                    <div className="space-y-1">
                      {Object.entries(selected.headers).map(([key, value], i) => (
                        <div key={i} className="flex items-center gap-1">
                          <Input
                            value={key}
                            placeholder="Header"
                            onChange={(e) => updateStepHeader(selectedIdx, key, e.target.value, value)}
                            className="h-7 text-xs flex-1"
                            disabled={readOnly}
                          />
                          <Input
                            value={value}
                            placeholder="Value"
                            onChange={(e) => updateStepHeader(selectedIdx, key, key, e.target.value)}
                            className="h-7 text-xs flex-1"
                            disabled={readOnly}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => removeStepHeader(selectedIdx, key)}
                            disabled={readOnly}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Extract rules */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">Extract to Context</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() => addExtract(selectedIdx)}
                      disabled={readOnly}
                    >
                      <Plus className="h-3 w-3 mr-0.5" />
                      Add
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Extract values from this step&apos;s response using JSONPath
                  </p>
                  {selected.extract.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground italic">
                      Full response available as $ctx.{selected.id}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {selected.extract.map((e, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <Input
                            value={e.source}
                            placeholder="$.data.field"
                            onChange={(ev) => updateExtract(selectedIdx, i, "source", ev.target.value)}
                            className="h-7 text-xs font-mono flex-1"
                            disabled={readOnly}
                          />
                          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          <Input
                            value={e.target}
                            placeholder="var_name"
                            onChange={(ev) => updateExtract(selectedIdx, i, "target", ev.target.value)}
                            className="h-7 text-xs font-mono flex-1"
                            disabled={readOnly}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => removeExtract(selectedIdx, i)}
                            disabled={readOnly}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Error handling */}
                <div>
                  <Label className="text-xs">On Error</Label>
                  <Select
                    value={selected.on_error}
                    onValueChange={(v) => updateStep(selectedIdx, { on_error: v as CompositionStep["on_error"] })}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip" className="text-xs">Skip — continue without this step</SelectItem>
                      <SelectItem value="abort" className="text-xs">Abort — stop and return error</SelectItem>
                      <SelectItem value="fallback" className="text-xs">Fallback — use default value</SelectItem>
                    </SelectContent>
                  </Select>
                  {selected.on_error === "fallback" && (
                    <div className="mt-2">
                      <Label className="text-xs">Fallback Value</Label>
                      <Input
                        value={selected.fallback_value}
                        onChange={(e) => updateStep(selectedIdx, { fallback_value: e.target.value })}
                        className="h-8 text-xs font-mono mt-1"
                        placeholder='{"default": true}'
                        disabled={readOnly}
                      />
                    </div>
                  )}
                </div>

                {/* Delete */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs text-destructive hover:text-destructive"
                  onClick={() => removeStep(selectedIdx)}
                  disabled={readOnly}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Remove Step
                </Button>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Settings2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-xs">Select a step to configure</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  or click &quot;Response&quot; to edit the aggregated response
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
