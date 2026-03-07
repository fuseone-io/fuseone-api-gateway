"use client"

import { useEffect, useState, useMemo } from "react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  MonitorCheck,
  Pencil,
  Plus,
  Search,
  Trash2,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
import { PageHeader } from "@/components/page-header"
import { useTestingStore } from "@/stores/testing-store"
import { api } from "@/lib/api-client"
import type { SyntheticMonitor } from "@/types/testing"
import type { NotificationContact } from "@/types/notification-contact"

const LOCATIONS = [
  { value: "us-east-1", label: "US East (Virginia)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "EU West (Ireland)" },
  { value: "sa-east-1", label: "South America (Sao Paulo)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
]

function formatInterval(sec: number): string {
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}min`
  return `${Math.floor(sec / 3600)}h`
}

// ── Monitor Form (shared between create and edit) ──
interface MonitorFormState {
  name: string
  description: string
  suite_id: string
  interval: string
  locations: string[]
  notify_contact_ids: string[]
}

const emptyForm: MonitorFormState = {
  name: "",
  description: "",
  suite_id: "",
  interval: "60",
  locations: ["sa-east-1"],
  notify_contact_ids: [],
}

function MonitorForm({
  suites,
  contacts,
  formState,
  setFormState,
  t,
  tc,
}: {
  suites: { id: string; name: string }[]
  contacts: NotificationContact[]
  formState: MonitorFormState
  setFormState: (s: MonitorFormState) => void
  t: ReturnType<typeof useTranslations<"testing">>
  tc: ReturnType<typeof useTranslations<"common">>
}) {
  const toggleLocation = (loc: string) => {
    setFormState({
      ...formState,
      locations: formState.locations.includes(loc)
        ? formState.locations.filter((l) => l !== loc)
        : [...formState.locations, loc],
    })
  }

  const toggleContact = (id: string) => {
    setFormState({
      ...formState,
      notify_contact_ids: formState.notify_contact_ids.includes(id)
        ? formState.notify_contact_ids.filter((c) => c !== id)
        : [...formState.notify_contact_ids, id],
    })
  }

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>{tc("name")}</Label>
        <Input
          placeholder={t("monitorsPage.form.namePlaceholder")}
          value={formState.name}
          onChange={(e) => setFormState({ ...formState, name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>{tc("description")}</Label>
        <Textarea
          placeholder={t("monitorsPage.form.descriptionPlaceholder")}
          value={formState.description}
          onChange={(e) => setFormState({ ...formState, description: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("monitorsPage.form.testSuite")}</Label>
        <Select value={formState.suite_id} onValueChange={(v) => setFormState({ ...formState, suite_id: v })}>
          <SelectTrigger>
            <SelectValue placeholder={t("monitorsPage.form.selectSuite")} />
          </SelectTrigger>
          <SelectContent>
            {suites.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{t("monitorsPage.form.interval")}</Label>
        <Select value={formState.interval} onValueChange={(v) => setFormState({ ...formState, interval: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">{t("monitorsPage.form.seconds30")}</SelectItem>
            <SelectItem value="60">{t("monitorsPage.form.minute1")}</SelectItem>
            <SelectItem value="300">{t("monitorsPage.form.minutes5")}</SelectItem>
            <SelectItem value="600">{t("monitorsPage.form.minutes10")}</SelectItem>
            <SelectItem value="1800">{t("monitorsPage.form.minutes30")}</SelectItem>
            <SelectItem value="3600">{t("monitorsPage.form.hour1")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{t("monitorsPage.form.locations")}</Label>
        <div className="flex flex-wrap gap-2">
          {LOCATIONS.map((loc) => (
            <Badge
              key={loc.value}
              variant={formState.locations.includes(loc.value) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleLocation(loc.value)}
            >
              {loc.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Notification Contacts */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5" />
          {t("monitorsPage.notificationChannels")}
        </Label>
        <p className="text-[11px] text-muted-foreground">
          {t("monitorsPage.notificationChannelsHint")}
        </p>
        {contacts.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            {t("monitorsPage.noChannels")}
          </p>
        ) : (
          <div className="space-y-1.5">
            {contacts.map((contact) => (
              <label
                key={contact.id}
                className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <input
                  type="checkbox"
                  className="rounded"
                  checked={formState.notify_contact_ids.includes(contact.id)}
                  onChange={() => toggleContact(contact.id)}
                />
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {contact.type}
                </Badge>
                <span className="text-sm truncate">{contact.name}</span>
                {!contact.enabled && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground ml-auto shrink-0">
                    {tc("disabled")}
                  </Badge>
                )}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SyntheticMonitorsPage() {
  const t = useTranslations("testing")
  const tc = useTranslations("common")

  const {
    monitors,
    monitorsLoading,
    suites,
    fetchMonitors,
    fetchSuites,
    createMonitor,
    updateMonitor,
    toggleMonitor,
    deleteMonitor,
  } = useTestingStore()

  const STATUS_CONFIG: Record<
    SyntheticMonitor["last_status"],
    { label: string; color: string; icon: typeof CheckCircle2 }
  > = {
    up: { label: t("monitorsPage.status.up"), color: "text-emerald-500", icon: CheckCircle2 },
    down: { label: t("monitorsPage.status.down"), color: "text-red-500", icon: XCircle },
    degraded: { label: t("monitorsPage.status.degraded"), color: "text-amber-500", icon: AlertTriangle },
    unknown: { label: t("monitorsPage.status.unknown"), color: "text-slate-400", icon: Activity },
  }

  const [contacts, setContacts] = useState<NotificationContact[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SyntheticMonitor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SyntheticMonitor | null>(null)
  const [search, setSearch] = useState("")

  // Form state (shared for create/edit)
  const [formState, setFormState] = useState<MonitorFormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchMonitors()
    fetchSuites()
    api.listNotificationContacts().then(setContacts).catch(() => {})
  }, [fetchMonitors, fetchSuites])

  function formatRelativeTime(dateStr: string): string {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return t("overview.timeAgo.now")
    if (diffMin < 60) return t("overview.timeAgo.minutesAgo", { min: diffMin })
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return t("overview.timeAgo.hoursAgo", { hours: diffHours })
    const diffDays = Math.floor(diffHours / 24)
    return t("overview.timeAgo.daysAgo", { days: diffDays })
  }

  // Filter monitors by search
  const filteredMonitors = useMemo(() => {
    if (!search.trim()) return monitors
    const q = search.toLowerCase()
    return monitors.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.last_status.includes(q)
    )
  }, [monitors, search])

  // Open edit dialog
  const openEdit = (monitor: SyntheticMonitor) => {
    setFormState({
      name: monitor.name,
      description: monitor.description,
      suite_id: monitor.suite_id,
      interval: String(monitor.interval_sec),
      locations: monitor.locations,
      notify_contact_ids: monitor.notify_contact_ids || [],
    })
    setEditTarget(monitor)
  }

  // Open create dialog
  const openCreate = () => {
    setFormState(emptyForm)
    setCreateOpen(true)
  }

  const handleCreate = async () => {
    if (!formState.name.trim() || !formState.suite_id) return
    setSubmitting(true)
    try {
      await createMonitor({
        name: formState.name.trim(),
        description: formState.description.trim(),
        suite_id: formState.suite_id,
        interval_sec: parseInt(formState.interval) || 60,
        locations: formState.locations,
        notify_contact_ids: formState.notify_contact_ids,
      })
      toast.success(t("monitorsPage.toasts.created"))
      setCreateOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("monitorsPage.toasts.failedCreate"))
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!editTarget || !formState.name.trim() || !formState.suite_id) return
    setSubmitting(true)
    try {
      await updateMonitor(editTarget.id, {
        name: formState.name.trim(),
        description: formState.description.trim(),
        suite_id: formState.suite_id,
        interval_sec: parseInt(formState.interval) || 60,
        locations: formState.locations,
        notify_contact_ids: formState.notify_contact_ids,
      })
      toast.success(t("monitorsPage.toasts.updated"))
      setEditTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("monitorsPage.toasts.failedUpdate"))
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleMonitor(id, enabled)
      toast.success(enabled ? t("monitorsPage.toasts.enabled") : t("monitorsPage.toasts.disabled"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("monitorsPage.toasts.failedToggle"))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMonitor(deleteTarget.id)
      toast.success(t("monitorsPage.toasts.deleted"))
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("monitorsPage.toasts.failedDelete"))
    }
  }

  if (monitorsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      </div>
    )
  }

  const isFormValid = formState.name.trim() && formState.suite_id && formState.locations.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("monitorsPage.title")}
        description={t("monitorsPage.description")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t("monitorsPage.newMonitor")}
          </Button>
        }
      />

      {/* Search bar */}
      {monitors.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("monitorsPage.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Monitor cards */}
      {monitors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MonitorCheck className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">
              {t("monitorsPage.noMonitors")}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {t("monitorsPage.noMonitorsDescription")}
            </p>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t("monitorsPage.newMonitor")}
            </Button>
          </CardContent>
        </Card>
      ) : filteredMonitors.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t("monitorsPage.noMonitorsFound", { search })}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMonitors.map((monitor) => {
            const statusConf = STATUS_CONFIG[monitor.last_status] || STATUS_CONFIG.unknown
            const StatusIcon = statusConf.icon
            const suite = suites.find((s) => s.id === monitor.suite_id)
            const notifyCount = (monitor.notify_contact_ids || []).length

            return (
              <Card key={monitor.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`shrink-0 ${statusConf.color}`}>
                        <StatusIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm truncate">{monitor.name}</CardTitle>
                        {monitor.description && (
                          <CardDescription className="text-xs line-clamp-1 mt-0.5">
                            {monitor.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={monitor.enabled}
                      onCheckedChange={(enabled) => handleToggle(monitor.id, enabled)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Uptime */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{t("monitorsPage.uptime")}</span>
                      <span className="font-medium">
                        {monitor.uptime_pct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          monitor.uptime_pct >= 99
                            ? "bg-emerald-500"
                            : monitor.uptime_pct >= 95
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(100, monitor.uptime_pct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/50 rounded px-2 py-1.5">
                      <span className="text-muted-foreground block">{t("monitorsPage.interval")}</span>
                      <span className="font-medium">{formatInterval(monitor.interval_sec)}</span>
                    </div>
                    <div className="bg-muted/50 rounded px-2 py-1.5">
                      <span className="text-muted-foreground block">{t("monitorsPage.consecutiveFails")}</span>
                      <span
                        className={`font-medium ${
                          monitor.consecutive_fail > 0 ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {monitor.consecutive_fail}
                      </span>
                    </div>
                  </div>

                  {/* Suite reference */}
                  {suite && (
                    <div className="text-xs text-muted-foreground">
                      Suite: <span className="font-medium text-foreground">{suite.name}</span>
                    </div>
                  )}

                  {/* Locations + Notification badge */}
                  <div className="flex flex-wrap gap-1 items-center">
                    {monitor.locations.map((loc) => (
                      <Badge key={loc} variant="outline" className="text-[10px] px-1.5 py-0">
                        {loc}
                      </Badge>
                    ))}
                    {notifyCount > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-600 border-blue-500/30">
                              <Bell className="h-2.5 w-2.5 mr-0.5" />
                              {notifyCount}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{t("monitorsPage.notificationCount", { count: notifyCount })}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {monitor.last_run_at
                        ? formatRelativeTime(monitor.last_run_at)
                        : t("monitorsPage.neverRun")}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => openEdit(monitor)}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        {tc("edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(monitor)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        {tc("delete")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("monitorsPage.createDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("monitorsPage.createDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <MonitorForm
            suites={suites}
            contacts={contacts}
            formState={formState}
            setFormState={setFormState}
            t={t}
            tc={tc}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={submitting || !isFormValid}>
              {submitting ? t("monitorsPage.creating") : t("monitorsPage.createMonitor")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("monitorsPage.editDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("monitorsPage.editDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <MonitorForm
            suites={suites}
            contacts={contacts}
            formState={formState}
            setFormState={setFormState}
            t={t}
            tc={tc}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleUpdate} disabled={submitting || !isFormValid}>
              {submitting ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("monitorsPage.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("monitorsPage.deleteDialog.description", { name: deleteTarget?.name || "" })}
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
