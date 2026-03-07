"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { api } from "@/lib/api-client"
import type { User, Role } from "@/types/auth"
import { toast } from "sonner"

export default function UsersContent() {
  const t = useTranslations("settings.users")
  const tc = useTranslations("common")
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 20

  const [showDialog, setShowDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [resetUserId, setResetUserId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, rolesData] = await Promise.all([
        api.listUsers({ search: search || undefined, page, page_size: pageSize }),
        api.listRoles(),
      ])
      setUsers(usersRes.data || [])
      setTotal(usersRes.total)
      setRoles(rolesData)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedToLoad"))
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    api.me().then((u) => setCurrentUserId(u.id)).catch(() => {})
  }, [])

  // Debounce search
  const [searchInput, setSearchInput] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setShowDialog(true)
  }

  const handleDialogClose = () => {
    setShowDialog(false)
    setEditingUser(null)
  }

  const handleSaved = () => {
    handleDialogClose()
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteUserId) return
    try {
      await api.deleteUser(deleteUserId)
      toast.success(t("userDeleted"))
      setShowDeleteDialog(false)
      setDeleteUserId(null)
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedToDelete"))
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t("heading")}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowDialog(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t("addUser")}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : users.length === 0 ? (
        <div className="py-12 text-center rounded-lg border border-dashed bg-muted/30">
          <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">{t("noUsersFound")}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {search ? t("tryDifferentSearch") : t("createFirstUser")}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-5">
              <h4 className="text-sm font-semibold">{t("title")}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">{t("totalCount", { count: total })}</p>
            </div>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("username")}</TableHead>
                    <TableHead>{t("displayName")}</TableHead>
                    <TableHead>{t("email")}</TableHead>
                    <TableHead>{t("role")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("lastLogin")}</TableHead>
                    <TableHead className="text-right">{tc("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <span className="font-medium text-sm">{user.username}</span>
                        {user.id === currentUserId && (
                          <Badge variant="secondary" className="ml-2 text-[9px] px-1.5 py-0">
                            {t("you")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{user.display_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.email || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {user.role_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            user.is_active
                              ? "bg-green-500/10 text-green-600 border-green-200"
                              : "bg-red-500/10 text-red-600 border-red-200"
                          }`}
                        >
                          {user.is_active ? t("active") : t("inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {user.last_login_at
                          ? new Date(user.last_login_at).toLocaleString()
                          : t("never")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={t("resetPassword")}
                            onClick={() => {
                              setResetUserId(user.id)
                              setShowResetDialog(true)
                            }}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(user)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            disabled={user.id === currentUserId}
                            onClick={() => {
                              setDeleteUserId(user.id)
                              setShowDeleteDialog(true)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t("pageOf", { page, totalPages })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {tc("previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {tc("next")}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <UserDialog
        open={showDialog}
        onOpenChange={(open) => { if (!open) handleDialogClose() }}
        onSaved={handleSaved}
        editingUser={editingUser}
        roles={roles}
      />

      <ResetPasswordDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        userId={resetUserId}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteUser")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              {tc("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function UserDialog({
  open,
  onOpenChange,
  onSaved,
  editingUser,
  roles,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  editingUser: User | null
  roles: Role[]
}) {
  const t = useTranslations("settings.users")
  const tc = useTranslations("common")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [roleId, setRoleId] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editingUser) {
      setUsername(editingUser.username)
      setEmail(editingUser.email || "")
      setDisplayName(editingUser.display_name)
      setPassword("")
      setRoleId(editingUser.role_id)
      setIsActive(editingUser.is_active)
    } else {
      setUsername("")
      setEmail("")
      setDisplayName("")
      setPassword("")
      setRoleId(roles[0]?.id || "")
      setIsActive(true)
    }
    setShowPassword(false)
  }, [editingUser, open, roles])

  const handleSubmit = async () => {
    if (!username.trim()) {
      toast.error(t("usernameRequired"))
      return
    }
    if (!displayName.trim()) {
      toast.error(t("displayNameRequired"))
      return
    }
    if (!editingUser && !password) {
      toast.error(t("passwordRequired"))
      return
    }
    if (!editingUser && password.length < 6) {
      toast.error(t("passwordMinLength"))
      return
    }
    if (!roleId) {
      toast.error(t("selectRoleRequired"))
      return
    }

    setSaving(true)
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, {
          username: username.trim(),
          email: email.trim() || undefined,
          display_name: displayName.trim(),
          role_id: roleId,
          is_active: isActive,
        })
        toast.success(t("userUpdated"))
      } else {
        await api.createUser({
          username: username.trim(),
          email: email.trim() || undefined,
          display_name: displayName.trim(),
          password,
          role_id: roleId,
          is_active: isActive,
        })
        toast.success(t("userCreated"))
      }
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedToSave"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {editingUser ? t("editUser") : t("newUser")}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto space-y-4 px-4">
          <div className="space-y-2">
            <Label>{t("username")}</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="john.doe"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("displayName")}</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("emailOptional")}</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>
          {!editingUser && (
            <div className="space-y-2">
              <Label>{tc("password")}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("minSixChars")}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full w-10"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>{t("role")}</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger>
                <SelectValue placeholder={t("selectRole")} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="user-active" />
            <Label htmlFor="user-active" className="text-sm cursor-pointer">
              {t("active")}
            </Label>
          </div>
        </div>
        <SheetFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? tc("saving") : editingUser ? tc("saveChanges") : t("createUser")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function ResetPasswordDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string | null
}) {
  const t = useTranslations("settings.users")
  const tc = useTranslations("common")
  const [newPassword, setNewPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setNewPassword("")
      setShowPassword(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!userId) return
    if (newPassword.length < 6) {
      toast.error(t("passwordMinLength"))
      return
    }
    setSaving(true)
    try {
      await api.resetPassword(userId, { new_password: newPassword })
      toast.success(t("passwordResetSuccess"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedToResetPassword"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            {t("resetPassword")}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto space-y-4 px-4">
          <div className="space-y-2">
            <Label>{t("newPassword")}</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("minSixChars")}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full w-10"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        </div>
        <SheetFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                {t("resetting")}
              </>
            ) : (
              t("resetPassword")
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
