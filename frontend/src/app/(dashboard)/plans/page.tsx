"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  CreditCard,
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
import type { APISIXConsumer, APISIXConsumerGroup } from "@/types/apisix"

export default function PlansPage() {
  const [plans, setPlans] = useState<APISIXConsumerGroup[]>([])
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const fetchData = async () => {
    setLoading(true)
    try {
      const [plansData, consumersData] = await Promise.all([
        api.listResource("consumer-groups"),
        api.listResource("consumers"),
      ])
      const planItems = (plansData?.list || []).map((n) => n.value as APISIXConsumerGroup)
      const consumerItems = (consumersData?.list || []).map((n) => n.value as APISIXConsumer)

      const counts: Record<string, number> = {}
      for (const c of consumerItems) {
        if (c.group_id) counts[c.group_id] = (counts[c.group_id] || 0) + 1
      }
      setMemberCounts(counts)
      setPlans(planItems)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load plans")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api.deleteResource("consumer-groups", deleteId)
      toast.success("Plan deleted")
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleteId(null)
    }
  }

  const filtered = useMemo(() => {
    if (!search) return plans
    const q = search.toLowerCase()
    return plans.filter(
      (p) =>
        (p.id || "").toLowerCase().includes(q) ||
        (p.desc || "").toLowerCase().includes(q)
    )
  }, [plans, search])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description="Define shared policies and rate limits for application groups"
        actions={
          <Button asChild>
            <Link href="/plans/new">
              <Plus className="mr-2 h-4 w-4" />
              New Plan
            </Link>
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search plans..."
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
              <TableHead>Description</TableHead>
              <TableHead>Policies</TableHead>
              <TableHead>Members</TableHead>
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
                    <CreditCard className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {search ? "No plans match your search" : "No plans configured"}
                    </p>
                    {!search && (
                      <Button asChild variant="outline" size="sm">
                        <Link href="/plans/new">Create your first plan</Link>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((plan) => (
                <TableRow key={plan.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium font-mono">
                    {plan.id}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {plan.desc || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {Object.keys(plan.plugins || {}).length}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {memberCounts[plan.id || ""] || 0} apps
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
                          <Link href={`/plans/${plan.id}`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(plan.id || null)}
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
            <AlertDialogTitle>Delete Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete plan &quot;{deleteId}&quot;? Applications
              assigned to this plan will lose their shared policies.
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
