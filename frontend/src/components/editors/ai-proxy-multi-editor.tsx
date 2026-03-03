"use client"

import { useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Plus, Trash2, ChevronDown, GripVertical } from "lucide-react"
import type { CustomEditorProps } from "../flow/plugin-config-panel"

// --- Types ---

interface InstanceAuth {
  header: Record<string, string>
}

interface InstanceOptions {
  model: string
  [key: string]: unknown
}

interface LLMInstance {
  name: string
  provider: string
  weight: number
  auth: InstanceAuth
  options: InstanceOptions
}

interface AIProxyMultiConfig {
  balancer: { algorithm: string }
  fallback: { strategy: string }
  instances: LLMInstance[]
}

// --- Constants ---

const PROVIDERS = [
  "openai",
  "anthropic",
  "deepseek",
  "google",
  "mistral",
  "groq",
  "ollama",
  "openai-compatible",
] as const

const BALANCER_OPTIONS = [
  { value: "roundrobin", label: "Round Robin" },
  { value: "chash", label: "Consistent Hash" },
] as const

const FALLBACK_OPTIONS = [
  { value: "instance_health_and_rate_limiting", label: "Health + Rate Limiting" },
  { value: "http_429", label: "HTTP 429" },
  { value: "http_5xx", label: "HTTP 5xx" },
] as const

const INSTANCE_COLORS = ["#0f5fb8", "#950fb8", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]

const AUTH_HEADER_BY_PROVIDER: Record<string, string> = {
  anthropic: "x-api-key",
  openai: "Authorization",
  deepseek: "Authorization",
  google: "Authorization",
  mistral: "Authorization",
  groq: "Authorization",
  ollama: "Authorization",
  "openai-compatible": "Authorization",
}

// --- Helpers ---

function defaultInstance(n: number): LLMInstance {
  return {
    name: `instance-${n}`,
    provider: "openai",
    weight: 50,
    auth: { header: { Authorization: "" } },
    options: { model: "" },
  }
}

function extractConfig(config: Record<string, unknown>): AIProxyMultiConfig {
  const raw = config as Partial<AIProxyMultiConfig>
  return {
    balancer: {
      algorithm: raw?.balancer?.algorithm || "roundrobin",
    },
    fallback: {
      strategy: raw?.fallback?.strategy || "instance_health_and_rate_limiting",
    },
    instances: Array.isArray(raw?.instances)
      ? raw.instances.map((inst) => ({
          name: inst.name || "",
          provider: inst.provider || "openai",
          weight: typeof inst.weight === "number" ? inst.weight : 50,
          auth: inst.auth || { header: { Authorization: "" } },
          options: inst.options || { model: "" },
        }))
      : [],
  }
}

function getAuthValue(instance: LLMInstance): string {
  const headerKey = AUTH_HEADER_BY_PROVIDER[instance.provider] || "Authorization"
  return instance.auth?.header?.[headerKey] || instance.auth?.header?.Authorization || ""
}

function setAuthValue(instance: LLMInstance, value: string): InstanceAuth {
  const headerKey = AUTH_HEADER_BY_PROVIDER[instance.provider] || "Authorization"
  return { header: { [headerKey]: value } }
}

function getInstanceColor(idx: number): string {
  return INSTANCE_COLORS[idx % INSTANCE_COLORS.length]
}

// --- Weight Bar ---

function WeightBar({ instances }: { instances: LLMInstance[] }) {
  const totalWeight = instances.reduce((sum, inst) => sum + inst.weight, 0)

  if (totalWeight === 0 || instances.length === 0) {
    return (
      <div className="h-6 rounded-md bg-muted flex items-center justify-center">
        <span className="text-[10px] text-muted-foreground">No weight distribution</span>
      </div>
    )
  }

  return (
    <div className="h-6 rounded-md overflow-hidden flex" title="Weight distribution">
      {instances.map((inst, idx) => {
        const pct = (inst.weight / totalWeight) * 100
        if (pct <= 0) return null
        return (
          <div
            key={idx}
            className="h-full flex items-center justify-center transition-all duration-300"
            style={{
              width: `${pct}%`,
              backgroundColor: getInstanceColor(idx),
              minWidth: pct > 0 ? "20px" : "0",
            }}
            title={`${inst.name}: ${inst.weight} (${pct.toFixed(0)}%)`}
          >
            {pct >= 12 && (
              <span className="text-[9px] font-medium text-white truncate px-1">
                {inst.name} {pct.toFixed(0)}%
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// --- Instance Card ---

interface InstanceCardProps {
  instance: LLMInstance
  index: number
  isOpen: boolean
  onToggle: () => void
  onUpdate: (update: Partial<LLMInstance>) => void
  onRemove: () => void
  readOnly: boolean
}

function InstanceCard({
  instance,
  index,
  isOpen,
  onToggle,
  onUpdate,
  onRemove,
  readOnly,
}: InstanceCardProps) {
  const color = getInstanceColor(index)

  return (
    <Card className="p-0 gap-0 overflow-visible" size="sm">
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <div
            className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none hover:bg-accent/50 transition-colors rounded-t-xl"
            style={{ borderLeft: `3px solid ${color}` }}
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate flex-1">
              {instance.name || "Unnamed"}
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
              {instance.provider}
            </Badge>
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 shrink-0 font-mono"
              style={{ backgroundColor: `${color}20`, color }}
            >
              w:{instance.weight}
            </Badge>
            {!readOnly && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove()
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-3 space-y-3">
            {/* Instance Name */}
            <div>
              <Label className="text-xs">Instance Name</Label>
              <Input
                value={instance.name}
                onChange={(e) => onUpdate({ name: e.target.value.replace(/\s+/g, "-") })}
                className="h-8 text-xs font-mono mt-1"
                placeholder="instance-name"
                disabled={readOnly}
              />
            </div>

            {/* Provider */}
            <div>
              <Label className="text-xs">Provider</Label>
              <Select
                value={instance.provider}
                onValueChange={(v) => {
                  const newAuth = setAuthValue(
                    { ...instance, provider: v },
                    getAuthValue(instance)
                  )
                  onUpdate({ provider: v, auth: newAuth })
                }}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div>
              <Label className="text-xs">Model</Label>
              <Input
                value={instance.options.model}
                onChange={(e) =>
                  onUpdate({ options: { ...instance.options, model: e.target.value } })
                }
                className="h-8 text-xs font-mono mt-1"
                placeholder="gpt-4o, claude-sonnet-4-20250514, etc."
                disabled={readOnly}
              />
            </div>

            {/* Weight */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Weight</Label>
                <span
                  className="text-xs font-mono font-medium"
                  style={{ color }}
                >
                  {instance.weight}
                </span>
              </div>
              <Slider
                value={[instance.weight]}
                onValueChange={([v]) => onUpdate({ weight: v })}
                min={0}
                max={100}
                step={1}
                disabled={readOnly}
                className="mt-2"
              />
            </div>

            {/* Auth */}
            <div>
              <Label className="text-xs">
                Authorization ({AUTH_HEADER_BY_PROVIDER[instance.provider] || "Authorization"})
              </Label>
              <Input
                type="password"
                value={getAuthValue(instance)}
                onChange={(e) => onUpdate({ auth: setAuthValue(instance, e.target.value) })}
                className="h-8 text-xs font-mono mt-1"
                placeholder={
                  instance.provider === "anthropic"
                    ? "sk-ant-..."
                    : "Bearer sk-..."
                }
                disabled={readOnly}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

// --- Main Editor ---

export default function AIProxyMultiEditor({ config, onChange, readOnly }: CustomEditorProps) {
  const [state, setState] = useState(() => extractConfig(config))
  const [openInstances, setOpenInstances] = useState<Set<number>>(() => new Set([0]))

  const sync = useCallback(
    (next: AIProxyMultiConfig) => {
      setState(next)
      onChange(next as unknown as Record<string, unknown>)
    },
    [onChange]
  )

  const toggleInstance = useCallback((idx: number) => {
    setOpenInstances((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) {
        next.delete(idx)
      } else {
        next.add(idx)
      }
      return next
    })
  }, [])

  const addInstance = useCallback(() => {
    const next = {
      ...state,
      instances: [...state.instances, defaultInstance(state.instances.length + 1)],
    }
    sync(next)
    setOpenInstances((prev) => new Set(prev).add(next.instances.length - 1))
  }, [state, sync])

  const removeInstance = useCallback(
    (idx: number) => {
      const instances = state.instances.filter((_, i) => i !== idx)
      sync({ ...state, instances })
      setOpenInstances((prev) => {
        const next = new Set<number>()
        prev.forEach((i) => {
          if (i < idx) next.add(i)
          else if (i > idx) next.add(i - 1)
        })
        return next
      })
    },
    [state, sync]
  )

  const updateInstance = useCallback(
    (idx: number, update: Partial<LLMInstance>) => {
      const instances = state.instances.map((inst, i) =>
        i === idx ? { ...inst, ...update } : inst
      )
      sync({ ...state, instances })
    },
    [state, sync]
  )

  const currentBalancerLabel = useMemo(
    () => BALANCER_OPTIONS.find((o) => o.value === state.balancer.algorithm)?.label || "Round Robin",
    [state.balancer.algorithm]
  )

  const currentFallbackLabel = useMemo(
    () =>
      FALLBACK_OPTIONS.find((o) => o.value === state.fallback.strategy)?.label ||
      "Health + Rate Limiting",
    [state.fallback.strategy]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs whitespace-nowrap">Balancing</Label>
          <Select
            value={state.balancer.algorithm}
            onValueChange={(v) =>
              sync({ ...state, balancer: { ...state.balancer, algorithm: v } })
            }
            disabled={readOnly}
          >
            <SelectTrigger className="h-7 text-xs w-[140px]">
              <SelectValue placeholder={currentBalancerLabel} />
            </SelectTrigger>
            <SelectContent>
              {BALANCER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <Label className="text-xs whitespace-nowrap">Fallback</Label>
          <Select
            value={state.fallback.strategy}
            onValueChange={(v) =>
              sync({ ...state, fallback: { ...state.fallback, strategy: v } })
            }
            disabled={readOnly}
          >
            <SelectTrigger className="h-7 text-xs w-[190px]">
              <SelectValue placeholder={currentFallbackLabel} />
            </SelectTrigger>
            <SelectContent>
              {FALLBACK_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1" />

        <Badge variant="outline" className="text-[10px]">
          {state.instances.length} instance{state.instances.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Weight Visualization Bar */}
      {state.instances.length > 0 && (
        <div className="px-4 py-2 border-b">
          <WeightBar instances={state.instances} />
        </div>
      )}

      {/* Instance List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {state.instances.length === 0 && (
            <div className="text-center py-12">
              <div className="h-12 w-12 mx-auto rounded-full bg-muted flex items-center justify-center mb-3">
                <Plus className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">No LLM instances configured</p>
              <p className="text-xs text-muted-foreground mb-4">
                Add instances to distribute AI requests across multiple providers
              </p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={addInstance}
                disabled={readOnly}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Instance
              </Button>
            </div>
          )}

          {state.instances.map((instance, idx) => (
            <InstanceCard
              key={idx}
              instance={instance}
              index={idx}
              isOpen={openInstances.has(idx)}
              onToggle={() => toggleInstance(idx)}
              onUpdate={(update) => updateInstance(idx, update)}
              onRemove={() => removeInstance(idx)}
              readOnly={readOnly}
            />
          ))}

          {state.instances.length > 0 && (
            <Button
              variant="outline"
              className="w-full h-9 text-xs border-dashed"
              onClick={addInstance}
              disabled={readOnly}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Instance
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
