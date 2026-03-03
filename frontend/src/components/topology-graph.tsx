"use client"

import { useCallback, useMemo } from "react"
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { CheckCircle2, XCircle, Server } from "lucide-react"
import type { MeshService, ServiceDependency } from "@/types/mesh"

// ---- Auto-layout calculation ----

const NODE_WIDTH = 240
const NODE_HEIGHT = 100
const H_GAP = 80
const V_GAP = 60
const COLS = 4

function calculateNodePositions(services: MeshService[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}
  services.forEach((service, idx) => {
    const col = idx % COLS
    const row = Math.floor(idx / COLS)
    positions[service.id] = {
      x: col * (NODE_WIDTH + H_GAP) + 40,
      y: row * (NODE_HEIGHT + V_GAP) + 40,
    }
  })
  return positions
}

// ---- Custom node data type ----

type ServiceNodeData = {
  label: string
  discoveryType: string
  healthyCount: number
  unhealthyCount: number
  totalCount: number
  hasUnhealthy: boolean
}

// ---- Custom service node component ----

function ServiceNodeComponent({ data }: NodeProps<Node<ServiceNodeData>>) {
  const borderColor = data.hasUnhealthy
    ? "border-red-500/60"
    : data.totalCount > 0
      ? "border-emerald-500/60"
      : "border-muted"

  const discoveryColors: Record<string, string> = {
    dns: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    consul: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
    nacos: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    eureka: "bg-green-500/10 text-green-700 dark:text-green-400",
    kubernetes: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
    static: "bg-muted text-muted-foreground",
  }

  const discoveryClass =
    discoveryColors[data.discoveryType?.toLowerCase()] || discoveryColors.static

  return (
    <div
      className={`rounded-lg border-2 bg-card shadow-sm px-4 py-3 min-w-[200px] ${borderColor}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2" />

      <div className="flex items-center gap-2 mb-2">
        <Server className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold truncate">{data.label}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] font-medium rounded px-1.5 py-0.5 ${discoveryClass}`}
        >
          {data.discoveryType}
        </span>

        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-0.5 text-emerald-600">
            <CheckCircle2 className="h-3 w-3" />
            {data.healthyCount}
          </span>
          {data.unhealthyCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-red-600">
              <XCircle className="h-3 w-3" />
              {data.unhealthyCount}
            </span>
          )}
          <span className="text-muted-foreground">
            / {data.totalCount}
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2" />
    </div>
  )
}

const nodeTypes = {
  serviceNode: ServiceNodeComponent,
}

// ---- Edge styling ----

function buildEdgeStyle(type: "route" | "plugin_reference") {
  if (type === "route") {
    return {
      stroke: "hsl(var(--primary))",
      strokeWidth: 2,
    }
  }
  return {
    stroke: "hsl(var(--muted-foreground))",
    strokeWidth: 1,
    strokeDasharray: "5 5",
  }
}

// ---- Main component ----

interface TopologyGraphProps {
  services: MeshService[]
  dependencies: ServiceDependency[]
  className?: string
}

export function TopologyGraph({ services, dependencies, className }: TopologyGraphProps) {
  const positions = useMemo(() => calculateNodePositions(services), [services])

  const initialNodes: Node<ServiceNodeData>[] = useMemo(
    () =>
      services.map((service) => ({
        id: service.id,
        type: "serviceNode",
        position: positions[service.id] || { x: 0, y: 0 },
        data: {
          label: service.name,
          discoveryType: service.discovery_type,
          healthyCount: service.healthy_count,
          unhealthyCount: service.unhealthy_count,
          totalCount: service.total_count,
          hasUnhealthy: service.unhealthy_count > 0,
        },
      })),
    [services, positions]
  )

  const initialEdges: Edge[] = useMemo(
    () =>
      dependencies.map((dep, idx) => ({
        id: `edge-${idx}`,
        source: dep.source,
        target: dep.target,
        label: dep.label || dep.type,
        animated: dep.type === "route",
        style: buildEdgeStyle(dep.type),
        labelStyle: {
          fontSize: 10,
          fill: "hsl(var(--muted-foreground))",
        },
        labelBgStyle: {
          fill: "hsl(var(--card))",
          fillOpacity: 0.9,
        },
        labelBgPadding: [4, 2] as [number, number],
      })),
    [dependencies]
  )

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 100)
  }, [])

  if (services.length === 0) {
    return (
      <div className={`flex items-center justify-center h-[500px] text-muted-foreground ${className || ""}`}>
        <div className="text-center">
          <Server className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm">Nenhum servico para exibir na topologia</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-[600px] w-full rounded-lg border bg-card ${className || ""}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          className="!bg-card !border-border !shadow-md [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-muted"
        />
        <MiniMap
          className="!bg-card !border-border"
          nodeColor={() => "hsl(var(--primary))"}
          maskColor="hsl(var(--muted) / 0.5)"
        />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--muted-foreground) / 0.15)" />
      </ReactFlow>
    </div>
  )
}
