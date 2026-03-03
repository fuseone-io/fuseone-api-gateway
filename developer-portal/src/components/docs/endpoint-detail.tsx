"use client";

import { Badge } from "@/components/ui/badge";
import type { ParsedEndpoint } from "@/lib/openapi-parser";
import { METHOD_COLORS } from "@/lib/openapi-parser";

export function EndpointDetail({ endpoint }: { endpoint: ParsedEndpoint }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={`font-mono text-xs font-bold ${METHOD_COLORS[endpoint.method] || ""}`}
          >
            {endpoint.method}
          </Badge>
          <code className="text-base font-semibold text-foreground">
            {endpoint.path}
          </code>
        </div>
        {endpoint.summary && (
          <p className="mt-2 text-muted-foreground">{endpoint.summary}</p>
        )}
        {endpoint.description && endpoint.description !== endpoint.summary && (
          <p className="mt-1 text-sm text-muted-foreground">
            {endpoint.description}
          </p>
        )}
      </div>

      {/* Parameters */}
      {endpoint.parameters.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">Parameters</h4>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    In
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {endpoint.parameters.map((p) => (
                  <tr key={`${p.in}-${p.name}`} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <code className="text-xs">{p.name}</code>
                      {p.required && (
                        <span className="ml-1 text-red-500">*</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{p.in}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {p.schema?.type || "string"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {p.description || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Request body */}
      {endpoint.requestBody && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">
            Request Body
            {endpoint.requestBody.required && (
              <span className="ml-1 text-red-500">*</span>
            )}
          </h4>
          {endpoint.requestBody.description && (
            <p className="mb-2 text-sm text-muted-foreground">
              {endpoint.requestBody.description}
            </p>
          )}
          {endpoint.requestBody.content?.["application/json"]?.example != null && (
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
              {JSON.stringify(
                endpoint.requestBody.content["application/json"].example,
                null,
                2
              )}
            </pre>
          )}
        </div>
      )}

      {/* Responses */}
      {endpoint.responses.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">Responses</h4>
          <div className="space-y-3">
            {endpoint.responses.map((r) => (
              <div key={r.status} className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      r.status.startsWith("2")
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        : r.status.startsWith("4")
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                          : r.status.startsWith("5")
                            ? "bg-red-500/10 text-red-600 border-red-500/30"
                            : ""
                    }
                  >
                    {r.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {r.description}
                  </span>
                </div>
                {r.example != null && (
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                    {JSON.stringify(r.example, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
