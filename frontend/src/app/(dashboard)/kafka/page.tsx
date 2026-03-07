"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Radio, Eye, Plus, Plug, PlugZap } from "lucide-react"
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
import { useKafkaStore } from "@/stores/kafka-store"

export default function KafkaPage() {
  const t = useTranslations("kafka")
  const tc = useTranslations("common")
  const router = useRouter()
  const { connections, loadingConnections, fetchConnections } = useKafkaStore()

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  const activeCount = connections.filter((c) => c.is_active).length

  if (loadingConnections) {
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={<Radio className="h-6 w-6" />}
        actions={
          <Button asChild>
            <Link href="/kafka/connections">
              <Plus className="mr-2 h-4 w-4" />
              {t("manageConnections")}
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
                <p className="text-xs font-medium text-muted-foreground">{t("totalConnections")}</p>
                <p className="text-2xl font-bold mt-1">{connections.length}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                <Plug className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("activeConnections")}</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <PlugZap className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connections table */}
      {connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Radio className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">
              {t("noConnections")}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {t("noConnectionsDescription")}
            </p>
            <Button asChild>
              <Link href="/kafka/connections">
                <Plus className="mr-2 h-4 w-4" />
                {t("createConnection")}
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
                <TableHead>{t("brokers")}</TableHead>
                <TableHead>{t("protocol")}</TableHead>
                <TableHead className="w-[100px] text-center">{tc("status")}</TableHead>
                <TableHead className="w-[80px]">{tc("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.map((conn) => (
                <TableRow key={conn.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{conn.name}</p>
                      {conn.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {conn.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs font-mono text-muted-foreground">
                      {conn.brokers.join(", ")}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {conn.security_protocol}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {conn.is_active ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700">{tc("active")}</Badge>
                    ) : (
                      <Badge variant="secondary">{tc("disabled")}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/kafka/${conn.id}/topics`)}
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
