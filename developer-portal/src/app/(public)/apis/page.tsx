"use client";

import { useState, useEffect } from "react";
import { Search, Filter, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ApiCard } from "@/components/catalog/api-card";
import { portalApi, type PortalApiSummary } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export default function ApiCatalogPage() {
  const [apis, setApis] = useState<PortalApiSummary[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    portalApi.getCategories().then((r) => setCategories(r.categories || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      portalApi
        .listAPIs({
          search: search || undefined,
          category: selectedCategory || undefined,
          page_size: 50,
        })
        .then((r) => {
          setApis(r.apis || []);
          setTotal(r.total);
        })
        .catch(() => {
          setApis([]);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search, selectedCategory]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          API Catalog
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Browse and discover APIs available for your applications.
        </p>
      </div>

      {/* Search bar */}
      <div className="mx-auto mb-8 max-w-2xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search APIs by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-12 rounded-xl pl-12 text-base shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
          />
        </div>
      </div>

      {/* Category filters */}
      {categories.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
          <Filter className="mr-1 h-4 w-4 text-muted-foreground" />
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-all",
              !selectedCategory
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium transition-all",
                selectedCategory === cat
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : apis.length === 0 ? (
        <div className="py-20 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground">No APIs found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search
              ? "Try adjusting your search terms."
              : "No APIs are currently available in the catalog."}
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {total} API{total !== 1 ? "s" : ""} available
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {apis.map((api) => (
              <ApiCard key={api.id} api={api} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
