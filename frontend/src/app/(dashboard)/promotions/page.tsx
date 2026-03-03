"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ArrowRight, Check, X, Rocket, Clock, AlertTriangle } from "lucide-react"
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
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { DiffViewer } from "@/components/diff-viewer"
import { api } from "@/lib/api-client"
import { useEnvironmentStore } from "@/stores/environment-store"
import type { PromotionRequest } from "@/types/promotion"

const STATUS_BADGE: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Pending", className: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: Clock },
  approved: { label: "Approved", className: "bg-blue-500/15 text-blue-600 border-blue-500/30", icon: Check },
  rejected: { label: "Rejected", className: "bg-red-500/15 text-red-600 border-red-500/30", icon: X },
  deployed: { label: "Deployed", className: "bg-green-500/15 text-green-600 border-green-500/30", icon: Rocket },
  failed: { label: "Failed", className: "bg-red-500/15 text-red-600 border-red-500/30", icon: AlertTriangle },
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<PromotionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedPromo, setSelectedPromo] = useState<PromotionRequest | null>(null)
  const [reviewComment, setReviewComment] = useState("")
  const [executing, setExecuting] = useState(false)
  const { environments, fetchEnvironments } = useEnvironmentStore()

  useEffect(() => {
    fetchEnvironments()
  }, [fetchEnvironments])

  useEffect(() => {
    loadPromotions()
  }, [statusFilter])

  const loadPromotions = async () => {
    try {
      const params: { status?: string } = {}
      if (statusFilter !== "all") params.status = statusFilter
      const data = await api.listPromotions(params)
      setPromotions(data || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load promotions")
    } finally {
      setLoading(false)
    }
  }

  const getEnvName = (envId: string) => {
    const env = environments.find((e) => e.id === envId)
    return env?.name || envId.slice(0, 8)
  }

  const getEnvColor = (envId: string) => {
    const env = environments.find((e) => e.id === envId)
    return env?.color || "#6b7280"
  }

  const handleReview = async (action: "approve" | "reject") => {
    if (!selectedPromo) return
    try {
      const result = await api.reviewPromotion(selectedPromo.id, { action, comment: reviewComment })
      setPromotions((prev) => prev.map((p) => (p.id === result.id ? result : p)))
      setSelectedPromo(result)
      setReviewComment("")
      toast.success(action === "approve" ? "Promotion approved" : "Promotion rejected")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} promotion`)
    }
  }

  const handleExecute = async () => {
    if (!selectedPromo) return
    setExecuting(true)
    try {
      const result = await api.executePromotion(selectedPromo.id)
      setPromotions((prev) => prev.map((p) => (p.id === result.id ? result : p)))
      setSelectedPromo(result)
      toast.success("Promotion deployed successfully")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to execute promotion")
    } finally {
      setExecuting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Promotions</h1>
          <p className="text-muted-foreground">Promote API configurations between environments</p>
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Promotions</h1>
          <p className="text-muted-foreground">Promote API configurations between environments</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="deployed">Deployed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {promotions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ArrowRight className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No promotions</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Promote an API from the API detail page to move it between environments.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Promotion</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promotions.map((promo) => {
                const status = STATUS_BADGE[promo.status] || STATUS_BADGE.pending
                return (
                  <TableRow
                    key={promo.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedPromo(promo)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: getEnvColor(promo.source_env_id) }}
                        />
                        <span className="text-sm font-medium">{getEnvName(promo.source_env_id)}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: getEnvColor(promo.target_env_id) }}
                        />
                        <span className="text-sm font-medium">{getEnvName(promo.target_env_id)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${status.className}`}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(promo.requested_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {promo.status === "pending" && (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={(e) => { e.stopPropagation(); setSelectedPromo(promo) }}
                          >
                            Review
                          </Button>
                        </div>
                      )}
                      {promo.status === "approved" && (
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedPromo(promo)
                          }}
                        >
                          <Rocket className="mr-1 h-3 w-3" />
                          Execute
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedPromo} onOpenChange={(open) => { if (!open) setSelectedPromo(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedPromo && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: getEnvColor(selectedPromo.source_env_id) }}
                  />
                  {getEnvName(selectedPromo.source_env_id)}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: getEnvColor(selectedPromo.target_env_id) }}
                  />
                  {getEnvName(selectedPromo.target_env_id)}
                </DialogTitle>
                <DialogDescription>
                  Requested {new Date(selectedPromo.requested_at).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge variant="outline" className={`text-xs ${(STATUS_BADGE[selectedPromo.status] || STATUS_BADGE.pending).className}`}>
                    {(STATUS_BADGE[selectedPromo.status] || STATUS_BADGE.pending).label}
                  </Badge>
                </div>

                {/* Review comment */}
                {selectedPromo.review_comment && (
                  <div className="rounded-md border p-3 text-sm">
                    <span className="text-muted-foreground">Review comment: </span>
                    {selectedPromo.review_comment}
                  </div>
                )}

                {/* Diff */}
                {selectedPromo.diff_summary && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Changes</h4>
                    <DiffViewer diff={selectedPromo.diff_summary} />
                  </div>
                )}

                {!selectedPromo.diff_summary && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No previous deployment in target environment — full deployment will be created.
                  </div>
                )}

                {/* Review actions */}
                {selectedPromo.status === "pending" && (
                  <div className="space-y-3 pt-2">
                    <Textarea
                      placeholder="Review comment (optional)"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleReview("reject")}
                      >
                        <X className="mr-1.5 h-4 w-4" />
                        Reject
                      </Button>
                      <Button className="flex-1" onClick={() => handleReview("approve")}>
                        <Check className="mr-1.5 h-4 w-4" />
                        Approve
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                {selectedPromo.status === "approved" && (
                  <Button onClick={handleExecute} disabled={executing}>
                    <Rocket className="mr-1.5 h-4 w-4" />
                    {executing ? "Deploying..." : "Deploy to Target"}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
