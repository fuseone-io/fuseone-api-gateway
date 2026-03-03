export interface DocSection {
  id: string
  title: string
  body: string
  subsections?: { id: string; title: string; body: string }[]
}

export interface DocArticle {
  slug: string
  title: string
  description: string
  icon: string
  content: DocSection[]
  tags: string[]
}

export interface DocCategory {
  slug: string
  title: string
  description: string
  icon: string
  articles: DocArticle[]
}
