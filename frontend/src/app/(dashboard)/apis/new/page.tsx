"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { ApiFlowEditor } from "@/components/flow/api-flow-editor"
import { apiToAPISIX } from "@/types/api"
import type { ApiDefinition } from "@/types/api"
import { api } from "@/lib/api-client"

const DEFAULT_API: ApiDefinition = {
  name: "",
  description: "",
  status: "enabled",
  endpoint: {
    nodes: [{ host: "127.0.0.1", port: 80, weight: 1 }],
    type: "roundrobin",
    scheme: "http",
  },
  flows: [
    {
      id: crypto.randomUUID(),
      name: "Default Flow",
      entrypoint: { uri: "", hosts: [], methods: [] },
      policies: [],
    },
  ],
}

export default function NewApiPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [apiDef, setApiDef] = useState<ApiDefinition>(DEFAULT_API)

  const firstFlow = apiDef.flows[0]
  const canSave =
    firstFlow &&
    !!firstFlow.entrypoint.uri &&
    apiDef.endpoint.nodes.length > 0 &&
    !!apiDef.endpoint.nodes[0]?.host

  const handleSave = async () => {
    if (!canSave) {
      toast.error("At least one flow with URI and one upstream node are required")
      return
    }
    setSaving(true)
    try {
      const { service, routes } = apiToAPISIX(apiDef)

      // 1. Create APISIX Service (holds shared upstream)
      const svcResult = await api.createResource("services", service) as Record<string, unknown>
      const svcValue = (svcResult.value || svcResult) as Record<string, unknown>
      const serviceId = svcValue.id as string

      // 2. Create Routes for each flow
      for (const route of routes) {
        route.data.service_id = serviceId
        route.data.labels = { ...route.data.labels, _fuseone_api: serviceId }
        await api.createResource("routes", route.data)
      }

      toast.success("API created successfully")
      router.push("/apis")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create API")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col -m-8 h-[calc(100vh-4rem)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-card shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push("/apis")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 min-w-0 flex items-center gap-3">
          <Input
            value={apiDef.name}
            onChange={(e) => setApiDef({ ...apiDef, name: e.target.value })}
            placeholder="API name"
            className="h-8 text-lg font-semibold border-0 bg-transparent shadow-none px-2 focus-visible:ring-0 placeholder:text-muted-foreground/50 max-w-xs"
          />
          <div className="w-px h-5 bg-border shrink-0" />
          <Input
            value={apiDef.description}
            onChange={(e) => setApiDef({ ...apiDef, description: e.target.value })}
            placeholder="Description..."
            className="h-8 text-sm border-0 bg-transparent shadow-none px-2 focus-visible:ring-0 placeholder:text-muted-foreground/50 flex-1"
          />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <Switch
              checked={apiDef.status === "enabled"}
              onCheckedChange={(checked) =>
                setApiDef({ ...apiDef, status: checked ? "enabled" : "disabled" })
              }
              className="scale-75"
            />
            <Badge variant={apiDef.status === "enabled" ? "default" : "secondary"} className="text-[10px]">
              {apiDef.status}
            </Badge>
          </div>
          <Button variant="outline" onClick={() => router.push("/apis")}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !canSave}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Creating..." : "Create API"}
          </Button>
        </div>
      </div>

      {/* Flow editor fills remaining space */}
      <div className="flex-1 min-h-0">
        <ApiFlowEditor api={apiDef} onChange={setApiDef} />
      </div>
    </div>
  )
}
