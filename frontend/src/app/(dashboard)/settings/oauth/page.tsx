"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  KeyRound,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { api } from "@/lib/api-client"
import type { OAuthProvider, CreateOAuthProviderRequest, UpdateOAuthProviderRequest } from "@/types/oauth"
import type { Role } from "@/types/auth"
import { toast } from "sonner"

// ---------- Provider Templates ----------

interface ProviderField {
  key: string
  label: string
  placeholder: string
  secret?: boolean
}

interface ProviderTemplate {
  provider: string
  name: string
  description: string
  color: string
  fields: ProviderField[]
  extraFields: ProviderField[]
  defaultScopes: string[]
  docsUrl?: string
}

const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    provider: "google",
    name: "Google",
    description: "Google Workspace / Gmail accounts",
    color: "#4285F4",
    fields: [
      { key: "client_id", label: "Client ID", placeholder: "xxxx.apps.googleusercontent.com" },
      { key: "client_secret", label: "Client Secret", placeholder: "GOCSPX-...", secret: true },
    ],
    extraFields: [],
    defaultScopes: ["openid", "email", "profile"],
    docsUrl: "https://console.cloud.google.com/apis/credentials",
  },
  {
    provider: "microsoft",
    name: "Microsoft",
    description: "Azure AD / Microsoft 365",
    color: "#00A4EF",
    fields: [
      { key: "client_id", label: "Application (Client) ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
      { key: "client_secret", label: "Client Secret Value", placeholder: "xxxxx~xxxxx", secret: true },
    ],
    extraFields: [
      { key: "tenant_id", label: "Tenant ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx or 'common'" },
    ],
    defaultScopes: ["openid", "email", "profile", "User.Read"],
    docsUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps",
  },
  {
    provider: "github",
    name: "GitHub",
    description: "GitHub personal and org accounts",
    color: "#333333",
    fields: [
      { key: "client_id", label: "Client ID", placeholder: "Iv1.xxxxx" },
      { key: "client_secret", label: "Client Secret", placeholder: "xxxxx", secret: true },
    ],
    extraFields: [],
    defaultScopes: ["read:user", "user:email"],
    docsUrl: "https://github.com/settings/developers",
  },
  {
    provider: "okta",
    name: "Okta",
    description: "Okta Workforce Identity",
    color: "#007DC1",
    fields: [
      { key: "client_id", label: "Client ID", placeholder: "0oaxxxxxx" },
      { key: "client_secret", label: "Client Secret", placeholder: "xxxxx", secret: true },
    ],
    extraFields: [
      { key: "domain", label: "Okta Domain", placeholder: "dev-123456.okta.com" },
    ],
    defaultScopes: ["openid", "email", "profile"],
    docsUrl: "https://developer.okta.com/docs/guides/",
  },
  {
    provider: "oidc",
    name: "Generic OIDC",
    description: "Any OpenID Connect provider",
    color: "#6B7280",
    fields: [
      { key: "client_id", label: "Client ID", placeholder: "your-client-id" },
      { key: "client_secret", label: "Client Secret", placeholder: "your-client-secret", secret: true },
    ],
    extraFields: [
      { key: "authorization_url", label: "Authorization URL", placeholder: "https://idp.example.com/authorize" },
      { key: "token_url", label: "Token URL", placeholder: "https://idp.example.com/token" },
      { key: "userinfo_url", label: "UserInfo URL", placeholder: "https://idp.example.com/userinfo" },
    ],
    defaultScopes: ["openid", "email", "profile"],
  },
]

// ---------- Component ----------

export default function OAuthContent() {
  const [providers, setProviders] = useState<OAuthProvider[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<ProviderTemplate | null>(null)
  const [showDialog, setShowDialog] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([
        api.listOAuthProviders(),
        api.listRoles(),
      ])
      setProviders(p)
      setRoles(r)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load providers")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getConfiguredProvider = (providerSlug: string) =>
    providers.find((p) => p.provider === providerSlug)

  const handleCardClick = (template: ProviderTemplate) => {
    setSelectedTemplate(template)
    setShowDialog(true)
  }

  const handleDialogClose = () => {
    setShowDialog(false)
    setSelectedTemplate(null)
  }

  const handleSaved = () => {
    handleDialogClose()
    fetchData()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Authentication Providers</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configure SSO and OAuth2 providers for user authentication
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px] rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  const callbackUrl = typeof window !== "undefined"
    ? `${window.location.origin}/login/oauth/callback`
    : ""

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Authentication Providers</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configure SSO and OAuth2 providers for user authentication
        </p>
      </div>

      {/* Callback URL hint */}
      {callbackUrl && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3">
          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Redirect / Callback URL (use this in your provider console):</p>
            <p className="text-sm font-mono truncate">{callbackUrl}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => {
              navigator.clipboard.writeText(callbackUrl)
              toast.success("Copied to clipboard")
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Provider cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDER_TEMPLATES.map((template) => {
          const configured = getConfiguredProvider(template.provider)
          return (
            <button
              key={template.provider}
              type="button"
              onClick={() => handleCardClick(template)}
              className="group rounded-lg border bg-card p-5 text-left shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition-all hover:border-primary/50 hover:shadow-md"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-white text-xs font-bold"
                    style={{ backgroundColor: template.color }}
                  >
                    {template.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground">{template.description}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {configured ? (
                  <>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-200"
                    >
                      <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                      Configured
                    </Badge>
                    {configured.is_enabled ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-600 border-blue-200"
                      >
                        Enabled
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Disabled
                      </Badge>
                    )}
                  </>
                ) : (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    <Plus className="h-2.5 w-2.5 mr-1" />
                    Not Configured
                  </Badge>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Config sheet */}
      {selectedTemplate && (
        <ProviderSheet
          open={showDialog}
          onOpenChange={(open) => { if (!open) handleDialogClose() }}
          onSaved={handleSaved}
          template={selectedTemplate}
          existing={getConfiguredProvider(selectedTemplate.provider) || null}
          roles={roles}
          callbackUrl={callbackUrl}
        />
      )}
    </div>
  )
}

// ---------- Sheet ----------

function ProviderSheet({
  open,
  onOpenChange,
  onSaved,
  template,
  existing,
  roles,
  callbackUrl,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  template: ProviderTemplate
  existing: OAuthProvider | null
  roles: Role[]
  callbackUrl: string
}) {
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Form fields
  const [displayName, setDisplayName] = useState("")
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [scopes, setScopes] = useState("")
  const [extraValues, setExtraValues] = useState<Record<string, string>>({})
  const [autoCreate, setAutoCreate] = useState(false)
  const [defaultRoleId, setDefaultRoleId] = useState("none")
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    if (existing) {
      setDisplayName(existing.display_name)
      setClientId(existing.client_id)
      setClientSecret("") // never pre-fill secret
      setScopes((existing.scopes || []).join(", "))
      setExtraValues(existing.extra_config || {})
      setAutoCreate(existing.auto_create_users)
      setDefaultRoleId(existing.default_role_id || "none")
      setEnabled(existing.is_enabled)
    } else {
      setDisplayName(template.name)
      setClientId("")
      setClientSecret("")
      setScopes(template.defaultScopes.join(", "))
      setExtraValues({})
      setAutoCreate(false)
      setDefaultRoleId("none")
      setEnabled(true)
    }
  }, [existing, template, open])

  const handleExtraChange = (key: string, value: string) => {
    setExtraValues((prev) => ({ ...prev, [key]: value }))
  }

  const parsedScopes = scopes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  const handleSave = async () => {
    if (!clientId.trim()) {
      toast.error("Client ID is required")
      return
    }
    if (!existing && !clientSecret.trim()) {
      toast.error("Client Secret is required")
      return
    }

    // Validate extra fields
    for (const field of template.extraFields) {
      if (!extraValues[field.key]?.trim()) {
        toast.error(`${field.label} is required`)
        return
      }
    }

    setSaving(true)
    try {
      if (existing) {
        const data: UpdateOAuthProviderRequest = {
          display_name: displayName.trim(),
          client_id: clientId.trim(),
          scopes: parsedScopes,
          extra_config: extraValues,
          auto_create_users: autoCreate,
          default_role_id: defaultRoleId !== "none" ? defaultRoleId : undefined,
          is_enabled: enabled,
        }
        if (clientSecret) {
          data.client_secret = clientSecret
        }
        await api.updateOAuthProvider(existing.id, data)
        toast.success(`${template.name} provider updated`)
      } else {
        const data: CreateOAuthProviderRequest = {
          provider: template.provider,
          display_name: displayName.trim(),
          client_id: clientId.trim(),
          client_secret: clientSecret,
          scopes: parsedScopes,
          extra_config: extraValues,
          auto_create_users: autoCreate,
          default_role_id: defaultRoleId !== "none" ? defaultRoleId : undefined,
          is_enabled: enabled,
        }
        await api.createOAuthProvider(data)
        toast.success(`${template.name} provider configured`)
      }
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!existing) return
    setDeleting(true)
    try {
      await api.deleteOAuthProvider(existing.id)
      toast.success(`${template.name} provider removed`)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[33vw] sm:min-w-[380px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: template.color }}
            >
              {template.name.charAt(0)}
            </div>
            {existing ? `Edit ${template.name}` : `Configure ${template.name}`}
          </SheetTitle>
          <SheetDescription>
            {template.description}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 space-y-4">
          {/* Display Name */}
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={template.name}
            />
          </div>

          <Separator />

          {/* Provider-specific extra fields (tenant, domain, URLs) */}
          {template.extraFields.length > 0 && (
            <>
              {template.extraFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label>{field.label}</Label>
                  <Input
                    value={extraValues[field.key] || ""}
                    onChange={(e) => handleExtraChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
              <Separator />
            </>
          )}

          {/* Standard fields (client_id, client_secret) */}
          {template.fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label>{field.label}</Label>
              {field.key === "client_id" ? (
                <Input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder={field.placeholder}
                />
              ) : field.key === "client_secret" ? (
                <Input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={existing ? "Leave blank to keep existing" : field.placeholder}
                />
              ) : null}
            </div>
          ))}

          {/* Scopes */}
          <div className="space-y-2">
            <Label>Scopes</Label>
            <Input
              value={scopes}
              onChange={(e) => setScopes(e.target.value)}
              placeholder="openid, email, profile"
            />
            <p className="text-xs text-muted-foreground">Comma-separated list of OAuth scopes</p>
          </div>

          <Separator />

          {/* Auto-create users */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Auto-create users</p>
              <p className="text-xs text-muted-foreground">
                Automatically provision accounts on first SSO login
              </p>
            </div>
            <Switch checked={autoCreate} onCheckedChange={setAutoCreate} />
          </div>

          {/* Default role */}
          {autoCreate && (
            <div className="space-y-2">
              <Label>Default Role for New Users</Label>
              <Select value={defaultRoleId} onValueChange={setDefaultRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No role (uses viewer)</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Enabled toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Enabled</p>
              <p className="text-xs text-muted-foreground">
                Show this provider on the login page
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* Callback URL */}
          {callbackUrl && (
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Redirect URI (add to your provider console):</p>
              <p className="text-xs font-mono break-all">{callbackUrl}</p>
            </div>
          )}

          {/* Docs link */}
          {template.docsUrl && (
            <a
              href={template.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {template.name} Developer Console
            </a>
          )}
        </div>

        <SheetFooter className="border-t pt-4">
          <div className="flex w-full items-center gap-2">
            {existing && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="mr-auto"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                )}
                Remove
              </Button>
            )}
            <div className={`flex items-center gap-2 ${existing ? "" : "ml-auto"}`}>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : existing ? (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                ) : (
                  <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                )}
                {saving ? "Saving..." : existing ? "Save Changes" : "Configure Provider"}
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
