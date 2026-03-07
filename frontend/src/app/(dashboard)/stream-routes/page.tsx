"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { toast } from "sonner"
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Wifi,
  Search,
  AlertTriangle,
  Shield,
  Network,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { api } from "@/lib/api-client"
import type { APISIXStreamRoute } from "@/types/apisix"

function formatUpstream(route: APISIXStreamRoute): string {
  if (route.upstream_id) return route.upstream_id
  if (!route.upstream?.nodes) return "—"
  if (Array.isArray(route.upstream.nodes)) {
    return route.upstream.nodes.map((n) => `${n.host}:${n.port}`).join(", ")
  }
  return Object.keys(route.upstream.nodes).join(", ")
}

export default function StreamRoutesPage() {
  const t = useTranslations("streamRoutes")
  const tc = useTranslations("common")
  const [routes, setRoutes] = useState<APISIXStreamRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [streamDisabled, setStreamDisabled] = useState(false)

  const fetchRoutes = () => {
    setLoading(true)
    setStreamDisabled(false)
    api
      .listResource("stream-routes")
      .then((data) => {
        const items = (data?.list || []).map(
          (node) => node.value as APISIXStreamRoute
        )
        setRoutes(items)
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err)
        if (
          msg.toLowerCase().includes("stream mode is disabled") ||
          msg.toLowerCase().includes("stream")
        ) {
          setStreamDisabled(true)
        } else {
          toast.error(msg)
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRoutes()
  }, [])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api.deleteResource("stream-routes", deleteId)
      toast.success(t("toasts.deleted"))
      fetchRoutes()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.failedDelete"))
    } finally {
      setDeleteId(null)
    }
  }

  const filtered = useMemo(() => {
    if (!search) return routes
    const q = search.toLowerCase()
    return routes.filter(
      (r) =>
        (r.id || "").toLowerCase().includes(q) ||
        (r.name || "").toLowerCase().includes(q) ||
        (r.desc || "").toLowerCase().includes(q) ||
        (r.sni || "").toLowerCase().includes(q) ||
        (r.remote_addr || "").toLowerCase().includes(q)
    )
  }, [routes, search])

  const colCount = 6

  if (!loading && streamDisabled) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("title")}
          description={t("description")}
          icon={<Wifi className="h-6 w-6" />}
        />

        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              {t("streamDisabled.title")}
            </CardTitle>
            <CardDescription>
              {t("streamDisabled.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4 space-y-3">
              <p className="text-sm font-medium">
                {t("streamDisabled.instructions")}
              </p>
              <pre className="text-xs bg-background rounded-md p-3 border overflow-x-auto font-mono">
{`apisix:
  proxy_mode: http&stream    # Enable both HTTP and stream
  stream_proxy:
    tcp:
      - 9100                 # TCP listen port
      - addr: 9443
        tls: true            # TCP with TLS
    udp:
      - 9200                 # UDP listen port`}
              </pre>
              <p className="text-xs text-muted-foreground">
                {t("streamDisabled.restartHint")}
              </p>
            </div>
            <Button variant="outline" onClick={fetchRoutes}>
              {t("streamDisabled.retry")}
            </Button>
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
        icon={<Wifi className="h-6 w-6" />}
        actions={
          <Button asChild>
            <Link href="/stream-routes/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("newStreamRoute")}
            </Link>
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>{t("tableHeaders.id")}</TableHead>
              <TableHead>{tc("name")}</TableHead>
              <TableHead>{t("tableHeaders.match")}</TableHead>
              <TableHead>{t("tableHeaders.upstream")}</TableHead>
              <TableHead>{t("tableHeaders.plugins")}</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: colCount }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Wifi className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {search
                        ? t("noMatchSearch")
                        : t("noConfigured")}
                    </p>
                    {!search && (
                      <Button asChild variant="outline" size="sm">
                        <Link href="/stream-routes/new">
                          {t("createFirst")}
                        </Link>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((route) => {
                const pluginCount = route.plugins
                  ? Object.keys(route.plugins).length
                  : 0
                const matchParts: string[] = []
                if (route.remote_addr)
                  matchParts.push(`IP: ${route.remote_addr}`)
                if (route.server_addr)
                  matchParts.push(`Server: ${route.server_addr}`)
                if (route.server_port)
                  matchParts.push(`Port: ${route.server_port}`)
                if (route.sni) matchParts.push(`SNI: ${route.sni}`)

                return (
                  <TableRow key={route.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-sm">
                      {route.id}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">
                          {route.name || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </p>
                        {route.desc && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {route.desc}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {matchParts.length > 0 ? (
                          matchParts.map((part) => (
                            <Badge
                              key={part}
                              variant="outline"
                              className="text-xs font-mono"
                            >
                              {part}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {t("any")}
                          </span>
                        )}
                        {route.protocol?.name && (
                          <Badge
                            variant="secondary"
                            className="text-xs gap-1 border-purple-500/30 text-purple-600"
                          >
                            <Network className="h-3 w-3" />
                            {route.protocol.name}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono truncate max-w-[200px] block">
                        {formatUpstream(route)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {pluginCount > 0 ? (
                        <div className="flex items-center gap-1">
                          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                          <Badge variant="secondary" className="text-xs">
                            {pluginCount}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          0
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/stream-routes/${route.id}`}>
                              <Pencil className="mr-2 h-4 w-4" />
                              {tc("edit")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(route.id!)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {tc("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{tc("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
