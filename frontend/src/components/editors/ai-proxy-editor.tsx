"use client"

import { useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Bot,
  Sparkles,
  Globe,
  Search,
  Zap,
  Server,
  Cloud,
  Link,
  ChevronDown,
  Eye,
  EyeOff,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { CustomEditorProps } from "../flow/plugin-config-panel"

interface ProviderOption {
  id: string
  name: string
  description: string
  icon: LucideIcon
}

const PROVIDERS: ProviderOption[] = [
  { id: "openai", name: "OpenAI", description: "GPT models", icon: Bot },
  { id: "anthropic", name: "Anthropic", description: "Claude models", icon: Sparkles },
  { id: "google", name: "Google Gemini", description: "Gemini models", icon: Globe },
  { id: "deepseek", name: "DeepSeek", description: "DeepSeek models", icon: Search },
  { id: "mistral", name: "Mistral", description: "Mistral AI models", icon: Zap },
  { id: "groq", name: "Groq", description: "Fast inference", icon: Zap },
  { id: "ollama", name: "Ollama", description: "Local models", icon: Server },
  { id: "bedrock", name: "Bedrock", description: "AWS Bedrock", icon: Cloud },
  { id: "openai-compatible", name: "OpenAI Compatible", description: "Custom endpoint", icon: Link },
]

const POPULAR_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o3-mini"],
  anthropic: ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  google: ["gemini-2.5-pro", "gemini-2.5-flash"],
  mistral: ["mistral-large-latest", "mistral-small-latest"],
  groq: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
  ollama: ["llama3", "codellama", "mistral"],
  bedrock: [],
  "openai-compatible": [],
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    const sourceVal = source[key]
    const targetVal = result[key]
    if (
      sourceVal &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      )
    } else {
      result[key] = sourceVal
    }
  }
  return result
}

export default function AIProxyEditor({ config, onChange, readOnly }: CustomEditorProps) {
  const [showAuthKey, setShowAuthKey] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [authOpen, setAuthOpen] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Read values from config with safe optional chaining
  const provider = (config?.provider as string) ?? ""
  const model = (config?.options as Record<string, unknown>)?.model as string ?? ""
  const endpoint = (config?.override as Record<string, unknown>)?.endpoint as string ?? ""
  const authHeader =
    ((config?.auth as Record<string, unknown>)?.header as Record<string, unknown>)
      ?.Authorization as string ?? ""
  const apiKeyHeader =
    ((config?.auth as Record<string, unknown>)?.header as Record<string, unknown>)
      ?.["api-key"] as string ?? ""
  const timeout = (config?.timeout as number) ?? 30000
  const keepalive = (config?.keepalive as boolean) ?? true
  const sslVerify = (config?.ssl_verify as boolean) ?? true
  const logSummaries =
    ((config?.logging as Record<string, unknown>)?.summaries as boolean) ?? false
  const logPayloads =
    ((config?.logging as Record<string, unknown>)?.payloads as boolean) ?? false

  const update = useCallback(
    (partial: Record<string, unknown>) => {
      onChange(deepMerge(config ?? {}, partial))
    },
    [config, onChange]
  )

  const selectProvider = (id: string) => {
    update({ provider: id })
  }

  const setModel = (value: string) => {
    update({ options: { model: value } })
  }

  const setAuthorizationHeader = (value: string) => {
    update({ auth: { header: { Authorization: value } } })
  }

  const setApiKeyHeaderValue = (value: string) => {
    update({ auth: { header: { "api-key": value } } })
  }

  const setEndpoint = (value: string) => {
    update({ override: { endpoint: value } })
  }

  const setTimeout_ = (value: number) => {
    update({ timeout: value })
  }

  const setKeepalive = (value: boolean) => {
    update({ keepalive: value })
  }

  const setSslVerify = (value: boolean) => {
    update({ ssl_verify: value })
  }

  const setLogSummaries = (value: boolean) => {
    update({ logging: { summaries: value } })
  }

  const setLogPayloads = (value: boolean) => {
    update({ logging: { payloads: value } })
  }

  const popularModels = POPULAR_MODELS[provider] ?? []

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Provider Selector */}
          <div>
            <Label className="text-xs font-medium mb-2 block">AI Provider</Label>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map((p) => {
                const Icon = p.icon
                const isSelected = provider === p.id
                return (
                  <Card
                    key={p.id}
                    size="sm"
                    className={`cursor-pointer transition-all hover:bg-accent/50 ${
                      isSelected
                        ? "ring-2 ring-primary"
                        : ""
                    } ${readOnly ? "pointer-events-none opacity-70" : ""}`}
                    onClick={() => {
                      if (!readOnly) selectProvider(p.id)
                    }}
                  >
                    <CardContent className="flex flex-col items-center text-center gap-1 py-2 px-2">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <span className="text-xs font-medium leading-tight">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        {p.description}
                      </span>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          <Separator />

          {/* Model Input */}
          <div>
            <Label className="text-xs font-medium mb-1 block">Model</Label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Enter model name..."
              className="h-8 text-xs"
              disabled={readOnly}
            />
            {popularModels.length > 0 && (
              <div className="mt-2">
                <span className="text-[10px] text-muted-foreground block mb-1.5">
                  Popular models
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {popularModels.map((m) => (
                    <Badge
                      key={m}
                      variant="outline"
                      className={`cursor-pointer text-[10px] hover:bg-accent transition-colors ${
                        model === m ? "bg-primary/10 border-primary text-primary" : ""
                      } ${readOnly ? "pointer-events-none" : ""}`}
                      onClick={() => {
                        if (!readOnly) setModel(m)
                      }}
                    >
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Authentication Section */}
          <Collapsible open={authOpen} onOpenChange={setAuthOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full flex items-center justify-between px-0 h-8 hover:bg-transparent"
              >
                <Label className="text-xs font-medium cursor-pointer">Authentication</Label>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    authOpen ? "rotate-180" : ""
                  }`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* Authorization Header */}
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">
                  Authorization Header
                </Label>
                <div className="relative">
                  <Input
                    type={showAuthKey ? "text" : "password"}
                    value={authHeader}
                    onChange={(e) => setAuthorizationHeader(e.target.value)}
                    placeholder="Bearer sk-..."
                    className="h-8 text-xs pr-8"
                    disabled={readOnly}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-8 w-8"
                    onClick={() => setShowAuthKey(!showAuthKey)}
                    tabIndex={-1}
                  >
                    {showAuthKey ? (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              {/* API Key Header */}
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">
                  API Key Header
                </Label>
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={apiKeyHeader}
                    onChange={(e) => setApiKeyHeaderValue(e.target.value)}
                    placeholder="api-key value..."
                    className="h-8 text-xs pr-8"
                    disabled={readOnly}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-8 w-8"
                    onClick={() => setShowApiKey(!showApiKey)}
                    tabIndex={-1}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Store sensitive keys in the Secrets manager using $secret:// references
              </p>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Advanced Settings */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full flex items-center justify-between px-0 h-8 hover:bg-transparent"
              >
                <Label className="text-xs font-medium cursor-pointer">Advanced Settings</Label>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    advancedOpen ? "rotate-180" : ""
                  }`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
              {/* Custom Endpoint URL - only for openai-compatible */}
              {provider === "openai-compatible" && (
                <div>
                  <Label className="text-[10px] text-muted-foreground mb-1 block">
                    Custom Endpoint URL
                  </Label>
                  <Input
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="https://your-endpoint.com/v1"
                    className="h-8 text-xs"
                    disabled={readOnly}
                  />
                </div>
              )}

              {/* Timeout */}
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">
                  Timeout (ms)
                </Label>
                <Input
                  type="number"
                  value={timeout}
                  onChange={(e) => setTimeout_(Number(e.target.value) || 30000)}
                  className="h-8 text-xs"
                  disabled={readOnly}
                />
              </div>

              {/* Keepalive toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Keepalive</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Reuse upstream connections
                  </p>
                </div>
                <Switch
                  checked={keepalive}
                  onCheckedChange={setKeepalive}
                  disabled={readOnly}
                />
              </div>

              {/* SSL Verify toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">SSL Verify</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Verify upstream TLS certificates
                  </p>
                </div>
                <Switch
                  checked={sslVerify}
                  onCheckedChange={setSslVerify}
                  disabled={readOnly}
                />
              </div>

              {/* Log Summaries toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Log Summaries</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Log request/response summaries
                  </p>
                </div>
                <Switch
                  checked={logSummaries}
                  onCheckedChange={setLogSummaries}
                  disabled={readOnly}
                />
              </div>

              {/* Log Payloads toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Log Payloads</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Log full request/response bodies
                  </p>
                </div>
                <Switch
                  checked={logPayloads}
                  onCheckedChange={setLogPayloads}
                  disabled={readOnly}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  )
}
