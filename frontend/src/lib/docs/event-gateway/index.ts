import type { DocCategory } from "../types"
import { visaoGeralArticle } from "./visao-geral"
import { conexoesArticle } from "./conexoes"
import { eventApisArticle } from "./event-apis"
import { topicosArticle } from "./topicos"
import { websocketArticle } from "./websocket"
import { webhookArticle } from "./webhook"
import { infraestruturaArticle } from "./infraestrutura"
import { useCasesArticle } from "./use-cases"

export const eventGatewayCategory: DocCategory = {
  slug: "event-gateway",
  title: "Event Gateway",
  description:
    "Exponha tópicos Kafka e subjects NATS como APIs gerenciadas via REST, SSE, WebSocket e Webhook, com governance completo pelo API Gateway.",
  icon: "Radio",
  articles: [
    visaoGeralArticle,
    conexoesArticle,
    eventApisArticle,
    topicosArticle,
    websocketArticle,
    webhookArticle,
    useCasesArticle,
    infraestruturaArticle,
  ],
}
