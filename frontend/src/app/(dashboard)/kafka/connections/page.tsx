"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { PageHeader } from "@/components/page-header"
import { useKafkaStore } from "@/stores/kafka-store"
import type { KafkaConnection } from "@/types/kafka"

const SECURITY_PROTOCOLS = ["PLAINTEXT", "SSL", "SASL_PLAINTEXT", "SASL_SSL"]
const SASL_MECHANISMS = ["PLAIN", "SCRAM-SHA-256", "SCRAM-SHA-512", "OAUTHBEARER"]

interface FormState {
  name: string
  description: string
  brokers: string
  security_protocol: string
  sasl_mechanism: string
  sasl_username: string
  sasl_password: string
  is_active: boolean
}

const emptyForm: FormState = {
  name: "",
  description: "",
  brokers: "",
  security_protocol: "PLAINTEXT",
  sasl_mechanism: "PLAIN",
  sasl_username: "",
  sasl_password: "",
  is_active: true,
}

function isSaslProtocol(protocol: string): boolean {
  return protocol === "SASL_PLAINTEXT" || protocol === "SASL_SSL"
}

export default function KafkaConnectionsPage() {
  const t = useTranslations("kafka.connections")
  const tc = useTranslations("common")
  const { connections, loadingConnections, fetchConnections, createConnection, updateConnection, deleteConnection } = useKafkaStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<KafkaConnection | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  const handleOpenCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const handleOpenEdit = (conn: KafkaConnection) => {
    setEditingId(conn.id)
    setForm({
      name: conn.name,
      description: conn.description || "",
      brokers: conn.brokers.join(", "),
      security_protocol: conn.security_protocol,
      sasl_mechanism: conn.sasl_mechanism || "PLAIN",
      sasl_username: conn.sasl_username || "",
      sasl_password: conn.sasl_password || "",
      is_active: conn.is_active,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t("nameRequired"))
      return
    }

    const brokers = form.brokers
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean)

    if (brokers.length === 0) {
      toast.error(t("brokersRequired"))
      return
    }

    const payload: Partial<KafkaConnection> = {
      name: form.name.trim(),
      description: form.description.trim(),
      brokers,
      security_protocol: form.security_protocol,
      is_active: form.is_active,
    }

    if (isSaslProtocol(form.security_protocol)) {
      payload.sasl_mechanism = form.sasl_mechanism
      payload.sasl_username = form.sasl_username
      payload.sasl_password = form.sasl_password
    }

    setSaving(true)
    try {
      if (editingId) {
        await updateConnection(editingId, payload)
        toast.success(t("connectionUpdated"))
      } else {
        await createConnection(payload)
        toast.success(t("connectionCreated"))
      }
      setDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteConnection(deleteTarget.id)
      toast.success(t("connectionDeleted"))
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("deleteFailed"))
    }
  }

  if (loadingConnections) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/kafka">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {tc("back")}
              </Link>
            </Button>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t("createConnection")}
            </Button>
          </div>
        }
      />

      {/* Connections table */}
      {connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg font-medium text-muted-foreground mb-2">
              {t("noConnections")}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {t("noConnectionsDescription")}
            </p>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t("createConnection")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tc("name")}</TableHead>
                <TableHead>{tc("description")}</TableHead>
                <TableHead>{t("brokers")}</TableHead>
                <TableHead>{t("protocol")}</TableHead>
                <TableHead className="w-[100px] text-center">{tc("status")}</TableHead>
                <TableHead className="w-[120px]">{tc("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.map((conn) => (
                <TableRow key={conn.id}>
                  <TableCell className="font-medium">{conn.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                    {conn.description || "-"}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs font-mono text-muted-foreground">
                      {conn.brokers.join(", ")}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {conn.security_protocol}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {conn.is_active ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700">{tc("active")}</Badge>
                    ) : (
                      <Badge variant="secondary">{tc("disabled")}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleOpenEdit(conn)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(conn)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingId ? t("editConnection") : t("newConnection")}</DialogTitle>
            <DialogDescription>
              {editingId
                ? t("editConnectionDescription")
                : t("newConnectionDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="conn-name">{tc("name")} *</Label>
              <Input
                id="conn-name"
                placeholder={t("namePlaceholder")}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="conn-desc">{tc("description")}</Label>
              <Input
                id="conn-desc"
                placeholder={t("descriptionPlaceholder")}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="conn-brokers">{t("brokersLabel")} *</Label>
              <Textarea
                id="conn-brokers"
                placeholder="broker1:9092, broker2:9092"
                rows={2}
                value={form.brokers}
                onChange={(e) => setForm((f) => ({ ...f, brokers: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("securityProtocol")}</Label>
              <Select
                value={form.security_protocol}
                onValueChange={(v) => setForm((f) => ({ ...f, security_protocol: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECURITY_PROTOCOLS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isSaslProtocol(form.security_protocol) && (
              <>
                <div className="space-y-2">
                  <Label>{t("saslMechanism")}</Label>
                  <Select
                    value={form.sasl_mechanism}
                    onValueChange={(v) => setForm((f) => ({ ...f, sasl_mechanism: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SASL_MECHANISMS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="conn-sasl-user">{t("saslUsername")}</Label>
                    <Input
                      id="conn-sasl-user"
                      value={form.sasl_username}
                      onChange={(e) => setForm((f) => ({ ...f, sasl_username: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conn-sasl-pass">{t("saslPassword")}</Label>
                    <Input
                      id="conn-sasl-pass"
                      type="password"
                      value={form.sasl_password}
                      onChange={(e) => setForm((f) => ({ ...f, sasl_password: e.target.value }))}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center gap-3">
              <Switch
                id="conn-active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked }))}
              />
              <Label htmlFor="conn-active" className="cursor-pointer">
                {t("connectionActive")}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? tc("saving") : editingId ? tc("save") : tc("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirm", { name: deleteTarget?.name ?? "" })}
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
