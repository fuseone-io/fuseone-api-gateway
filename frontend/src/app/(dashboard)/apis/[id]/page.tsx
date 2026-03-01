"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Save, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiFlowEditor } from "@/components/flow/api-flow-editor"
import { apisixToApi, apisixServiceToApi, apiToAPISIX } from "@/types/api"
import type { ApiDefinition } from "@/types/api"
import { api } from "@/lib/api-client"

export default function ApiDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [apiDef, setApiDef] = useState<ApiDefinition | null>(null)
  const [editDef, setEditDef] = useState<ApiDefinition | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  // Track original route IDs for deletion detection
  const [originalRouteIds, setOriginalRouteIds] = useState<string[]>([])

  useEffect(() => {
    loadApi()
  }, [id])

  const loadApi = async () => {
    try {
      // Try loading as Service first (multi-flow API)
      let parsed: ApiDefinition
      try {
        const svcData = await api.getResource("services", id)
        const svcValue = ((svcData as Record<string, unknown>).value || svcData) as Record<string, unknown>

        // Load routes belonging to this service
        const routesData = await api.listResource("routes")
        const serviceRoutes = routesData.list
          .map((n) => n.value as Record<string, unknown>)
          .filter((r) => r.service_id === id)

        parsed = apisixServiceToApi(svcValue, serviceRoutes)
        setOriginalRouteIds(serviceRoutes.map((r) => r.id as string))
      } catch {
        // Fallback: load as single Route (legacy API)
        const data = await api.getResource("routes", id)
        const value = ((data as Record<string, unknown>).value || data) as Record<string, unknown>
        parsed = apisixToApi(value)
        parsed.id = id
        setOriginalRouteIds(parsed.flows.map((f) => f.routeId).filter(Boolean) as string[])
      }

      setApiDef(parsed)
      setEditDef(parsed)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load API")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!editDef) return
    setSaving(true)
    try {
      const { service, routes } = apiToAPISIX(editDef)

      if (editDef.serviceId) {
        // Update existing Service
        await api.updateResource("services", editDef.serviceId, service)

        // Upsert routes
        const currentRouteIds: string[] = []
        for (const route of routes) {
          route.data.service_id = editDef.serviceId
          route.data.labels = { ...route.data.labels, _fuseone_api: editDef.serviceId }

          if (route.routeId) {
            await api.updateResource("routes", route.routeId, route.data)
            currentRouteIds.push(route.routeId)
          } else {
            const result = await api.createResource("routes", route.data) as Record<string, unknown>
            const value = (result.value || result) as Record<string, unknown>
            currentRouteIds.push(value.id as string)
          }
        }

        // Delete removed routes
        for (const oldId of originalRouteIds) {
          if (!currentRouteIds.includes(oldId)) {
            await api.deleteResource("routes", oldId)
          }
        }

        setOriginalRouteIds(currentRouteIds)
      } else {
        // Legacy single-route: update inline (first flow's route)
        const firstRoute = routes[0]
        if (firstRoute?.routeId) {
          // Build legacy format with inline upstream
          const legacyData = {
            ...firstRoute.data,
            upstream: service.upstream,
          }
          await api.updateResource("routes", firstRoute.routeId, legacyData)
        }
      }

      toast.success("API updated successfully")
      setApiDef(editDef)
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update API")
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditDef(apiDef)
    setEditing(false)
  }

  const startEditing = () => {
    setEditDef(apiDef)
    setEditing(true)
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    )
  }

  if (!apiDef || !editDef) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-lg font-medium text-muted-foreground">API not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/apis")}>
          Back to APIs
        </Button>
      </div>
    )
  }

  const current = editing ? editDef : apiDef

  return (
    <div className="flex flex-col -m-8 h-[calc(100vh-4rem)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-card shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push("/apis")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 min-w-0 flex items-center gap-3">
          {editing ? (
            <>
              <Input
                value={editDef!.name}
                onChange={(e) => setEditDef({ ...editDef!, name: e.target.value })}
                placeholder="API name"
                className="h-8 text-lg font-semibold border-0 bg-transparent shadow-none px-2 focus-visible:ring-0 placeholder:text-muted-foreground/50 max-w-xs"
              />
              <div className="w-px h-5 bg-border shrink-0" />
              <Input
                value={editDef!.description}
                onChange={(e) => setEditDef({ ...editDef!, description: e.target.value })}
                placeholder="Description..."
                className="h-8 text-sm border-0 bg-transparent shadow-none px-2 focus-visible:ring-0 placeholder:text-muted-foreground/50 flex-1"
              />
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold truncate">
                {current.name || "Untitled API"}
              </h1>
              <div className="w-px h-5 bg-border shrink-0" />
              <p className="text-sm text-muted-foreground truncate">
                {current.description || "No description"}
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <Switch
              checked={current.status === "enabled"}
              onCheckedChange={(checked) => {
                const status = checked ? "enabled" : "disabled"
                if (editing) {
                  setEditDef({ ...editDef!, status })
                } else {
                  startEditing()
                  setEditDef({ ...apiDef!, status })
                }
              }}
              disabled={!editing}
              className="scale-75"
            />
            <Badge variant={current.status === "enabled" ? "default" : "secondary"} className="text-[10px]">
              {current.status}
            </Badge>
          </div>
          {current.flows.length > 1 && (
            <Badge variant="outline" className="text-[10px]">
              {current.flows.length} flows
            </Badge>
          )}
          {editing ? (
            <>
              <Button variant="outline" onClick={handleCancel}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </>
          ) : (
            <Button onClick={startEditing}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Flow editor */}
      <div className="flex-1 min-h-0">
        <ApiFlowEditor
          api={current}
          onChange={(updated) => {
            if (editing) {
              setEditDef(updated)
            } else {
              startEditing()
              setEditDef(updated)
            }
          }}
          readOnly={!editing}
        />
      </div>
    </div>
  )
}
