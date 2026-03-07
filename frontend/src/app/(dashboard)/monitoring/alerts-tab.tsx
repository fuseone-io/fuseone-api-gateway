"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  Clock,
  ExternalLink,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { api } from "@/lib/api-client"
import { useAlertStore } from "@/stores/alert-store"
import type { AlertRule, AlertEvent, CreateAlertRuleRequest } from "@/types/alert"
import type { NotificationContact } from "@/types/notification-contact"
import { toast } from "sonner"

function formatThreshold(ruleType: string, value: number): string {
  if (ruleType === "error_rate" || ruleType === "traffic_drop") {
    return `${(value * 100).toFixed(1)}%`
  }
  if (ruleType === "token_budget") {
    return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M tokens` : `${value.toLocaleString()} tokens`
  }
  if (ruleType === "cost_budget") {
    return `$${value.toFixed(2)}`
  }
  return `${value.toFixed(0)} ms`
}

export function AlertsTab() {
  const t = useTranslations("monitoring")
  const tc = useTranslations("common")

  function StateBadge({ state }: { state: AlertRule["state"] }) {
    switch (state) {
      case "firing":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {t("alerts.state.firing")}
          </Badge>
        )
      case "acknowledged":
        return (
          <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-600 border-amber-200">
            <Clock className="h-3 w-3" />
            {t("alerts.state.acknowledged")}
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-200">
            <Check className="h-3 w-3" />
            {t("alerts.state.ok")}
          </Badge>
        )
    }
  }

  const RULE_TYPE_LABELS: Record<string, string> = {
    error_rate: t("alerts.ruleType.errorRate"),
    latency_p99: t("alerts.ruleType.latency"),
    traffic_drop: t("alerts.ruleType.trafficDrop"),
    token_budget: t("alerts.ruleType.tokenBudget"),
    cost_budget: t("alerts.ruleType.costBudget"),
  }

  const SCOPE_TYPE_LABELS: Record<string, string> = {
    global: t("alerts.scopeType.global"),
    route: t("alerts.scopeType.route"),
    consumer: t("alerts.scopeType.consumer"),
  }

  const [rules, setRules] = useState<AlertRule[]>([])
  const [events, setEvents] = useState<AlertEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedRule, setSelectedRule] = useState<string | null>(null)
  const refreshFiringCount = useAlertStore((s) => s.refresh)

  const fetchData = useCallback(async () => {
    try {
      const [r, e] = await Promise.all([
        api.listAlertRules(),
        api.listAlertEvents({ limit: 50 }),
      ])
      setRules(r)
      setEvents(e)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("alerts.failedToLoad"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAcknowledge = async (id: string) => {
    try {
      await api.acknowledgeAlert(id)
      toast.success(t("alerts.alertAcknowledged"))
      fetchData()
      refreshFiringCount()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("alerts.failedToAcknowledge"))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAlertRule(id)
      toast.success(t("alerts.alertRuleDeleted"))
      fetchData()
      refreshFiringCount()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("alerts.failedToDelete"))
    }
  }

  const handleToggleEnabled = async (rule: AlertRule) => {
    try {
      await api.updateAlertRule(rule.id, { enabled: !rule.enabled })
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("alerts.failedToUpdate"))
    }
  }

  const handleRuleCreated = () => {
    setShowCreate(false)
    fetchData()
    refreshFiringCount()
  }

  const filteredEvents = selectedRule
    ? events.filter((e) => e.rule_id === selectedRule)
    : events

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchData() }}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            {tc("refresh")}
          </Button>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t("alerts.newRule")}
        </Button>
      </div>

      {/* Rules Table */}
      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BellOff className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium">{t("alerts.noRulesConfigured")}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {t("alerts.noRulesDescription")}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t("alerts.createFirstRule")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("alerts.alertRules")}</CardTitle>
            <CardDescription>{t("alerts.rulesConfigured", { count: rules.length })}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("alerts.tableHeaders.name")}</TableHead>
                  <TableHead>{t("alerts.tableHeaders.type")}</TableHead>
                  <TableHead>{t("alerts.tableHeaders.scope")}</TableHead>
                  <TableHead>{t("alerts.tableHeaders.threshold")}</TableHead>
                  <TableHead>{t("alerts.tableHeaders.window")}</TableHead>
                  <TableHead>{t("alerts.tableHeaders.channels")}</TableHead>
                  <TableHead>{t("alerts.tableHeaders.state")}</TableHead>
                  <TableHead>{t("alerts.tableHeaders.enabled")}</TableHead>
                  <TableHead className="text-right">{t("alerts.tableHeaders.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id} className={rule.state === "firing" ? "bg-red-500/5" : ""}>
                    <TableCell>
                      <button
                        className="font-medium text-sm hover:underline text-left"
                        onClick={() => setSelectedRule(selectedRule === rule.id ? null : rule.id)}
                      >
                        {rule.name}
                      </button>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{rule.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type}
                    </TableCell>
                    <TableCell className="text-xs">
                      {SCOPE_TYPE_LABELS[rule.scope_type] || rule.scope_type}
                      {rule.scope_ids.length > 0 && (
                        <span className="text-muted-foreground ml-1">({rule.scope_ids.length})</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatThreshold(rule.rule_type, rule.threshold)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{rule.eval_window}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {rule.channels.length === 0 ? (
                          <span className="text-xs text-muted-foreground">-</span>
                        ) : (
                          rule.channels.map((ch, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] px-1.5">
                              {ch.type}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell><StateBadge state={rule.state} /></TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => handleToggleEnabled(rule)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {rule.state === "firing" && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleAcknowledge(rule.id)}>
                            <Check className="h-3 w-3 mr-1" />
                            Ack
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(rule.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Event History */}
      {events.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t("alerts.eventHistory")}</CardTitle>
                <CardDescription>
                  {selectedRule ? t("alerts.filteredByRule") : t("alerts.recentEvents")}
                </CardDescription>
              </div>
              {selectedRule && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedRule(null)}>
                  {t("alerts.clearFilter")}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("alerts.tableHeaders.time")}</TableHead>
                  <TableHead>{t("alerts.tableHeaders.event")}</TableHead>
                  <TableHead>{t("alerts.tableHeaders.message")}</TableHead>
                  <TableHead className="text-right">{t("alerts.tableHeaders.value")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.slice(0, 20).map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(event.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={event.event_type === "fired" ? "destructive" : event.event_type === "resolved" ? "secondary" : "outline"}
                        className="text-xs"
                      >
                        {event.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[300px] truncate">
                      {event.message}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {event.value != null ? event.value.toFixed(4) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create Rule Dialog */}
      <CreateRuleDialog open={showCreate} onOpenChange={setShowCreate} onCreated={handleRuleCreated} t={t} tc={tc} />
    </div>
  )
}

type ChannelFormEntry = {
  type: "webhook" | "slack" | "teams"
  url: string
  channel?: string
}

const CHANNEL_LABELS: Record<string, string> = {
  webhook: "Webhook",
  slack: "Slack",
  teams: "Microsoft Teams",
}

const CHANNEL_PLACEHOLDERS: Record<string, string> = {
  webhook: "https://hooks.example.com/alerts",
  slack: "https://hooks.slack.com/services/...",
  teams: "https://outlook.office.com/webhook/...",
}

function channelEntryToAlertChannel(entry: ChannelFormEntry): import("@/types/alert").AlertChannel | null {
  if (!entry.url.trim()) return null
  switch (entry.type) {
    case "slack":
      return { type: "slack", config: { webhook_url: entry.url.trim(), ...(entry.channel ? { channel: entry.channel } : {}) } }
    case "teams":
      return { type: "teams", config: { webhook_url: entry.url.trim() } }
    default:
      return { type: "webhook", config: { url: entry.url.trim() } }
  }
}

function CreateRuleDialog({
  open,
  onOpenChange,
  onCreated,
  t,
  tc,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
  t: ReturnType<typeof useTranslations<"monitoring">>
  tc: ReturnType<typeof useTranslations<"common">>
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [ruleType, setRuleType] = useState<AlertRule["rule_type"]>("error_rate")
  const [scopeType, setScopeType] = useState<AlertRule["scope_type"]>("global")
  const [threshold, setThreshold] = useState("")
  const [evalWindow, setEvalWindow] = useState<AlertRule["eval_window"]>("5m")
  const [channels, setChannels] = useState<ChannelFormEntry[]>([])
  const [saving, setSaving] = useState(false)

  // Saved notification contacts
  const [savedContacts, setSavedContacts] = useState<NotificationContact[]>([])
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      api.listNotificationContacts()
        .then((data) => setSavedContacts(data.filter((c) => c.enabled)))
        .catch(() => {})
    }
  }, [open])

  const toggleContact = (id: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addChannel = (type: ChannelFormEntry["type"]) => {
    setChannels([...channels, { type, url: "" }])
  }

  const updateChannel = (idx: number, field: keyof ChannelFormEntry, value: string) => {
    setChannels(channels.map((ch, i) => i === idx ? { ...ch, [field]: value } : ch))
  }

  const removeChannel = (idx: number) => {
    setChannels(channels.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t("alerts.createDialog.nameRequired"))
      return
    }
    const thresholdNum = parseFloat(threshold)
    if (isNaN(thresholdNum) || thresholdNum <= 0) {
      toast.error(t("alerts.createDialog.thresholdPositive"))
      return
    }

    const actualThreshold = (ruleType === "error_rate" || ruleType === "traffic_drop")
      ? thresholdNum / 100
      : thresholdNum

    const fromSavedContacts = savedContacts
      .filter((c) => selectedContactIds.has(c.id))
      .map((c): import("@/types/alert").AlertChannel => ({ type: c.type, config: c.config }))

    const fromCustom = channels
      .map(channelEntryToAlertChannel)
      .filter((ch): ch is import("@/types/alert").AlertChannel => ch !== null)

    const alertChannels = [...fromSavedContacts, ...fromCustom]

    setSaving(true)
    try {
      const data: CreateAlertRuleRequest = {
        name: name.trim(),
        description: description.trim(),
        rule_type: ruleType,
        scope_type: scopeType,
        threshold: actualThreshold,
        eval_window: evalWindow,
        channels: alertChannels,
      }
      await api.createAlertRule(data)
      toast.success(t("alerts.alertRuleCreated"))
      onCreated()
      setName("")
      setDescription("")
      setRuleType("error_rate")
      setScopeType("global")
      setThreshold("")
      setEvalWindow("5m")
      setChannels([])
      setSelectedContactIds(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("alerts.failedToCreate"))
    } finally {
      setSaving(false)
    }
  }

  const thresholdLabel = ruleType === "error_rate"
    ? t("alerts.createDialog.thresholdPct")
    : ruleType === "traffic_drop"
    ? t("alerts.createDialog.dropThresholdPct")
    : ruleType === "token_budget"
    ? t("alerts.createDialog.tokenLimit")
    : ruleType === "cost_budget"
    ? t("alerts.createDialog.costLimitUsd")
    : t("alerts.createDialog.thresholdMs")

  const thresholdPlaceholder = ruleType === "error_rate"
    ? t("alerts.createDialog.placeholderErrorRate")
    : ruleType === "traffic_drop"
    ? t("alerts.createDialog.placeholderDrop")
    : ruleType === "token_budget"
    ? t("alerts.createDialog.placeholderTokens")
    : ruleType === "cost_budget"
    ? t("alerts.createDialog.placeholderCost")
    : t("alerts.createDialog.placeholderMs")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {t("alerts.createDialog.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label>{t("alerts.createDialog.nameLabel")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("alerts.createDialog.namePlaceholder")} />
          </div>
          <div className="space-y-2">
            <Label>{t("alerts.createDialog.descriptionLabel")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("alerts.createDialog.descriptionPlaceholder")} className="min-h-[60px]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("alerts.createDialog.metric")}</Label>
              <Select value={ruleType} onValueChange={(v) => setRuleType(v as AlertRule["rule_type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="error_rate">{t("alerts.ruleType.errorRate")}</SelectItem>
                  <SelectItem value="latency_p99">{t("alerts.ruleType.latency")}</SelectItem>
                  <SelectItem value="traffic_drop">{t("alerts.ruleType.trafficDrop")}</SelectItem>
                  <SelectItem value="token_budget">{t("alerts.ruleType.tokenBudget")}</SelectItem>
                  <SelectItem value="cost_budget">{t("alerts.ruleType.costBudget")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("alerts.createDialog.scope")}</Label>
              <Select value={scopeType} onValueChange={(v) => setScopeType(v as AlertRule["scope_type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">{t("alerts.scopeType.global")}</SelectItem>
                  <SelectItem value="route">{t("alerts.scopeType.route")}</SelectItem>
                  <SelectItem value="consumer">{t("alerts.scopeType.consumer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{thresholdLabel}</Label>
              <Input value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder={thresholdPlaceholder} type="number" step="any" />
            </div>
            <div className="space-y-2">
              <Label>{t("alerts.createDialog.evalWindow")}</Label>
              <Select value={evalWindow} onValueChange={(v) => setEvalWindow(v as AlertRule["eval_window"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">1 min</SelectItem>
                  <SelectItem value="5m">5 min</SelectItem>
                  <SelectItem value="15m">15 min</SelectItem>
                  <SelectItem value="30m">30 min</SelectItem>
                  <SelectItem value="1h">1 hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notification Channels */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("alerts.createDialog.notificationChannels")}</Label>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" asChild>
                <Link href="/settings" target="_blank">
                  <Settings className="h-3 w-3" />
                  {t("alerts.createDialog.manageChannels")}
                  <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              </Button>
            </div>

            {savedContacts.length > 0 ? (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t("alerts.createDialog.selectChannels")}</p>
                {savedContacts.map((contact) => (
                  <label
                    key={contact.id}
                    className="flex items-center gap-2.5 cursor-pointer py-1 hover:bg-muted/50 rounded px-1 -mx-1"
                  >
                    <input
                      type="checkbox"
                      checked={selectedContactIds.has(contact.id)}
                      onChange={() => toggleContact(contact.id)}
                      className="rounded border-muted-foreground/30"
                    />
                    <span className="text-sm flex-1">{contact.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5">
                      {contact.type}
                    </Badge>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-center">
                <Bell className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs font-medium">{t("alerts.createDialog.noChannelsConfigured")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("alerts.createDialog.noChannelsDescription")}
                </p>
                <Button variant="outline" size="sm" className="h-7 text-xs mt-3 gap-1.5" asChild>
                  <Link href="/settings" target="_blank">
                    <Settings className="h-3 w-3" />
                    {t("alerts.createDialog.goToSettings")}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                </Button>
              </div>
            )}

            {savedContacts.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{t("alerts.createDialog.addOneOff")}</p>
                  <div className="flex gap-1">
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => addChannel("slack")}>
                      + Slack
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => addChannel("teams")}>
                      + Teams
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => addChannel("webhook")}>
                      + Webhook
                    </Button>
                  </div>
                </div>
                {channels.map((ch, idx) => (
                  <div key={idx} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {CHANNEL_LABELS[ch.type]}
                      </Badge>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeChannel(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input
                      value={ch.url}
                      onChange={(e) => updateChannel(idx, "url", e.target.value)}
                      placeholder={CHANNEL_PLACEHOLDERS[ch.type]}
                      className="text-sm"
                    />
                    {ch.type === "slack" && (
                      <Input
                        value={ch.channel || ""}
                        onChange={(e) => updateChannel(idx, "channel", e.target.value)}
                        placeholder="#channel (optional override)"
                        className="text-sm"
                      />
                    )}
                  </div>
                ))}
              </>
            )}

            {selectedContactIds.size === 0 && channels.length === 0 && savedContacts.length > 0 && (
              <p className="text-xs text-muted-foreground">{t("alerts.createDialog.noChannelsSelected")}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? t("alerts.createDialog.creating") : t("alerts.createDialog.createRule")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
