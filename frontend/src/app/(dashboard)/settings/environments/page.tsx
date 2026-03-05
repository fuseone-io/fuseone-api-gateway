"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  Star,
  Plug,
  Loader2,
  CheckCircle2,
  XCircle,
  Server,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
import { api } from "@/lib/api-client"
import { useEnvironmentStore } from "@/stores/environment-store"
import type { Environment, CreateEnvironmentRequest, UpdateEnvironmentRequest } from "@/types/environment"

const ENV_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#6b7280", // gray
]

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export default function EnvironmentsContent() {
  const { environments, fetchEnvironments } = useEnvironmentStore()
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Environment | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Environment | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState("")
  const [color, setColor] = useState(ENV_COLORS[0])
  const [adminUrl, setAdminUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [controlUrl, setControlUrl] = useState("")
  const [metricsUrl, setMetricsUrl] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      await fetchEnvironments()
    } finally {
      setLoading(false)
    }
  }, [fetchEnvironments])

  useEffect(() => {
    load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setName("")
    setSlug("")
    setSlugTouched(false)
    setDescription("")
    setColor(ENV_COLORS[Math.floor(Math.random() * ENV_COLORS.length)])
    setAdminUrl("")
    setApiKey("")
    setControlUrl("")
    setMetricsUrl("")
    setDialogOpen(true)
  }

  function openEdit(env: Environment) {
    setEditing(env)
    setName(env.name)
    setSlug(env.slug)
    setSlugTouched(true)
    setDescription(env.description)
    setColor(env.color)
    setAdminUrl(env.admin_url)
    setApiKey("")
    setControlUrl(env.control_url)
    setMetricsUrl(env.metrics_url)
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editing) {
        const data: UpdateEnvironmentRequest = {
          name,
          slug,
          description,
          color,
          admin_url: adminUrl,
          control_url: controlUrl,
          metrics_url: metricsUrl,
        }
        if (apiKey) data.api_key = apiKey
        await api.updateEnvironment(editing.id, data)
      } else {
        const data: CreateEnvironmentRequest = {
          name,
          slug: slug || slugify(name),
          description,
          color,
          admin_url: adminUrl,
          api_key: apiKey,
          control_url: controlUrl,
          metrics_url: metricsUrl,
        }
        await api.createEnvironment(data)
      }
      setDialogOpen(false)
      load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save environment")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await api.deleteEnvironment(deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete environment")
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await api.setDefaultEnvironment(id)
      load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to set default")
    }
  }

  async function handleTestConnection(id: string) {
    setTesting(id)
    setTestResult(null)
    try {
      const result = await api.testEnvironmentConnection(id)
      setTestResult({ id, success: result.success, message: result.message })
    } catch (err: unknown) {
      setTestResult({ id, success: false, message: err instanceof Error ? err.message : "Connection failed" })
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Environments</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configure multiple API Gateway environments (dev, staging, production)
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Add Environment
        </Button>
      </div>

      {loading && environments.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : environments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No environments configured yet.</p>
          <p className="text-sm">Create your first environment to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {environments.map((env) => (
            <div
              key={env.id}
              className="flex items-center gap-4 rounded-lg border p-4"
            >
              <Server
                className="h-4 w-4 shrink-0"
                style={{ color: env.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{env.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{env.slug}</span>
                  {env.is_default && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600">
                      Default
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {env.admin_url}
                </p>
              </div>

              {testResult?.id === env.id && (
                <div className="flex items-center gap-1.5 text-xs">
                  {testResult.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  <span className={testResult.success ? "text-emerald-600" : "text-destructive"}>
                    {testResult.message}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleTestConnection(env.id)}
                  disabled={testing === env.id}
                  title="Test connection"
                >
                  {testing === env.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plug className="h-4 w-4" />
                  )}
                </Button>
                {!env.is_default && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleSetDefault(env.id)}
                    title="Set as default"
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(env)}
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {!env.is_default && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(env)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Sheet */}
      <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Environment" : "New Environment"}</SheetTitle>
            <SheetDescription>
              {editing
                ? "Update the environment configuration."
                : "Add a new API Gateway environment."}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto space-y-4 px-4">
            <div className="grid gap-2">
              <Label htmlFor="env-name">Name</Label>
              <Input
                id="env-name"
                placeholder="e.g. Production"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (!slugTouched) setSlug(slugify(e.target.value))
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="env-slug">Slug</Label>
              <Input
                id="env-slug"
                placeholder="e.g. production"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value)
                  setSlugTouched(true)
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {ENV_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="h-6 w-6 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? "var(--foreground)" : "transparent",
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="env-desc">Description</Label>
              <Input
                id="env-desc"
                placeholder="Optional description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Separator />
            <div className="grid gap-2">
              <Label htmlFor="env-admin-url">Admin API URL</Label>
              <Input
                id="env-admin-url"
                placeholder="http://apisix:9180"
                value={adminUrl}
                onChange={(e) => setAdminUrl(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="env-api-key">
                API Key {editing && <span className="text-muted-foreground">(leave empty to keep current)</span>}
              </Label>
              <Input
                id="env-api-key"
                type="password"
                placeholder={editing ? "••••••••" : "edd1c9f034335f136f87ad84b625c8f1"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="env-control-url">Control API URL (optional)</Label>
              <Input
                id="env-control-url"
                placeholder="http://apisix:9090"
                value={controlUrl}
                onChange={(e) => setControlUrl(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="env-metrics-url">Metrics URL (optional)</Label>
              <Input
                id="env-metrics-url"
                placeholder="http://apisix:9091"
                value={metricsUrl}
                onChange={(e) => setMetricsUrl(e.target.value)}
              />
            </div>
          </div>
          <SheetFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name || !adminUrl}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Save Changes" : "Create Environment"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete environment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the &quot;{deleteTarget?.name}&quot; environment.
              APIs deployed to this environment will no longer be accessible through it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
