// Auto-layout algorithm for mindmap entities
// When positions exist: snaps to a clean grid preserving the user's relative arrangement
// When no positions: relationship-aware grid from scratch

import type { MindmapEntity, MindmapRelationship } from "@/types/mindmap"

const NODE_WIDTH = 280
const NODE_HEIGHT = 200
const H_GAP = 100
const V_GAP = 80
const COLS = 3
const GRID_STEP_X = NODE_WIDTH + H_GAP   // 380
const GRID_STEP_Y = NODE_HEIGHT + V_GAP  // 280
const PADDING = 40

/**
 * Main layout function.
 * If currentPositions has entries, it aligns existing positions to a clean grid.
 * Otherwise it creates a fresh grid layout with relationship-aware ordering.
 */
export function calculateMindmapLayout(
  entities: MindmapEntity[],
  relationships: MindmapRelationship[],
  currentPositions?: Record<string, { x: number; y: number }>
): Record<string, { x: number; y: number }> {
  if (entities.length === 0) return {}

  // Check if we have existing positions for most entities
  const hasPositions =
    currentPositions &&
    entities.filter((e) => currentPositions[e.id]).length > entities.length / 2

  if (hasPositions) {
    return alignToGrid(entities, currentPositions!)
  }

  return freshGridLayout(entities, relationships)
}

/**
 * Snap existing positions to a clean grid while preserving relative arrangement.
 * 1. Sort entities by their current position (top-to-bottom, left-to-right)
 * 2. Assign each to the nearest free grid cell, respecting their relative order
 */
function alignToGrid(
  entities: MindmapEntity[],
  currentPositions: Record<string, { x: number; y: number }>
): Record<string, { x: number; y: number }> {
  // Sort entities by their current position: row-major order (y first, then x)
  const sorted = [...entities].sort((a, b) => {
    const pa = currentPositions[a.id] || { x: 0, y: 0 }
    const pb = currentPositions[b.id] || { x: 0, y: 0 }
    // Quantize Y to detect "same row" (within half a grid step)
    const rowA = Math.round(pa.y / GRID_STEP_Y)
    const rowB = Math.round(pb.y / GRID_STEP_Y)
    if (rowA !== rowB) return rowA - rowB
    return pa.x - pb.x
  })

  const positions: Record<string, { x: number; y: number }> = {}
  const occupied = new Set<string>()

  for (const entity of sorted) {
    const pos = currentPositions[entity.id] || { x: 0, y: 0 }

    // Snap to nearest grid cell
    let col = Math.round((pos.x - PADDING) / GRID_STEP_X)
    let row = Math.round((pos.y - PADDING) / GRID_STEP_Y)
    col = Math.max(0, col)
    row = Math.max(0, row)

    // If occupied, find nearest free cell
    let key = `${col},${row}`
    if (occupied.has(key)) {
      const free = findNearestFreeCell(col, row, occupied)
      col = free.col
      row = free.row
      key = `${col},${row}`
    }

    occupied.add(key)
    positions[entity.id] = {
      x: col * GRID_STEP_X + PADDING,
      y: row * GRID_STEP_Y + PADDING,
    }
  }

  return positions
}

/**
 * Find the nearest free grid cell using BFS spiral outward.
 */
function findNearestFreeCell(
  startCol: number,
  startRow: number,
  occupied: Set<string>
): { col: number; row: number } {
  for (let dist = 1; dist < 20; dist++) {
    // Check cells at manhattan distance `dist`, prefer right then down
    for (let dc = -dist; dc <= dist; dc++) {
      for (let dr = -dist; dr <= dist; dr++) {
        if (Math.abs(dc) + Math.abs(dr) !== dist) continue
        const c = startCol + dc
        const r = startRow + dr
        if (c < 0 || r < 0) continue
        if (!occupied.has(`${c},${r}`)) return { col: c, row: r }
      }
    }
  }
  return { col: startCol + 1, row: startRow }
}

/**
 * Fresh grid layout: relationship-aware ordering (roots → children → independent).
 */
function freshGridLayout(
  entities: MindmapEntity[],
  relationships: MindmapRelationship[]
): Record<string, { x: number; y: number }> {
  const childOf = new Set<string>()
  for (const rel of relationships) {
    if (rel.cardinality === "1:N") {
      childOf.add(rel.targetEntityId)
    }
  }

  const hasRelationship = new Set<string>()
  for (const rel of relationships) {
    hasRelationship.add(rel.sourceEntityId)
    hasRelationship.add(rel.targetEntityId)
  }

  const roots: MindmapEntity[] = []
  const children: MindmapEntity[] = []
  const independent: MindmapEntity[] = []

  for (const entity of entities) {
    if (childOf.has(entity.id)) {
      children.push(entity)
    } else if (hasRelationship.has(entity.id)) {
      roots.push(entity)
    } else {
      independent.push(entity)
    }
  }

  const ordered = [...roots, ...children, ...independent]
  const positions: Record<string, { x: number; y: number }> = {}

  ordered.forEach((entity, idx) => {
    const col = idx % COLS
    const row = Math.floor(idx / COLS)
    positions[entity.id] = {
      x: col * GRID_STEP_X + PADDING,
      y: row * GRID_STEP_Y + PADDING,
    }
  })

  return positions
}

export { NODE_WIDTH, NODE_HEIGHT }
