"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Plus, Trash2, Copy, FlaskConical, FileJson } from "lucide-react"
import type { CustomEditorProps } from "../flow/plugin-config-panel"

interface MockProfile {
  name: string
  status: number
  contentType: string
  body: string
  headers: Record<string, string>
  delay: number
}

const STATUS_CODES = [
  { value: 200, label: "200 OK", color: "text-emerald-600" },
  { value: 201, label: "201 Created", color: "text-emerald-600" },
  { value: 204, label: "204 No Content", color: "text-emerald-600" },
  { value: 400, label: "400 Bad Request", color: "text-amber-600" },
  { value: 401, label: "401 Unauthorized", color: "text-amber-600" },
  { value: 403, label: "403 Forbidden", color: "text-amber-600" },
  { value: 404, label: "404 Not Found", color: "text-amber-600" },
  { value: 409, label: "409 Conflict", color: "text-amber-600" },
  { value: 422, label: "422 Unprocessable", color: "text-amber-600" },
  { value: 500, label: "500 Internal Error", color: "text-red-600" },
  { value: 502, label: "502 Bad Gateway", color: "text-red-600" },
  { value: 503, label: "503 Unavailable", color: "text-red-600" },
]

const CONTENT_TYPES = [
  "application/json",
  "text/xml",
  "text/plain",
  "text/html",
  "application/xml",
]

function defaultProfile(name: string, status: number, body: string): MockProfile {
  return { name, status, contentType: "application/json", body, headers: {}, delay: 0 }
}

function extractProfiles(config: Record<string, unknown>): MockProfile[] {
  const stored = config._profiles as MockProfile[] | undefined
  if (stored && stored.length > 0) return stored

  // Build from existing mocking config
  return [
    defaultProfile(
      "Default",
      (config.response_status as number) || 200,
      (config.response_example as string) || '{\n  "message": "Mock response"\n}'
    ),
  ]
}

function extractActiveIndex(config: Record<string, unknown>): number {
  return (config._active_profile as number) || 0
}

export default function MockingEditor({ config, onChange, readOnly }: CustomEditorProps) {
  const [profiles, setProfiles] = useState<MockProfile[]>(() => extractProfiles(config))
  const [activeIdx, setActiveIdx] = useState(() => extractActiveIndex(config))
  const [withMockHeader, setWithMockHeader] = useState(
    (config.with_mock_header as boolean) ?? true
  )

  const active = profiles[activeIdx] || profiles[0]

  const syncConfig = useCallback(
    (newProfiles: MockProfile[], newActiveIdx: number, mockHeader: boolean) => {
      const current = newProfiles[newActiveIdx] || newProfiles[0]
      if (!current) return
      onChange({
        response_status: current.status,
        content_type: current.contentType,
        response_example: current.body,
        delay: current.delay,
        with_mock_header: mockHeader,
        _profiles: newProfiles,
        _active_profile: newActiveIdx,
      })
    },
    [onChange]
  )

  const updateProfile = (idx: number, update: Partial<MockProfile>) => {
    const next = profiles.map((p, i) => (i === idx ? { ...p, ...update } : p))
    setProfiles(next)
    syncConfig(next, activeIdx, withMockHeader)
  }

  const addProfile = () => {
    const next = [
      ...profiles,
      defaultProfile(`Profile ${profiles.length + 1}`, 200, '{\n  "message": "New mock"\n}'),
    ]
    setProfiles(next)
    setActiveIdx(next.length - 1)
    syncConfig(next, next.length - 1, withMockHeader)
  }

  const removeProfile = (idx: number) => {
    if (profiles.length <= 1) return
    const next = profiles.filter((_, i) => i !== idx)
    const newActive = Math.min(activeIdx, next.length - 1)
    setProfiles(next)
    setActiveIdx(newActive)
    syncConfig(next, newActive, withMockHeader)
  }

  const selectProfile = (idx: number) => {
    setActiveIdx(idx)
    syncConfig(profiles, idx, withMockHeader)
  }

  const toggleMockHeader = (v: boolean) => {
    setWithMockHeader(v)
    syncConfig(profiles, activeIdx, v)
  }

  const addHeader = () => {
    const headers = { ...active.headers, "": "" }
    updateProfile(activeIdx, { headers })
  }

  const updateHeader = (oldKey: string, newKey: string, value: string) => {
    const headers = { ...active.headers }
    if (oldKey !== newKey) delete headers[oldKey]
    headers[newKey] = value
    updateProfile(activeIdx, { headers })
  }

  const removeHeader = (key: string) => {
    const headers = { ...active.headers }
    delete headers[key]
    updateProfile(activeIdx, { headers })
  }

  const formatBody = () => {
    try {
      const parsed = JSON.parse(active.body)
      updateProfile(activeIdx, { body: JSON.stringify(parsed, null, 2) })
    } catch {
      // Not valid JSON, leave as-is
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Profile tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b overflow-x-auto">
        <FlaskConical className="h-4 w-4 text-muted-foreground shrink-0" />
        {profiles.map((p, i) => (
          <button
            key={i}
            onClick={() => selectProfile(i)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              i === activeIdx
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {p.name}
          </button>
        ))}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={addProfile}
          disabled={readOnly}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <div className="flex-1" />
        <Badge variant="outline" className="text-[10px] shrink-0">
          Active: {active.name}
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Profile name */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label className="text-xs">Profile Name</Label>
              <Input
                value={active.name}
                onChange={(e) => updateProfile(activeIdx, { name: e.target.value })}
                className="h-8 text-xs mt-1"
                disabled={readOnly}
              />
            </div>
            {profiles.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive mt-5"
                onClick={() => removeProfile(activeIdx)}
                disabled={readOnly}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <Separator />

          {/* Status & Content-Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status Code</Label>
              <Select
                value={String(active.status)}
                onValueChange={(v) => updateProfile(activeIdx, { status: Number(v) })}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_CODES.map((s) => (
                    <SelectItem key={s.value} value={String(s.value)} className="text-xs">
                      <span className={s.color}>{s.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Content-Type</Label>
              <Select
                value={active.contentType}
                onValueChange={(v) => updateProfile(activeIdx, { contentType: v })}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((ct) => (
                    <SelectItem key={ct} value={ct} className="text-xs">
                      {ct}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Response body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Response Body</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] gap-1"
                onClick={formatBody}
                disabled={readOnly}
              >
                <FileJson className="h-3 w-3" />
                Format
              </Button>
            </div>
            <textarea
              value={active.body}
              onChange={(e) => updateProfile(activeIdx, { body: e.target.value })}
              className="w-full h-48 rounded-md border bg-muted/50 p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              spellCheck={false}
              disabled={readOnly}
            />
          </div>

          {/* Response headers */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Response Headers</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] gap-1"
                onClick={addHeader}
                disabled={readOnly}
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>
            {Object.entries(active.headers).length === 0 ? (
              <p className="text-[10px] text-muted-foreground">No custom headers</p>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(active.headers).map(([key, value], i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input
                      value={key}
                      placeholder="Header name"
                      onChange={(e) => updateHeader(key, e.target.value, value)}
                      className="h-7 text-xs flex-1"
                      disabled={readOnly}
                    />
                    <Input
                      value={value}
                      placeholder="Value"
                      onChange={(e) => updateHeader(key, key, e.target.value)}
                      className="h-7 text-xs flex-1"
                      disabled={readOnly}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => removeHeader(key)}
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

          {/* Delay */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Response Delay</Label>
              <span className="text-xs text-muted-foreground">{active.delay}ms</span>
            </div>
            <Slider
              value={[active.delay]}
              min={0}
              max={5000}
              step={100}
              onValueChange={([v]) => updateProfile(activeIdx, { delay: v })}
              disabled={readOnly}
            />
          </div>

          {/* Mock header toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Include Mock Header</Label>
              <p className="text-[10px] text-muted-foreground">
                Adds X-Mock-By header to identify mocked responses
              </p>
            </div>
            <Switch checked={withMockHeader} onCheckedChange={toggleMockHeader} disabled={readOnly} />
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
