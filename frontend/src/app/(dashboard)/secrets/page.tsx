"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  Plus,
  Trash2,
  MoreHorizontal,
  KeyRound,
  Search,
  Eye,
  EyeOff,
  Copy,
  Pencil,
  Server,
  CloudCog,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { api } from "@/lib/api-client"
import type { Secret, SecretManager } from "@/types/api"

// --- Secret Manager type labels ---

const MANAGER_TYPE_LABELS: Record<string, { label: string; description: string }> = {
  vault: { label: "HashiCorp Vault", description: "Store secrets in HashiCorp Vault" },
  aws: { label: "AWS Secrets Manager", description: "Store secrets in AWS Secrets Manager" },
  gcp: { label: "GCP Secret Manager", description: "Store secrets in Google Cloud Secret Manager" },
  env: { label: "Environment Variables", description: "Reference environment variables on the gateway" },
}

// --- Main Page ---

export default function SecretsPage() {
  const t = useTranslations("secrets")
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={<KeyRound className="h-6 w-6" />}
      />

      <Tabs defaultValue="local" className="space-y-6">
        <TabsList variant="line">
          <TabsTrigger value="local" className="gap-2">
            <KeyRound className="h-4 w-4" />
            {t("localSecrets")}
          </TabsTrigger>
          <TabsTrigger value="managers" className="gap-2">
            <CloudCog className="h-4 w-4" />
            {t("externalManagers")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="local">
          <LocalSecretsTab />
        </TabsContent>

        <TabsContent value="managers">
          <SecretManagersTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================================
// Local Secrets Tab
// ============================================================================

function LocalSecretsTab() {
  const t = useTranslations("secrets")
  const tc = useTranslations("common")
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [editSecret, setEditSecret] = useState<Secret | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetchSecrets = () => {
    setLoading(true)
    api
      .listSecrets()
      .then((res) => setSecrets(res.data || []))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchSecrets()
  }, [])

  const filtered = secrets.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api.deleteSecret(deleteId)
      toast.success(t("secretDeleted"))
      fetchSecrets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("deleteFailed"))
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchSecrets")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("newSecret")}
        </Button>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <p>
          {t("localSecretsInfo")}
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <KeyRound className="h-12 w-12 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            {search ? t("noSecretsSearch") : t("noSecretsYet")}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tc("name")}</TableHead>
                <TableHead>{tc("description")}</TableHead>
                <TableHead>{t("reference")}</TableHead>
                <TableHead>{t("tags")}</TableHead>
                <TableHead className="text-right">{t("created")}</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((secret) => (
                <TableRow key={secret.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-primary shrink-0" />
                      {secret.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {secret.description || "—"}
                  </TableCell>
                  <TableCell>
                    <SecretReference name={secret.name} />
                  </TableCell>
                  <TableCell>
                    {secret.tags?.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {secret.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {new Date(secret.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditSecret(secret)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(secret.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <SecretFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={fetchSecrets}
      />

      {/* Edit dialog */}
      {editSecret && (
        <SecretFormDialog
          open
          secret={editSecret}
          onClose={() => setEditSecret(null)}
          onSaved={fetchSecrets}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteSecret")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteSecretConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// --- Secret reference with copy button ---

function SecretReference({ name }: { name: string }) {
  const t = useTranslations("secrets")
  const ref = `$secret://local/${name}`

  const handleCopy = () => {
    navigator.clipboard.writeText(ref)
    toast.success(t("referenceCopied"))
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-1 font-mono text-xs hover:bg-muted/80 transition-colors"
    >
      <Copy className="h-3 w-3 text-muted-foreground" />
      {ref}
    </button>
  )
}

// --- Secret create/edit dialog ---

function SecretFormDialog({
  open,
  secret,
  onClose,
  onSaved,
}: {
  open: boolean
  secret?: Secret
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations("secrets")
  const tc = useTranslations("common")
  const isEdit = !!secret
  const [name, setName] = useState(secret?.name || "")
  const [description, setDescription] = useState(secret?.description || "")
  const [value, setValue] = useState("")
  const [tags, setTags] = useState(secret?.tags?.join(", ") || "")
  const [showValue, setShowValue] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t("nameRequired"))
      return
    }
    if (!isEdit && !value.trim()) {
      toast.error(t("valueRequired"))
      return
    }

    setSaving(true)
    try {
      const parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)

      if (isEdit) {
        await api.updateSecret(secret!.id, {
          description,
          value: value.trim() ? value : undefined,
          tags: parsedTags,
        })
        toast.success(t("secretUpdated"))
      } else {
        await api.createSecret({
          name: name.trim(),
          description,
          value,
          tags: parsedTags,
        })
        toast.success(t("secretCreated"))
      }
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editSecret") : t("newSecret")}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("editSecretDesc")
              : t("newSecretDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{tc("name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-api-key"
              disabled={isEdit}
            />
            {!isEdit && (
              <p className="text-xs text-muted-foreground">
                {t("nameHint")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{tc("description")}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label>{isEdit ? t("newValueOptional") : t("value")}</Label>
            <div className="relative">
              <Input
                type={showValue ? "text" : "password"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={isEdit ? t("leaveEmptyToKeep") : t("enterSecretValue")}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowValue((v) => !v)}
              >
                {showValue ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("tags")}</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t("tagsPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("tagsHint")}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? t("update") : tc("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Secret Managers Tab
// ============================================================================

function SecretManagersTab() {
  const t = useTranslations("secrets")
  const tc = useTranslations("common")
  const [managers, setManagers] = useState<SecretManager[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetchManagers = () => {
    setLoading(true)
    api
      .listSecretManagers()
      .then((data) => setManagers(data || []))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchManagers()
  }, [])

  const handleToggle = async (manager: SecretManager) => {
    try {
      await api.updateSecretManager(manager.id, { is_active: !manager.is_active })
      toast.success(manager.is_active ? t("managerDisabled") : t("managerEnabled"))
      fetchManagers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("updateFailed"))
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await api.deleteSecretManager(deleteId)
      toast.success(t("managerRemoved"))
      fetchManagers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("deleteFailed"))
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("externalManagersInfo")}
        </p>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("addManager")}
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : managers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <CloudCog className="h-12 w-12 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            {t("noManagersConfigured")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {managers.map((manager) => {
            const typeInfo = MANAGER_TYPE_LABELS[manager.type] || {
              label: manager.type,
              description: "",
            }
            return (
              <div
                key={manager.id}
                className="flex items-center gap-4 rounded-lg border p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Server className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">{manager.name}</h4>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {typeInfo.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Reference: <code className="rounded bg-muted px-1 font-mono">$secret://{manager.type}/{manager.name}/...</code>
                  </p>
                </div>
                <Switch
                  checked={manager.is_active}
                  onCheckedChange={() => handleToggle(manager)}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteId(manager.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t("remove")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })}
        </div>
      )}

      {/* Create dialog */}
      <ManagerFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={fetchManagers}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeManager")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeManagerConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// --- Manager create dialog ---

interface ConfigField {
  key: string
  label: string
  placeholder: string
  secret?: boolean
  multiline?: boolean
}

const VAULT_CONFIG_FIELDS: ConfigField[] = [
  { key: "uri", label: "Vault URI", placeholder: "https://vault.example.com" },
  { key: "token", label: "Token", placeholder: "hvs.xxxxx", secret: true },
  { key: "prefix", label: "Secret Path Prefix", placeholder: "kv/data/apisix" },
]

const AWS_CONFIG_FIELDS: ConfigField[] = [
  { key: "region", label: "AWS Region", placeholder: "us-east-1" },
  { key: "access_key_id", label: "Access Key ID", placeholder: "AKIA..." },
  { key: "secret_access_key", label: "Secret Access Key", placeholder: "wJal...", secret: true },
]

const GCP_CONFIG_FIELDS: ConfigField[] = [
  { key: "project_id", label: "GCP Project ID", placeholder: "my-project-123" },
  { key: "credentials_json", label: "Service Account JSON", placeholder: '{"type":"service_account"...}', multiline: true },
]

const ENV_CONFIG_FIELDS: ConfigField[] = []

const CONFIG_FIELDS: Record<string, ConfigField[]> = {
  vault: VAULT_CONFIG_FIELDS,
  aws: AWS_CONFIG_FIELDS,
  gcp: GCP_CONFIG_FIELDS,
  env: ENV_CONFIG_FIELDS,
}

function ManagerFormDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations("secrets")
  const tc = useTranslations("common")
  const [name, setName] = useState("")
  const [type, setType] = useState<string>("vault")
  const [config, setConfig] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const fields = CONFIG_FIELDS[type] || []

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t("nameRequired"))
      return
    }

    setSaving(true)
    try {
      await api.createSecretManager({
        name: name.trim(),
        type,
        config,
      })
      toast.success(t("managerAdded"))
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("addManager")}</DialogTitle>
          <DialogDescription>
            {t("addManagerDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{tc("name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="production-vault"
            />
          </div>

          <div className="space-y-2">
            <Label>{tc("type")}</Label>
            <Select value={type} onValueChange={(v) => { setType(v); setConfig({}) }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MANAGER_TYPE_LABELS).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    {info.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {MANAGER_TYPE_LABELS[type]?.description}
            </p>
          </div>

          {fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label>{field.label}</Label>
              {field.multiline ? (
                <Textarea
                  value={config[field.key] || ""}
                  onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  rows={4}
                  className="font-mono text-xs"
                />
              ) : (
                <Input
                  type={field.secret ? "password" : "text"}
                  value={config[field.key] || ""}
                  onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                />
              )}
            </div>
          ))}

          {type === "env" && (
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <p>
                {t("envInfo")}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("addManager")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
