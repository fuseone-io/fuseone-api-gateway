"use client"

import { useEffect } from "react"
import { Check, ChevronDown, Server } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useEnvironmentStore } from "@/stores/environment-store"

export function EnvironmentSwitcher() {
  const { environments, activeEnvironmentId, loading, fetchEnvironments, setActiveEnvironment, activeEnvironment } =
    useEnvironmentStore()

  useEffect(() => {
    fetchEnvironments()
  }, [fetchEnvironments])

  const current = activeEnvironment()

  // Hide when only 1 environment
  if (environments.length <= 1) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={loading}>
          {current && (
            <Server
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: current.color }}
            />
          )}
          <span className="truncate max-w-[100px]">{current?.name ?? "Environment"}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {environments.map((env) => (
          <DropdownMenuItem
            key={env.id}
            onClick={() => setActiveEnvironment(env.id)}
            className="gap-2"
          >
            <Server
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: env.color }}
            />
            <span className="flex-1 truncate">{env.name}</span>
            {env.id === activeEnvironmentId && (
              <Check className="h-3.5 w-3.5 shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
