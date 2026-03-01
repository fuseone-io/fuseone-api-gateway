"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  ArrowUpDown,
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
import type { APISIXUpstream } from "@/types/apisix"

export default function UpstreamsPage() {
  const [upstreams, setUpstreams] = useState<APISIXUpstream[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const fetchUpstreams = () => {
    setLoading(true)
    api
      .listResource("upstreams")
      .then((data) => {
        const items = (data?.list || []).map((node) => node.value as APISIXUpstream)
        setUpstreams(items)
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUpstreams()
  }, [])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api.deleteResource("upstreams", deleteId)
      toast.success("Upstream deleted")
      fetchUpstreams()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleteId(null)
    }
  }

  function getNodesCount(upstream: APISIXUpstream): number {
    if (!upstream.nodes) return 0
    if (Array.isArray(upstream.nodes)) return upstream.nodes.length
    return Object.keys(upstream.nodes).length
  }

  function hasHealthCheck(upstream: APISIXUpstream): boolean {
    return !!(upstream.checks?.active || upstream.checks?.passive)
  }

  const filtered = useMemo(() => {
    if (!search) return upstreams
    const q = search.toLowerCase()
    return upstreams.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.type || "").toLowerCase().includes(q) ||
        (u.desc || "").toLowerCase().includes(q)
    )
  }, [upstreams, search])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upstreams"
        description="Manage upstream server groups and load balancing configurations"
        actions={
          <Button asChild>
            <Link href="/upstreams/new">
              <Plus className="mr-2 h-4 w-4" />
              New Upstream
            </Link>
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search upstreams..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Nodes</TableHead>
              <TableHead>Scheme</TableHead>
              <TableHead>Health Check</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <ArrowUpDown className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {search ? "No upstreams match your search" : "No upstreams configured"}
                    </p>
                    {!search && (
                      <Button asChild variant="outline" size="sm">
                        <Link href="/upstreams/new">Create your first upstream</Link>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((upstream) => (
                <TableRow key={upstream.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {upstream.name || upstream.id}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {upstream.type || "roundrobin"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {getNodesCount(upstream)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {upstream.scheme || "http"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={hasHealthCheck(upstream) ? "default" : "secondary"}>
                      {hasHealthCheck(upstream) ? "Enabled" : "Disabled"}
                    </Badge>
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
                          <Link href={`/upstreams/${upstream.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(upstream.id!)}
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
            <AlertDialogTitle>Delete Upstream</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this upstream? This action cannot be
              undone. Services and routes referencing this upstream will be affected.
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
