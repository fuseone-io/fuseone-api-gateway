"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Trash2,
  Power,
  PowerOff,
  ArrowRight,
  GitBranch,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { api } from "@/lib/api-client"
import { PageHeader } from "@/components/page-header"
import { apisixToApi, apisixServiceToApi } from "@/types/api"
import type { ApiDefinition } from "@/types/api"

export default function ApisPage() {
  const router = useRouter()
  const [apis, setApis] = useState<ApiDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<ApiDefinition | null>(null)

  const loadApis = async () => {
    try {
      const [servicesData, routesData] = await Promise.all([
        api.listResource("services"),
        api.listResource("routes"),
      ])

      const allRoutes = (routesData.list || []).map(
        (item) => ((item.value || item) as Record<string, unknown>)
      )
      const allServices = (servicesData.list || []).map(
        (item) => ((item.value || item) as Record<string, unknown>)
      )

      // Group routes by service_id
      const routesByService = new Map<string, Record<string, unknown>[]>()
      const orphanRoutes: Record<string, unknown>[] = []

      for (const route of allRoutes) {
        const serviceId = route.service_id as string | undefined
        if (serviceId) {
          const existing = routesByService.get(serviceId) || []
          existing.push(route)
          routesByService.set(serviceId, existing)
        } else {
          orphanRoutes.push(route)
        }
      }

      const result: ApiDefinition[] = []

      // Multi-flow APIs (Service + Routes)
      for (const svc of allServices) {
        const svcId = svc.id as string
        const routes = routesByService.get(svcId) || []
        result.push(apisixServiceToApi(svc, routes))
      }

      // Legacy single-route APIs (no service)
      for (const route of orphanRoutes) {
        result.push(apisixToApi(route))
      }

      setApis(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load APIs")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApis()
  }, [])

  const handleDelete = async () => {
    if (!deleteTarget?.id) return
    try {
      if (deleteTarget.serviceId) {
        // Delete all routes first, then service
        for (const flow of deleteTarget.flows) {
          if (flow.routeId) {
            await api.deleteResource("routes", flow.routeId)
          }
        }
        await api.deleteResource("services", deleteTarget.serviceId)
      } else {
        // Legacy: delete single route
        await api.deleteResource("routes", deleteTarget.id)
      }
      toast.success("API deleted")
      setDeleteTarget(null)
      loadApis()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete API")
    }
  }

  const filtered = apis.filter((a) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.flows.some((f) => f.entrypoint.uri.toLowerCase().includes(q))
    )
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="APIs"
        description="Manage your API definitions with visual flow design"
        actions={
          <Button asChild>
            <Link href="/apis/new">
              <Plus className="mr-2 h-4 w-4" />
              Create API
            </Link>
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search APIs..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* API Cards Grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg font-medium text-muted-foreground mb-2">
              {search ? "No APIs match your search" : "No APIs created yet"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {search
                ? "Try a different search term"
                : "Create your first API to get started with the visual flow designer"}
            </p>
            {!search && (
              <Button asChild>
                <Link href="/apis/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create API
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((apiDef) => {
            const firstFlow = apiDef.flows[0]
            const totalPolicies = apiDef.flows.reduce((sum, f) => sum + f.policies.length, 0)
            // Use serviceId for multi-flow APIs, id for legacy
            const linkId = apiDef.serviceId || apiDef.id

            return (
              <Card
                key={linkId}
                className="group cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
                onClick={() => router.push(`/apis/${linkId}`)}
              >
                <CardContent className="p-5">
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">
                        {apiDef.name || "Untitled API"}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {apiDef.description || "No description"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2" onClick={(e) => e.stopPropagation()}>
                      <Badge variant={apiDef.status === "enabled" ? "default" : "secondary"}>
                        {apiDef.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/apis/${linkId}`)}>
                            <Eye className="mr-2 h-3.5 w-3.5" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteTarget(apiDef)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Flows info */}
                  <div className="flex items-center gap-2 mb-3">
                    {apiDef.flows.length > 1 ? (
                      <Badge variant="outline" className="text-xs gap-1">
                        <GitBranch className="h-3 w-3" />
                        {apiDef.flows.length} flows
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-mono text-xs shrink-0">
                        {firstFlow?.entrypoint.methods.length
                          ? firstFlow.entrypoint.methods.join(", ")
                          : "ALL"}
                      </Badge>
                    )}
                    <span className="font-mono text-sm truncate">
                      {firstFlow?.entrypoint.uri || "/"}
                    </span>
                    {apiDef.flows.length > 1 && (
                      <Badge variant="secondary" className="text-[10px]">
                        +{apiDef.flows.length - 1}
                      </Badge>
                    )}
                  </div>

                  {/* Mini flow visualization */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="shrink-0">Client</span>
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    <Badge variant="secondary" className="text-[10px]">
                      {totalPolicies} {totalPolicies === 1 ? "policy" : "policies"}
                    </Badge>
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    <span className="font-mono truncate shrink-0">
                      {apiDef.endpoint.nodes[0]
                        ? `${apiDef.endpoint.nodes[0].host}:${apiDef.endpoint.nodes[0].port}`
                        : "upstream"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this API, all its flows, and its configuration from the gateway.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
