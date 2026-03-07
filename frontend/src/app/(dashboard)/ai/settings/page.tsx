"use client"

import { useEffect, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { SlidersHorizontal, Plus, Trash2, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { api } from "@/lib/api-client"
import type { CostModels, CostModelEntry } from "@/types/ai-metrics"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const DEFAULT_COST_MODELS: CostModels = {
  openai: {
    "gpt-4o": { prompt_per_1k: 0.0025, completion_per_1k: 0.01 },
    "gpt-4o-mini": { prompt_per_1k: 0.00015, completion_per_1k: 0.0006 },
    "gpt-4.1": { prompt_per_1k: 0.002, completion_per_1k: 0.008 },
    "o3-mini": { prompt_per_1k: 0.0011, completion_per_1k: 0.0044 },
  },
  anthropic: {
    "claude-sonnet-4-20250514": { prompt_per_1k: 0.003, completion_per_1k: 0.015 },
    "claude-haiku-4-5-20251001": { prompt_per_1k: 0.0008, completion_per_1k: 0.004 },
  },
  deepseek: {
    "deepseek-chat": { prompt_per_1k: 0.00014, completion_per_1k: 0.00028 },
    "deepseek-reasoner": { prompt_per_1k: 0.00055, completion_per_1k: 0.00219 },
  },
  google: {
    "gemini-2.5-pro": { prompt_per_1k: 0.00125, completion_per_1k: 0.01 },
    "gemini-2.5-flash": { prompt_per_1k: 0.00015, completion_per_1k: 0.0006 },
  },
}

interface CostModelRow {
  id: string
  provider: string
  model: string
  prompt_per_1k: number
  completion_per_1k: number
}

function costModelsToRows(models: CostModels): CostModelRow[] {
  const rows: CostModelRow[] = []
  for (const [provider, providerModels] of Object.entries(models)) {
    for (const [model, entry] of Object.entries(providerModels)) {
      rows.push({
        id: crypto.randomUUID(),
        provider,
        model,
        prompt_per_1k: entry.prompt_per_1k,
        completion_per_1k: entry.completion_per_1k,
      })
    }
  }
  return rows
}

function rowsToCostModels(rows: CostModelRow[]): CostModels {
  const models: CostModels = {}
  for (const row of rows) {
    const provider = row.provider.trim()
    const model = row.model.trim()
    if (!provider || !model) continue
    if (!models[provider]) {
      models[provider] = {}
    }
    models[provider][model] = {
      prompt_per_1k: row.prompt_per_1k,
      completion_per_1k: row.completion_per_1k,
    }
  }
  return models
}

export default function AICostSettingsPage() {
  const t = useTranslations("ai.settings")
  const tc = useTranslations("common")
  const [rows, setRows] = useState<CostModelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadCostModels = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getSetting("ai_cost_models")
      const models = data as CostModels | null
      if (models && typeof models === "object" && Object.keys(models).length > 0) {
        setRows(costModelsToRows(models))
      } else {
        setRows(costModelsToRows(DEFAULT_COST_MODELS))
      }
    } catch {
      // Setting not found or empty -- use defaults
      setRows(costModelsToRows(DEFAULT_COST_MODELS))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCostModels()
  }, [loadCostModels])

  const handleSave = async () => {
    try {
      setSaving(true)
      const costModels = rowsToCostModels(rows)
      await api.updateSetting("ai_cost_models", costModels)
      toast.success(t("savedSuccess"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("savedFailed"))
    } finally {
      setSaving(false)
    }
  }

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        provider: "",
        model: "",
        prompt_per_1k: 0,
        completion_per_1k: 0,
      },
    ])
  }

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const updateRow = (id: string, field: keyof Omit<CostModelRow, "id">, value: string | number) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={<SlidersHorizontal className="h-6 w-6" />}
        actions={
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {tc("save")}
          </Button>
        }
      />
      <Link
        href="/ai"
        className="text-sm text-primary hover:underline -mt-4"
      >
        {t("backToDashboard")}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{t("llmPricing")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">{t("providerColumn")}</TableHead>
                    <TableHead className="w-[250px]">{t("modelColumn")}</TableHead>
                    <TableHead className="w-[180px]">{t("promptCost")}</TableHead>
                    <TableHead className="w-[180px]">{t("completionCost")}</TableHead>
                    <TableHead className="w-[80px]">{tc("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        {t("noCostModels")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Input
                            value={row.provider}
                            onChange={(e) => updateRow(row.id, "provider", e.target.value)}
                            placeholder="e.g. openai"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.model}
                            onChange={(e) => updateRow(row.id, "model", e.target.value)}
                            placeholder="e.g. gpt-4o"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step={0.0001}
                            min={0}
                            value={row.prompt_per_1k}
                            onChange={(e) =>
                              updateRow(row.id, "prompt_per_1k", parseFloat(e.target.value) || 0)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step={0.0001}
                            min={0}
                            value={row.completion_per_1k}
                            onChange={(e) =>
                              updateRow(row.id, "completion_per_1k", parseFloat(e.target.value) || 0)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(row.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="mt-4">
                <Button variant="outline" onClick={addRow}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("addModel")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
