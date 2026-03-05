"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  FlaskConical,
  ListChecks,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react"
import SchemaEditor from "@/components/editors/schema-editor"
import type { ApiFlow, FlowContract, ContractParameter, JsonSchemaDefinition } from "@/types/api"
import {
  contractToMockConfig,
  contractToRequestValidation,
} from "@/lib/contract-utils"

// --- Status code options ---

const STATUS_CODE_OPTIONS = [
  { value: "200", label: "200 OK" },
  { value: "201", label: "201 Created" },
  { value: "204", label: "204 No Content" },
  { value: "400", label: "400 Bad Request" },
  { value: "401", label: "401 Unauthorized" },
  { value: "403", label: "403 Forbidden" },
  { value: "404", label: "404 Not Found" },
  { value: "409", label: "409 Conflict" },
  { value: "422", label: "422 Unprocessable" },
  { value: "500", label: "500 Internal Error" },
]

const PARAM_LOCATIONS = [
  { value: "query", label: "Query" },
  { value: "path", label: "Path" },
  { value: "header", label: "Header" },
  { value: "cookie", label: "Cookie" },
] as const

// --- Props ---

interface ContractPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  flow: ApiFlow
  onContractChange: (contract: FlowContract) => void
  onGenerateMock: (mockConfig: Record<string, unknown>) => void
  onGenerateValidation: (validationConfig: Record<string, unknown>) => void
  readOnly?: boolean
}

export function ContractPanel({
  open,
  onOpenChange,
  flow,
  onContractChange,
  onGenerateMock,
  onGenerateValidation,
  readOnly,
}: ContractPanelProps) {
  const contract: FlowContract = flow.contract || {}
  const [addStatusCode, setAddStatusCode] = useState("200")

  const update = useCallback(
    (patch: Partial<FlowContract>) => {
      onContractChange({ ...contract, ...patch })
    },
    [contract, onContractChange]
  )

  // --- Request ---

  const handleRequestSchemaChange = (schema: JsonSchemaDefinition) => {
    update({ request_schema: schema })
  }

  const handleRequestExampleChange = (example: unknown) => {
    update({ request_example: example })
  }

  // --- Responses ---

  const addResponse = (code: string) => {
    const responses = { ...(contract.response_schemas || {}) }
    if (responses[code]) return
    responses[code] = {
      schema: { type: "object", properties: {} },
      description: STATUS_CODE_OPTIONS.find((s) => s.value === code)?.label.split(" ").slice(1).join(" ") || "",
    }
    update({ response_schemas: responses })
  }

  const updateResponse = (code: string, patch: { schema?: JsonSchemaDefinition; example?: unknown; description?: string }) => {
    const responses = { ...(contract.response_schemas || {}) }
    responses[code] = { ...responses[code], ...patch }
    update({ response_schemas: responses })
  }

  const removeResponse = (code: string) => {
    const responses = { ...(contract.response_schemas || {}) }
    delete responses[code]
    update({ response_schemas: Object.keys(responses).length > 0 ? responses : undefined })
  }

  // --- Parameters ---

  const params = contract.parameters || []

  const addParameter = () => {
    // Auto-detect path params from URI
    const uriParams = (flow.entrypoint.uri.match(/\/:([^/]+)/g) || []).map((p) => p.slice(2))
    const existingNames = params.map((p) => p.name)
    const missingPathParams = uriParams.filter((p) => !existingNames.includes(p))

    if (missingPathParams.length > 0) {
      const newParams: ContractParameter[] = missingPathParams.map((name) => ({
        name,
        in: "path",
        required: true,
        schema: { type: "string" },
      }))
      update({ parameters: [...params, ...newParams] })
    } else {
      update({
        parameters: [
          ...params,
          { name: "", in: "query", required: false, schema: { type: "string" } },
        ],
      })
    }
  }

  const updateParameter = (idx: number, patch: Partial<ContractParameter>) => {
    const newParams = params.map((p, i) => (i === idx ? { ...p, ...patch } : p))
    update({ parameters: newParams })
  }

  const removeParameter = (idx: number) => {
    const newParams = params.filter((_, i) => i !== idx)
    update({ parameters: newParams.length > 0 ? newParams : undefined })
  }

  // --- Actions ---

  const handleGenerateMock = () => {
    const config = contractToMockConfig(contract)
    onGenerateMock(config)
  }

  const handleGenerateValidation = () => {
    const config = contractToRequestValidation(contract)
    if (config) onGenerateValidation(config)
  }

  const responseCount = contract.response_schemas ? Object.keys(contract.response_schemas).length : 0
  const paramCount = params.length
  const hasRequestSchema = !!contract.request_schema

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[50vw] max-w-[700px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            <SheetTitle className="text-sm">API Contract</SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            {flow.name} &mdash; {flow.entrypoint.methods.join(", ") || "ANY"} {flow.entrypoint.uri || "/"}
          </SheetDescription>
          <div className="flex items-center gap-1.5 pt-1">
            {hasRequestSchema && <Badge variant="outline" className="text-[10px]">Request Schema</Badge>}
            {responseCount > 0 && <Badge variant="outline" className="text-[10px]">{responseCount} Response{responseCount !== 1 ? "s" : ""}</Badge>}
            {paramCount > 0 && <Badge variant="outline" className="text-[10px]">{paramCount} Param{paramCount !== 1 ? "s" : ""}</Badge>}
          </div>
        </SheetHeader>

        <Tabs defaultValue="request" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-2 shrink-0">
            <TabsTrigger value="request" className="text-xs gap-1">
              <ArrowUpFromLine className="h-3 w-3" />
              Request
            </TabsTrigger>
            <TabsTrigger value="response" className="text-xs gap-1">
              <ArrowDownToLine className="h-3 w-3" />
              Response
              {responseCount > 0 && (
                <Badge variant="secondary" className="text-[9px] ml-1 h-4 px-1">{responseCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="parameters" className="text-xs gap-1">
              <Settings2 className="h-3 w-3" />
              Parameters
              {paramCount > 0 && (
                <Badge variant="secondary" className="text-[9px] ml-1 h-4 px-1">{paramCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Request Tab */}
          <TabsContent value="request" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                <Label className="text-xs font-medium">Request Body Schema</Label>
                <SchemaEditor
                  schema={contract.request_schema}
                  onChange={handleRequestSchemaChange}
                  example={contract.request_example}
                  onExampleChange={handleRequestExampleChange}
                  readOnly={readOnly}
                />
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Response Tab */}
          <TabsContent value="response" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {/* Add response */}
                {!readOnly && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={addStatusCode}
                      onValueChange={setAddStatusCode}
                    >
                      <SelectTrigger className="h-7 text-xs w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_CODE_OPTIONS.filter(
                          (s) => !contract.response_schemas?.[s.value]
                        ).map((s) => (
                          <SelectItem key={s.value} value={s.value} className="text-xs">
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => addResponse(addStatusCode)}
                    >
                      <Plus className="h-3 w-3" />
                      Add Response
                    </Button>
                  </div>
                )}

                {/* Response schemas */}
                {contract.response_schemas &&
                  Object.entries(contract.response_schemas)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([code, resp]) => {
                      const codeNum = Number(code)
                      const colorClass =
                        codeNum < 300
                          ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20"
                          : codeNum < 400
                            ? "border-blue-300 bg-blue-50/50 dark:bg-blue-950/20"
                            : codeNum < 500
                              ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
                              : "border-red-300 bg-red-50/50 dark:bg-red-950/20"

                      return (
                        <div key={code} className={`border rounded-lg p-3 space-y-3 ${colorClass}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={`text-xs font-mono ${
                                  codeNum < 300
                                    ? "text-emerald-700"
                                    : codeNum < 400
                                      ? "text-blue-700"
                                      : codeNum < 500
                                        ? "text-amber-700"
                                        : "text-red-700"
                                }`}
                              >
                                {code}
                              </Badge>
                              <Input
                                value={resp.description || ""}
                                onChange={(e) => updateResponse(code, { description: e.target.value })}
                                placeholder="Description"
                                className="h-7 text-xs w-48 bg-background"
                                disabled={readOnly}
                              />
                            </div>
                            {!readOnly && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive/70"
                                onClick={() => removeResponse(code)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <SchemaEditor
                            schema={resp.schema}
                            onChange={(s) => updateResponse(code, { schema: s })}
                            example={resp.example}
                            onExampleChange={(ex) => updateResponse(code, { example: ex })}
                            readOnly={readOnly}
                          />
                        </div>
                      )
                    })}

                {responseCount === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <ArrowDownToLine className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No response schemas defined</p>
                    <p className="text-[10px]">Add a response to define the API contract</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Parameters Tab */}
          <TabsContent value="parameters" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                {params.length > 0 && (
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 text-muted-foreground">
                          <th className="text-left px-2 py-1.5 font-medium">Name</th>
                          <th className="text-left px-2 py-1.5 font-medium w-20">In</th>
                          <th className="text-left px-2 py-1.5 font-medium w-20">Type</th>
                          <th className="text-center px-2 py-1.5 font-medium w-12">Req</th>
                          <th className="text-left px-2 py-1.5 font-medium">Description</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {params.map((param, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-2 py-1">
                              <Input
                                value={param.name}
                                onChange={(e) => updateParameter(idx, { name: e.target.value })}
                                className="h-7 text-xs font-mono"
                                placeholder="param_name"
                                disabled={readOnly}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <Select
                                value={param.in}
                                onValueChange={(v) => updateParameter(idx, { in: v as ContractParameter["in"] })}
                                disabled={readOnly}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PARAM_LOCATIONS.map((l) => (
                                    <SelectItem key={l.value} value={l.value} className="text-xs">{l.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-2 py-1">
                              <Select
                                value={param.schema?.type || "string"}
                                onValueChange={(v) =>
                                  updateParameter(idx, { schema: { ...param.schema, type: v as JsonSchemaDefinition["type"] } })
                                }
                                disabled={readOnly}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="string" className="text-xs">String</SelectItem>
                                  <SelectItem value="integer" className="text-xs">Integer</SelectItem>
                                  <SelectItem value="number" className="text-xs">Number</SelectItem>
                                  <SelectItem value="boolean" className="text-xs">Boolean</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-2 py-1 text-center">
                              <Checkbox
                                checked={param.required}
                                onCheckedChange={(v) => updateParameter(idx, { required: !!v })}
                                disabled={readOnly}
                                className="h-3.5 w-3.5"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <Input
                                value={param.description || ""}
                                onChange={(e) => updateParameter(idx, { description: e.target.value || undefined })}
                                className="h-7 text-xs"
                                placeholder="Description"
                                disabled={readOnly}
                              />
                            </td>
                            <td className="px-1 py-1">
                              {!readOnly && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive/70"
                                  onClick={() => removeParameter(idx)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {!readOnly && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 w-full border-dashed"
                    onClick={addParameter}
                  >
                    <Plus className="h-3 w-3" />
                    {params.length === 0 ? "Add Parameter (auto-detects path params)" : "Add Parameter"}
                  </Button>
                )}

                {params.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No parameters defined</p>
                    <p className="text-[10px]">Add query, path, header, or cookie parameters</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Footer actions */}
        {!readOnly && (
          <div className="border-t px-4 py-3 flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={handleGenerateMock}
              disabled={responseCount === 0}
            >
              <FlaskConical className="h-3.5 w-3.5" />
              Generate Mock
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={handleGenerateValidation}
              disabled={!hasRequestSchema}
            >
              <ListChecks className="h-3.5 w-3.5" />
              Generate Validation
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
