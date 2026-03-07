"use client"

import { useTranslations } from "next-intl"
import { BookOpen } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { DOC_CATEGORIES } from "@/lib/docs"
import { DocCategoryCard } from "@/components/docs/doc-category-card"

export default function DocsPage() {
  const t = useTranslations("docs")
  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <PageHeader
          title={t("title")}
          description={t("fullDescription")}
          icon={<BookOpen className="h-6 w-6" />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DOC_CATEGORIES.map((cat) => (
          <DocCategoryCard key={cat.slug} category={cat} />
        ))}
      </div>
    </div>
  )
}
