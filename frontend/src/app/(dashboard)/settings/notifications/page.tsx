"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Bell,
  Hash,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  Webhook,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  CardDescription,
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
import type {
  NotificationContact,
  CreateNotificationContactRequest,
} from "@/types/notification-contact"
import { toast } from "sonner"

const TYPE_LABELS: Record<string, string> = {
  webhook: "Webhook",
  slack: "Slack",
  teams: "Microsoft Teams",
  email: "Email",
}

const TYPE_COLORS: Record<string, string> = {
  webhook: "bg-blue-500/10 text-blue-600 border-blue-200",
  slack: "bg-purple-500/10 text-purple-600 border-purple-200",
  teams: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
  email: "bg-amber-500/10 text-amber-600 border-amber-200",
}

function getConfigSummary(contact: NotificationContact): string {
  switch (contact.type) {
    case "slack":
      return (contact.config.webhook_url as string) || ""
    case "teams":
      return (contact.config.webhook_url as string) || ""
    case "webhook":
      return (contact.config.url as string) || ""
    case "email":
      return ((contact.config.to as string[]) || []).join(", ")
    default:
      return ""
  }
}

export default function NotificationsContent() {
  const [contacts, setContacts] = useState<NotificationContact[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingContact, setEditingContact] = useState<NotificationContact | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const data = await api.listNotificationContacts()
      setContacts(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load contacts")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDelete = async (id: string) => {
    try {
      await api.deleteNotificationContact(id)
      toast.success("Contact deleted")
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  const handleToggleEnabled = async (contact: NotificationContact) => {
    try {
      await api.updateNotificationContact(contact.id, { enabled: !contact.enabled })
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    }
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    try {
      await api.testNotificationContact(id)
      toast.success("Test notification sent successfully!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed")
    } finally {
      setTestingId(null)
    }
  }

  const handleEdit = (contact: NotificationContact) => {
    setEditingContact(contact)
    setShowDialog(true)
  }

  const handleDialogClose = () => {
    setShowDialog(false)
    setEditingContact(null)
  }

  const handleSaved = () => {
    handleDialogClose()
    fetchData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Notification Channels</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configure reusable notification channels for alerts and system events
          </p>
        </div>
        <Button size="sm" onClick={() => setShowDialog(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Channel
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="py-12 text-center rounded-lg border border-dashed bg-muted/30">
          <Bell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">No notification channels configured</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Add Slack, Teams, or webhook channels to receive alert notifications.
            Channels configured here can be reused across multiple alert rules.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowDialog(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add First Channel
          </Button>
        </div>
      ) : (
        <div>
          <div className="mb-3">
            <CardTitle className="text-base">Channels</CardTitle>
            <CardDescription>{contacts.length} channel{contacts.length !== 1 ? "s" : ""} configured</CardDescription>
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Webhook className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm">{contact.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${TYPE_COLORS[contact.type] || ""}`}>
                        {TYPE_LABELS[contact.type] || contact.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground font-mono truncate max-w-[300px] block">
                        {getConfigSummary(contact)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={contact.enabled}
                        onCheckedChange={() => handleToggleEnabled(contact)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleTest(contact.id)}
                          disabled={testingId === contact.id}
                        >
                          {testingId === contact.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3 mr-1" />
                          )}
                          Test
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(contact)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(contact.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <ContactDialog
        open={showDialog}
        onOpenChange={(open) => { if (!open) handleDialogClose() }}
        onSaved={handleSaved}
        editingContact={editingContact}
      />
    </div>
  )
}

function ContactDialog({
  open,
  onOpenChange,
  onSaved,
  editingContact,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  editingContact: NotificationContact | null
}) {
  const [name, setName] = useState("")
  const [type, setType] = useState<NotificationContact["type"]>("slack")
  const [url, setUrl] = useState("")
  const [slackChannel, setSlackChannel] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  // Populate form when editing
  useEffect(() => {
    if (editingContact) {
      setName(editingContact.name)
      setType(editingContact.type)
      setEnabled(editingContact.enabled)
      if (editingContact.type === "slack") {
        setUrl((editingContact.config.webhook_url as string) || "")
        setSlackChannel((editingContact.config.channel as string) || "")
      } else if (editingContact.type === "teams") {
        setUrl((editingContact.config.webhook_url as string) || "")
      } else if (editingContact.type === "webhook") {
        setUrl((editingContact.config.url as string) || "")
      }
    } else {
      setName("")
      setType("slack")
      setUrl("")
      setSlackChannel("")
      setEnabled(true)
    }
  }, [editingContact, open])

  const buildConfig = (): Record<string, unknown> => {
    switch (type) {
      case "slack":
        return { webhook_url: url.trim(), ...(slackChannel ? { channel: slackChannel } : {}) }
      case "teams":
        return { webhook_url: url.trim() }
      case "webhook":
        return { url: url.trim() }
      default:
        return {}
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    if (!url.trim()) {
      toast.error("URL is required")
      return
    }

    setSaving(true)
    try {
      if (editingContact) {
        await api.updateNotificationContact(editingContact.id, {
          name: name.trim(),
          type,
          config: buildConfig(),
          enabled,
        })
        toast.success("Channel updated")
      } else {
        const data: CreateNotificationContactRequest = {
          name: name.trim(),
          type,
          config: buildConfig(),
          enabled,
        }
        await api.createNotificationContact(data)
        toast.success("Channel created")
      }
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const urlPlaceholder = type === "slack"
    ? "https://hooks.slack.com/services/..."
    : type === "teams"
    ? "https://outlook.office.com/webhook/..."
    : "https://hooks.example.com/alerts"

  const urlLabel = type === "slack" || type === "teams"
    ? "Webhook URL"
    : "URL"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {editingContact ? "Edit Channel" : "New Notification Channel"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., #ops-alerts, DevOps Webhook" />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as NotificationContact["type"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="slack">
                  <span className="flex items-center gap-2"><Hash className="h-3.5 w-3.5" /> Slack</span>
                </SelectItem>
                <SelectItem value="teams">
                  <span className="flex items-center gap-2"><Hash className="h-3.5 w-3.5" /> Microsoft Teams</span>
                </SelectItem>
                <SelectItem value="webhook">
                  <span className="flex items-center gap-2"><Webhook className="h-3.5 w-3.5" /> Webhook</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{urlLabel}</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={urlPlaceholder} />
          </div>
          {type === "slack" && (
            <div className="space-y-2">
              <Label>Channel Override (optional)</Label>
              <Input value={slackChannel} onChange={(e) => setSlackChannel(e.target.value)} placeholder="#channel" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} id="contact-enabled" />
            <Label htmlFor="contact-enabled" className="text-sm cursor-pointer">Enabled</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : editingContact ? "Save Changes" : "Create Channel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
