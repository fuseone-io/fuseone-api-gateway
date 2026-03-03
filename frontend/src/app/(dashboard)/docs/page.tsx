"use client"

import { BookOpen } from "lucide-react"
import { DOC_CATEGORIES } from "@/lib/docs"
import { DocCategoryCard } from "@/components/docs/doc-category-card"

export default function DocsPage() {
  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Documentacao</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Guias completos, referencias e boas praticas para a plataforma FuseOne API Gateway.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DOC_CATEGORIES.map((cat) => (
          <DocCategoryCard key={cat.slug} category={cat} />
        ))}
      </div>
    </div>
  )
}
