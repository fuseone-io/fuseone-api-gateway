"use client"

import { Badge } from "@/components/ui/badge"
import { DocRenderer } from "./doc-renderer"
import type { DocArticle, DocCategory } from "@/lib/docs"

interface DocArticleViewProps {
  article: DocArticle
  category: DocCategory
}

export function DocArticleView({ article, category }: DocArticleViewProps) {
  return (
    <article className="max-w-3xl">
      {/* Breadcrumb */}
      <p className="mb-2 text-sm text-muted-foreground">
        {category.title}
      </p>

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

      {/* Table of Contents */}
      {article.content.length > 1 && (
        <nav className="mb-8 rounded-lg border bg-muted/30 p-4">
          <p className="mb-2 text-sm font-semibold">Neste artigo</p>
          <ul className="space-y-1">
            {article.content.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {section.title}
                </a>
                {section.subsections && section.subsections.length > 0 && (
                  <ul className="ml-4 mt-1 space-y-0.5">
                    {section.subsections.map((sub) => (
                      <li key={sub.id}>
                        <a
                          href={`#${sub.id}`}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
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
        </nav>
      )}

      {/* Sections */}
      <div className="space-y-8">
        {article.content.map((section) => (
          <section key={section.id} id={section.id}>
            <h2 className="text-xl font-semibold mb-3 scroll-mt-20">{section.title}</h2>
            <DocRenderer content={section.body} />
            {section.subsections?.map((sub) => (
              <div key={sub.id} id={sub.id} className="mt-6">
                <h3 className="text-lg font-medium mb-2 scroll-mt-20">{sub.title}</h3>
                <DocRenderer content={sub.body} />
              </div>
            ))}
          </section>
        ))}
      </div>
    </article>
  )
}
