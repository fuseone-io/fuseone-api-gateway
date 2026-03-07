"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import {
  CheckCircle2,
  Clock,
  Download,
  Eye,
  GitBranch,
  Loader2,
  Plug,
  RotateCcw,
  Save,
  Upload,
  XCircle,
} from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api-client"
import { toast } from "sonner"

interface BackupConfig {
  provider: string
  repo_url: string
  branch: string
  has_token?: boolean
}

interface BackupCommit {
  sha: string
  message: string
  date: string
  author: string
}

interface BackupPreview {
  added: string[]
  modified: string[]
  deleted: string[]
}

const PROVIDERS = [
  { value: "github", label: "GitHub", description: "GitHub.com or GitHub Enterprise", placeholder: "https://github.com/org/fuseone-backup.git", tokenLabel: "Personal Access Token", tokenPlaceholder: "ghp_xxxxxxxxxxxxxxxxxxxx" },
  { value: "gitlab", label: "GitLab", description: "GitLab.com or self-hosted GitLab", placeholder: "https://gitlab.com/org/fuseone-backup.git", tokenLabel: "Personal Access Token", tokenPlaceholder: "glpat-xxxxxxxxxxxxxxxxxxxx" },
  { value: "bitbucket", label: "Bitbucket", description: "Bitbucket Cloud or Data Center", placeholder: "https://bitbucket.org/org/fuseone-backup.git", tokenLabel: "App Password", tokenPlaceholder: "Your Bitbucket app password" },
]

export default function BackupContent() {
  const t = useTranslations("settings.backup")
  const tc = useTranslations("common")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Configuration
  const [configured, setConfigured] = useState(false)
  const [provider, setProvider] = useState("github")
  const [repoUrl, setRepoUrl] = useState("")
  const [branch, setBranch] = useState("main")
  const [token, setToken] = useState("")
  const [hasToken, setHasToken] = useState(false)

  // Connection test
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  // History
  const [history, setHistory] = useState<BackupCommit[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [backupCreating, setBackupCreating] = useState(false)

  // Preview sheet
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewSha, setPreviewSha] = useState("")
  const [previewData, setPreviewData] = useState<BackupPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Restore
  const [restoreConfirmSha, setRestoreConfirmSha] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      const data = await api.getBackupConfig()
      if (data) {
        const cfg = data as unknown as BackupConfig
        setProvider(cfg.provider || "github")
        setRepoUrl(cfg.repo_url || "")
        setBranch(cfg.branch || "main")
        setHasToken(cfg.has_token || false)
        setConfigured(!!cfg.repo_url)
      }
    } catch {
      // Not configured yet
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const data = await api.getBackupHistory()
      setHistory(data || [])
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  useEffect(() => {
    if (configured) fetchHistory()
  }, [configured, fetchHistory])

  const handleSaveConfig = async () => {
    if (!repoUrl.trim()) {
      toast.error(t("repoUrlRequired"))
      return
    }
    if (!token.trim() && !hasToken) {
      toast.error(t("tokenRequired"))
      return
    }

    setSaving(true)
    try {
      await api.saveBackupConfig({
        provider,
        repo_url: repoUrl.trim(),
        branch: branch.trim() || "main",
        token: token.trim() || undefined,
      })
      setConfigured(true)
      setHasToken(true)
      setToken("")
      toast.success(t("configSaved"))
      fetchHistory()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedToSaveConfig"))
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await api.testBackupConnection()
      setTestResult(result)
      if (result.ok) toast.success(t("connectionSuccessful"))
      else toast.error(result.message)
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("connectionTestFailed")
      setTestResult({ ok: false, message: msg })
      toast.error(msg)
    } finally {
      setTesting(false)
    }
  }

  const handleCreateBackup = async () => {
    setBackupCreating(true)
    try {
      const result = await api.createBackup()
      toast.success(t("backupCreated", { sha: result.commit_sha }))
      fetchHistory()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedToCreateBackup"))
    } finally {
      setBackupCreating(false)
    }
  }

  const handlePreview = async (sha: string) => {
    setPreviewSha(sha)
    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewData(null)
    try {
      const data = await api.previewRestore(sha)
      setPreviewData(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedToLoadPreview"))
      setPreviewOpen(false)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleRestore = async (sha: string) => {
    setRestoring(true)
    try {
      const result = await api.restoreBackup(sha)
      toast.success(t("restoreSuccess", { message: result.message, count: result.applied }))
      setRestoreConfirmSha(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedToRestore"))
    } finally {
      setRestoring(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">{t("title")}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <Skeleton className="h-[200px] rounded-lg" />
        <Skeleton className="h-[300px] rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{t("title")}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("fullDescription")}
        </p>
      </div>

      {/* Git Configuration Card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">{t("gitRepository")}</h4>
              {configured && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-200">
                  {t("configured")}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("gitRepoDescription")}
            </p>
          </div>
          <Button size="sm" onClick={handleSaveConfig} disabled={saving || !repoUrl.trim()}>
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            {saving ? tc("saving") : tc("save")}
          </Button>
        </div>

        <div className="grid gap-4 max-w-lg">
          <div className="space-y-2">
            <Label>{t("provider")}</Label>
            <div className="grid grid-cols-3 gap-3">
              {PROVIDERS.map((p) => (
                <label
                  key={p.value}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 cursor-pointer transition-colors text-center ${
                    provider === p.value
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="provider"
                    value={p.value}
                    checked={provider === p.value}
                    onChange={() => setProvider(p.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">{p.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{p.description}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("repositoryUrl")}</Label>
            <Input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder={PROVIDERS.find((p) => p.value === provider)?.placeholder}
            />
            <p className="text-xs text-muted-foreground">{t("repoUrlHint")}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("branch")}</Label>
              <Input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
              />
            </div>
            <div className="space-y-2">
              <Label>
                {PROVIDERS.find((p) => p.value === provider)?.tokenLabel ?? "Access Token"}
                {hasToken && (
                  <span className="text-xs text-muted-foreground ml-1.5">(saved)</span>
                )}
              </Label>
              <Input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={hasToken ? t("leaveEmptyToKeep") : PROVIDERS.find((p) => p.value === provider)?.tokenPlaceholder}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing || !configured}
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Plug className="h-3.5 w-3.5 mr-1.5" />
              )}
              {t("testConnection")}
            </Button>
            {testResult && (
              <div className={`flex items-center gap-1.5 text-xs ${testResult.ok ? "text-emerald-600" : "text-destructive"}`}>
                {testResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Backup History Card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h4 className="text-sm font-semibold">{t("backupHistory")}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("backupHistoryDescription")}
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleCreateBackup}
            disabled={backupCreating || !configured}
          >
            {backupCreating ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-1.5" />
            )}
            {backupCreating ? t("creating") : t("backupNow")}
          </Button>
        </div>

        {!configured ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <GitBranch className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("configureRepoFirst")}
            </p>
          </div>
        ) : historyLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("noBackupsYet")}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {history.map((commit) => (
              <div
                key={commit.sha}
                className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                      {commit.sha}
                    </code>
                    <span className="text-sm truncate">{commit.message}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {commit.author} &middot; {new Date(commit.date).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => handlePreview(commit.sha)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    {t("preview")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700"
                    onClick={() => setRestoreConfirmSha(commit.sha)}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    {t("restore")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Sheet */}
      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              {t("restorePreview")}
            </SheetTitle>
            <SheetDescription>
              Contents of backup <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{previewSha}</code>
            </SheetDescription>
          </SheetHeader>

          {previewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : previewData ? (
            <div className="space-y-4 mt-4">
              {previewData.added.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-emerald-600">
                    {t("resources")} ({previewData.added.length})
                  </h4>
                  <div className="space-y-1">
                    {previewData.added.map((file) => (
                      <div key={file} className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                        <span className="text-emerald-600">+</span>
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {previewData.modified.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-amber-600">
                    {t("modified")} ({previewData.modified.length})
                  </h4>
                  <div className="space-y-1">
                    {previewData.modified.map((file) => (
                      <div key={file} className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                        <span className="text-amber-600">~</span>
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {previewData.deleted.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-destructive">
                    {t("deleted")} ({previewData.deleted.length})
                  </h4>
                  <div className="space-y-1">
                    {previewData.deleted.map((file) => (
                      <div key={file} className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                        <span className="text-destructive">-</span>
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <Button
                  className="w-full"
                  variant="default"
                  onClick={() => {
                    setPreviewOpen(false)
                    setRestoreConfirmSha(previewSha)
                  }}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  {t("restoreThisBackup")}
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!restoreConfirmSha} onOpenChange={(open) => !open && setRestoreConfirmSha(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("restoreConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("restoreConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreConfirmSha && handleRestore(restoreConfirmSha)}
              disabled={restoring}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {restoring ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              )}
              {restoring ? t("restoring") : t("yesRestore")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
