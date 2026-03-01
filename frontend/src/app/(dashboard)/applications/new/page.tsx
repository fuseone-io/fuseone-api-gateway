"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  Copy,
  Key,
  Lock,
  Save,
  ShieldCheck,
  Fingerprint,
  Shuffle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/page-header"
import { PLUGIN_FORM_REGISTRY } from "@/lib/plugin-forms"
import { PluginFormRenderer } from "@/components/flow/plugin-form-renderer"
import { api } from "@/lib/api-client"
import type { APISIXConsumerGroup } from "@/types/apisix"

const AUTH_METHODS = [
  { value: "key-auth", label: "API Key", icon: Key, description: "Simple key-based authentication via header or query parameter" },
  { value: "basic-auth", label: "Basic Auth", icon: Lock, description: "HTTP Basic authentication with username and password" },
  { value: "jwt-auth", label: "JWT", icon: ShieldCheck, description: "JSON Web Token-based authentication" },
  { value: "hmac-auth", label: "HMAC", icon: Fingerprint, description: "HMAC signature-based authentication" },
] as const

type AuthMethod = (typeof AUTH_METHODS)[number]["value"]

function generateApiKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export default function NewApplicationPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [planId, setPlanId] = useState<string>("")
  const [plans, setPlans] = useState<APISIXConsumerGroup[]>([])
  const [authMethod, setAuthMethod] = useState<AuthMethod>("key-auth")
  const [authConfig, setAuthConfig] = useState<Record<string, unknown>>({})

  useEffect(() => {
    api
      .listResource("consumer-groups")
      .then((data) => {
        const groups = (data?.list || []).map(
          (n) => n.value as APISIXConsumerGroup
        )
        setPlans(groups)
      })
      .catch(() => {})
  }, [])

  // Reset auth config when method changes
  useEffect(() => {
    if (authMethod === "key-auth") {
      setAuthConfig({ key: generateApiKey() })
    } else {
      setAuthConfig({})
    }
  }, [authMethod])

  const handleGenerateKey = () => {
    setAuthConfig({ ...authConfig, key: generateApiKey() })
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Application name is required")
      return
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name.trim())) {
      toast.error(
        "Name must contain only letters, numbers, hyphens and underscores"
      )
      return
    }

    setSaving(true)
    try {
      await api.createResource("consumers", {
        username: name.trim(),
        desc: description || undefined,
        group_id: planId || undefined,
        plugins: { [authMethod]: authConfig },
      })

      // Show credentials toast
      const credentialInfo = getCredentialSummary(authMethod, authConfig)
      toast.success("Application created", {
        description: credentialInfo,
        duration: 10000,
      })

      router.push(`/applications/${name.trim()}`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create application"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Application"
        description="Register a new client application with credentials"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/applications")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Creating..." : "Create Application"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 max-w-2xl">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>Basic application information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-mobile-app"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier. Use lowercase with hyphens (e.g.,
                my-mobile-app, partner-api).
              </p>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mobile application for iOS and Android"
              />
            </div>
          </CardContent>
        </Card>

        {/* Plan */}
        <Card>
          <CardHeader>
            <CardTitle>Plan</CardTitle>
            <CardDescription>
              Assign a plan to apply shared policies and rate limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="No plan (standalone)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No plan (standalone)</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id || ""}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{p.id}</span>
                      {p.desc && (
                        <span className="text-muted-foreground">
                          — {p.desc}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Authentication */}
        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>
              Choose how this application will authenticate with the gateway
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Method selector */}
            <div className="grid grid-cols-2 gap-2">
              {AUTH_METHODS.map((method) => {
                const Icon = method.icon
                const isSelected = authMethod === method.value
                return (
                  <button
                    key={method.value}
                    onClick={() => setAuthMethod(method.value)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:bg-accent"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <div>
                      <p
                        className={`text-sm font-medium ${isSelected ? "text-primary" : ""}`}
                      >
                        {method.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {method.description}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Auth config form */}
            <div className="rounded-lg border p-4">
              {authMethod === "key-auth" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">API Key</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleGenerateKey}
                    >
                      <Shuffle className="mr-1.5 h-3 w-3" />
                      Regenerate
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={(authConfig.key as string) || ""}
                      onChange={(e) =>
                        setAuthConfig({ ...authConfig, key: e.target.value })
                      }
                      className="font-mono text-xs"
                      placeholder="Enter or generate an API key"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          (authConfig.key as string) || ""
                        )
                        toast.success("API key copied to clipboard")
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Save this key — it will be used by the application to
                    authenticate requests via the <code>apikey</code> header.
                  </p>
                </div>
              )}

              {authMethod !== "key-auth" &&
                PLUGIN_FORM_REGISTRY[authMethod] && (
                  <PluginFormRenderer
                    formDef={PLUGIN_FORM_REGISTRY[authMethod]}
                    config={authConfig}
                    onChange={setAuthConfig}
                    readOnly={false}
                  />
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function getCredentialSummary(
  method: AuthMethod,
  config: Record<string, unknown>
): string {
  switch (method) {
    case "key-auth":
      return `API Key: ${(config.key as string)?.slice(0, 12)}...`
    case "basic-auth":
      return `Username: ${config.username || "—"}`
    case "jwt-auth":
      return `Consumer Key: ${config.key || "—"}`
    case "hmac-auth":
      return `Access Key: ${config.access_key || "—"}`
    default:
      return ""
  }
}
