import type { PluginFormDef, PluginFieldDef, PluginFieldGroup } from "@/lib/plugin-forms"

// Converts a JSON Schema (from APISIX /schema/plugins/{name}) into a PluginFormDef
// for auto-generating form fields when no handcrafted form exists.

interface JsonSchemaProperty {
  type?: string | string[]
  description?: string
  default?: unknown
  enum?: unknown[]
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  items?: JsonSchemaProperty
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
  oneOf?: JsonSchemaProperty[]
  anyOf?: JsonSchemaProperty[]
  title?: string
  encrypted?: boolean
}

interface JsonSchema {
  type?: string
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
  title?: string
  description?: string
}

// Fields that typically hold secrets — matches exact names and suffix patterns
const SECRET_FIELD_NAMES = new Set([
  // Passwords
  "password", "redis_password", "redis_cluster_password",
  "admin_password", "sasl_password",
  // Keys
  "secret", "secret_key", "client_secret", "signing_key",
  "api_key", "access_key", "private_key", "encryption_key",
  "key", "hmac_key",
  // Tokens & Auth
  "token", "access_token", "refresh_token", "bearer_token",
  "auth_header", "auth_token", "auth_value",
  // Certificates
  "client_cert", "client_key", "client_cert_key",
  "ssl_client_cert", "ssl_client_key",
  "tls_client_cert", "tls_client_key",
  // Vault / Cloud
  "vault_token", "service_account_key",
])

// Suffix patterns that indicate sensitive fields
const SECRET_FIELD_SUFFIXES = [
  "_password", "_secret", "_key", "_token",
  "_cert", "_certificate", "_private_key",
]

function resolveType(prop: JsonSchemaProperty): string {
  if (Array.isArray(prop.type)) {
    return prop.type.find((t) => t !== "null") || "string"
  }
  return prop.type || "string"
}

function propertyToFieldDef(
  key: string,
  prop: JsonSchemaProperty,
  isRequired: boolean
): PluginFieldDef | null {
  const type = resolveType(prop)
  const label = key
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")

  // Skip deeply nested objects that can't be easily rendered
  if (type === "object" && prop.properties && Object.keys(prop.properties).length > 8) {
    return null
  }

  // Enum
  if (prop.enum && prop.enum.length > 0) {
    return {
      key,
      label,
      description: prop.description,
      type: "enum",
      required: isRequired,
      defaultValue: prop.default,
      options: prop.enum.map((v) => ({
        value: String(v),
        label: String(v),
      })),
    }
  }

  // Secret/password fields
  const isSecret = SECRET_FIELD_NAMES.has(key)
    || prop.encrypted
    || SECRET_FIELD_SUFFIXES.some((suffix) => key.endsWith(suffix))
  if (isSecret) {
    return {
      key,
      label,
      description: prop.description,
      type: "password",
      required: isRequired,
      defaultValue: prop.default,
    }
  }

  switch (type) {
    case "string":
      return {
        key,
        label,
        description: prop.description,
        type: "string",
        required: isRequired,
        defaultValue: prop.default,
      }

    case "integer":
      return {
        key,
        label,
        description: prop.description,
        type: "integer",
        required: isRequired,
        defaultValue: prop.default,
        min: prop.minimum,
        max: prop.maximum,
      }

    case "number":
      return {
        key,
        label,
        description: prop.description,
        type: "number",
        required: isRequired,
        defaultValue: prop.default,
        min: prop.minimum,
        max: prop.maximum,
        step: 0.01,
      }

    case "boolean":
      return {
        key,
        label,
        description: prop.description,
        type: "boolean",
        required: isRequired,
        defaultValue: prop.default,
      }

    case "array":
      if (prop.items) {
        const itemType = resolveType(prop.items)
        if (itemType === "string" || itemType === "integer" || itemType === "number") {
          return {
            key,
            label,
            description: prop.description,
            type: "string-array",
            required: isRequired,
          }
        }
      }
      // Complex arrays — fall back to text
      return {
        key,
        label,
        description: prop.description,
        type: "text",
        required: isRequired,
        placeholder: "Enter as JSON array",
      }

    case "object":
      // Simple objects rendered as JSON text
      return {
        key,
        label,
        description: prop.description,
        type: "text",
        required: isRequired,
        placeholder: "Enter as JSON object",
      }

    default:
      return {
        key,
        label,
        description: prop.description,
        type: "string",
        required: isRequired,
        defaultValue: prop.default,
      }
  }
}

export function jsonSchemaToFormDef(
  pluginName: string,
  schema: unknown
): PluginFormDef | null {
  if (!schema || typeof schema !== "object") return null

  const s = schema as JsonSchema
  const properties = s.properties
  if (!properties || Object.keys(properties).length === 0) return null

  const required = new Set(s.required || [])

  // Split into required and optional fields
  const requiredFields: PluginFieldDef[] = []
  const optionalFields: PluginFieldDef[] = []

  for (const [key, prop] of Object.entries(properties)) {
    // Skip internal fields
    if (key.startsWith("_") || key === "disable") continue

    const fieldDef = propertyToFieldDef(key, prop, required.has(key))
    if (!fieldDef) continue

    if (required.has(key)) {
      requiredFields.push(fieldDef)
    } else {
      optionalFields.push(fieldDef)
    }
  }

  const groups: PluginFieldGroup[] = []

  if (requiredFields.length > 0) {
    groups.push({
      title: "Required",
      fields: requiredFields,
    })
  }

  if (optionalFields.length > 0) {
    groups.push({
      title: "Options",
      collapsible: requiredFields.length > 0,
      defaultOpen: requiredFields.length === 0,
      fields: optionalFields,
    })
  }

  if (groups.length === 0) return null

  return { pluginName, groups }
}
