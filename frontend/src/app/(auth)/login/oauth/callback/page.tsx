"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api-client"

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-svh flex-col items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  )
}

function OAuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const errorParam = searchParams.get("error")
    const errorDescription = searchParams.get("error_description")

    if (errorParam) {
      setError(errorDescription || errorParam)
      return
    }

    if (!code) {
      setError("No authorization code received")
      return
    }

    const provider = sessionStorage.getItem("oauth_provider")
    const savedState = sessionStorage.getItem("oauth_state")

    if (!provider) {
      setError("OAuth session expired. Please try again.")
      return
    }

    if (savedState && state !== savedState) {
      setError("Invalid state parameter. Please try again.")
      return
    }

    const redirectUri = `${window.location.origin}/login/oauth/callback`

    api.oauthCallback(provider, code, state || "", redirectUri)
      .then(() => {
        sessionStorage.removeItem("oauth_state")
        sessionStorage.removeItem("oauth_provider")
        router.push("/dashboard")
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Authentication failed")
      })
  }, [searchParams, router])

  if (error) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <XCircle className="h-12 w-12 text-destructive" />
            <div>
              <h2 className="text-lg font-semibold">Authentication Failed</h2>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button variant="outline" onClick={() => router.push("/login")} className="w-full">
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Authenticating...</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Completing sign-in with your provider
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
