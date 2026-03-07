"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Zap, Plus, Eye, Rocket, CloudOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { useEventApiStore } from "@/stores/event-api-store"

export default function EventApisPage() {
  const t = useTranslations("eventApis")
  const tc = useTranslations("common")
  const router = useRouter()
  const { eventApis, loading, fetchEventApis } = useEventApiStore()

  useEffect(() => {
    fetchEventApis()
  }, [fetchEventApis])

  const activeCount = eventApis.filter((ea) => ea.status === "active").length

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  function getProtocols(ea: (typeof eventApis)[0]) {
    const protos: string[] = []
    if (ea.rest_produce) protos.push("REST Produce")
    if (ea.rest_consume) protos.push("REST Consume")
    if (ea.sse_enabled) protos.push("SSE")
    if (ea.websocket_enabled) protos.push("WebSocket")
    if (ea.webhook_enabled) protos.push("Webhook")
    return protos
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={<Zap className="h-6 w-6" />}
        actions={
          <Button asChild>
            <Link href="/kafka/event-apis/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("createEventApi")}
            </Link>
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("totalEventApis")}</p>
                <p className="text-2xl font-bold mt-1">{eventApis.length}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                <Zap className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("activeEventApis")}</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <Rocket className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event APIs table */}
      {eventApis.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">
              {t("noEventApis")}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {t("noEventApisDescription")}
            </p>
            <Button asChild>
              <Link href="/kafka/event-apis/new">
                <Plus className="mr-2 h-4 w-4" />
                {t("createEventApi")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tc("name")}</TableHead>
                <TableHead>{t("topic")}</TableHead>
                <TableHead>{t("protocols")}</TableHead>
                <TableHead>{t("contextPath")}</TableHead>
                <TableHead className="w-[100px] text-center">{tc("status")}</TableHead>
                <TableHead className="w-[80px]">{tc("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventApis.map((ea) => (
                <TableRow key={ea.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{ea.name}</p>
                      <p className="text-xs text-muted-foreground">{ea.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs font-mono text-muted-foreground">
                      {ea.topic_name}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {getProtocols(ea).map((proto) => (
                        <Badge key={proto} variant="outline" className="text-xs">
                          {proto}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs font-mono text-muted-foreground">
                      {ea.context_path}/{ea.slug}
                    </code>
                  </TableCell>
                  <TableCell className="text-center">
                    {ea.status === "active" ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700">
                        <Rocket className="mr-1 h-3 w-3" />
                        {tc("active")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <CloudOff className="mr-1 h-3 w-3" />
                        Draft
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/kafka/event-apis/${ea.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {tc("view")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
