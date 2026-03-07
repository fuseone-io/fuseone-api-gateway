"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import Link from "next/link"
import {
  PenTool,
  FlaskConical,
  CheckCircle2,
  Rocket,
  Plus,
  Upload,
  ArrowRight,
  ExternalLink,
  MoreHorizontal,
  ScrollText,
  Network,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { api } from "@/lib/api-client"
import type { ApiDefRecord } from "@/types/api"
import { hasContract } from "@/lib/contract-utils"

// --- Workflow step visual ---

const WORKFLOW_STEPS = [
  {
    step: 1,
    labelKey: "workflowDesign",
    descriptionKey: "workflowDesignDesc",
    icon: PenTool,
    color: "text-blue-600 bg-blue-100 dark:bg-blue-950",
  },
  {
    step: 2,
    labelKey: "workflowMock",
    descriptionKey: "workflowMockDesc",
    icon: FlaskConical,
    color: "text-purple-600 bg-purple-100 dark:bg-purple-950",
  },
  {
    step: 3,
    labelKey: "workflowImplement",
    descriptionKey: "workflowImplementDesc",
    icon: Rocket,
    color: "text-amber-600 bg-amber-100 dark:bg-amber-950",
  },
  {
    step: 4,
    labelKey: "workflowVerify",
    descriptionKey: "workflowVerifyDesc",
    icon: CheckCircle2,
    color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950",
  },
]

function getDesignStage(record: ApiDefRecord): { step: number; labelKey: string; color: string } {
  const def = record.definition
  const hasMocking = def.flows.some((f) => f.policies.some((p) => p.name === "mocking" && p.enabled))
  const hasContractDef = def.flows.some((f) => hasContract(f.contract))
  const isDeployed = record.sync_status === "synced"

  if (isDeployed && !hasMocking) return { step: 4, labelKey: "stageLive", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" }
  if (hasMocking) return { step: 2, labelKey: "stageMocked", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" }
  if (hasContractDef) return { step: 1, labelKey: "stageDesigning", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" }
  return { step: 0, labelKey: "stageDraft", color: "bg-muted text-muted-foreground" }
}

export default function DesignStudioPage() {
  const router = useRouter()
  const t = useTranslations("design")
  const tc = useTranslations("common")
  const [apis, setApis] = useState<ApiDefRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .listApis({ lifecycle_status: "draft" })
      .then((data) => {
        if (Array.isArray(data)) {
          setApis(data as ApiDefRecord[])
        } else if (data && typeof data === "object" && "items" in data) {
          setApis((data as { items: ApiDefRecord[] }).items || [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Stats
  const designingCount = apis.filter((a) => a.definition.flows.some((f) => hasContract(f.contract))).length
  const mockedCount = apis.filter((a) => a.definition.flows.some((f) => f.policies.some((p) => p.name === "mocking" && p.enabled))).length
  const totalContracts = apis.reduce(
    (sum, a) => sum + a.definition.flows.filter((f) => hasContract(f.contract)).length,
    0
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={<PenTool className="h-6 w-6" />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => router.push("/design/mindmap")}
            >
              <Network className="h-3.5 w-3.5" />
              {t("apiMindmap")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => router.push("/apis/new?mode=import")}
            >
              <Upload className="h-3.5 w-3.5" />
              {t("importOpenApi")}
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => router.push("/apis/new?mode=design")}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("newApiDesign")}
            </Button>
          </div>
        }
      />

      {/* Workflow Steps */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t("designFirstWorkflow")}</CardTitle>
          <CardDescription className="text-xs">
            {t("designFirstWorkflowDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {WORKFLOW_STEPS.map((ws, idx) => (
              <div key={ws.step} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 flex-1 ${ws.color}`}>
                  <div className="flex items-center justify-center h-7 w-7 rounded-full bg-background/80 shrink-0">
                    <ws.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">{t(ws.labelKey)}</p>
                    <p className="text-[10px] opacity-80 truncate">{t(ws.descriptionKey)}</p>
                  </div>
                </div>
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{apis.length}</p>
                <p className="text-xs text-muted-foreground">{t("apisInDraft")}</p>
              </div>
              <PenTool className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{designingCount}</p>
                <p className="text-xs text-muted-foreground">{t("withContracts")}</p>
              </div>
              <ScrollText className="h-8 w-8 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{mockedCount}</p>
                <p className="text-xs text-muted-foreground">{t("mockActive")}</p>
              </div>
              <FlaskConical className="h-8 w-8 text-purple-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{totalContracts}</p>
                <p className="text-xs text-muted-foreground">{t("totalContracts")}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* APIs Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t("apisInDesign")}</CardTitle>
          <CardDescription className="text-xs">
            {t("apisInDesignDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : apis.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <PenTool className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">{t("noApisInDesign")}</p>
              <p className="text-xs mt-1">{t("noApisInDesignDesc")}</p>
              <Button
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() => router.push("/apis/new?mode=design")}
              >
                <Plus className="h-3.5 w-3.5" />
                {t("newApiDesign")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{tc("name")}</TableHead>
                  <TableHead className="text-xs w-20">{t("flows")}</TableHead>
                  <TableHead className="text-xs w-24">{t("contracts")}</TableHead>
                  <TableHead className="text-xs w-24">{t("stage")}</TableHead>
                  <TableHead className="text-xs w-36">{t("updated")}</TableHead>
                  <TableHead className="text-xs w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {apis.map((record) => {
                  const stage = getDesignStage(record)
                  const contractCount = record.definition.flows.filter((f) => hasContract(f.contract)).length
                  return (
                    <TableRow key={record.id}>
                      <TableCell>
                        <Link
                          href={`/apis/${record.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {record.name}
                        </Link>
                        {record.description && (
                          <p className="text-[10px] text-muted-foreground truncate max-w-[300px]">
                            {record.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{record.definition.flows.length}</TableCell>
                      <TableCell>
                        {contractCount > 0 ? (
                          <Badge variant="outline" className="text-[10px] border-blue-400/50 text-blue-600">
                            {contractCount}/{record.definition.flows.length}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${stage.color}`}>{t(stage.labelKey)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(record.updated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/apis/${record.id}`)}>
                              <ExternalLink className="h-3.5 w-3.5 mr-2" />
                              {t("editDesign")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
