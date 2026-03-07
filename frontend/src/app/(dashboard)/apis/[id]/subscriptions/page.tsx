"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
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
import { PageHeader } from "@/components/page-header"
import { api } from "@/lib/api-client"
import type { Subscription } from "@/types/subscription"
import type { APISIXListResponse } from "@/types/apisix"

export default function ApiSubscriptionsPage() {
  const t = useTranslations("apis")
  const tc = useTranslations("common")
  const params = useParams()
  const apiId = params.id as string

  const STATUS_BADGE: Record<string, { label: string; className: string; icon: typeof Clock }> = {
    pending: { label: t("detail.subscriptions.status.pending"), className: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: Clock },
    active: { label: t("detail.subscriptions.status.active"), className: "bg-green-500/15 text-green-600 border-green-500/30", icon: Check },
    suspended: { label: t("detail.subscriptions.status.suspended"), className: "bg-blue-500/15 text-blue-600 border-blue-500/30", icon: Pause },
    revoked: { label: t("detail.subscriptions.status.revoked"), className: "bg-red-500/15 text-red-600 border-red-500/30", icon: XCircle },
  }

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
      toast.error(err instanceof Error ? err.message : t("detail.subscriptions.toasts.failedLoad"))
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
      toast.error(t("detail.subscriptions.toasts.failedLoadConsumers"))
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
      toast.success(t("detail.subscriptions.toasts.created"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("detail.subscriptions.toasts.failedCreate"))
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      const result = await api.reviewSubscription(id, { action: "approve" })
      setSubscriptions((prev) => prev.map((s) => (s.id === result.id ? result : s)))
      toast.success(t("detail.subscriptions.toasts.approved"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("detail.subscriptions.toasts.failedApprove"))
    }
  }

  const handleReject = async (id: string) => {
    try {
      const result = await api.reviewSubscription(id, { action: "reject" })
      setSubscriptions((prev) => prev.map((s) => (s.id === result.id ? result : s)))
      toast.success(t("detail.subscriptions.toasts.rejected"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("detail.subscriptions.toasts.failedReject"))
    }
  }

  const handleSuspend = async (id: string) => {
    try {
      const result = await api.suspendSubscription(id)
      setSubscriptions((prev) => prev.map((s) => (s.id === result.id ? result : s)))
      toast.success(t("detail.subscriptions.toasts.suspended"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("detail.subscriptions.toasts.failedSuspend"))
    }
  }

  const handleRevoke = async (id: string) => {
    try {
      const result = await api.revokeSubscription(id)
      setSubscriptions((prev) => prev.map((s) => (s.id === result.id ? result : s)))
      toast.success(t("detail.subscriptions.toasts.revoked"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("detail.subscriptions.toasts.failedRevoke"))
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("detail.subscribers")}
          description={t("detail.subscribersDescription")}
          icon={
            <Link href={`/apis/${apiId}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          }
        />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("detail.subscribers")}
        description={t("detail.subscribersDescription")}
        icon={
          <Link href={`/apis/${apiId}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        }
        actions={
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder={t("detail.subscriptions.filterStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc("all")}</SelectItem>
                <SelectItem value="pending">{t("detail.subscriptions.status.pending")}</SelectItem>
                <SelectItem value="active">{t("detail.subscriptions.status.active")}</SelectItem>
                <SelectItem value="suspended">{t("detail.subscriptions.status.suspended")}</SelectItem>
                <SelectItem value="revoked">{t("detail.subscriptions.status.revoked")}</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={openAddDialog}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t("detail.subscriptions.addSubscriber")}
            </Button>
          </div>
        }
      />

      {subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">{t("detail.subscriptions.noSubscribers")}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("detail.subscriptions.noSubscribersDescription")}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("detail.subscriptions.tableHeaders.application")}</TableHead>
                <TableHead>{t("detail.subscriptions.tableHeaders.plan")}</TableHead>
                <TableHead>{t("detail.subscriptions.tableHeaders.status")}</TableHead>
                <TableHead>{t("detail.subscriptions.tableHeaders.requested")}</TableHead>
                <TableHead className="text-right">{t("detail.subscriptions.tableHeaders.actions")}</TableHead>
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
                      {sub.plan_id || t("detail.subscriptions.noPlan")}
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
                              {t("detail.subscriptions.approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-red-600"
                              onClick={() => handleReject(sub.id)}
                            >
                              <X className="mr-1 h-3 w-3" />
                              {t("detail.subscriptions.reject")}
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
                              {t("detail.subscriptions.suspend")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-red-600"
                              onClick={() => handleRevoke(sub.id)}
                            >
                              {t("detail.subscriptions.revoke")}
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
                              {t("detail.subscriptions.reactivate")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-red-600"
                              onClick={() => handleRevoke(sub.id)}
                            >
                              {t("detail.subscriptions.revoke")}
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
            <DialogTitle>{t("detail.subscriptions.addDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("detail.subscriptions.applicationLabel")}</label>
              <Select value={selectedConsumer} onValueChange={setSelectedConsumer}>
                <SelectTrigger>
                  <SelectValue placeholder={t("detail.subscriptions.selectApplication")} />
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
              <label className="text-sm font-medium">{t("detail.subscriptions.planLabel")}</label>
              <Select value={selectedPlan || "none"} onValueChange={(v) => setSelectedPlan(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("detail.subscriptions.noPlan")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("detail.subscriptions.noPlan")}</SelectItem>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name || p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("detail.subscriptions.notesLabel")}</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("detail.subscriptions.notesPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleAdd} disabled={!selectedConsumer || submitting}>
              {submitting ? t("detail.subscriptions.creating") : t("detail.subscriptions.createSubscription")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
