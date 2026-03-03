"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EndpointDetail } from "@/components/docs/endpoint-detail";
import { TryItPanel } from "@/components/docs/try-it-panel";
import { portalApi } from "@/lib/api-client";
import {
  parseOpenAPISpec,
  METHOD_COLORS,
  type ParsedEndpoint,
} from "@/lib/openapi-parser";
import { cn } from "@/lib/utils";

export default function ApiDocsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [endpoints, setEndpoints] = useState<ParsedEndpoint[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<ParsedEndpoint | null>(null);
  const [apiName, setApiName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTryIt, setShowTryIt] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [apiData, specData] = await Promise.all([
          portalApi.getAPI(id),
          portalApi.getSpec(id),
        ]);
        setApiName(apiData.name);

        const spec = specData.spec;
        if (!spec) {
          setError("No OpenAPI specification available for this API.");
          return;
        }

        const parsed = parseOpenAPISpec(spec);
        if (!parsed) {
          setError("Failed to parse OpenAPI specification. Make sure it is valid JSON.");
          return;
        }

        setEndpoints(parsed.endpoints);
        setTags(parsed.tags);
        if (parsed.endpoints.length > 0) {
          setSelectedEndpoint(parsed.endpoints[0]);
        }
        // Use first server URL or fallback
        setBaseUrl(parsed.spec.servers?.[0]?.url || "");
      } catch {
        setError("Failed to load API documentation.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <FileWarning className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Documentation Unavailable</h2>
        <p className="mt-2 text-muted-foreground">{error}</p>
        <Button variant="outline" className="mt-6" asChild>
          <Link href={`/apis/${id}`}>Back to API</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/apis/${id}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="text-xl font-bold text-foreground">
            {apiName} — Documentation
          </h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTryIt(!showTryIt)}
        >
          {showTryIt ? "Hide Try-It" : "Show Try-It"}
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar: endpoint list */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border bg-card p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Endpoints
            </h3>
            {tags.map((tag) => (
              <div key={tag} className="mb-4">
                <p className="mb-1 text-xs font-semibold text-foreground capitalize">
                  {tag}
                </p>
                <div className="space-y-0.5">
                  {endpoints
                    .filter((e) => e.tag === tag)
                    .map((ep) => {
                      const key = `${ep.method}-${ep.path}`;
                      const isActive =
                        selectedEndpoint &&
                        selectedEndpoint.method === ep.method &&
                        selectedEndpoint.path === ep.path;
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedEndpoint(ep)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <Badge
                            variant="outline"
                            className={`font-mono text-[10px] px-1 py-0 ${METHOD_COLORS[ep.method] || ""}`}
                          >
                            {ep.method}
                          </Badge>
                          <span className="truncate font-mono">{ep.path}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {selectedEndpoint ? (
            <div className="flex gap-6">
              <div className={cn("min-w-0", showTryIt ? "flex-1" : "w-full")}>
                <div className="rounded-xl border bg-card p-6 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
                  <EndpointDetail endpoint={selectedEndpoint} />
                </div>
              </div>

              {/* Try-It panel */}
              {showTryIt && (
                <div className="hidden w-96 shrink-0 xl:block">
                  <div className="sticky top-24">
                    <TryItPanel
                      endpoint={selectedEndpoint}
                      baseUrl={baseUrl}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-12 text-center">
              <p className="text-muted-foreground">
                Select an endpoint from the sidebar to view its documentation.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile endpoint selector */}
      <div className="mb-4 mt-6 lg:hidden">
        <select
          className="w-full rounded-lg border bg-card p-2.5 text-sm"
          value={
            selectedEndpoint
              ? `${selectedEndpoint.method}-${selectedEndpoint.path}`
              : ""
          }
          onChange={(e) => {
            const [method, ...pathParts] = e.target.value.split("-");
            const path = pathParts.join("-");
            const ep = endpoints.find(
              (ep) => ep.method === method && ep.path === path
            );
            if (ep) setSelectedEndpoint(ep);
          }}
        >
          {endpoints.map((ep) => (
            <option
              key={`${ep.method}-${ep.path}`}
              value={`${ep.method}-${ep.path}`}
            >
              {ep.method} {ep.path}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
