"use client"

import { useParams } from "next/navigation"
import { findArticleBySlug } from "@/lib/docs"
import { DocArticleView } from "@/components/docs/doc-article-view"
import { FileQuestion } from "lucide-react"

export default function DocArticlePage() {
  const params = useParams()
  const slug = params.slug as string
  const result = findArticleBySlug(slug)

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <FileQuestion className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Artigo nao encontrado</h2>
        <p className="text-sm">O artigo &quot;{slug}&quot; nao existe na documentacao.</p>
      </div>
    )
  }

  return <DocArticleView article={result.article} category={result.category} />
}
