// Contract utilities — convert API contracts to mock configs, request validation, and test steps

import type {
  ApiDefinition,
  FlowContract,
  JsonSchemaDefinition,
} from "@/types/api"
import type { TestStep, Assertion, TestSuite } from "@/types/testing"

// --- Schema inference from JSON example ---

export function inferSchemaFromJson(value: unknown): JsonSchemaDefinition {
  if (value === null) return { type: "null" }
  if (Array.isArray(value)) {
    const items = value.length > 0 ? inferSchemaFromJson(value[0]) : { type: "string" as const }
    return { type: "array", items }
  }
  switch (typeof value) {
    case "string": {
      // Try to detect common formats
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return { type: "string", format: "date-time", example: value }
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { type: "string", format: "email", example: value }
      if (/^https?:\/\//.test(value)) return { type: "string", format: "uri", example: value }
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return { type: "string", format: "uuid", example: value }
      return { type: "string", example: value }
    }
    case "number":
      return Number.isInteger(value) ? { type: "integer", example: value } : { type: "number", example: value }
    case "boolean":
      return { type: "boolean", example: value }
    case "object": {
      const obj = value as Record<string, unknown>
      const properties: Record<string, JsonSchemaDefinition> = {}
      const required: string[] = []
      for (const [k, v] of Object.entries(obj)) {
        properties[k] = inferSchemaFromJson(v)
        required.push(k)
      }
      return { type: "object", properties, required }
    }
    default:
      return { type: "string" }
  }
}

// --- Generate example from schema ---

export function generateExampleFromSchema(schema: JsonSchemaDefinition): unknown {
  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default
  if (schema.enum && schema.enum.length > 0) return schema.enum[0]

  switch (schema.type) {
    case "string": {
      if (schema.format === "date-time") return new Date().toISOString()
      if (schema.format === "email") return "user@example.com"
      if (schema.format === "uri") return "https://example.com"
      if (schema.format === "uuid") return "00000000-0000-0000-0000-000000000000"
      return "string"
    }
    case "number":
      return schema.minimum ?? 0.0
    case "integer":
      return schema.minimum ?? 0
    case "boolean":
      return true
    case "null":
      return null
    case "array": {
      const item = schema.items ? generateExampleFromSchema(schema.items) : "item"
      return [item]
    }
    case "object": {
      const obj: Record<string, unknown> = {}
      if (schema.properties) {
        for (const [k, v] of Object.entries(schema.properties)) {
          obj[k] = generateExampleFromSchema(v)
        }
      }
      return obj
    }
    default:
      return null
  }
}

// --- Contract → Mocking plugin config ---

interface MockProfile {
  name: string
  status: number
  contentType: string
  body: string
  headers: Record<string, string>
  delay: number
}

export function contractToMockConfig(contract: FlowContract): Record<string, unknown> {
  const profiles: MockProfile[] = []

  if (contract.response_schemas) {
    const statusCodes = Object.keys(contract.response_schemas).sort()
    for (const code of statusCodes) {
      const resp = contract.response_schemas[code]
      let body = ""
      if (resp.example !== undefined) {
        body = typeof resp.example === "string" ? resp.example : JSON.stringify(resp.example, null, 2)
      } else if (resp.schema) {
        const generated = generateExampleFromSchema(resp.schema)
        body = JSON.stringify(generated, null, 2)
      }
      profiles.push({
        name: `${code} ${resp.description || statusLabel(Number(code))}`,
        status: Number(code),
        contentType: "application/json",
        body,
        headers: {},
        delay: 0,
      })
    }
  }

  // Ensure at least one profile
  if (profiles.length === 0) {
    profiles.push({
      name: "200 OK",
      status: 200,
      contentType: "application/json",
      body: '{\n  "message": "Mock response"\n}',
      headers: {},
      delay: 0,
    })
  }

  const active = profiles[0]
  return {
    response_status: active.status,
    content_type: active.contentType,
    response_example: active.body,
    delay: active.delay,
    with_mock_header: true,
    _profiles: profiles,
    _active_profile: 0,
  }
}

// --- Contract → request-validation plugin config ---

export function contractToRequestValidation(contract: FlowContract): Record<string, unknown> | null {
  if (!contract.request_schema) return null
  return {
    body_schema: JSON.stringify(contract.request_schema),
    rejected_msg: "Request body does not match the API contract",
  }
}

// --- Contract → Test Steps ---

export function contractToTestSteps(api: ApiDefinition, baseUrl: string): TestStep[] {
  const steps: TestStep[] = []

  for (const flow of api.flows) {
    if (!flow.contract) continue

    const method = (flow.entrypoint.methods[0] || "GET") as TestStep["method"]
    const contextPath = api.context_path || ""
    const uri = flow.entrypoint.uri || "/"
    const url = `${baseUrl}${contextPath}${uri}`

    // Build request body
    let body: string | undefined
    if (flow.contract.request_example !== undefined) {
      body = typeof flow.contract.request_example === "string"
        ? flow.contract.request_example
        : JSON.stringify(flow.contract.request_example)
    } else if (flow.contract.request_schema) {
      const example = generateExampleFromSchema(flow.contract.request_schema)
      body = JSON.stringify(example)
    }

    // Build assertions from response schemas
    const assertions: Assertion[] = []

    if (flow.contract.response_schemas) {
      // Assert the success status code (first 2xx response)
      const successCode = Object.keys(flow.contract.response_schemas).find((c) => c.startsWith("2"))
      if (successCode) {
        assertions.push({
          type: "status_code",
          target: "",
          operator: "eq",
          expected: successCode,
        })

        // Assert response body fields from schema
        const resp = flow.contract.response_schemas[successCode]
        if (resp.schema?.type === "object" && resp.schema.properties) {
          for (const field of Object.keys(resp.schema.properties)) {
            assertions.push({
              type: "body_json",
              target: `$.${field}`,
              operator: "neq",
              expected: "",
            })
          }
        }
      }
    }

    // Response time assertion
    assertions.push({
      type: "response_time",
      target: "",
      operator: "lt",
      expected: "2000",
    })

    steps.push({
      name: flow.name || `Test ${method} ${uri}`,
      method,
      url,
      headers: { "Content-Type": "application/json" },
      body: ["POST", "PUT", "PATCH"].includes(method) ? body : undefined,
      assertions,
    })
  }

  return steps
}

// --- Contract → Full Test Suite ---

export function contractToTestSuite(
  api: ApiDefinition,
  apiId: string,
  baseUrl: string
): Omit<TestSuite, "id" | "created_at" | "updated_at"> {
  return {
    name: `Contract Tests: ${api.name}`,
    description: `Auto-generated contract tests for ${api.name}`,
    api_id: apiId,
    steps: contractToTestSteps(api, baseUrl),
    tags: ["contract", "auto-generated"],
  }
}

// --- Helpers ---

function statusLabel(code: number): string {
  const labels: Record<number, string> = {
    200: "OK",
    201: "Created",
    204: "No Content",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    422: "Unprocessable Entity",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
  }
  return labels[code] || "Response"
}

// --- Count contract definitions on a flow ---

export function countContractResponses(contract?: FlowContract): number {
  if (!contract?.response_schemas) return 0
  return Object.keys(contract.response_schemas).length
}

export function hasContract(contract?: FlowContract): boolean {
  if (!contract) return false
  return !!(
    contract.request_schema ||
    contract.request_example ||
    (contract.response_schemas && Object.keys(contract.response_schemas).length > 0) ||
    (contract.parameters && contract.parameters.length > 0)
  )
}
