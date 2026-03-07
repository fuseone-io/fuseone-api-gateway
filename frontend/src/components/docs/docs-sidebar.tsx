"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { DocSearchInput } from "./doc-search-input"
import { getDocIcon } from "./doc-icon-map"
import { DOC_CATEGORIES, searchArticles } from "@/lib/docs"
import { useDocsStore } from "@/stores/docs-store"
import { cn } from "@/lib/utils"

export function DocsSidebar() {
  const pathname = usePathname()
  const searchQuery = useDocsStore((s) => s.searchQuery)
  const expandedCategories = useDocsStore((s) => s.expandedCategories)
  const toggleCategory = useDocsStore((s) => s.toggleCategory)
  const expandOnly = useDocsStore((s) => s.expandOnly)

  // Auto-expand the category that contains the active article
  useEffect(() => {
    const activeCat = DOC_CATEGORIES.find((cat) =>
      cat.articles.some((a) => pathname === `/docs/${a.slug}`),
    )
    if (activeCat) {
      expandOnly(activeCat.slug)
    }
  }, [pathname, expandOnly])

  const searchResults = searchQuery ? searchArticles(searchQuery) : null

  return (
    <div className="flex h-full w-64 min-h-0 flex-col border-r bg-muted/30 shrink-0">
      <div className="p-3">
        <DocSearchInput />
      </div>
      <ScrollArea className="flex-1 min-h-0 px-3 pb-3">
        {searchResults ? (
          <div className="space-y-1">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""}
            </p>
            {searchResults.map((article) => (
              <Link
                key={article.slug}
                href={`/docs/${article.slug}`}
                className={cn(
                  "block rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                  pathname === `/docs/${article.slug}` && "bg-accent font-medium",
                )}
              >
                {article.title}
              </Link>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {DOC_CATEGORIES.map((cat) => {
              const isExpanded = !!expandedCategories[cat.slug]
              const CatIcon = getDocIcon(cat.icon)

              return (
                <Collapsible
                  key={cat.slug}
                  open={isExpanded}
                  onOpenChange={() => toggleCategory(cat.slug)}
                >
                  <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent transition-colors">
                    <ChevronRight className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform",
                      isExpanded && "rotate-90",
                    )} />
                    {CatIcon && (
                      <CatIcon className={cn(
                        "h-4 w-4 shrink-0",
                        isExpanded ? "text-primary" : "text-muted-foreground",
                      )} />
                    )}
                    <span className="truncate">{cat.title}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-3 border-l pl-2 space-y-0.5 mt-0.5">
                      {cat.articles.map((article) => {
                        const isActive = pathname === `/docs/${article.slug}`
                        return (
                          <Link
                            key={article.slug}
                            href={`/docs/${article.slug}`}
                            className={cn(
                              "block rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent text-muted-foreground",
                              isActive && "border-l-2 border-primary -ml-[calc(0.5rem+1px)] pl-[calc(0.5rem+1px)] bg-accent text-foreground font-medium",
                            )}
                          >
                            {article.title}
                          </Link>
                        )
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
