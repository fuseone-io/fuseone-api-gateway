"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  ShieldCheck,
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
import type { APISIXGlobalRule } from "@/types/apisix"

export default function GlobalRulesPage() {
  const [rules, setRules] = useState<APISIXGlobalRule[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const fetchRules = () => {
    setLoading(true)
    api
      .listResource("global-rules")
      .then((data) => {
        const items = (data?.list || []).map((node) => node.value as APISIXGlobalRule)
        setRules(items)
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchRules()
  }, [])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api.deleteResource("global-rules", deleteId)
      toast.success("Global policy deleted")
      fetchRules()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleteId(null)
    }
  }

  function getPluginsCount(plugins?: Record<string, unknown>): number {
    return plugins ? Object.keys(plugins).length : 0
  }

  const filtered = useMemo(() => {
    if (!search) return rules
    const q = search.toLowerCase()
    return rules.filter(
      (r) =>
        (r.id || "").toLowerCase().includes(q) ||
        (r.plugins
          ? Object.keys(r.plugins).some((name) => name.toLowerCase().includes(q))
          : false)
    )
  }, [rules, search])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Policies"
        description="Manage plugins that apply to all API traffic"
        actions={
          <Button asChild>
            <Link href="/global-rules/new">
              <Plus className="mr-2 h-4 w-4" />
              New Policy
            </Link>
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search policies..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>ID</TableHead>
              <TableHead>Plugins</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 3 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <ShieldCheck className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {search ? "No policies match your search" : "No global policies configured"}
                    </p>
                    {!search && (
                      <Button asChild variant="outline" size="sm">
                        <Link href="/global-rules/new">Create your first global policy</Link>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((rule) => (
                <TableRow key={rule.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-sm">
                    {rule.id}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {rule.plugins && Object.keys(rule.plugins).length > 0 ? (
                        <>
                          <Badge variant="secondary">
                            {getPluginsCount(rule.plugins)} plugin{getPluginsCount(rule.plugins) !== 1 ? "s" : ""}
                          </Badge>
                          {Object.keys(rule.plugins).slice(0, 3).map((name) => (
                            <Badge key={name} variant="outline" className="text-xs">
                              {name}
                            </Badge>
                          ))}
                          {Object.keys(rule.plugins).length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{Object.keys(rule.plugins).length - 3} more
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">0</span>
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
                          <Link href={`/global-rules/${rule.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(rule.id!)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
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
            <AlertDialogTitle>Delete Global Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this global policy? This action cannot be
              undone. All API traffic will be affected as these plugins will no
              longer be applied.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
