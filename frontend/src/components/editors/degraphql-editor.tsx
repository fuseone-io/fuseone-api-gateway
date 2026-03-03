"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Trash2, ArrowLeftRight, Copy, Wand2 } from "lucide-react"
import type { CustomEditorProps } from "../flow/plugin-config-panel"

interface VariableMapping {
  rest_param: string
  graphql_var: string
  type: string
}

const GRAPHQL_VAR_TYPES = ["String", "Int", "Float", "Boolean", "ID"] as const

const TEMPLATES = [
  {
    name: "Get by ID",
    query: `query($id: ID!) {
  resource(id: $id) {
    id
    name
    createdAt
  }
}`,
    variables: [{ rest_param: "id", graphql_var: "id", type: "ID" }],
  },
  {
    name: "List with Filter",
    query: `query($filter: String, $limit: Int) {
  resources(filter: $filter, first: $limit) {
    edges {
      node {
        id
        name
      }
    }
    pageInfo {
      hasNextPage
    }
  }
}`,
    variables: [
      { rest_param: "filter", graphql_var: "filter", type: "String" },
      { rest_param: "limit", graphql_var: "limit", type: "Int" },
    ],
  },
  {
    name: "Create Mutation",
    query: `mutation($input: CreateResourceInput!) {
  createResource(input: $input) {
    id
    name
    createdAt
  }
}`,
    variables: [{ rest_param: "input", graphql_var: "input", type: "String" }],
  },
  {
    name: "Search",
    query: `query($query: String!, $first: Int) {
  search(query: $query, first: $first) {
    id
    name
    score
  }
}`,
    variables: [
      { rest_param: "q", graphql_var: "query", type: "String" },
      { rest_param: "limit", graphql_var: "first", type: "Int" },
    ],
  },
]

function extractConfig(config: Record<string, unknown>) {
  return {
    query: (config.query as string) || "",
    variables: (config.variables as string[]) || [],
    variable_mappings: (config._variable_mappings as VariableMapping[]) || [],
  }
}

export default function DeGraphQLEditor({ config, onChange, readOnly }: CustomEditorProps) {
  const [query, setQuery] = useState(() => extractConfig(config).query)
  const [mappings, setMappings] = useState<VariableMapping[]>(
    () => extractConfig(config).variable_mappings
  )

  const syncConfig = useCallback(
    (newQuery: string, newMappings: VariableMapping[]) => {
      const variables = newMappings
        .map((m) => m.rest_param)
        .filter(Boolean)
      onChange({
        query: newQuery,
        variables,
        _variable_mappings: newMappings,
      })
    },
    [onChange]
  )

  const updateQuery = (val: string) => {
    setQuery(val)
    syncConfig(val, mappings)
  }

  const addMapping = () => {
    const next = [...mappings, { rest_param: "", graphql_var: "", type: "String" }]
    setMappings(next)
    syncConfig(query, next)
  }

  const removeMapping = (idx: number) => {
    const next = mappings.filter((_, i) => i !== idx)
    setMappings(next)
    syncConfig(query, next)
  }

  const updateMapping = (idx: number, field: keyof VariableMapping, value: string) => {
    const next = mappings.map((m, i) => (i === idx ? { ...m, [field]: value } : m))
    setMappings(next)
    syncConfig(query, next)
  }

  const applyTemplate = (tpl: (typeof TEMPLATES)[number]) => {
    setQuery(tpl.query)
    setMappings(tpl.variables)
    syncConfig(tpl.query, tpl.variables)
  }

  const autoDetectVars = () => {
    // Detect $varName patterns from the query
    const matches = query.match(/\$(\w+)/g)
    if (!matches) return
    const vars = [...new Set(matches.map((m) => m.slice(1)))]
    const existingMap = new Map(mappings.map((m) => [m.graphql_var, m]))
    const newMappings = vars.map((v) => existingMap.get(v) || { rest_param: v, graphql_var: v, type: "String" })
    setMappings(newMappings)
    syncConfig(query, newMappings)
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-pink-500" />
          <span className="text-sm font-semibold">REST-to-GraphQL Converter</span>
          <Badge variant="secondary" className="text-[9px]">degraphql</Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          Define a GraphQL query template que sera enviada ao upstream quando esta rota receber uma requisicao REST.
          Variaveis no query ($var) sao preenchidas com parametros REST (path, query string, body).
        </p>

        {/* Templates */}
        {!readOnly && (
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Templates
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.name}
                  onClick={() => applyTemplate(tpl)}
                  className="px-2 py-1 rounded-md text-[11px] font-medium border bg-muted/50 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                >
                  <Copy className="h-3 w-3 inline mr-1" />
                  {tpl.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* GraphQL Query */}
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            GraphQL Query
          </Label>
          <textarea
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            disabled={readOnly}
            placeholder={`query($id: ID!) {\n  user(id: $id) {\n    id\n    name\n    email\n  }\n}`}
            className="w-full min-h-[200px] rounded-md border bg-muted/30 px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            spellCheck={false}
          />
        </div>

        <Separator />

        {/* Variable Mappings */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Variable Mappings
            </Label>
            <div className="flex gap-1.5">
              {!readOnly && query && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={autoDetectVars}>
                  <Wand2 className="h-3 w-3 mr-1" />
                  Auto-detect
                </Button>
              )}
              {!readOnly && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={addMapping}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              )}
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Mapeia parametros REST (path params, query string) para variaveis GraphQL.
          </p>

          {mappings.length === 0 ? (
            <div className="text-center py-4 text-xs text-muted-foreground border border-dashed rounded-md">
              Sem mapeamentos de variaveis. Clique &quot;Auto-detect&quot; para extrair do query ou adicione manualmente.
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 px-1">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">REST Param</span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">GraphQL Var</span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Type</span>
                <span />
              </div>
              {mappings.map((m, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 items-center">
                  <Input
                    value={m.rest_param}
                    onChange={(e) => updateMapping(idx, "rest_param", e.target.value)}
                    disabled={readOnly}
                    placeholder="id"
                    className="h-7 text-xs font-mono"
                  />
                  <Input
                    value={m.graphql_var}
                    onChange={(e) => updateMapping(idx, "graphql_var", e.target.value)}
                    disabled={readOnly}
                    placeholder="id"
                    className="h-7 text-xs font-mono"
                  />
                  <select
                    value={m.type}
                    onChange={(e) => updateMapping(idx, "type", e.target.value)}
                    disabled={readOnly}
                    className="h-7 rounded-md border bg-transparent px-1.5 text-xs"
                  >
                    {GRAPHQL_VAR_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive/60 hover:text-destructive"
                      onClick={() => removeMapping(idx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  )
}
