"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
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
import { useTranslations } from "next-intl"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { api } from "@/lib/api-client"
import type { User } from "@/types/auth"
import { toast } from "sonner"
import { useLocaleStore } from "@/stores/locale-store"
import { locales, localeLabels } from "@/i18n/config"
import type { Locale } from "@/i18n/config"

export default function ProfileContent() {
  const t = useTranslations("profile")
  const tc = useTranslations("common")
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

  // Locale
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)

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
      toast.success(t("profileUpdated"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedUpdateProfile"))
    } finally { setSaving(false) }
  }

  const canChangePassword = currentPassword && newPassword && confirmPassword && newPassword.length >= 6

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t("passwordsDoNotMatch"))
      return
    }
    setChangingPassword(true)
    try {
      await api.changePassword({ current_password: currentPassword, new_password: newPassword })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success(t("passwordChanged"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedChangePassword"))
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
      toast.error(err instanceof Error ? err.message : t("failedSetup2FA"))
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
      toast.success(t("twoFactorEnabledToast"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invalidCode"))
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
      toast.success(t("twoFactorDisabledToast"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invalidPassword"))
    } finally { setTotpLoading(false) }
  }

  const handleLocaleChange = (value: string) => {
    setLocale(value as Locale)
    toast.success(t("languageChanged"))
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
          <h3 className="text-lg font-semibold">{t("title")}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t("descriptionShort")}</p>
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
        <h3 className="text-lg font-semibold">{t("title")}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("description")}
        </p>
      </div>

      {/* Language */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <div>
              <h4 className="text-sm font-semibold">{t("language")}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">{t("languageDescription")}</p>
            </div>
          </div>
          <Select value={locale} onValueChange={handleLocaleChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locales.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {localeLabels[loc]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Personal Information */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h4 className="text-sm font-semibold">{t("personalInfo")}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{t("updateProfile")}</p>
          </div>
          <Button size="sm" onClick={handleSaveProfile} disabled={saving || !hasProfileChanges}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            {saving ? tc("saving") : tc("saveChanges")}
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
                <Label>{t("displayName")}</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <Label>{t("email")}</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t("username")}</Label>
                <Input value={user?.username || ""} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">{t("usernameCantChange")}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t("role")}</Label>
                <div className="flex items-center h-9">
                  <Badge variant="outline" className="text-xs">
                    {user?.role_name || "—"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{t("roleContactAdmin")}</p>
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
              <h4 className="text-sm font-semibold">{t("changePassword")}</h4>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{t("updatePassword")}</p>
          </div>
          <Button size="sm" onClick={handleChangePassword} disabled={changingPassword || !canChangePassword}>
            {changingPassword ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Lock className="h-3.5 w-3.5 mr-1.5" />}
            {changingPassword ? t("changingPassword") : t("changePassword")}
          </Button>
        </div>

        <div className="grid gap-4 max-w-lg">
          <div className="space-y-2">
            <Label>{t("currentPassword")}</Label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t("currentPasswordPlaceholder")}
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
              <Label>{t("newPassword")}</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("newPasswordPlaceholder")}
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
              <Label>{t("confirmPassword")}</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("confirmPasswordPlaceholder")}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <XCircle className="h-3 w-3" /> {t("passwordsDoNotMatch")}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("passwordSecurityNote")}
          </p>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">{t("twoFactorAuth")}</h4>
              {totpEnabled ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px] px-1.5 py-0">
                  <ShieldCheck className="h-3 w-3 mr-1" /> {t("twoFactorEnabled")}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {t("twoFactorDisabled")}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("twoFactorDescription")}
            </p>
          </div>
        </div>

        {/* TOTP Disabled — show Enable button or Setup flow */}
        {!totpEnabled && !totpSetupMode && (
          <div className="max-w-lg">
            <p className="text-sm text-muted-foreground mb-4">
              {t("twoFactorDetailedDescription")}
            </p>
            <Button variant="outline" size="sm" onClick={handleTOTPSetup} disabled={totpLoading}>
              {totpLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
              {t("enable2FA")}
            </Button>
          </div>
        )}

        {/* TOTP Setup Flow */}
        {!totpEnabled && totpSetupMode && (
          <div className="max-w-lg space-y-5">
            <div className="space-y-3">
              <p className="text-sm font-medium">{t("scanQrCode")}</p>
              <div className="flex items-start gap-5">
                <div className="rounded-lg border bg-white p-3">
                  <QRCodeSVG value={totpUrl} size={160} />
                </div>
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-muted-foreground">
                    {t("scanQrCodeHint")}
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{t("enterManually")}</p>
                    <code className="block text-xs font-mono bg-muted px-2 py-1.5 rounded select-all break-all">
                      {totpSecret}
                    </code>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">{t("enterVerificationCode")}</p>
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
                  {t("verifyAndEnable")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setTotpSetupMode(false); setTotpCode("") }}>
                  {tc("cancel")}
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
                {t("twoFactorActive")}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowDisableForm(true)}>
              <ShieldOff className="h-3.5 w-3.5 mr-1.5" />
              {t("disable2FA")}
            </Button>
          </div>
        )}

        {/* TOTP Disable Confirmation */}
        {totpEnabled && showDisableForm && (
          <div className="max-w-lg space-y-4">
            <div className="flex items-start gap-2.5 rounded-md bg-amber-500/5 border border-amber-200/50 px-3 py-2.5">
              <ShieldOff className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {t("disableWarning")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{tc("password")}</Label>
              <Input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder={t("enterPasswordConfirm")}
                className="max-w-xs"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="destructive" size="sm" onClick={handleTOTPDisable} disabled={totpLoading || !disablePassword}>
                {totpLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5 mr-1.5" />}
                {t("disable2FA")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowDisableForm(false); setDisablePassword("") }}>
                {tc("cancel")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
