"use client"

import { ChevronRight, Hash, List } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DocRenderer } from "./doc-renderer"
import { getDocIcon } from "./doc-icon-map"
import type { DocArticle, DocCategory } from "@/lib/docs"

interface DocArticleViewProps {
  article: DocArticle
  category: DocCategory
}

export function DocArticleView({ article, category }: DocArticleViewProps) {
  const CategoryIcon = getDocIcon(category.icon)
  const hasToc = article.content.length > 1

  return (
    <div className="flex gap-8 w-full">
      {/* Article content */}
      <article className="min-w-0 flex-1">
        {/* Breadcrumb */}
        <div className="mb-3 flex items-center gap-1.5 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {CategoryIcon && <CategoryIcon className="h-3 w-3" />}
            {category.title}
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{article.title}</span>
        </div>

        {/* Header */}
        <h1 className="text-3xl font-bold tracking-tight mb-2">{article.title}</h1>
        <p className="text-lg text-muted-foreground mb-4">{article.description}</p>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {article.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Sections */}
        <div className="space-y-8">
          {article.content.map((section, idx) => (
            <section
              key={section.id}
              id={section.id}
              className={idx < article.content.length - 1 ? "border-b pb-8" : ""}
            >
              <div className="group mb-4 flex items-center gap-2">
                <h2 className="text-xl font-semibold scroll-mt-20">{section.title}</h2>
                <a
                  href={`#${section.id}`}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Link para ${section.title}`}
                >
                  <Hash className="h-4 w-4 text-muted-foreground" />
                </a>
              </div>
              <DocRenderer content={section.body} />
              {section.subsections?.map((sub) => (
                <div key={sub.id} id={sub.id} className="mt-6">
                  <div className="group mb-3 flex items-center gap-2">
                    <h3 className="text-lg font-medium scroll-mt-20">{sub.title}</h3>
                    <a
                      href={`#${sub.id}`}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label={`Link para ${sub.title}`}
                    >
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                  </div>
                  <DocRenderer content={sub.body} />
                </div>
              ))}
            </section>
          ))}
        </div>
      </article>

      {/* TOC — sticky right panel */}
      {hasToc && (
        <nav className="hidden xl:block w-56 shrink-0">
          <div className="sticky top-0 pt-1">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <List className="h-4 w-4" />
              Neste artigo
            </div>
            <ScrollArea className="max-h-[calc(100vh-12rem)]">
              <ul className="space-y-0.5 border-l pl-3">
                {article.content.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      onClick={(e) => {
                        e.preventDefault()
                        document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth" })
                      }}
                      className="block py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {section.title}
                    </a>
                    {section.subsections && section.subsections.length > 0 && (
                      <ul className="ml-3 space-y-0.5">
                        {section.subsections.map((sub) => (
                          <li key={sub.id}>
                            <a
                              href={`#${sub.id}`}
                              onClick={(e) => {
                                e.preventDefault()
                                document.getElementById(sub.id)?.scrollIntoView({ behavior: "smooth" })
                              }}
                              className="block py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                            >
                              {sub.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        </nav>
      )}
    </div>
  )
}
