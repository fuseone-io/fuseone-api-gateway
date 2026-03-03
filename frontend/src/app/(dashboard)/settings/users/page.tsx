"use client"

import { useCallback, useEffect, useState } from "react"
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
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
      toast.error(err instanceof Error ? err.message : "Failed to load users")
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
      toast.success("User deleted")
      setShowDeleteDialog(false)
      setDeleteUserId(null)
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user")
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">User Management</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage user accounts for the API Gateway
          </p>
        </div>
        <Button size="sm" onClick={() => setShowDialog(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add User
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
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
          <p className="text-sm font-medium">No users found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {search ? "Try a different search term." : "Create the first user account."}
          </p>
        </div>
      ) : (
        <>
          <div>
            <div className="mb-3">
              <CardTitle className="text-base">Users</CardTitle>
              <CardDescription>{total} user{total !== 1 ? "s" : ""} total</CardDescription>
            </div>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <span className="font-medium text-sm">{user.username}</span>
                        {user.id === currentUserId && (
                          <Badge variant="secondary" className="ml-2 text-[9px] px-1.5 py-0">
                            You
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
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {user.last_login_at
                          ? new Date(user.last_login_at).toLocaleString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Reset password"
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
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
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

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      toast.error("Username is required")
      return
    }
    if (!displayName.trim()) {
      toast.error("Display name is required")
      return
    }
    if (!editingUser && !password) {
      toast.error("Password is required for new users")
      return
    }
    if (!editingUser && password.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }
    if (!roleId) {
      toast.error("Please select a role")
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
        toast.success("User updated")
      } else {
        await api.createUser({
          username: username.trim(),
          email: email.trim() || undefined,
          display_name: displayName.trim(),
          password,
          role_id: roleId,
          is_active: isActive,
        })
        toast.success("User created")
      }
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save user")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {editingUser ? "Edit User" : "New User"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="john.doe"
            />
          </div>
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <div className="space-y-2">
            <Label>Email (optional)</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>
          {!editingUser && (
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
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
            <Label>Role</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role..." />
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
              Active
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : editingUser ? "Save Changes" : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      toast.error("Password must be at least 6 characters")
      return
    }
    setSaving(true)
    try {
      await api.resetPassword(userId, { new_password: newPassword })
      toast.success("Password reset successfully")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Reset Password
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Resetting...
              </>
            ) : (
              "Reset Password"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
