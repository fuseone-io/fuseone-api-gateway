"use client";

import Link from "next/link";
import { BookOpen, Layers, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PortalApiSummary } from "@/lib/api-client";

const lifecycleColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  beta: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  deprecated: "bg-red-500/10 text-red-600 border-red-500/20",
};

export function ApiCard({ api }: { api: PortalApiSummary }) {
  return (
    <Link
      href={`/apis/${api.id}`}
      className="group relative flex flex-col rounded-2xl border bg-card p-6 shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
    >
      {/* Top accent bar */}
      <div className="absolute left-0 right-0 top-0 h-1 overflow-hidden rounded-t-2xl">
        <div className="h-full w-full bg-gradient-to-r from-primary to-secondary opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>

      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground group-hover:text-primary">
              {api.name}
            </h3>
            <span className="text-xs text-muted-foreground">v{api.version}</span>
          </div>
        </div>
        <Badge
          variant="outline"
          className={lifecycleColors[api.lifecycle] || ""}
        >
          {api.lifecycle}
        </Badge>
      </div>

      {/* Description */}
      <p className="mb-4 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
        {api.description || "No description available."}
      </p>

      {/* Categories */}
      {api.categories && api.categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {api.categories.map((cat) => (
            <span
              key={cat}
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {cat}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {api.has_docs && (
            <span className="flex items-center gap-1 text-emerald-600">
              <BookOpen className="h-3.5 w-3.5" />
              Docs
            </span>
          )}
          {api.plan_count > 0 && (
            <span>{api.plan_count} plan{api.plan_count !== 1 ? "s" : ""}</span>
          )}
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:text-primary group-hover:opacity-100" />
      </div>
    </Link>
  );
}
