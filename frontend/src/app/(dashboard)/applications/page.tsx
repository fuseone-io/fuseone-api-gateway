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
  AppWindow,
  Search,
  Key,
  Lock,
  ShieldCheck,
  Fingerprint,
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
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { api } from "@/lib/api-client"
import { AUTH_PLUGINS } from "@/lib/constants"
import type { APISIXConsumer, APISIXConsumerGroup } from "@/types/apisix"

type AuthMethod = (typeof AUTH_PLUGINS)[number]

const AUTH_LABELS: Record<AuthMethod, { label: string; className: string }> = {
  "key-auth": { label: "API Key", className: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  "basic-auth": { label: "Basic Auth", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  "jwt-auth": { label: "JWT", className: "bg-green-500/15 text-green-600 border-green-500/30" },
  "hmac-auth": { label: "HMAC", className: "bg-purple-500/15 text-purple-600 border-purple-500/30" },
}

function getAuthMethod(plugins?: Record<string, unknown>): AuthMethod | null {
  if (!plugins) return null
  return AUTH_PLUGINS.find((p) => plugins[p]) || null
}

export default function ApplicationsPage() {
  const t = useTranslations("applications")
  const tc = useTranslations("common")
  const [apps, setApps] = useState<APISIXConsumer[]>([])
  const [planMap, setPlanMap] = useState<Map<string, APISIXConsumerGroup>>(new Map())
  const [loading, setLoading] = useState(true)
  const [deleteUsername, setDeleteUsername] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const fetchData = async () => {
    setLoading(true)
    try {
      const [consumersData, plansData] = await Promise.all([
        api.listResource("consumers"),
        api.listResource("consumer-groups"),
      ])
      const consumers = (consumersData?.list || []).map((n) => n.value as APISIXConsumer)
      const groups = (plansData?.list || []).map((n) => n.value as APISIXConsumerGroup)
      setApps(consumers)
      setPlanMap(new Map(groups.map((g) => [g.id || "", g])))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc("failedToLoad", { resource: t("title") }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDelete = async () => {
    if (!deleteUsername) return
    try {
      await api.deleteResource("consumers", deleteUsername)
      toast.success(t("toasts.deleted"))
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.failedDelete"))
    } finally {
      setDeleteUsername(null)
    }
  }

  const filtered = useMemo(() => {
    if (!search) return apps
    const q = search.toLowerCase()
    return apps.filter(
      (a) =>
        a.username.toLowerCase().includes(q) ||
        (a.desc || "").toLowerCase().includes(q)
    )
  }, [apps, search])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={<AppWindow className="h-6 w-6" />}
        actions={
          <Button asChild>
            <Link href="/applications/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("newApplication")}
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
              <TableHead>{tc("name")}</TableHead>
              <TableHead>{tc("description")}</TableHead>
              <TableHead>{t("tableHeaders.plan")}</TableHead>
              <TableHead>{t("tableHeaders.authMethod")}</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <AppWindow className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {search ? t("noMatchSearch") : t("noConfigured")}
                    </p>
                    {!search && (
                      <Button asChild variant="outline" size="sm">
                        <Link href="/applications/new">{t("createFirst")}</Link>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((app) => {
                const auth = getAuthMethod(app.plugins)
                const authMeta = auth ? AUTH_LABELS[auth] : null
                const plan = app.group_id ? planMap.get(app.group_id) : null
                return (
                  <TableRow key={app.username} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{app.username}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {app.desc || "-"}
                    </TableCell>
                    <TableCell>
                      {plan ? (
                        <Link href={`/plans/${plan.id}`}>
                          <Badge variant="outline" className="text-xs font-mono hover:bg-accent">
                            {plan.id}
                          </Badge>
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {authMeta ? (
                        <Badge variant="outline" className={`text-xs ${authMeta.className}`}>
                          {authMeta.label}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/applications/${app.username}`}>
                              <Pencil className="mr-2 h-4 w-4" />
                              {tc("edit")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteUsername(app.username)}
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

      <AlertDialog open={!!deleteUsername} onOpenChange={() => setDeleteUsername(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDialog.description", { name: deleteUsername || "" })}
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
