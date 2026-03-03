import type { DocCategory, DocArticle } from "./types"
import { primeirosPassosCategory } from "./01-primeiros-passos"
import { gerenciamentoApisCategory } from "./02-gerenciamento-apis"
import { politicasPluginsCategory } from "./03-politicas-plugins"
import { referenciaPluginsCategory } from "./04-plugin-docs-ptbr"
import { apiCompositionCategory } from "./05-api-composition"
import { scriptingCategory } from "./06-scripting-customizado"
import { aiGatewayCategory } from "./07-ai-gateway"
import { monitoramentoCategory } from "./08-monitoramento-alertas"
import { segurancaCategory } from "./09-seguranca"
import { multiAmbienteCategory } from "./10-multi-ambiente"
import { portalDesenvolvedorCategory } from "./11-portal-desenvolvedor"
import { administracaoCategory } from "./12-administracao"
import { graphqlGatewayCategory } from "./13-graphql-gateway"
import { apiTestingCategory } from "./14-api-testing"
import { serviceMeshCategory } from "./15-service-mesh"
import { kafkaGatewayCategory } from "./16-kafka-gateway"

export type { DocCategory, DocArticle, DocSection } from "./types"

export const DOC_CATEGORIES: DocCategory[] = [
  primeirosPassosCategory,
  gerenciamentoApisCategory,
  politicasPluginsCategory,
  referenciaPluginsCategory,
  apiCompositionCategory,
  scriptingCategory,
  aiGatewayCategory,
  graphqlGatewayCategory,
  apiTestingCategory,
  serviceMeshCategory,
  kafkaGatewayCategory,
  monitoramentoCategory,
  segurancaCategory,
  multiAmbienteCategory,
  portalDesenvolvedorCategory,
  administracaoCategory,
]

/** Find an article by its slug across all categories */
export function findArticleBySlug(slug: string): { article: DocArticle; category: DocCategory } | null {
  for (const cat of DOC_CATEGORIES) {
    const article = cat.articles.find((a) => a.slug === slug)
    if (article) return { article, category: cat }
  }
  return null
}

/** Search articles by query string (title, description, tags) */
export function searchArticles(query: string): DocArticle[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  const results: DocArticle[] = []
  for (const cat of DOC_CATEGORIES) {
    for (const article of cat.articles) {
      const haystack = [
        article.title,
        article.description,
        ...article.tags,
      ].join(" ").toLowerCase()
      if (haystack.includes(q)) {
        results.push(article)
      }
    }
  }
  return results
}

/** Get all articles as a flat list */
export function getAllArticles(): DocArticle[] {
  return DOC_CATEGORIES.flatMap((cat) => cat.articles)
}
