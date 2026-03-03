"use client"

import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import type { DocCategory } from "@/lib/docs"

interface DocCategoryCardProps {
  category: DocCategory
}

export function DocCategoryCard({ category }: DocCategoryCardProps) {
  const firstArticle = category.articles[0]
  if (!firstArticle) return null

  return (
    <Link href={`/docs/${firstArticle.slug}`}>
      <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{category.title}</CardTitle>
          <CardDescription className="text-sm">{category.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-0.5">
            {category.articles.slice(0, 4).map((article) => (
              <li key={article.slug} className="text-sm text-muted-foreground">
                {article.title}
              </li>
            ))}
            {category.articles.length > 4 && (
              <li className="text-xs text-muted-foreground/60">
                +{category.articles.length - 4} mais...
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </Link>
  )
}
