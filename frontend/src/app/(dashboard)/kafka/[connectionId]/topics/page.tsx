"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { ArrowLeft, Inbox, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

export default function KafkaTopicsPage() {
  const t = useTranslations("kafka")
  const tc = useTranslations("common")
  const { connectionId } = useParams<{ connectionId: string }>()
  const { connections, topics, loadingTopics, fetchConnections, fetchTopics } = useKafkaStore()
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (connections.length === 0) {
      fetchConnections()
    }
  }, [connections.length, fetchConnections])

  useEffect(() => {
    if (connectionId) {
      fetchTopics(connectionId)
    }
  }, [connectionId, fetchTopics])

  const connection = connections.find((c) => c.id === connectionId)
  const connectionName = connection?.name || connectionId

  const filteredTopics = useMemo(() => {
    if (!search.trim()) return topics
    const q = search.toLowerCase()
    return topics.filter((t) => t.toLowerCase().includes(q))
  }, [topics, search])

  if (loadingTopics) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-full max-w-md" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("topics.title", { connection: connectionName })}
        description={t("topics.description")}
        actions={
          <Button variant="outline" asChild>
            <Link href="/kafka">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {tc("back")}
            </Link>
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("topics.filterPlaceholder")}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Topics table */}
      {filteredTopics.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Inbox className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">
              {search ? t("topics.noTopicsFound") : t("topics.noTopicsAvailable")}
            </p>
            <p className="text-sm text-muted-foreground">
              {search
                ? tc("tryAdjusting")
                : t("topics.noTopicsDescription")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("topics.topicName")}</TableHead>
                <TableHead className="w-[100px]">{tc("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTopics.map((topic) => (
                <TableRow key={topic}>
                  <TableCell>
                    <code className="text-sm font-mono">{topic}</code>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/kafka/${connectionId}/topics/${encodeURIComponent(topic)}`}>
                        {tc("view")}
                      </Link>
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
