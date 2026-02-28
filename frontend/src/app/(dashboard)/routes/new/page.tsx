"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/api-client"

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]

export default function NewRoutePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: "",
    desc: "",
    uri: "",
    host: "",
    methods: [] as string[],
    upstream_nodes: "",
    upstream_type: "roundrobin",
  })

  const toggleMethod = (method: string) => {
    setForm((prev) => ({
      ...prev,
      methods: prev.methods.includes(method)
        ? prev.methods.filter((m) => m !== method)
        : [...prev.methods, method],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Parse upstream nodes (format: host:port=weight, ...)
      const nodes: Record<string, number> = {}
      if (form.upstream_nodes) {
        form.upstream_nodes.split(",").forEach((n) => {
          const [addr, weight] = n.trim().split("=")
          nodes[addr] = parseInt(weight || "1", 10)
        })
      }

      const routeData: Record<string, unknown> = {
        name: form.name || undefined,
        desc: form.desc || undefined,
        uri: form.uri,
        methods: form.methods.length > 0 ? form.methods : undefined,
        host: form.host || undefined,
        status: 1,
      }

      if (Object.keys(nodes).length > 0) {
        routeData.upstream = {
          type: form.upstream_type,
          nodes,
        }
      }

      await api.createResource("routes", routeData)
      toast.success("Route created successfully")
      router.push("/routes")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create route")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Route</h1>
        <p className="text-muted-foreground">
          Configure a new API route
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="my-api-route"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="host">Host (optional)</Label>
                <Input
                  id="host"
                  placeholder="api.example.com"
                  value={form.host}
                  onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="uri">URI *</Label>
              <Input
                id="uri"
                placeholder="/api/v1/*"
                value={form.uri}
                onChange={(e) => setForm((f) => ({ ...f, uri: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                placeholder="Route description..."
                value={form.desc}
                onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>HTTP Methods</Label>
              <div className="flex flex-wrap gap-3">
                {HTTP_METHODS.map((method) => (
                  <label
                    key={method}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={form.methods.includes(method)}
                      onCheckedChange={() => toggleMethod(method)}
                    />
                    {method}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to match all methods
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator className="my-6" />

        <Card>
          <CardHeader>
            <CardTitle>Upstream</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="upstream_nodes">Upstream Nodes</Label>
              <Input
                id="upstream_nodes"
                placeholder="127.0.0.1:8080=1, 127.0.0.1:8081=1"
                value={form.upstream_nodes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, upstream_nodes: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Format: host:port=weight (comma-separated)
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/routes")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Route"}
          </Button>
        </div>
      </form>
    </div>
  )
}
