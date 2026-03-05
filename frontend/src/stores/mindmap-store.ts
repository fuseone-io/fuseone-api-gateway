import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type {
  MindmapDocument,
  MindmapEntity,
  MindmapRelationship,
  EntityField,
  CrudOperation,
  CustomOperation,
  GenerationOptions,
} from "@/types/mindmap"
import { ENTITY_COLORS } from "@/types/mindmap"

interface MindmapState {
  // Current document
  currentDocument: MindmapDocument | null
  isDirty: boolean

  // Saved documents (persisted)
  savedDocuments: MindmapDocument[]

  // UI state
  selectedEntityId: string | null
  selectedRelationshipId: string | null
  entityEditorOpen: boolean
  relationshipEditorOpen: boolean
  generationOptions: GenerationOptions

  // Document actions
  newDocument: (name: string, description?: string) => void
  loadDocument: (id: string) => void
  saveDocument: () => void
  deleteDocument: (id: string) => void
  renameDocument: (name: string) => void
  setDescription: (description: string) => void

  // Entity CRUD
  addEntity: (entity: MindmapEntity) => void
  updateEntity: (id: string, updates: Partial<MindmapEntity>) => void
  removeEntity: (id: string) => void

  // Field management
  addField: (entityId: string, field: EntityField) => void
  updateField: (entityId: string, fieldId: string, updates: Partial<EntityField>) => void
  removeField: (entityId: string, fieldId: string) => void

  // Operation toggles
  toggleCrudOperation: (entityId: string, op: CrudOperation) => void
  addCustomOperation: (entityId: string, op: CustomOperation) => void
  removeCustomOperation: (entityId: string, opId: string) => void

  // Relationships
  addRelationship: (rel: MindmapRelationship) => void
  updateRelationship: (id: string, updates: Partial<MindmapRelationship>) => void
  removeRelationship: (id: string) => void

  // Positions
  updateNodePosition: (entityId: string, position: { x: number; y: number }) => void
  updateAllPositions: (positions: Record<string, { x: number; y: number }>) => void

  // UI
  selectEntity: (id: string | null) => void
  selectRelationship: (id: string | null) => void
  setEntityEditorOpen: (open: boolean) => void
  setRelationshipEditorOpen: (open: boolean) => void
  setGenerationOptions: (opts: Partial<GenerationOptions>) => void
}

function nextColor(entities: MindmapEntity[]): string {
  const used = new Set(entities.map((e) => e.color))
  const available = ENTITY_COLORS.find((c) => !used.has(c.key))
  return available?.key || ENTITY_COLORS[entities.length % ENTITY_COLORS.length].key
}

function updateDoc(doc: MindmapDocument): MindmapDocument {
  return { ...doc, updatedAt: new Date().toISOString() }
}

export const useMindmapStore = create<MindmapState>()(
  persist(
    (set, get) => ({
      currentDocument: null,
      isDirty: false,
      savedDocuments: [],
      selectedEntityId: null,
      selectedRelationshipId: null,
      entityEditorOpen: false,
      relationshipEditorOpen: false,
      generationOptions: {
        includeTimestamps: true,
        includePagination: true,
        generateContracts: true,
        generateMocks: false,
      },

      // --- Document actions ---

      newDocument: (name, description) => {
        const now = new Date().toISOString()
        set({
          currentDocument: {
            id: crypto.randomUUID(),
            name,
            description,
            entities: [],
            relationships: [],
            nodePositions: {},
            createdAt: now,
            updatedAt: now,
          },
          isDirty: false,
          selectedEntityId: null,
          selectedRelationshipId: null,
        })
      },

      loadDocument: (id) => {
        const doc = get().savedDocuments.find((d) => d.id === id)
        if (doc) {
          set({
            currentDocument: { ...doc },
            isDirty: false,
            selectedEntityId: null,
            selectedRelationshipId: null,
          })
        }
      },

      saveDocument: () => {
        const { currentDocument, savedDocuments } = get()
        if (!currentDocument) return
        const updated = updateDoc(currentDocument)
        const idx = savedDocuments.findIndex((d) => d.id === updated.id)
        const next = [...savedDocuments]
        if (idx >= 0) {
          next[idx] = updated
        } else {
          next.push(updated)
        }
        set({ currentDocument: updated, savedDocuments: next, isDirty: false })
      },

      deleteDocument: (id) => {
        const { currentDocument, savedDocuments } = get()
        set({
          savedDocuments: savedDocuments.filter((d) => d.id !== id),
          currentDocument: currentDocument?.id === id ? null : currentDocument,
        })
      },

      renameDocument: (name) => {
        const { currentDocument } = get()
        if (!currentDocument) return
        set({ currentDocument: { ...currentDocument, name }, isDirty: true })
      },

      setDescription: (description) => {
        const { currentDocument } = get()
        if (!currentDocument) return
        set({ currentDocument: { ...currentDocument, description }, isDirty: true })
      },

      // --- Entity CRUD ---

      addEntity: (entity) => {
        const { currentDocument } = get()
        if (!currentDocument) return
        const color = entity.color || nextColor(currentDocument.entities)
        const updated = {
          ...currentDocument,
          entities: [...currentDocument.entities, { ...entity, color }],
        }
        set({ currentDocument: updateDoc(updated), isDirty: true })
      },

      updateEntity: (id, updates) => {
        const { currentDocument } = get()
        if (!currentDocument) return
        const updated = {
          ...currentDocument,
          entities: currentDocument.entities.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        }
        set({ currentDocument: updateDoc(updated), isDirty: true })
      },

      removeEntity: (id) => {
        const { currentDocument } = get()
        if (!currentDocument) return
        const { [id]: _, ...positions } = currentDocument.nodePositions
        const updated = {
          ...currentDocument,
          entities: currentDocument.entities.filter((e) => e.id !== id),
          relationships: currentDocument.relationships.filter(
            (r) => r.sourceEntityId !== id && r.targetEntityId !== id
          ),
          nodePositions: positions,
        }
        set({
          currentDocument: updateDoc(updated),
          isDirty: true,
          selectedEntityId: get().selectedEntityId === id ? null : get().selectedEntityId,
        })
      },

      // --- Field management ---

      addField: (entityId, field) => {
        const { currentDocument } = get()
        if (!currentDocument) return
        const updated = {
          ...currentDocument,
          entities: currentDocument.entities.map((e) =>
            e.id === entityId ? { ...e, fields: [...e.fields, field] } : e
          ),
        }
        set({ currentDocument: updateDoc(updated), isDirty: true })
      },

      updateField: (entityId, fieldId, updates) => {
        const { currentDocument } = get()
        if (!currentDocument) return
        const updated = {
          ...currentDocument,
          entities: currentDocument.entities.map((e) =>
            e.id === entityId
              ? {
                  ...e,
                  fields: e.fields.map((f) =>
                    f.id === fieldId ? { ...f, ...updates } : f
                  ),
                }
              : e
          ),
        }
        set({ currentDocument: updateDoc(updated), isDirty: true })
      },

      removeField: (entityId, fieldId) => {
        const { currentDocument } = get()
        if (!currentDocument) return
        const updated = {
          ...currentDocument,
          entities: currentDocument.entities.map((e) =>
            e.id === entityId
              ? { ...e, fields: e.fields.filter((f) => f.id !== fieldId) }
              : e
          ),
        }
        set({ currentDocument: updateDoc(updated), isDirty: true })
      },

      // --- Operations ---

      toggleCrudOperation: (entityId, op) => {
        const { currentDocument } = get()
        if (!currentDocument) return
        const updated = {
          ...currentDocument,
          entities: currentDocument.entities.map((e) => {
            if (e.id !== entityId) return e
            const has = e.crudOperations.includes(op)
            return {
              ...e,
              crudOperations: has
                ? e.crudOperations.filter((o) => o !== op)
                : [...e.crudOperations, op],
            }
          }),
        }
        set({ currentDocument: updateDoc(updated), isDirty: true })
      },

      addCustomOperation: (entityId, op) => {
        const { currentDocument } = get()
        if (!currentDocument) return
        const updated = {
          ...currentDocument,
          entities: currentDocument.entities.map((e) =>
            e.id === entityId
              ? { ...e, customOperations: [...e.customOperations, op] }
              : e
          ),
        }
        set({ currentDocument: updateDoc(updated), isDirty: true })
      },

      removeCustomOperation: (entityId, opId) => {
        const { currentDocument } = get()
        if (!currentDocument) return
        const updated = {
          ...currentDocument,
          entities: currentDocument.entities.map((e) =>
            e.id === entityId
              ? { ...e, customOperations: e.customOperations.filter((o) => o.id !== opId) }
              : e
          ),
        }
        set({ currentDocument: updateDoc(updated), isDirty: true })
      },

      // --- Relationships ---

      addRelationship: (rel) => {
        const { currentDocument } = get()
        if (!currentDocument) return
        const updated = {
          ...currentDocument,
          relationships: [...currentDocument.relationships, rel],
        }
        set({ currentDocument: updateDoc(updated), isDirty: true })
      },

      updateRelationship: (id, updates) => {
        const { currentDocument } = get()
        if (!currentDocument) return
        const updated = {
          ...currentDocument,
          relationships: currentDocument.relationships.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }
        set({ currentDocument: updateDoc(updated), isDirty: true })
      },

      removeRelationship: (id) => {
        const { currentDocument } = get()
        if (!currentDocument) return
        const updated = {
          ...currentDocument,
          relationships: currentDocument.relationships.filter((r) => r.id !== id),
        }
        set({
          currentDocument: updateDoc(updated),
          isDirty: true,
          selectedRelationshipId: get().selectedRelationshipId === id ? null : get().selectedRelationshipId,
        })
      },

      // --- Positions ---

      updateNodePosition: (entityId, position) => {
        const { currentDocument } = get()
        if (!currentDocument) return
        set({
          currentDocument: {
            ...currentDocument,
            nodePositions: { ...currentDocument.nodePositions, [entityId]: position },
          },
          isDirty: true,
        })
      },

      updateAllPositions: (positions) => {
        const { currentDocument } = get()
        if (!currentDocument) return
        set({
          currentDocument: { ...currentDocument, nodePositions: positions },
          isDirty: true,
        })
      },

      // --- UI ---

      selectEntity: (id) => set({ selectedEntityId: id, selectedRelationshipId: null }),
      selectRelationship: (id) => set({ selectedRelationshipId: id, selectedEntityId: null }),

      setEntityEditorOpen: (open) => set({ entityEditorOpen: open }),
      setRelationshipEditorOpen: (open) => set({ relationshipEditorOpen: open }),

      setGenerationOptions: (opts) =>
        set({ generationOptions: { ...get().generationOptions, ...opts } }),
    }),
    {
      name: "fuseone:mindmap:documents",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        savedDocuments: state.savedDocuments,
        generationOptions: state.generationOptions,
      }),
    }
  )
)
