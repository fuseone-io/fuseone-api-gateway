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
  FileJson,
  Search,
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
import type { APISIXPluginConfig } from "@/types/apisix"

export default function PolicyTemplatesPage() {
  const t = useTranslations("pluginConfigs")
  const tc = useTranslations("common")
  const [templates, setTemplates] = useState<APISIXPluginConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const fetchTemplates = () => {
    setLoading(true)
    api
      .listResource("plugin-configs")
      .then((data) => {
        const items = (data?.list || []).map((node) => node.value as APISIXPluginConfig)
        setTemplates(items)
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api.deleteResource("plugin-configs", deleteId)
      toast.success(t("templateDeleted"))
      fetchTemplates()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("deleteFailed"))
    } finally {
      setDeleteId(null)
    }
  }

  const filtered = useMemo(() => {
    if (!search) return templates
    const q = search.toLowerCase()
    return templates.filter(
      (t) =>
        (t.id || "").toLowerCase().includes(q) ||
        (t.desc || "").toLowerCase().includes(q) ||
        (t.plugins
          ? Object.keys(t.plugins).some((name) => name.toLowerCase().includes(q))
          : false) ||
        (t.labels
          ? Object.entries(t.labels).some(
              ([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q)
            )
          : false)
    )
  }, [templates, search])

  function getPluginsCount(plugins?: Record<string, unknown>): number {
    return plugins ? Object.keys(plugins).length : 0
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={<FileJson className="h-6 w-6" />}
        actions={
          <Button asChild>
            <Link href="/plugin-configs/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("newTemplate")}
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
              <TableHead>{t("plugins")}</TableHead>
              <TableHead>{t("labels")}</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <FileJson className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {search
                        ? t("noSearchResults")
                        : t("noTemplates")}
                    </p>
                    {!search && (
                      <Button asChild variant="outline" size="sm">
                        <Link href="/plugin-configs/new">
                          {t("createFirstTemplate")}
                        </Link>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((tpl) => (
                <TableRow key={tpl.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">
                        {tpl.desc || tc("untitled")}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {tpl.id}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tpl.plugins && Object.keys(tpl.plugins).length > 0 ? (
                        <>
                          <Badge variant="secondary">
                            {getPluginsCount(tpl.plugins)} plugin
                            {getPluginsCount(tpl.plugins) !== 1 ? "s" : ""}
                          </Badge>
                          {Object.keys(tpl.plugins)
                            .slice(0, 3)
                            .map((name) => (
                              <Badge
                                key={name}
                                variant="outline"
                                className="text-xs"
                              >
                                {name}
                              </Badge>
                            ))}
                          {Object.keys(tpl.plugins).length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{Object.keys(tpl.plugins).length - 3} more
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground text-sm">0</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tpl.labels &&
                        Object.entries(tpl.labels)
                          .slice(0, 2)
                          .map(([k, v]) => (
                            <Badge
                              key={k}
                              variant="outline"
                              className="text-xs"
                            >
                              {k}: {v}
                            </Badge>
                          ))}
                      {tpl.labels &&
                        Object.keys(tpl.labels).length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{Object.keys(tpl.labels).length - 2} more
                          </Badge>
                        )}
                      {(!tpl.labels || Object.keys(tpl.labels).length === 0) && (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>
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
                          <Link href={`/plugin-configs/${tpl.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {tc("edit")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(tpl.id!)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {tc("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirm")}
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
