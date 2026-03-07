"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import {
  Download,
  FileBarChart,
  FileSpreadsheet,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { MetricsDateRange } from "@/components/metrics-date-range"
import { PageHeader } from "@/components/page-header"
import { api } from "@/lib/api-client"
import { dateRangeToParams } from "@/lib/metrics-utils"
import type { DateRangeValue } from "@/types/metrics"
import { toast } from "sonner"

type ReportType = "usage" | "consumers" | "timeseries"

const REPORT_TYPES: { value: ReportType; labelKey: string; descriptionKey: string; icon: typeof FileBarChart }[] = [
  { value: "usage", labelKey: "usageReport", descriptionKey: "usageReportDesc", icon: FileBarChart },
  { value: "consumers", labelKey: "consumerReport", descriptionKey: "consumerReportDesc", icon: Users },
  { value: "timeseries", labelKey: "timeSeriesExport", descriptionKey: "timeSeriesExportDesc", icon: FileSpreadsheet },
]

export default function ReportsPage() {
  const t = useTranslations("reports")
  const tc = useTranslations("common")
  const [dateRange, setDateRange] = useState<DateRangeValue>({ type: "preset", preset: "24h" })
  const [reportType, setReportType] = useState<ReportType>("usage")
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const params = dateRangeToParams(dateRange)
      switch (reportType) {
        case "usage":
          await api.reportUsageCSV(params)
          break
        case "consumers":
          await api.reportConsumerCSV(params)
          break
        case "timeseries":
          await api.reportTimeSeriesCSV(params)
          break
      }
      toast.success(t("reportDownloaded"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedToDownload"))
    } finally {
      setDownloading(false)
    }
  }

  const selectedReport = REPORT_TYPES.find((r) => r.value === reportType)!

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={<FileBarChart className="h-6 w-6" />}
      />

      <div className="grid gap-6 max-w-2xl">
        {/* Report Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>{t("generateReport")}</CardTitle>
            <CardDescription>
              {t("generateReportDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Report Type */}
            <div className="space-y-2">
              <Label>{t("reportType")}</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>
                      <div className="flex items-center gap-2">
                        <rt.icon className="h-4 w-4 text-muted-foreground" />
                        <span>{t(rt.labelKey)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t(selectedReport.descriptionKey)}</p>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label>{t("timeRange")}</Label>
              <MetricsDateRange value={dateRange} onChange={setDateRange} />
            </div>

            {/* Download */}
            <Button onClick={handleDownload} disabled={downloading} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              {downloading ? t("generating") : t("downloadCsv")}
            </Button>
          </CardContent>
        </Card>

        {/* Report Types Overview */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {REPORT_TYPES.map((rt) => (
            <Card
              key={rt.value}
              className={`cursor-pointer transition-colors ${reportType === rt.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
              onClick={() => setReportType(rt.value)}
            >
              <CardContent className="p-4 text-center">
                <rt.icon className={`h-8 w-8 mx-auto mb-2 ${reportType === rt.value ? "text-primary" : "text-muted-foreground"}`} />
                <p className="text-sm font-medium">{t(rt.labelKey)}</p>
                <p className="text-xs text-muted-foreground mt-1">{t(rt.descriptionKey)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
