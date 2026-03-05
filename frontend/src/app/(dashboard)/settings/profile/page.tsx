"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Save,
  Shield,
  ShieldCheck,
  ShieldOff,
  XCircle,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api-client"
import type { User } from "@/types/auth"
import { toast } from "sonner"

export default function ProfileContent() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  // Profile form
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [saving, setSaving] = useState(false)
  const [originalProfile, setOriginalProfile] = useState({ displayName: "", email: "" })

  // Password form
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  // TOTP state
  const [totpEnabled, setTotpEnabled] = useState(false)
  const [totpSetupMode, setTotpSetupMode] = useState(false)
  const [totpSecret, setTotpSecret] = useState("")
  const [totpUrl, setTotpUrl] = useState("")
  const [totpCode, setTotpCode] = useState("")
  const [totpLoading, setTotpLoading] = useState(false)
  const [disablePassword, setDisablePassword] = useState("")
  const [showDisableForm, setShowDisableForm] = useState(false)

  const fetchProfile = useCallback(async () => {
    try {
      const data = await api.me()
      setUser(data)
      setDisplayName(data.display_name)
      setEmail(data.email || "")
      setOriginalProfile({ displayName: data.display_name, email: data.email || "" })
      setTotpEnabled(data.totp_enabled)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  const hasProfileChanges =
    displayName !== originalProfile.displayName ||
    email !== originalProfile.email

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const updated = await api.updateProfile({
        display_name: displayName.trim(),
        email: email.trim() || undefined,
      })
      setUser(updated)
      setOriginalProfile({ displayName: updated.display_name, email: updated.email || "" })
      toast.success("Profile updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile")
    } finally { setSaving(false) }
  }

  const canChangePassword = currentPassword && newPassword && confirmPassword && newPassword.length >= 6

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }
    setChangingPassword(true)
    try {
      await api.changePassword({ current_password: currentPassword, new_password: newPassword })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success("Password changed. Other sessions have been logged out.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password")
    } finally { setChangingPassword(false) }
  }

  const handleTOTPSetup = async () => {
    setTotpLoading(true)
    try {
      const data = await api.totpSetup()
      setTotpSecret(data.secret)
      setTotpUrl(data.url)
      setTotpSetupMode(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to setup 2FA")
    } finally { setTotpLoading(false) }
  }

  const handleTOTPEnable = async () => {
    if (totpCode.length !== 6) return
    setTotpLoading(true)
    try {
      await api.totpEnable(totpCode)
      setTotpEnabled(true)
      setTotpSetupMode(false)
      setTotpCode("")
      setTotpSecret("")
      setTotpUrl("")
      toast.success("Two-factor authentication enabled")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code")
    } finally { setTotpLoading(false) }
  }

  const handleTOTPDisable = async () => {
    if (!disablePassword) return
    setTotpLoading(true)
    try {
      await api.totpDisable(disablePassword)
      setTotpEnabled(false)
      setShowDisableForm(false)
      setDisablePassword("")
      toast.success("Two-factor authentication disabled")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid password")
    } finally { setTotpLoading(false) }
  }

  const initials = user?.display_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?"

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Profile</h3>
          <p className="text-sm text-muted-foreground mt-1">Manage your personal information</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Profile</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal information and security settings
        </p>
      </div>

      {/* Personal Information */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h4 className="text-sm font-semibold">Personal Information</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Update your profile details</p>
          </div>
          <Button size="sm" onClick={handleSaveProfile} disabled={saving || !hasProfileChanges}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <div className="flex items-start gap-6">
          <Avatar className="h-16 w-16 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 grid gap-4 max-w-lg">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Username</Label>
                <Input value={user?.username || ""} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Username cannot be changed</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Role</Label>
                <div className="flex items-center h-9">
                  <Badge variant="outline" className="text-xs">
                    {user?.role_name || "—"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Contact an admin to change your role</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Change Password</h4>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Update your account password</p>
          </div>
          <Button size="sm" onClick={handleChangePassword} disabled={changingPassword || !canChangePassword}>
            {changingPassword ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Lock className="h-3.5 w-3.5 mr-1.5" />}
            {changingPassword ? "Changing..." : "Change Password"}
          </Button>
        </div>

        <div className="grid gap-4 max-w-lg">
          <div className="space-y-2">
            <Label>Current Password</Label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
              />
              <Button
                type="button" variant="ghost" size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                />
                <Button
                  type="button" variant="ghost" size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <XCircle className="h-3 w-3" /> Passwords do not match
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            After changing your password, all other active sessions will be logged out for security.
          </p>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Two-Factor Authentication</h4>
              {totpEnabled ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px] px-1.5 py-0">
                  <ShieldCheck className="h-3 w-3 mr-1" /> Enabled
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  Disabled
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add an extra layer of security with a time-based one-time password (TOTP)
            </p>
          </div>
        </div>

        {/* TOTP Disabled — show Enable button or Setup flow */}
        {!totpEnabled && !totpSetupMode && (
          <div className="max-w-lg">
            <p className="text-sm text-muted-foreground mb-4">
              Two-factor authentication adds an additional layer of security to your account by requiring a verification code from your authenticator app when signing in.
            </p>
            <Button variant="outline" size="sm" onClick={handleTOTPSetup} disabled={totpLoading}>
              {totpLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
              Enable 2FA
            </Button>
          </div>
        )}

        {/* TOTP Setup Flow */}
        {!totpEnabled && totpSetupMode && (
          <div className="max-w-lg space-y-5">
            <div className="space-y-3">
              <p className="text-sm font-medium">1. Scan this QR code with your authenticator app</p>
              <div className="flex items-start gap-5">
                <div className="rounded-lg border bg-white p-3">
                  <QRCodeSVG value={totpUrl} size={160} />
                </div>
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-muted-foreground">
                    Use an app like Google Authenticator, Authy, or 1Password to scan the QR code.
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Or enter this code manually:</p>
                    <code className="block text-xs font-mono bg-muted px-2 py-1.5 rounded select-all break-all">
                      {totpSecret}
                    </code>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">2. Enter the 6-digit verification code</p>
              <div className="flex items-center gap-3">
                <Input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-32 font-mono text-center text-lg tracking-widest"
                  maxLength={6}
                />
                <Button size="sm" onClick={handleTOTPEnable} disabled={totpLoading || totpCode.length !== 6}>
                  {totpLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                  Verify & Enable
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setTotpSetupMode(false); setTotpCode("") }}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TOTP Enabled — show Disable option */}
        {totpEnabled && !showDisableForm && (
          <div className="max-w-lg">
            <div className="flex items-start gap-2.5 rounded-md bg-emerald-500/5 border border-emerald-200/50 px-3 py-2.5 mb-4">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Two-factor authentication is active. You will be asked for a verification code when signing in.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowDisableForm(true)}>
              <ShieldOff className="h-3.5 w-3.5 mr-1.5" />
              Disable 2FA
            </Button>
          </div>
        )}

        {/* TOTP Disable Confirmation */}
        {totpEnabled && showDisableForm && (
          <div className="max-w-lg space-y-4">
            <div className="flex items-start gap-2.5 rounded-md bg-amber-500/5 border border-amber-200/50 px-3 py-2.5">
              <ShieldOff className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Disabling 2FA will make your account less secure. Enter your password to confirm.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Enter your password to confirm"
                className="max-w-xs"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="destructive" size="sm" onClick={handleTOTPDisable} disabled={totpLoading || !disablePassword}>
                {totpLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5 mr-1.5" />}
                Disable 2FA
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowDisableForm(false); setDisablePassword("") }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
