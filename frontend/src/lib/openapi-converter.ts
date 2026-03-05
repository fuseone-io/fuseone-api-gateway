import yaml from "js-yaml"
import type { ApiDefinition, ApiFlow, PolicyInstance, FlowContract, ContractParameter, JsonSchemaDefinition, ContractResponse } from "@/types/api"
import { getPluginDef } from "@/lib/constants"

// --- Export: ApiDefinition → OpenAPI 3.0 ---

interface OpenAPISpec {
  openapi: string
  info: { title: string; description: string; version: string }
  servers: { url: string; description?: string }[]
  paths: Record<string, Record<string, unknown>>
  "x-upstream-config"?: Record<string, unknown>
}

export function apiToOpenAPI(api: ApiDefinition): OpenAPISpec {
  const ep = api.endpoint
  const node = ep.nodes[0]

  // Build server URL from first node
  const serverUrl = node
    ? `${ep.scheme || "http"}://${node.host}:${node.port}`
    : `${ep.scheme || "http"}://localhost:80`

  // Build paths from flows
  const paths: Record<string, Record<string, unknown>> = {}

  for (const flow of api.flows) {
    const uri = flow.entrypoint.uri || "/"
    // Convert APISIX wildcard to OpenAPI path
    const openApiPath = uri.replace(/\/\*$/, "/{path}")

    if (!paths[openApiPath]) {
      paths[openApiPath] = {}
    }

    // Build plugins extension
    const plugins = flow.policies
      .filter((p) => p.enabled)
      .map((p) => ({ name: p.name, phase: p.phase, config: p.config }))

    const methods = flow.entrypoint.methods.length > 0
      ? flow.entrypoint.methods
      : ["get", "post", "put", "patch", "delete"]

    for (const method of methods) {
      const operation: Record<string, unknown> = {
        summary: flow.name,
        operationId: `${flow.name.replace(/\s+/g, "_").toLowerCase()}_${method.toLowerCase()}`,
        responses: {} as Record<string, unknown>,
      }

      // Build responses from contract or default
      const responses = operation.responses as Record<string, unknown>
      if (flow.contract?.response_schemas && Object.keys(flow.contract.response_schemas).length > 0) {
        for (const [code, resp] of Object.entries(flow.contract.response_schemas)) {
          const respObj: Record<string, unknown> = { description: resp.description || "" }
          if (resp.schema) {
            respObj.content = {
              "application/json": {
                schema: resp.schema,
                ...(resp.example !== undefined ? { example: resp.example } : {}),
              },
            }
          }
          responses[code] = respObj
        }
      } else {
        responses["200"] = { description: "Success" }
      }

      // Build requestBody from contract
      if (flow.contract?.request_schema && ["post", "put", "patch"].includes(method.toLowerCase())) {
        operation.requestBody = {
          required: true,
          content: {
            "application/json": {
              schema: flow.contract.request_schema,
              ...(flow.contract.request_example !== undefined ? { example: flow.contract.request_example } : {}),
            },
          },
        }
      }

      if (plugins.length > 0) {
        operation["x-gateway-plugins"] = plugins
      }

      if (flow.entrypoint.hosts.length > 0) {
        operation["x-hosts"] = flow.entrypoint.hosts
      }

      // Build parameters from contract + wildcard path params
      const parameters: Record<string, unknown>[] = []

      if (flow.contract?.parameters) {
        for (const param of flow.contract.parameters) {
          parameters.push({
            name: param.name,
            in: param.in,
            required: param.required,
            schema: param.schema || { type: "string" },
            ...(param.description ? { description: param.description } : {}),
            ...(param.example !== undefined ? { example: param.example } : {}),
          })
        }
      }

      if (openApiPath.includes("{path}") && !parameters.some((p) => (p as { name: string }).name === "path")) {
        parameters.push({
          name: "path",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Wildcard path segment",
        })
      }

      if (parameters.length > 0) {
        operation.parameters = parameters
      }

      paths[openApiPath][method.toLowerCase()] = operation
    }
  }

  // Build upstream config extension (non-trivial settings)
  const upstreamConfig: Record<string, unknown> = {}
  if (ep.type !== "roundrobin") upstreamConfig.type = ep.type
  if (ep.retries) upstreamConfig.retries = ep.retries
  if (ep.timeout) upstreamConfig.timeout = ep.timeout
  if (ep.pass_host && ep.pass_host !== "pass") upstreamConfig.pass_host = ep.pass_host
  if (ep.checks) upstreamConfig.checks = ep.checks
  if (ep.keepalive_pool) upstreamConfig.keepalive_pool = ep.keepalive_pool
  if (ep.nodes.length > 1) {
    upstreamConfig.nodes = ep.nodes
  }

  // Include context path in server URL if present
  const fullServerUrl = api.context_path
    ? `${serverUrl}${api.context_path}`
    : serverUrl

  const spec: OpenAPISpec = {
    openapi: "3.0.3",
    info: {
      title: api.name || "Untitled API",
      description: api.description || "",
      version: "1.0.0",
    },
    servers: [{ url: fullServerUrl, description: "Upstream target" }],
    paths,
  }

  if (Object.keys(upstreamConfig).length > 0) {
    spec["x-upstream-config"] = upstreamConfig
  }

  return spec
}

// --- Import: OpenAPI 3.0 → ApiDefinition ---

export function openAPIToApi(raw: Record<string, unknown>): ApiDefinition {
  const info = (raw.info || {}) as Record<string, string>
  const servers = (raw.servers || []) as { url: string }[]
  const paths = (raw.paths || {}) as Record<string, Record<string, unknown>>
  const upstreamConfig = (raw["x-upstream-config"] || {}) as Record<string, unknown>

  // Parse server URL for endpoint
  let scheme = "http" as "http" | "https" | "grpc" | "grpcs"
  let host = "127.0.0.1"
  let port = 80
  let contextPath = ""

  if (servers.length > 0 && servers[0].url) {
    try {
      const url = new URL(servers[0].url)
      scheme = url.protocol.replace(":", "") as "http" | "https" | "grpc" | "grpcs"
      host = url.hostname
      port = url.port ? parseInt(url.port) : (scheme === "https" || scheme === "grpcs" ? 443 : 80)
      // Extract context path from URL pathname
      if (url.pathname && url.pathname !== "/") {
        contextPath = url.pathname.replace(/\/$/, "")
      }
    } catch {
      // Keep defaults
    }
  }

  // Build nodes from upstream config or server URL
  const nodes = (upstreamConfig.nodes as { host: string; port: number; weight: number }[])
    || [{ host, port, weight: 1 }]

  // Build flows from paths
  const flows: ApiFlow[] = []

  for (const [path, methods] of Object.entries(paths)) {
    // Convert OpenAPI path params to APISIX wildcard
    let uri = path
    if (uri.includes("{")) {
      // Replace the last {param} segment with *
      uri = uri.replace(/\/\{[^}]+\}$/, "/*")
      // If there are still params in the middle, keep them (APISIX supports with right router)
      uri = uri.replace(/\{[^}]+\}/g, "*")
    }

    // Collect methods and plugins for this path
    const httpMethods: string[] = []
    let flowName = ""
    const allPlugins: PolicyInstance[] = []
    const hosts: string[] = []
    const contract: FlowContract = {}

    const httpMethodNames = ["get", "post", "put", "patch", "delete", "head", "options"]

    for (const [method, operation] of Object.entries(methods)) {
      if (!httpMethodNames.includes(method.toLowerCase())) continue

      const op = operation as Record<string, unknown>
      httpMethods.push(method.toUpperCase())

      if (!flowName && op.summary) {
        flowName = op.summary as string
      }

      // Extract request body schema
      const requestBody = op.requestBody as Record<string, unknown> | undefined
      if (requestBody && !contract.request_schema) {
        const content = requestBody.content as Record<string, Record<string, unknown>> | undefined
        if (content) {
          const jsonContent = content["application/json"] || Object.values(content)[0]
          if (jsonContent) {
            if (jsonContent.schema) contract.request_schema = jsonContent.schema as JsonSchemaDefinition
            if (jsonContent.example !== undefined) contract.request_example = jsonContent.example
          }
        }
      }

      // Extract response schemas
      const responses = op.responses as Record<string, Record<string, unknown>> | undefined
      if (responses) {
        for (const [code, resp] of Object.entries(responses)) {
          if (contract.response_schemas?.[code]) continue
          const content = resp.content as Record<string, Record<string, unknown>> | undefined
          const respEntry: ContractResponse = { description: (resp.description as string) || "" }
          if (content) {
            const jsonContent = content["application/json"] || Object.values(content)[0]
            if (jsonContent) {
              if (jsonContent.schema) respEntry.schema = jsonContent.schema as JsonSchemaDefinition
              if (jsonContent.example !== undefined) respEntry.example = jsonContent.example
            }
          }
          if (respEntry.schema || respEntry.description) {
            if (!contract.response_schemas) contract.response_schemas = {}
            contract.response_schemas[code] = respEntry
          }
        }
      }

      // Extract parameters
      const params = op.parameters as Record<string, unknown>[] | undefined
      if (params && !contract.parameters) {
        const contractParams: ContractParameter[] = []
        for (const p of params) {
          contractParams.push({
            name: (p.name as string) || "",
            in: (p.in as ContractParameter["in"]) || "query",
            required: (p.required as boolean) || false,
            schema: p.schema as JsonSchemaDefinition | undefined,
            description: p.description as string | undefined,
            example: p.example,
          })
        }
        if (contractParams.length > 0) contract.parameters = contractParams
      }

      // Extract gateway plugins extension
      const plugins = op["x-gateway-plugins"] as { name: string; phase?: string; config?: Record<string, unknown> }[] | undefined
      if (plugins) {
        for (const p of plugins) {
          // Avoid duplicate plugins
          if (!allPlugins.some((existing) => existing.name === p.name)) {
            const def = getPluginDef(p.name)
            allPlugins.push({
              id: crypto.randomUUID(),
              name: p.name,
              phase: (p.phase as "request" | "response" | "observability") || def?.phase || "request",
              enabled: true,
              config: p.config || {},
            })
          }
        }
      }

      // Extract hosts extension
      const opHosts = op["x-hosts"] as string[] | undefined
      if (opHosts) {
        for (const h of opHosts) {
          if (!hosts.includes(h)) hosts.push(h)
        }
      }
    }

    if (httpMethods.length === 0) continue

    // Build contract if we found any schema data
    const hasContract = contract.request_schema || contract.response_schemas || contract.parameters

    flows.push({
      id: crypto.randomUUID(),
      name: flowName || `Flow ${uri}`,
      entrypoint: {
        uri,
        hosts,
        methods: httpMethods,
      },
      policies: allPlugins,
      ...(hasContract ? { contract } : {}),
    })
  }

  // Ensure at least one flow
  if (flows.length === 0) {
    flows.push({
      id: crypto.randomUUID(),
      name: "Default Flow",
      entrypoint: { uri: "", hosts: [], methods: [] },
      policies: [],
    })
  }

  const result: ApiDefinition = {
    name: info.title || "Imported API",
    description: info.description || "",
    status: "enabled",
    endpoint: {
      nodes,
      type: (upstreamConfig.type as "roundrobin") || "roundrobin",
      scheme,
      retries: upstreamConfig.retries as number | undefined,
      timeout: upstreamConfig.timeout as { connect: number; send: number; read: number } | undefined,
      pass_host: upstreamConfig.pass_host as "pass" | "node" | "rewrite" | undefined,
      checks: upstreamConfig.checks as ApiDefinition["endpoint"]["checks"],
      keepalive_pool: upstreamConfig.keepalive_pool as { size: number; idle_timeout: number; requests: number } | undefined,
    },
    flows,
  }

  if (contextPath) {
    result.context_path = contextPath
  }

  return result
}

// --- Import: FuseOne JSON → ApiDefinition ---

export function parseFuseOneJson(raw: Record<string, unknown>): ApiDefinition {
  // Already in our format — just ensure required fields
  const result: ApiDefinition = {
    name: (raw.name as string) || "Imported API",
    description: (raw.description as string) || "",
    status: (raw.status as "enabled" | "disabled") || "enabled",
    endpoint: (raw.endpoint as ApiDefinition["endpoint"]) || {
      nodes: [{ host: "127.0.0.1", port: 80, weight: 1 }],
      type: "roundrobin",
      scheme: "http",
    },
    flows: (raw.flows as ApiFlow[]) || [
      {
        id: crypto.randomUUID(),
        name: "Default Flow",
        entrypoint: { uri: "", hosts: [], methods: [] },
        policies: [],
      },
    ],
    labels: raw.labels as Record<string, string> | undefined,
  }

  // Preserve routing config
  if (raw.hosts) result.hosts = raw.hosts as string[]
  if (raw.context_path) result.context_path = raw.context_path as string
  if (raw.routing_mode) result.routing_mode = raw.routing_mode as ApiDefinition["routing_mode"]
  if (raw.is_default_version !== undefined) result.is_default_version = raw.is_default_version as boolean

  return result
}

// --- Format detection ---

export function detectFormat(raw: Record<string, unknown>): "openapi" | "fuseone" | "unknown" {
  if (raw.openapi && typeof raw.openapi === "string") return "openapi"
  if (raw.flows && raw.endpoint) return "fuseone"
  return "unknown"
}

// --- Parse file content (JSON or YAML) ---

export function parseFileContent(content: string, filename: string): Record<string, unknown> {
  const ext = filename.toLowerCase().split(".").pop()
  if (ext === "yaml" || ext === "yml") {
    return yaml.load(content) as Record<string, unknown>
  }
  return JSON.parse(content)
}

// --- File download helper ---

export function downloadAsFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportAsFuseOneJson(api: ApiDefinition) {
  const slug = (api.name || "api").toLowerCase().replace(/\s+/g, "-")
  downloadAsFile(
    JSON.stringify(api, null, 2),
    `${slug}.fuseone.json`,
    "application/json"
  )
}

export function exportAsOpenAPIYaml(api: ApiDefinition) {
  const spec = apiToOpenAPI(api)
  const slug = (api.name || "api").toLowerCase().replace(/\s+/g, "-")
  downloadAsFile(
    yaml.dump(spec, { lineWidth: 120, noRefs: true }),
    `${slug}.openapi.yaml`,
    "application/x-yaml"
  )
}
