"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Check, Clock, Pause, Plus, Users, X, XCircle } from "lucide-react"
import Link from "next/link"
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api-client"
import type { Subscription } from "@/types/subscription"
import type { APISIXListResponse } from "@/types/apisix"

const STATUS_BADGE: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Pending", className: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: Clock },
  active: { label: "Active", className: "bg-green-500/15 text-green-600 border-green-500/30", icon: Check },
  suspended: { label: "Suspended", className: "bg-blue-500/15 text-blue-600 border-blue-500/30", icon: Pause },
  revoked: { label: "Revoked", className: "bg-red-500/15 text-red-600 border-red-500/30", icon: XCircle },
}

export default function ApiSubscriptionsPage() {
  const params = useParams()
  const apiId = params.id as string

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [showAddDialog, setShowAddDialog] = useState(false)

  // Add subscriber form state
  const [consumers, setConsumers] = useState<{ username: string }[]>([])
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([])
  const [selectedConsumer, setSelectedConsumer] = useState("")
  const [selectedPlan, setSelectedPlan] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadSubscriptions()
  }, [apiId, statusFilter])

  const loadSubscriptions = async () => {
    try {
      const params: { api_definition_id: string; status?: string } = { api_definition_id: apiId }
      if (statusFilter !== "all") params.status = statusFilter
      const data = await api.listSubscriptions(params)
      setSubscriptions(data || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load subscriptions")
    } finally {
      setLoading(false)
    }
  }

  const openAddDialog = async () => {
    setShowAddDialog(true)
    try {
      const [consumersRes, plansRes] = await Promise.all([
        api.listResource("consumers") as Promise<APISIXListResponse>,
        api.listResource("consumer-groups") as Promise<APISIXListResponse>,
      ])
      setConsumers(
        (consumersRes.list || []).map((item) => {
          const val = typeof item.value === "string" ? JSON.parse(item.value) : item.value
          return { username: val.username || "" }
        }).filter((c) => c.username)
      )
      setPlans(
        (plansRes.list || []).map((item) => {
          const val = typeof item.value === "string" ? JSON.parse(item.value) : item.value
          return { id: val.id || item.key?.split("/").pop() || "", name: val.desc || val.id || "" }
        })
      )
    } catch {
      toast.error("Failed to load consumers or plans")
    }
  }

  const handleAdd = async () => {
    if (!selectedConsumer) return
    setSubmitting(true)
    try {
      const sub = await api.createSubscription({
        consumer_username: selectedConsumer,
        api_definition_id: apiId,
        plan_id: selectedPlan || undefined,
        notes: notes || undefined,
      })
      setSubscriptions((prev) => [sub, ...prev])
      setShowAddDialog(false)
      setSelectedConsumer("")
      setSelectedPlan("")
      setNotes("")
      toast.success("Subscription request created")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create subscription")
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      const result = await api.reviewSubscription(id, { action: "approve" })
      setSubscriptions((prev) => prev.map((s) => (s.id === result.id ? result : s)))
      toast.success("Subscription approved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve")
    }
  }

  const handleReject = async (id: string) => {
    try {
      const result = await api.reviewSubscription(id, { action: "reject" })
      setSubscriptions((prev) => prev.map((s) => (s.id === result.id ? result : s)))
      toast.success("Subscription rejected")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject")
    }
  }

  const handleSuspend = async (id: string) => {
    try {
      const result = await api.suspendSubscription(id)
      setSubscriptions((prev) => prev.map((s) => (s.id === result.id ? result : s)))
      toast.success("Subscription suspended")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to suspend")
    }
  }

  const handleRevoke = async (id: string) => {
    try {
      const result = await api.revokeSubscription(id)
      setSubscriptions((prev) => prev.map((s) => (s.id === result.id ? result : s)))
      toast.success("Subscription revoked")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke")
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href={`/apis/${apiId}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Subscribers</h1>
            <p className="text-muted-foreground">Applications subscribed to this API</p>
          </div>
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href={`/apis/${apiId}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Subscribers</h1>
            <p className="text-muted-foreground">Applications subscribed to this API</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Subscriber
          </Button>
        </div>
      </div>

      {subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No subscribers</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add an application to subscribe it to this API.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Application</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => {
                const status = STATUS_BADGE[sub.status] || STATUS_BADGE.pending
                return (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <Link
                        href={`/applications/${sub.consumer_username}`}
                        className="font-medium hover:underline"
                      >
                        {sub.consumer_username}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sub.plan_id || "No plan"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${status.className}`}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(sub.requested_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {sub.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleApprove(sub.id)}
                            >
                              <Check className="mr-1 h-3 w-3" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-red-600"
                              onClick={() => handleReject(sub.id)}
                            >
                              <X className="mr-1 h-3 w-3" />
                              Reject
                            </Button>
                          </>
                        )}
                        {sub.status === "active" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleSuspend(sub.id)}
                            >
                              <Pause className="mr-1 h-3 w-3" />
                              Suspend
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-red-600"
                              onClick={() => handleRevoke(sub.id)}
                            >
                              Revoke
                            </Button>
                          </>
                        )}
                        {sub.status === "suspended" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleApprove(sub.id)}
                            >
                              Reactivate
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-red-600"
                              onClick={() => handleRevoke(sub.id)}
                            >
                              Revoke
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Subscriber Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Subscriber</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Application</label>
              <Select value={selectedConsumer} onValueChange={setSelectedConsumer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an application..." />
                </SelectTrigger>
                <SelectContent>
                  {consumers.map((c) => (
                    <SelectItem key={c.username} value={c.username}>
                      {c.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Plan (optional)</label>
              <Select value={selectedPlan || "none"} onValueChange={(v) => setSelectedPlan(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="No plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No plan</SelectItem>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name || p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for subscription..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!selectedConsumer || submitting}>
              {submitting ? "Creating..." : "Create Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
