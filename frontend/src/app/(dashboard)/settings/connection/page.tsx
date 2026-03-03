"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Plug,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
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
import { useEnvironmentStore } from "@/stores/environment-store"
import type { TestConnectionResult } from "@/types/environment"
import { toast } from "sonner"

interface TestState {
  loading: boolean
  result: TestConnectionResult | null
}

export default function ConnectionContent() {
  const { environments, activeEnvironmentId, fetchEnvironments } = useEnvironmentStore()
  const [loading, setLoading] = useState(true)
  const [testStates, setTestStates] = useState<Record<string, TestState>>({})

  const load = useCallback(async () => {
    try {
      await fetchEnvironments()
    } catch {
      toast.error("Failed to load environments")
    } finally {
      setLoading(false)
    }
  }, [fetchEnvironments])

  useEffect(() => {
    load()
  }, [load])

  const handleTest = async (envId: string) => {
    setTestStates((prev) => ({
      ...prev,
      [envId]: { loading: true, result: null },
    }))

    try {
      const result = await api.testEnvironmentConnection(envId)
      setTestStates((prev) => ({
        ...prev,
        [envId]: { loading: false, result },
      }))
      if (result.success) {
        toast.success(`Connection successful (${result.latency_ms}ms)`)
      } else {
        toast.error(result.message)
      }
    } catch (err) {
      setTestStates((prev) => ({
        ...prev,
        [envId]: {
          loading: false,
          result: { success: false, message: err instanceof Error ? err.message : "Connection failed" },
        },
      }))
      toast.error(err instanceof Error ? err.message : "Connection test failed")
    }
  }

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId)

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Gateway Connection</h3>
          <p className="text-sm text-muted-foreground mt-1">
            API Gateway endpoint configuration and health check
          </p>
        </div>
        <Skeleton className="h-[200px] rounded-lg" />
        <Skeleton className="h-[200px] rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Gateway Connection</h3>
        <p className="text-sm text-muted-foreground mt-1">
          API Gateway endpoint configuration and health check
        </p>
      </div>

      {/* Active environment card */}
      {activeEnv ? (
        <div className="rounded-lg border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: activeEnv.color || "#3b82f6" }}
              />
              <div>
                <h4 className="text-sm font-medium">{activeEnv.name}</h4>
                <p className="text-xs text-muted-foreground">Active Environment</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleTest(activeEnv.id)}
              disabled={testStates[activeEnv.id]?.loading}
            >
              {testStates[activeEnv.id]?.loading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Plug className="h-3.5 w-3.5 mr-1.5" />
              )}
              Test Connection
            </Button>
          </div>

          {testStates[activeEnv.id]?.result && (
            <div
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                testStates[activeEnv.id].result!.success
                  ? "bg-green-500/10 text-green-700"
                  : "bg-red-500/10 text-red-700"
              }`}
            >
              {testStates[activeEnv.id].result!.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{testStates[activeEnv.id].result!.message}</span>
              {testStates[activeEnv.id].result!.latency_ms != null && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {testStates[activeEnv.id].result!.latency_ms}ms
                </Badge>
              )}
            </div>
          )}

          <Separator />

          <div className="grid gap-3">
            <ConnectionField
              label="Admin API"
              value={activeEnv.admin_url}
              icon={<KeyRound className="h-3.5 w-3.5" />}
            />
            <ConnectionField
              label="Control API"
              value={activeEnv.control_url || "Not configured"}
              muted={!activeEnv.control_url}
              icon={<Plug className="h-3.5 w-3.5" />}
            />
            <ConnectionField
              label="Metrics Endpoint"
              value={activeEnv.metrics_url || "Not configured"}
              muted={!activeEnv.metrics_url}
              icon={<Plug className="h-3.5 w-3.5" />}
            />
          </div>
        </div>
      ) : (
        <div className="py-8 text-center rounded-lg border border-dashed bg-muted/30">
          <Plug className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">No active environment</p>
          <p className="text-xs text-muted-foreground mt-1">
            Configure an environment in the Environments tab.
          </p>
        </div>
      )}

      {/* All environments table */}
      {environments.length > 0 && (
        <div>
          <div className="mb-3">
            <CardTitle className="text-base">All Environments</CardTitle>
            <CardDescription>
              {environments.length} environment{environments.length !== 1 ? "s" : ""} configured
            </CardDescription>
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Environment</TableHead>
                  <TableHead>Admin API</TableHead>
                  <TableHead>Control API</TableHead>
                  <TableHead>Metrics</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {environments.map((env) => {
                  const state = testStates[env.id]
                  return (
                    <TableRow key={env.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: env.color || "#3b82f6" }}
                          />
                          <span className="font-medium text-sm">{env.name}</span>
                          {env.id === activeEnvironmentId && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                              Active
                            </Badge>
                          )}
                          {env.is_default && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-600">
                              Default
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px] block">
                          {env.admin_url || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-muted-foreground truncate max-w-[180px] block">
                          {env.control_url || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-muted-foreground truncate max-w-[180px] block">
                          {env.metrics_url || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {state?.result ? (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              state.result.success
                                ? "bg-green-500/10 text-green-600 border-green-200"
                                : "bg-red-500/10 text-red-600 border-red-200"
                            }`}
                          >
                            {state.result.success
                              ? `OK (${state.result.latency_ms}ms)`
                              : "Failed"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleTest(env.id)}
                          disabled={state?.loading}
                        >
                          {state?.loading ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Plug className="h-3 w-3 mr-1" />
                          )}
                          Test
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ExternalLink className="h-3 w-3" />
        <span>
          To edit connection details, switch to the{" "}
          <span className="font-medium text-foreground">Environments</span> tab.
        </span>
      </div>
    </div>
  )
}

function ConnectionField({
  label,
  value,
  muted,
  icon,
}: {
  label: string
  value: string
  muted?: boolean
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`text-sm font-mono truncate ${
            muted ? "text-muted-foreground/60 italic" : ""
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  )
}
