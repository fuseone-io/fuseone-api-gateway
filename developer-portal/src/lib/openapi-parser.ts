export interface OpenAPISpec {
  openapi?: string;
  info?: {
    title?: string;
    description?: string;
    version?: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  paths?: Record<string, Record<string, OpenAPIOperation>>;
  tags?: Array<{ name: string; description?: string }>;
}

export interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: {
    description?: string;
    required?: boolean;
    content?: Record<string, { schema?: OpenAPISchema; example?: unknown }>;
  };
  responses?: Record<
    string,
    {
      description?: string;
      content?: Record<string, { schema?: OpenAPISchema; example?: unknown }>;
    }
  >;
  security?: Array<Record<string, string[]>>;
}

export interface OpenAPIParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  description?: string;
  required?: boolean;
  schema?: OpenAPISchema;
  example?: unknown;
}

export interface OpenAPISchema {
  type?: string;
  format?: string;
  properties?: Record<string, OpenAPISchema>;
  items?: OpenAPISchema;
  required?: string[];
  description?: string;
  example?: unknown;
  enum?: unknown[];
  $ref?: string;
}

export interface ParsedEndpoint {
  method: string;
  path: string;
  tag: string;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters: OpenAPIParameter[];
  requestBody?: OpenAPIOperation["requestBody"];
  responses: Array<{
    status: string;
    description: string;
    example?: unknown;
  }>;
}

const METHOD_ORDER = ["get", "post", "put", "patch", "delete", "options", "head"];

export function parseOpenAPISpec(raw: string): {
  spec: OpenAPISpec;
  endpoints: ParsedEndpoint[];
  tags: string[];
} | null {
  try {
    const spec: OpenAPISpec = JSON.parse(raw);

    const endpoints: ParsedEndpoint[] = [];
    const tagSet = new Set<string>();

    if (spec.paths) {
      for (const [path, methods] of Object.entries(spec.paths)) {
        for (const method of METHOD_ORDER) {
          const op = methods[method];
          if (!op) continue;

          const tag = op.tags?.[0] || "default";
          tagSet.add(tag);

          const responses: ParsedEndpoint["responses"] = [];
          if (op.responses) {
            for (const [status, resp] of Object.entries(op.responses)) {
              let example: unknown = undefined;
              if (resp.content) {
                const json = resp.content["application/json"];
                example = json?.example || json?.schema?.example;
              }
              responses.push({
                status,
                description: resp.description || "",
                example,
              });
            }
          }

          endpoints.push({
            method: method.toUpperCase(),
            path,
            tag,
            operationId: op.operationId,
            summary: op.summary,
            description: op.description,
            parameters: op.parameters || [],
            requestBody: op.requestBody,
            responses,
          });
        }
      }
    }

    return {
      spec,
      endpoints,
      tags: Array.from(tagSet),
    };
  } catch {
    return null;
  }
}

export const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  POST: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  PUT: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  PATCH: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  DELETE: "bg-red-500/10 text-red-600 border-red-500/30",
  OPTIONS: "bg-gray-500/10 text-gray-600 border-gray-500/30",
  HEAD: "bg-gray-500/10 text-gray-600 border-gray-500/30",
};
