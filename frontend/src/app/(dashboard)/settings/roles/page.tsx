"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import {
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/api-client"
import { PERMISSION_GROUPS } from "@/lib/permissions"
import type { Role } from "@/types/auth"
import { toast } from "sonner"

export default function RolesContent() {
  const t = useTranslations("settings.roles")
  const tc = useTranslations("common")
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const data = await api.listRoles()
      setRoles(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedToLoad"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleEdit = (role: Role) => {
    setEditingRole(role)
    setShowDialog(true)
  }

  const handleDialogClose = () => {
    setShowDialog(false)
    setEditingRole(null)
  }

  const handleSaved = () => {
    handleDialogClose()
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteRoleId) return
    try {
      await api.deleteRole(deleteRoleId)
      toast.success(t("roleDeleted"))
      setShowDeleteDialog(false)
      setDeleteRoleId(null)
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedToDelete"))
    }
  }

  const formatPermissions = (perms: string[]) => {
    if (perms.length === 1 && perms[0] === "*") return t("fullAccess")
    return t("permissionCount", { count: perms.length })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t("title")}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowDialog(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t("addRole")}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : roles.length === 0 ? (
        <div className="py-12 text-center rounded-lg border border-dashed bg-muted/30">
          <ShieldCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">{t("noRolesConfigured")}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("noRolesDescription")}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-6">
          <div className="mb-5">
            <h4 className="text-sm font-semibold">{t("rolesLabel")}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{t("rolesCount", { count: roles.length })}</p>
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tc("name")}</TableHead>
                  <TableHead>{tc("description")}</TableHead>
                  <TableHead>{t("permissions")}</TableHead>
                  <TableHead>{tc("type")}</TableHead>
                  <TableHead className="text-right">{tc("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm">{role.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                      {role.description || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {formatPermissions(role.permissions)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {role.is_system ? (
                        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-200">
                          {t("system")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {tc("custom")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={role.is_system}
                          onClick={() => handleEdit(role)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          disabled={role.is_system}
                          onClick={() => {
                            setDeleteRoleId(role.id)
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
      )}

      <RoleDialog
        open={showDialog}
        onOpenChange={(open) => { if (!open) handleDialogClose() }}
        onSaved={handleSaved}
        editingRole={editingRole}
      />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteRole")}</DialogTitle>
            <DialogDescription>
              {t("deleteConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RoleDialog({
  open,
  onOpenChange,
  onSaved,
  editingRole,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  editingRole: Role | null
}) {
  const t = useTranslations("settings.roles")
  const tc = useTranslations("common")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [permissions, setPermissions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editingRole) {
      setName(editingRole.name)
      setDescription(editingRole.description)
      setPermissions([...editingRole.permissions])
    } else {
      setName("")
      setDescription("")
      setPermissions([])
    }
  }, [editingRole, open])

  const togglePermission = (perm: string) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    )
  }

  const toggleGroup = (groupPerms: readonly string[]) => {
    const allSelected = groupPerms.every((p) => permissions.includes(p))
    if (allSelected) {
      setPermissions((prev) => prev.filter((p) => !groupPerms.includes(p)))
    } else {
      setPermissions((prev) => {
        const newPerms = [...prev]
        for (const p of groupPerms) {
          if (!newPerms.includes(p)) newPerms.push(p)
        }
        return newPerms
      })
    }
  }

  const selectAll = () => {
    const all = PERMISSION_GROUPS.flatMap((g) => g.permissions)
    setPermissions([...all])
  }

  const clearAll = () => {
    setPermissions([])
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t("roleNameRequired"))
      return
    }
    if (permissions.length === 0) {
      toast.error(t("selectAtLeastOnePermission"))
      return
    }

    setSaving(true)
    try {
      if (editingRole) {
        await api.updateRole(editingRole.id, {
          name: name.trim(),
          description: description.trim(),
          permissions,
        })
        toast.success(t("roleUpdated"))
      } else {
        await api.createRole({
          name: name.trim(),
          description: description.trim(),
          permissions,
        })
        toast.success(t("roleCreated"))
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
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {editingRole ? t("editRole") : t("newRole")}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto space-y-4 px-4">
          <div className="space-y-2">
            <Label>{tc("name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., api-manager"
            />
          </div>
          <div className="space-y-2">
            <Label>{tc("description")}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this role can do..."
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("permissions")}</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={selectAll}>
                  {t("selectAll")}
                </Button>
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={clearAll}>
                  {t("clear")}
                </Button>
              </div>
            </div>
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {PERMISSION_GROUPS.map((group) => {
                const allSelected = group.permissions.every((p) => permissions.includes(p))
                const someSelected = group.permissions.some((p) => permissions.includes(p))
                return (
                  <div key={group.group} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={() => toggleGroup(group.permissions)}
                        id={`group-${group.group}`}
                      />
                      <label
                        htmlFor={`group-${group.group}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {group.group}
                      </label>
                    </div>
                    <div className="ml-6 flex flex-wrap gap-x-4 gap-y-1">
                      {group.permissions.map((perm) => (
                        <div key={perm} className="flex items-center gap-1.5">
                          <Checkbox
                            checked={permissions.includes(perm)}
                            onCheckedChange={() => togglePermission(perm)}
                            id={`perm-${perm}`}
                          />
                          <label
                            htmlFor={`perm-${perm}`}
                            className="text-xs text-muted-foreground cursor-pointer"
                          >
                            {perm.split(":")[1]}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("permissionsSelected", { count: permissions.length })}
            </p>
          </div>
        </div>
        <SheetFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? tc("saving") : editingRole ? tc("saveChanges") : t("createRole")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
