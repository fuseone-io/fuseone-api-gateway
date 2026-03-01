"use client"

import { useState, useEffect, useCallback } from "react"
import {
  KeyRound,
  Plus,
  Check,
  ChevronDown,
  Server,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { api } from "@/lib/api-client"
import type { Secret, SecretManager } from "@/types/api"

// --- Module-level cache for secrets and managers ---

let secretsCache: Secret[] | null = null
let managersCache: SecretManager[] | null = null
let secretsFetchPromise: Promise<void> | null = null

async function ensureSecretsLoaded() {
  if (secretsCache && managersCache) return

  if (secretsFetchPromise) {
    await secretsFetchPromise
    return
  }

  secretsFetchPromise = Promise.all([
    secretsCache
      ? Promise.resolve()
      : api
          .listSecrets()
          .then((res) => {
            secretsCache = res.data || []
          })
          .catch(() => {
            secretsCache = []
          }),
    managersCache
      ? Promise.resolve()
      : api
          .listSecretManagers()
          .then((data) => {
            managersCache = (data || []).filter((m) => m.is_active)
          })
          .catch(() => {
            managersCache = []
          }),
  ]).then(() => {
    secretsFetchPromise = null
  })

  await secretsFetchPromise
}

// Invalidate cache when a new secret is created
function invalidateSecretsCache() {
  secretsCache = null
  secretsFetchPromise = null
}

// --- Secret Selector Props ---

interface SecretSelectorProps {
  value: string
  onChange: (value: string) => void
  readOnly: boolean
  /** Field label for context in the create dialog */
  fieldLabel?: string
}

function isSecretRef(value: string): boolean {
  return typeof value === "string" && value.startsWith("$secret://")
}

function parseSecretRef(value: string): { source: string; name: string; path?: string } | null {
  if (!isSecretRef(value)) return null
  // $secret://local/my-key  or  $secret://vault/manager-name/path
  const withoutPrefix = value.replace("$secret://", "")
  const parts = withoutPrefix.split("/")
  if (parts.length < 2) return null
  if (parts[0] === "local") {
    return { source: "local", name: parts.slice(1).join("/") }
  }
  // External: $secret://{type}/{manager-name}/{path}
  return { source: parts[0], name: parts[1], path: parts.slice(2).join("/") }
}

export function SecretSelector({ value, onChange, readOnly, fieldLabel }: SecretSelectorProps) {
  const [open, setOpen] = useState(false)
  const [secrets, setSecrets] = useState<Secret[]>(secretsCache || [])
  const [managers, setManagers] = useState<SecretManager[]>(managersCache || [])
  const [loading, setLoading] = useState(!secretsCache)
  const [showCreate, setShowCreate] = useState(false)
  const [managerPath, setManagerPath] = useState("")

  const isRef = isSecretRef(value || "")
  const parsed = isRef ? parseSecretRef(value) : null

  useEffect(() => {
    if (!open) return
    setLoading(!secretsCache)
    ensureSecretsLoaded().then(() => {
      setSecrets(secretsCache || [])
      setManagers(managersCache || [])
      setLoading(false)
    })
  }, [open])

  const handleSelectLocal = (secretName: string) => {
    onChange(`$secret://local/${secretName}`)
    setOpen(false)
  }

  const handleSelectManager = (manager: SecretManager, path: string) => {
    if (!path.trim()) {
      toast.error("Enter a secret path")
      return
    }
    onChange(`$secret://${manager.type}/${manager.name}/${path.trim()}`)
    setOpen(false)
    setManagerPath("")
  }

  const handleCreated = useCallback(
    (secretName: string) => {
      invalidateSecretsCache()
      ensureSecretsLoaded().then(() => {
        setSecrets(secretsCache || [])
        setManagers(managersCache || [])
      })
      onChange(`$secret://local/${secretName}`)
      setShowCreate(false)
      setOpen(false)
    },
    [onChange]
  )

  const handleClear = () => {
    onChange("")
    setOpen(false)
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={readOnly}
            className={`w-full flex items-center gap-1.5 rounded-md border px-2 h-7 text-xs transition-colors hover:bg-muted/50 ${
              isRef
                ? "border-primary/40 bg-primary/5"
                : "border-input bg-transparent"
            } ${readOnly ? "opacity-50 cursor-default" : "cursor-pointer"}`}
          >
            <KeyRound className={`h-3 w-3 shrink-0 ${isRef ? "text-primary" : "text-muted-foreground"}`} />
            {isRef ? (
              <span className="font-mono text-[10px] truncate flex-1 text-left text-primary">
                {value}
              </span>
            ) : (
              <span className="text-muted-foreground truncate flex-1 text-left">
                Select a secret reference...
              </span>
            )}
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <div className="px-3 pt-3 pb-2 border-b">
            <p className="text-xs font-semibold">Secret Reference</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Select an existing secret or create a new one
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="p-1">
                {/* Local Secrets */}
                {secrets.length > 0 && (
                  <div className="mb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
                      Local Secrets
                    </p>
                    {secrets.map((secret) => {
                      const isSelected = parsed?.source === "local" && parsed?.name === secret.name
                      return (
                        <button
                          key={secret.id}
                          onClick={() => handleSelectLocal(secret.name)}
                          className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted transition-colors"
                        >
                          <KeyRound className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium block truncate">{secret.name}</span>
                            {secret.description && (
                              <span className="text-[10px] text-muted-foreground block truncate">
                                {secret.description}
                              </span>
                            )}
                          </div>
                          {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* External Managers */}
                {managers.map((manager) => (
                  <div key={manager.id} className="mb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5 flex items-center gap-1.5">
                      <Server className="h-3 w-3" />
                      {manager.name}
                      <span className="text-[9px] font-normal capitalize">({manager.type})</span>
                    </p>
                    <div className="px-2 pb-1">
                      <div className="flex items-center gap-1">
                        <Input
                          placeholder="secret/path/key"
                          value={managerPath}
                          onChange={(e) => setManagerPath(e.target.value)}
                          className="h-6 text-[10px] font-mono flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              handleSelectManager(manager, managerPath)
                            }
                          }}
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-6 w-6 shrink-0"
                          onClick={() => handleSelectManager(manager, managerPath)}
                          disabled={!managerPath.trim()}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {secrets.length === 0 && managers.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No secrets or managers configured
                  </p>
                )}

                {/* Actions */}
                <div className="border-t mt-1 pt-1">
                  <button
                    onClick={() => {
                      setOpen(false)
                      setShowCreate(true)
                    }}
                    className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted transition-colors"
                  >
                    <Plus className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-xs font-medium text-primary">Create new secret</span>
                  </button>
                  {isRef && (
                    <button
                      onClick={handleClear}
                      className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted transition-colors"
                    >
                      <span className="text-xs text-muted-foreground">Clear reference (use raw value)</span>
                    </button>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </PopoverContent>
      </Popover>

      {/* Inline Create Secret Dialog */}
      <CreateSecretDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
        suggestedName={fieldLabel?.toLowerCase().replace(/\s+/g, "-")}
      />
    </>
  )
}

// --- Inline Create Secret Dialog ---

function CreateSecretDialog({
  open,
  onClose,
  onCreated,
  suggestedName,
}: {
  open: boolean
  onClose: () => void
  onCreated: (name: string) => void
  suggestedName?: string
}) {
  const [name, setName] = useState(suggestedName || "")
  const [value, setValue] = useState("")
  const [showValue, setShowValue] = useState(false)
  const [saving, setSaving] = useState(false)

  // Reset on open
  useEffect(() => {
    if (open) {
      setName(suggestedName || "")
      setValue("")
      setShowValue(false)
    }
  }, [open, suggestedName])

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    if (!value.trim()) {
      toast.error("Value is required")
      return
    }

    setSaving(true)
    try {
      await api.createSecret({ name: name.trim(), value })
      toast.success("Secret created")
      onCreated(name.trim())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create secret")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Secret</DialogTitle>
          <DialogDescription>
            Create a new encrypted secret and use it as a reference in this field.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-api-key"
              className="h-8 text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Lowercase letters, numbers, and hyphens.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Value</Label>
            <div className="relative">
              <Input
                type={showValue ? "text" : "password"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter secret value"
                className="h-8 text-sm pr-8"
              />
              <button
                type="button"
                onClick={() => setShowValue(!showValue)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showValue ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Create & Use
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
