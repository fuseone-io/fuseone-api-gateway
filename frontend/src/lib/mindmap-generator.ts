// Generation engine: converts MindmapDocument → ApiDefinition

import type {
  MindmapDocument,
  MindmapEntity,
  EntityField,
  GenerationOptions,
  CrudOperation,
} from "@/types/mindmap"
import type {
  ApiDefinition,
  ApiFlow,
  FlowContract,
  JsonSchemaDefinition,
  ContractParameter,
  ContractResponse,
  PolicyInstance,
} from "@/types/api"
import {
  generateExampleFromSchema,
  contractToMockConfig,
} from "@/lib/contract-utils"

// --- Pluralize helper (simple English rules) ---

function pluralize(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith("s") || lower.endsWith("x") || lower.endsWith("z") || lower.endsWith("ch") || lower.endsWith("sh"))
    return lower + "es"
  if (lower.endsWith("y") && !/[aeiou]y$/i.test(lower))
    return lower.slice(0, -1) + "ies"
  return lower + "s"
}

function getPlural(entity: MindmapEntity): string {
  return entity.pluralName?.toLowerCase() || pluralize(entity.name)
}

// --- Field → JsonSchemaDefinition ---

function fieldToSchema(field: EntityField): JsonSchemaDefinition {
  let schema: JsonSchemaDefinition

  switch (field.type) {
    case "uuid":
      schema = { type: "string", format: "uuid" }
      break
    case "email":
      schema = { type: "string", format: "email" }
      break
    case "datetime":
      schema = { type: "string", format: "date-time" }
      break
    case "uri":
      schema = { type: "string", format: "uri" }
      break
    default:
      schema = { type: field.type }
  }

  if (field.format && !schema.format) {
    schema.format = field.format
  }
  if (field.description) {
    schema.description = field.description
  }

  if (field.isArray) {
    return { type: "array", items: schema }
  }

  return schema
}

// --- Entity → Full object schema ---

function entityToSchema(
  entity: MindmapEntity,
  options: GenerationOptions,
  excludeFields?: string[]
): JsonSchemaDefinition {
  const properties: Record<string, JsonSchemaDefinition> = {}
  const required: string[] = []

  for (const field of entity.fields) {
    if (excludeFields?.includes(field.name)) continue
    properties[field.name] = fieldToSchema(field)
    if (field.required) required.push(field.name)
  }

  if (options.includeTimestamps) {
    properties.created_at = { type: "string", format: "date-time", description: "Creation timestamp" }
    properties.updated_at = { type: "string", format: "date-time", description: "Last update timestamp" }
  }

  return { type: "object", properties, ...(required.length > 0 ? { required } : {}) }
}

// --- Error schema ---

function errorSchema(message: string): JsonSchemaDefinition {
  return {
    type: "object",
    properties: {
      error: { type: "string", description: "Error message" },
      code: { type: "integer", description: "Error code" },
    },
    required: ["error"],
  }
}

// --- Pagination wrapper ---

function paginatedSchema(itemSchema: JsonSchemaDefinition): JsonSchemaDefinition {
  return {
    type: "object",
    properties: {
      items: { type: "array", items: itemSchema },
      total: { type: "integer", description: "Total number of items" },
      page: { type: "integer", description: "Current page number" },
      per_page: { type: "integer", description: "Items per page" },
    },
    required: ["items", "total"],
  }
}

// --- Generate a single flow ---

function makeFlow(params: {
  name: string
  method: string
  uri: string
  contract?: FlowContract
  mockConfig?: Record<string, unknown>
}): ApiFlow {
  const policies: PolicyInstance[] = []

  if (params.mockConfig) {
    policies.push({
      id: crypto.randomUUID(),
      name: "mocking",
      phase: "request",
      enabled: true,
      config: params.mockConfig,
    })
  }

  return {
    id: crypto.randomUUID(),
    name: params.name,
    entrypoint: {
      uri: params.uri,
      hosts: [],
      methods: [params.method],
    },
    policies,
    contract: params.contract,
  }
}

// --- Build flows for one entity ---

function entityToFlows(
  entity: MindmapEntity,
  options: GenerationOptions
): ApiFlow[] {
  const flows: ApiFlow[] = []
  const plural = getPlural(entity)
  const fullSchema = entityToSchema(entity, options)
  const idFields = entity.fields.filter((f) => f.isIdentifier).map((f) => f.name)
  const createSchema = entityToSchema(entity, options, idFields)

  const opFlows: Record<CrudOperation, () => ApiFlow> = {
    list: () => {
      const responseSchema = options.includePagination
        ? paginatedSchema(fullSchema)
        : { type: "array" as const, items: fullSchema }
      const contract: FlowContract = options.generateContracts
        ? {
            response_schemas: {
              "200": {
                schema: responseSchema,
                example: generateExampleFromSchema(responseSchema),
                description: `List of ${plural}`,
              },
            },
            parameters: [
              ...(options.includePagination
                ? [
                    { name: "page", in: "query" as const, required: false, schema: { type: "integer" as const }, description: "Page number" },
                    { name: "per_page", in: "query" as const, required: false, schema: { type: "integer" as const }, description: "Items per page" },
                  ]
                : []),
            ],
          }
        : {}
      return makeFlow({
        name: `List ${entity.name}`,
        method: "GET",
        uri: `/${plural}`,
        contract: Object.keys(contract).length > 0 ? contract : undefined,
        mockConfig: options.generateMocks && contract.response_schemas ? contractToMockConfig(contract as FlowContract) : undefined,
      })
    },

    getById: () => {
      const contract: FlowContract = options.generateContracts
        ? {
            response_schemas: {
              "200": { schema: fullSchema, example: generateExampleFromSchema(fullSchema), description: `${entity.name} found` },
              "404": { schema: errorSchema("Not found"), example: { error: `${entity.name} not found`, code: 404 }, description: `${entity.name} not found` },
            },
            parameters: [
              { name: "id", in: "path" as const, required: true, schema: { type: "string" as const }, description: `${entity.name} ID` },
            ],
          }
        : {}
      return makeFlow({
        name: `Get ${entity.name}`,
        method: "GET",
        uri: `/${plural}/:id`,
        contract: Object.keys(contract).length > 0 ? contract : undefined,
        mockConfig: options.generateMocks && contract.response_schemas ? contractToMockConfig(contract as FlowContract) : undefined,
      })
    },

    create: () => {
      const contract: FlowContract = options.generateContracts
        ? {
            request_schema: createSchema,
            request_example: generateExampleFromSchema(createSchema),
            response_schemas: {
              "201": { schema: fullSchema, example: generateExampleFromSchema(fullSchema), description: `${entity.name} created` },
              "400": { schema: errorSchema("Validation error"), example: { error: "Invalid request body", code: 400 }, description: "Validation error" },
            },
          }
        : {}
      return makeFlow({
        name: `Create ${entity.name}`,
        method: "POST",
        uri: `/${plural}`,
        contract: Object.keys(contract).length > 0 ? contract : undefined,
        mockConfig: options.generateMocks && contract.response_schemas ? contractToMockConfig(contract as FlowContract) : undefined,
      })
    },

    update: () => {
      const contract: FlowContract = options.generateContracts
        ? {
            request_schema: createSchema,
            request_example: generateExampleFromSchema(createSchema),
            response_schemas: {
              "200": { schema: fullSchema, example: generateExampleFromSchema(fullSchema), description: `${entity.name} updated` },
              "404": { schema: errorSchema("Not found"), example: { error: `${entity.name} not found`, code: 404 }, description: `${entity.name} not found` },
            },
            parameters: [
              { name: "id", in: "path" as const, required: true, schema: { type: "string" as const }, description: `${entity.name} ID` },
            ],
          }
        : {}
      return makeFlow({
        name: `Update ${entity.name}`,
        method: "PUT",
        uri: `/${plural}/:id`,
        contract: Object.keys(contract).length > 0 ? contract : undefined,
        mockConfig: options.generateMocks && contract.response_schemas ? contractToMockConfig(contract as FlowContract) : undefined,
      })
    },

    delete: () => {
      const contract: FlowContract = options.generateContracts
        ? {
            response_schemas: {
              "204": { description: `${entity.name} deleted` },
              "404": { schema: errorSchema("Not found"), example: { error: `${entity.name} not found`, code: 404 }, description: `${entity.name} not found` },
            },
            parameters: [
              { name: "id", in: "path" as const, required: true, schema: { type: "string" as const }, description: `${entity.name} ID` },
            ],
          }
        : {}
      return makeFlow({
        name: `Delete ${entity.name}`,
        method: "DELETE",
        uri: `/${plural}/:id`,
        contract: Object.keys(contract).length > 0 ? contract : undefined,
        mockConfig: options.generateMocks && contract.response_schemas ? contractToMockConfig(contract as FlowContract) : undefined,
      })
    },
  }

  for (const op of entity.crudOperations) {
    if (opFlows[op]) flows.push(opFlows[op]())
  }

  // Custom operations
  for (const cop of entity.customOperations) {
    flows.push(
      makeFlow({
        name: `${cop.name} ${entity.name}`,
        method: cop.method,
        uri: `/${plural}${cop.pathSuffix}`,
      })
    )
  }

  return flows
}

// --- Build nested relationship flows ---

function relationshipFlows(
  doc: MindmapDocument,
  options: GenerationOptions
): ApiFlow[] {
  const flows: ApiFlow[] = []

  for (const rel of doc.relationships) {
    if (rel.cardinality !== "1:N") continue

    const parent = doc.entities.find((e) => e.id === rel.sourceEntityId)
    const child = doc.entities.find((e) => e.id === rel.targetEntityId)
    if (!parent || !child) continue

    // Only generate nested list if child has "list" enabled
    if (!child.crudOperations.includes("list")) continue

    const parentPlural = getPlural(parent)
    const childPlural = getPlural(child)
    const paramName = `${parent.name.toLowerCase()}Id`
    const childSchema = entityToSchema(child, options)
    const responseSchema = options.includePagination
      ? paginatedSchema(childSchema)
      : { type: "array" as const, items: childSchema }

    const contract: FlowContract = options.generateContracts
      ? {
          response_schemas: {
            "200": {
              schema: responseSchema,
              example: generateExampleFromSchema(responseSchema),
              description: `${child.name} list for ${parent.name}`,
            },
          },
          parameters: [
            { name: paramName, in: "path" as const, required: true, schema: { type: "string" as const }, description: `${parent.name} ID` },
          ],
        }
      : {}

    flows.push(
      makeFlow({
        name: `List ${child.name} by ${parent.name}`,
        method: "GET",
        uri: `/${parentPlural}/:${paramName}/${childPlural}`,
        contract: Object.keys(contract).length > 0 ? contract : undefined,
        mockConfig: options.generateMocks && contract.response_schemas ? contractToMockConfig(contract as FlowContract) : undefined,
      })
    )
  }

  return flows
}

// --- Main generation function ---

export function generateApiFromMindmap(
  doc: MindmapDocument,
  options: GenerationOptions
): ApiDefinition {
  const allFlows: ApiFlow[] = []

  // Entity CRUD flows
  for (const entity of doc.entities) {
    allFlows.push(...entityToFlows(entity, options))
  }

  // Relationship nested flows
  allFlows.push(...relationshipFlows(doc, options))

  const contextPath =
    options.contextPath ||
    `/${doc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`

  return {
    name: options.apiName || doc.name,
    description: options.apiDescription || doc.description || `API generated from mindmap: ${doc.name}`,
    status: "enabled",
    context_path: contextPath,
    routing_mode: "path",
    is_default_version: true,
    endpoint: {
      nodes: [{ host: "127.0.0.1", port: 80, weight: 1 }],
      type: "roundrobin",
      scheme: "http",
    },
    flows: allFlows,
    labels: {
      _fuseone_mindmap: JSON.stringify({ id: doc.id, name: doc.name }),
    },
  }
}
