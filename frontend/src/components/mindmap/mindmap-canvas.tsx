"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useMindmapStore } from "@/stores/mindmap-store"
import { mindmapNodeTypes, type EntityNodeData } from "./entity-node"
import { mindmapEdgeTypes, type RelationshipEdgeData } from "./relationship-edge"
import { MindmapToolbar } from "./mindmap-toolbar"
import { EntityEditorPanel } from "./entity-editor-panel"
import { RelationshipEditorPanel } from "./relationship-editor-panel"
import { Network } from "lucide-react"
import { calculateMindmapLayout } from "@/lib/mindmap-layout"
import type { MindmapEntity, MindmapRelationship } from "@/types/mindmap"
import { ENTITY_COLORS } from "@/types/mindmap"

// ---- Convert mindmap entities to React Flow nodes ----

function entitiesToNodes(
  entities: MindmapEntity[],
  positions: Record<string, { x: number; y: number }>,
  selectedId: string | null,
  onEdit: (entityId: string) => void
): Node<EntityNodeData>[] {
  return entities.map((entity) => ({
    id: entity.id,
    type: "entityNode",
    position: positions[entity.id] || { x: 100, y: 100 },
    data: {
      entity,
      isSelected: entity.id === selectedId,
      onEdit,
    },
  }))
}

// ---- Compute best handle pair based on node positions ----

function getBestHandles(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number }
): { sourceHandle: string; targetHandle: string } {
  const dx = targetPos.x - sourcePos.x
  const dy = targetPos.y - sourcePos.y

  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal: use right→left or left→right
    return dx >= 0
      ? { sourceHandle: "right-source", targetHandle: "left-target" }
      : { sourceHandle: "left-source", targetHandle: "right-target" }
  }
  // Vertical: use bottom→top or top→bottom
  return dy >= 0
    ? { sourceHandle: "bottom-source", targetHandle: "top-target" }
    : { sourceHandle: "top-source", targetHandle: "bottom-target" }
}

// ---- Convert relationships to React Flow edges ----

function relationshipsToEdges(
  relationships: MindmapRelationship[],
  positions: Record<string, { x: number; y: number }>,
  onEdit: (edgeId: string) => void
): Edge<RelationshipEdgeData>[] {
  return relationships.map((rel) => {
    const sourcePos = positions[rel.sourceEntityId] || { x: 0, y: 0 }
    const targetPos = positions[rel.targetEntityId] || { x: 0, y: 0 }
    const { sourceHandle, targetHandle } = getBestHandles(sourcePos, targetPos)

    return {
      id: rel.id,
      source: rel.sourceEntityId,
      target: rel.targetEntityId,
      sourceHandle,
      targetHandle,
      type: "relationshipEdge",
      data: {
        cardinality: rel.cardinality,
        sourceField: rel.sourceField,
        targetField: rel.targetField,
        label: rel.label,
        onEdit,
      },
    }
  })
}

// ---- Main Component ----

export function MindmapCanvas() {
  const doc = useMindmapStore((s) => s.currentDocument)
  const selectedEntityId = useMindmapStore((s) => s.selectedEntityId)
  const selectedRelationshipId = useMindmapStore((s) => s.selectedRelationshipId)
  const entityEditorOpen = useMindmapStore((s) => s.entityEditorOpen)
  const relationshipEditorOpen = useMindmapStore((s) => s.relationshipEditorOpen)
  const selectEntity = useMindmapStore((s) => s.selectEntity)
  const selectRelationship = useMindmapStore((s) => s.selectRelationship)
  const setEntityEditorOpen = useMindmapStore((s) => s.setEntityEditorOpen)
  const setRelationshipEditorOpen = useMindmapStore((s) => s.setRelationshipEditorOpen)
  const addEntity = useMindmapStore((s) => s.addEntity)
  const addRelationship = useMindmapStore((s) => s.addRelationship)
  const removeEntity = useMindmapStore((s) => s.removeEntity)
  const removeRelationship = useMindmapStore((s) => s.removeRelationship)
  const updateNodePosition = useMindmapStore((s) => s.updateNodePosition)
  const updateAllPositions = useMindmapStore((s) => s.updateAllPositions)
  const newDocument = useMindmapStore((s) => s.newDocument)

  type RFInstance = ReactFlowInstance<Node<EntityNodeData>, Edge<RelationshipEdgeData>>
  const rfInstanceRef = useRef<RFInstance | null>(null)

  // Auto-create document if none exists
  useEffect(() => {
    if (!doc) {
      newDocument("New API Mindmap")
    }
  }, [doc, newDocument])

  // ---- Callbacks for node/edge interaction ----

  const handleEditEntity = useCallback(
    (entityId: string) => {
      selectEntity(entityId)
      setEntityEditorOpen(true)
    },
    [selectEntity, setEntityEditorOpen]
  )

  const handleEditRelationship = useCallback(
    (edgeId: string) => {
      selectRelationship(edgeId)
      setRelationshipEditorOpen(true)
    },
    [selectRelationship, setRelationshipEditorOpen]
  )

  // ---- Build React Flow nodes/edges ----

  const rfNodes = useMemo(
    () =>
      entitiesToNodes(
        doc?.entities || [],
        doc?.nodePositions || {},
        selectedEntityId,
        handleEditEntity
      ),
    [doc?.entities, doc?.nodePositions, selectedEntityId, handleEditEntity]
  )

  const rfEdges = useMemo(
    () => relationshipsToEdges(doc?.relationships || [], doc?.nodePositions || {}, handleEditRelationship),
    [doc?.relationships, doc?.nodePositions, handleEditRelationship]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges)

  // Sync when store changes
  useEffect(() => {
    setNodes(rfNodes)
  }, [rfNodes, setNodes])

  useEffect(() => {
    setEdges(rfEdges)
  }, [rfEdges, setEdges])

  // ---- Handle node drag ----

  const handleNodesChange: typeof onNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes)
      // Persist position changes to store
      for (const change of changes) {
        if (change.type === "position" && change.position && !change.dragging) {
          updateNodePosition(change.id, change.position)
        }
      }
    },
    [onNodesChange, updateNodePosition]
  )

  // ---- Handle node click (select) ----

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectEntity(node.id)
    },
    [selectEntity]
  )

  // ---- Handle edge click (select) ----

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      selectRelationship(edge.id)
    },
    [selectRelationship]
  )

  // ---- Handle pane click (deselect) ----

  const handlePaneClick = useCallback(() => {
    selectEntity(null)
    selectRelationship(null)
  }, [selectEntity, selectRelationship])

  // ---- Handle new connection → create relationship ----

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      if (connection.source === connection.target) return // no self-ref

      // Check for duplicate
      const existing = doc?.relationships.find(
        (r) =>
          (r.sourceEntityId === connection.source && r.targetEntityId === connection.target) ||
          (r.sourceEntityId === connection.target && r.targetEntityId === connection.source)
      )
      if (existing) return

      const rel: MindmapRelationship = {
        id: crypto.randomUUID(),
        sourceEntityId: connection.source,
        targetEntityId: connection.target,
        cardinality: "1:N",
      }
      addRelationship(rel)

      // Open editor for the new relationship
      selectRelationship(rel.id)
      setRelationshipEditorOpen(true)
    },
    [doc?.relationships, addRelationship, selectRelationship, setRelationshipEditorOpen]
  )

  // ---- Connection validation ----

  const isValidConnection = useCallback(
    (connection: Edge<RelationshipEdgeData> | Connection) => {
      if (!connection.source || !connection.target) return false
      if (connection.source === connection.target) return false
      // No duplicate relationships
      const exists = doc?.relationships.some(
        (r) =>
          (r.sourceEntityId === connection.source && r.targetEntityId === connection.target) ||
          (r.sourceEntityId === connection.target && r.targetEntityId === connection.source)
      )
      return !exists
    },
    [doc?.relationships]
  )

  // ---- Delete selected entity/relationship on key ----

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedEntityId && !entityEditorOpen) {
          removeEntity(selectedEntityId)
        } else if (selectedRelationshipId && !relationshipEditorOpen) {
          removeRelationship(selectedRelationshipId)
        }
      }
    },
    [selectedEntityId, selectedRelationshipId, entityEditorOpen, relationshipEditorOpen, removeEntity, removeRelationship]
  )

  // ---- Add entity ----

  const handleAddEntity = useCallback(() => {
    const viewport = rfInstanceRef.current?.getViewport()
    const center = rfInstanceRef.current
      ? rfInstanceRef.current.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        })
      : { x: 200, y: 200 }

    const index = (doc?.entities.length || 0)
    const color = ENTITY_COLORS[index % ENTITY_COLORS.length].key

    const entity: MindmapEntity = {
      id: crypto.randomUUID(),
      name: `Entity${index + 1}`,
      fields: [
        {
          id: crypto.randomUUID(),
          name: "id",
          type: "uuid",
          required: true,
          isIdentifier: true,
        },
      ],
      crudOperations: ["list", "getById", "create", "update", "delete"],
      customOperations: [],
      color,
    }

    addEntity(entity)
    updateNodePosition(entity.id, center)

    // Open editor immediately
    selectEntity(entity.id)
    setEntityEditorOpen(true)
  }, [doc?.entities.length, addEntity, updateNodePosition, selectEntity, setEntityEditorOpen])

  // ---- Auto layout ----

  const handleAutoLayout = useCallback(() => {
    if (!doc) return
    const positions = calculateMindmapLayout(doc.entities, doc.relationships, doc.nodePositions)
    updateAllPositions(positions)
    // Fit view after layout
    setTimeout(() => rfInstanceRef.current?.fitView({ padding: 0.2 }), 100)
  }, [doc, updateAllPositions])

  // ---- Init ----

  const handleInit = useCallback((instance: RFInstance) => {
    rfInstanceRef.current = instance
    setTimeout(() => instance.fitView({ padding: 0.2 }), 200)
  }, [])

  if (!doc) return null

  return (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown} tabIndex={0}>
      <MindmapToolbar onAddEntity={handleAddEntity} onAutoLayout={handleAutoLayout} />

      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={handlePaneClick}
          onInit={handleInit}
          nodeTypes={mindmapNodeTypes}
          edgeTypes={mindmapEdgeTypes}
          isValidConnection={isValidConnection}
          fitView
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          deleteKeyCode={null} // We handle delete ourselves
          className="bg-background"
        >
          <Controls
            className="!bg-card !border-border !shadow-md [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-muted"
          />
          <MiniMap
            className="!bg-card !border-border"
            nodeColor={() => "hsl(var(--primary))"}
            maskColor="hsl(var(--muted) / 0.5)"
          />
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="hsl(var(--muted-foreground) / 0.15)"
          />

          {/* SVG arrow marker */}
          <svg className="absolute h-0 w-0">
            <defs>
              <marker
                id="arrowhead"
                viewBox="0 0 10 10"
                refX="10"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--muted-foreground))" />
              </marker>
            </defs>
          </svg>
        </ReactFlow>

        {/* Empty state overlay */}
        {doc.entities.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Network className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
              <p className="text-sm font-medium text-muted-foreground">Start by adding entities</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Click &quot;+ Entity&quot; or double-click the canvas
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Editor Panels */}
      <EntityEditorPanel
        open={entityEditorOpen}
        onOpenChange={setEntityEditorOpen}
        entityId={selectedEntityId}
      />
      <RelationshipEditorPanel
        open={relationshipEditorOpen}
        onOpenChange={setRelationshipEditorOpen}
        relationshipId={selectedRelationshipId}
      />
    </div>
  )
}
