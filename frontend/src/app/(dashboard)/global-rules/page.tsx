"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { api } from "@/lib/api-client"
import type { APISIXGlobalRule } from "@/types/apisix"

export default function GlobalRulesPage() {
  const [rules, setRules] = useState<APISIXGlobalRule[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetchRules = () => {
    setLoading(true)
    api
      .listResource("global_rules")
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
      await api.deleteResource("global_rules", deleteId)
      toast.success("Global rule deleted")
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Global Rules</h1>
          <p className="text-muted-foreground">
            Manage plugins that apply to all routes globally
          </p>
        </div>
        <Button asChild>
          <Link href="/global-rules/new">
            <Plus className="mr-2 h-4 w-4" />
            New Global Rule
          </Link>
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
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
            ) : rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <ShieldCheck className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No global rules configured</p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/global-rules/new">Create your first global rule</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id}>
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
                        <Button variant="ghost" size="icon">
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
            <AlertDialogTitle>Delete Global Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this global rule? This action cannot be
              undone. All routes will be affected as the plugins in this rule will no
              longer be applied globally.
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
