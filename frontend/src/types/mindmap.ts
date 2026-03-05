// Types for the API Mindmap — visual entity/relationship canvas that generates ApiDefinitions

export type FieldType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object"
  | "uuid"
  | "email"
  | "datetime"
  | "uri"

export interface EntityField {
  id: string
  name: string
  type: FieldType
  format?: string
  required: boolean
  description?: string
  isIdentifier?: boolean // marks PK field (e.g., "id")
  isArray?: boolean // wrap in array
}

export type CrudOperation = "list" | "getById" | "create" | "update" | "delete"

export interface CustomOperation {
  id: string
  name: string
  method: string // HTTP method
  pathSuffix: string // e.g., "/:id/activate"
  description?: string
}

export interface MindmapEntity {
  id: string
  name: string
  pluralName?: string // auto-derived if empty
  fields: EntityField[]
  crudOperations: CrudOperation[]
  customOperations: CustomOperation[]
  color?: string
}

export type RelationshipCardinality = "1:1" | "1:N" | "N:N"

export interface MindmapRelationship {
  id: string
  sourceEntityId: string
  targetEntityId: string
  cardinality: RelationshipCardinality
  sourceField?: string // e.g., "id" on User
  targetField?: string // e.g., "userId" on Order
  label?: string
}

export interface MindmapDocument {
  id: string
  name: string
  description?: string
  entities: MindmapEntity[]
  relationships: MindmapRelationship[]
  nodePositions: Record<string, { x: number; y: number }>
  createdAt: string
  updatedAt: string
}

export interface GenerationOptions {
  contextPath?: string
  includeTimestamps?: boolean
  includePagination?: boolean
  generateMocks?: boolean
  generateContracts?: boolean
  apiName?: string
  apiDescription?: string
}

// Entity color palette
export const ENTITY_COLORS = [
  { key: "blue", bg: "bg-blue-500/15", border: "border-blue-500/40", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  { key: "purple", bg: "bg-purple-500/15", border: "border-purple-500/40", text: "text-purple-600 dark:text-purple-400", dot: "bg-purple-500" },
  { key: "emerald", bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  { key: "amber", bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  { key: "red", bg: "bg-red-500/15", border: "border-red-500/40", text: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  { key: "cyan", bg: "bg-cyan-500/15", border: "border-cyan-500/40", text: "text-cyan-600 dark:text-cyan-400", dot: "bg-cyan-500" },
  { key: "pink", bg: "bg-pink-500/15", border: "border-pink-500/40", text: "text-pink-600 dark:text-pink-400", dot: "bg-pink-500" },
  { key: "indigo", bg: "bg-indigo-500/15", border: "border-indigo-500/40", text: "text-indigo-600 dark:text-indigo-400", dot: "bg-indigo-500" },
] as const

export function getEntityColor(colorKey?: string) {
  return ENTITY_COLORS.find((c) => c.key === colorKey) || ENTITY_COLORS[0]
}

// Field type display labels
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  string: "Text",
  number: "Decimal",
  integer: "Integer",
  boolean: "Boolean",
  array: "Array",
  object: "Object",
  uuid: "UUID",
  email: "Email",
  datetime: "Date/Time",
  uri: "URL",
}

// CRUD operation labels
export const CRUD_LABELS: Record<CrudOperation, { label: string; method: string; description: string }> = {
  list: { label: "List", method: "GET", description: "List all items" },
  getById: { label: "Get by ID", method: "GET", description: "Get a single item by ID" },
  create: { label: "Create", method: "POST", description: "Create a new item" },
  update: { label: "Update", method: "PUT", description: "Update an existing item" },
  delete: { label: "Delete", method: "DELETE", description: "Delete an item" },
}
