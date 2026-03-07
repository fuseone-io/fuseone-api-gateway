import type { DocArticle } from "../types"

export const topicosArticle: DocArticle = {
  slug: "topicos-browser",
  title: "Navegação de Tópicos",
  description:
    "Navegue por tópicos e subjects, visualize partições e produza/consuma mensagens para debug.",
  icon: "List",
  tags: ["kafka", "nats", "tópicos", "subjects", "partições", "browser"],
  content: [
    {
      id: "browser",
      title: "Topic Browser",
      body: `O Topic Browser permite navegar pelos tópicos/subjects de uma conexão.

**Acessando:**

1. Vá para **Integrações > Event Gateway**
2. Selecione uma conexão ativa na tabela
3. Clique em **Ver Tópicos**

A lista mostra todos os tópicos (Kafka) ou subjects com streams (NATS JetStream). Use o campo de busca para filtrar.

> **Nota:** Para NATS Core (sem JetStream), o topic browser tem funcionalidade limitada pois não há persistência de mensagens.`,
    },
    {
      id: "produzir-consumir",
      title: "Produzir e Consumir (Debug)",
      body: `Na página de detalhes de um tópico:

**Aba Produzir:**
- Envie mensagens ao tópico/subject com chave, valor e headers
- Feedback com offset/sequence e partição da mensagem produzida

**Aba Consumir:**
- Informe um Group ID e consuma um batch de mensagens
- Tabela com offset, partição, chave, valor e headers

> **Dica:** Produzir/consumir via dashboard é para debug e teste. Para uso em produção, crie uma Event API e use os endpoints REST/SSE.`,
    },
  ],
}
