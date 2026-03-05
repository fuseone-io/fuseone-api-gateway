"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/api-client"
import type { PublicOAuthProvider } from "@/types/oauth"

const PROVIDER_COLORS: Record<string, string> = {
  google: "#4285F4",
  microsoft: "#00A4EF",
  github: "#333333",
  okta: "#007DC1",
  oidc: "#6B7280",
}

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft",
  github: "GitHub",
  okta: "Okta",
  oidc: "SSO",
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [totpRequired, setTotpRequired] = useState(false)
  const [totpCode, setTotpCode] = useState("")
  const [oauthProviders, setOauthProviders] = useState<PublicOAuthProvider[]>([])
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)

  useEffect(() => {
    api.listEnabledOAuthProviders().then(setOauthProviders).catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await api.login(username, password, totpRequired ? totpCode : undefined)
      router.push("/dashboard")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed"
      if (message.includes("totp_required")) {
        setTotpRequired(true)
      } else {
        toast.error(message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: PublicOAuthProvider) => {
    setOauthLoading(provider.provider)
    try {
      const redirectUri = `${window.location.origin}/login/oauth/callback`
      const { url, state } = await api.oauthAuthorize(provider.provider, redirectUri)
      // Store state for validation on callback
      sessionStorage.setItem("oauth_state", state)
      sessionStorage.setItem("oauth_provider", provider.provider)
      window.location.href = url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start OAuth flow")
      setOauthLoading(null)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form onSubmit={handleSubmit} className="p-6 md:p-8">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <img src="/logo-mark.svg" alt="FuseOne" className="h-10 w-10" />
                <h1 className="text-2xl font-bold">FuseOne API Gateway</h1>
                <p className="text-muted-foreground text-balance">
                  Entre com suas credenciais para acessar o painel
                </p>
              </div>
              <Field>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input
                  id="username"
                  type="text"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>
              {totpRequired && (
                <Field>
                  <FieldLabel htmlFor="totp_code">Authentication Code</FieldLabel>
                  <Input
                    id="totp_code"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    autoFocus
                    maxLength={6}
                    className="font-mono text-center text-lg tracking-widest"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </Field>
              )}
              <Field>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </Field>

              {/* OAuth providers */}
              {oauthProviders.length > 0 && (
                <>
                  <div className="relative">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                      ou
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {oauthProviders.map((provider) => {
                      const label = provider.display_name || PROVIDER_LABELS[provider.provider] || provider.provider
                      const color = PROVIDER_COLORS[provider.provider] || "#6B7280"
                      return (
                        <Button
                          key={provider.provider}
                          type="button"
                          variant="outline"
                          className="w-full gap-2"
                          disabled={oauthLoading === provider.provider}
                          onClick={() => handleOAuth(provider)}
                        >
                          <span
                            className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white shrink-0"
                            style={{ backgroundColor: color }}
                          >
                            {label.charAt(0)}
                          </span>
                          {oauthLoading === provider.provider
                            ? "Redirecting..."
                            : `Entrar com ${label}`}
                        </Button>
                      )
                    })}
                  </div>
                </>
              )}
            </FieldGroup>
          </form>
          <div className="bg-muted relative hidden md:block">
            <img
              src="/login-illustration.svg"
              alt="API Gateway"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
