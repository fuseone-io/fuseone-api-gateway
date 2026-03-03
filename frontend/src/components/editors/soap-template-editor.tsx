"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { FileCode, Download, ArrowRight, Upload, ChevronRight, FileJson } from "lucide-react"
import { SOAP_TEMPLATES, type SoapTemplate } from "@/lib/soap-templates"
import { parseWsdl, type WsdlParseResult } from "@/lib/wsdl-parser"
import type { CustomEditorProps } from "../flow/plugin-config-panel"

const INPUT_FORMATS = [
  { value: "json", label: "JSON" },
  { value: "xml", label: "XML" },
  { value: "", label: "Auto-detect" },
]

export default function SoapTemplateEditor({ config, onChange, readOnly }: CustomEditorProps) {
  const [activeTab, setActiveTab] = useState<"templates" | "editor">("editor")
  const [wsdlDialogOpen, setWsdlDialogOpen] = useState(false)
  const [wsdlInput, setWsdlInput] = useState("")
  const [wsdlResult, setWsdlResult] = useState<WsdlParseResult | null>(null)
  const [sampleInput, setSampleInput] = useState('{\n  "name": "John",\n  "email": "john@example.com"\n}')

  const requestTemplate = (config.request as string) || ""
  const responseTemplate = (config.response as string) || ""
  const inputFormat = (config.input_format as string) || ""

  const updateConfig = useCallback(
    (updates: Partial<Record<string, unknown>>) => {
      onChange({ ...config, ...updates })
    },
    [config, onChange]
  )

  const applyTemplate = (template: SoapTemplate) => {
    updateConfig({
      request: template.requestTemplate,
      response: template.responseTemplate,
      input_format: "json",
    })
    setSampleInput(template.sampleInput)
    setActiveTab("editor")
  }

  const handleWsdlImport = () => {
    const result = parseWsdl(wsdlInput)
    setWsdlResult(result)
    if (result && result.operations.length > 0) {
      const op = result.operations[0]
      updateConfig({
        request: op.requestTemplate,
        response: op.responseTemplate,
        input_format: "json",
      })
      setActiveTab("editor")
      setWsdlDialogOpen(false)
    }
  }

  const selectWsdlOperation = (op: { requestTemplate: string; responseTemplate: string }) => {
    updateConfig({
      request: op.requestTemplate,
      response: op.responseTemplate,
      input_format: "json",
    })
    setActiveTab("editor")
    setWsdlDialogOpen(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <FileCode className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium">Body Transformer</span>
        <div className="flex-1" />
        <Select
          value={inputFormat}
          onValueChange={(v) => updateConfig({ input_format: v })}
          disabled={readOnly}
        >
          <SelectTrigger className="h-7 w-[120px] text-xs">
            <SelectValue placeholder="Auto-detect" />
          </SelectTrigger>
          <SelectContent>
            {INPUT_FORMATS.map((f) => (
              <SelectItem key={f.value} value={f.value} className="text-xs">
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={wsdlDialogOpen} onOpenChange={setWsdlDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={readOnly}>
              <Upload className="h-3.5 w-3.5" />
              WSDL
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Import from WSDL</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Textarea
                value={wsdlInput}
                onChange={(e) => setWsdlInput(e.target.value)}
                placeholder="Paste WSDL XML here..."
                rows={12}
                className="font-mono text-xs"
              />
              <Button onClick={handleWsdlImport} className="w-full" disabled={!wsdlInput.trim()}>
                Parse WSDL
              </Button>
              {wsdlResult && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Service: {wsdlResult.serviceName} ({wsdlResult.operations.length} operations)
                  </p>
                  <div className="space-y-1">
                    {wsdlResult.operations.map((op, i) => (
                      <button
                        key={i}
                        className="w-full text-left p-2 rounded-md hover:bg-accent text-sm flex items-center gap-2"
                        onClick={() => selectWsdlOperation(op)}
                      >
                        <Badge variant="outline" className="text-[10px]">
                          {op.name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {op.inputMessage} → {op.outputMessage}
                        </span>
                        <ChevronRight className="h-3 w-3 ml-auto" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {wsdlResult === null && wsdlInput.trim() && (
                <p className="text-xs text-destructive">Failed to parse WSDL. Check the XML format.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "templates" | "editor")} className="flex flex-col flex-1 min-h-0">
        <TabsList className="mx-3 mt-2 shrink-0">
          <TabsTrigger value="templates" className="text-xs">Templates</TabsTrigger>
          <TabsTrigger value="editor" className="text-xs">Editor</TabsTrigger>
        </TabsList>

        {/* Template gallery */}
        <TabsContent value="templates" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {SOAP_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  className="w-full text-left rounded-lg border p-3 hover:bg-accent/50 transition-colors group"
                  onClick={() => applyTemplate(t)}
                  disabled={readOnly}
                >
                  <div className="flex items-center gap-2">
                    <FileJson className="h-4 w-4 text-purple-500 shrink-0" />
                    <span className="text-xs font-medium">{t.name}</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100" />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{t.description}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Template editor */}
        <TabsContent value="editor" className="flex-1 min-h-0 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">
              {/* Request template */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600">
                    Request
                  </Badge>
                  <Label className="text-xs">JSON → XML Template</Label>
                </div>
                <textarea
                  value={requestTemplate}
                  onChange={(e) => updateConfig({ request: e.target.value })}
                  className="w-full h-44 rounded-md border bg-muted/50 p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  spellCheck={false}
                  disabled={readOnly}
                  placeholder="Enter Lua template for request transformation..."
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Use {"{{_body.field}}"} for field values, {"{%"} for Lua logic
                </p>
              </div>

              <div className="flex items-center justify-center">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Response template */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                    Response
                  </Badge>
                  <Label className="text-xs">XML → JSON Template</Label>
                </div>
                <textarea
                  value={responseTemplate}
                  onChange={(e) => updateConfig({ response: e.target.value })}
                  className="w-full h-44 rounded-md border bg-muted/50 p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  spellCheck={false}
                  disabled={readOnly}
                  placeholder="Enter Lua template for response transformation..."
                />
              </div>

              <Separator />

              {/* Live preview */}
              <div>
                <Label className="text-xs mb-2 block">Preview</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Sample JSON Input</p>
                    <textarea
                      value={sampleInput}
                      onChange={(e) => setSampleInput(e.target.value)}
                      className="w-full h-24 rounded-md border bg-muted/50 p-2 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      spellCheck={false}
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Rendered XML (approximate)</p>
                    <div className="w-full h-24 rounded-md border bg-muted/30 p-2 font-mono text-[11px] overflow-auto text-muted-foreground">
                      {renderPreview(requestTemplate, sampleInput)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * Simple preview renderer — replaces {{_body.field}} patterns with values from sample JSON.
 * This is a rough approximation; the actual transformation happens server-side in Lua.
 */
function renderPreview(template: string, sampleJson: string): string {
  if (!template) return "(no template)"
  try {
    const data = JSON.parse(sampleJson)
    let result = template
    // Replace {* _body.field *} patterns
    result = result.replace(/\{\*\s*_body\.(\w+)\s*\*\}/g, (_, field) => {
      return data[field] != null ? String(data[field]) : ""
    })
    // Replace {* _body *} with full JSON
    result = result.replace(/\{\*\s*_body\s*\*\}/g, sampleJson)
    // Strip Lua logic blocks for preview
    result = result.replace(/\{%[\s\S]*?%\}/g, "")
    return result.trim() || "(empty result)"
  } catch {
    return "(invalid sample JSON)"
  }
}
