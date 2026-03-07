import type { DocArticle } from "../types"

export const visaoGeralArticle: DocArticle = {
  slug: "visao-geral-event-gateway",
  title: "Visão Geral do Event Gateway",
  description:
    "Entenda a arquitetura do Event Gateway e como ele transforma tópicos Kafka e subjects NATS em APIs gerenciadas.",
  icon: "Radio",
  tags: ["kafka", "nats", "eventos", "mensageria", "overview", "event-api", "jetstream"],
  content: [
    {
      id: "o-que-e",
      title: "O que é o Event Gateway",
      body: `O Event Gateway do FuseOne transforma **tópicos Kafka** e **subjects NATS** em **APIs gerenciadas** — expostas via REST, SSE (Server-Sent Events), WebSocket e Webhook, com auth, rate limiting e SSL aplicados automaticamente pelo APISIX.

**Provedores suportados:**

| Provedor | Características | Quando Usar |
|----------|----------------|-------------|
| **Apache Kafka** | Alta throughput, particionamento, persistência nativa | Streaming de alto volume, event sourcing, pipelines de dados |
| **NATS Core** | Ultra-leve, pub/sub efêmero, latência sub-milissegundo | Comunicação entre microserviços, comandos em tempo real |
| **NATS JetStream** | Persistência, consumers duráveis, exactly-once | IoT, telemetria, filas de trabalho, replay de eventos |

**Dois modos de uso:**

1. **Topic Browser** (admin) — navegue tópicos/subjects, produza e consuma mensagens para debug diretamente pelo dashboard
2. **Event APIs** (produção) — exponha tópicos como endpoints REST/SSE/WebSocket para aplicações externas, com governance completo

**Funcionalidades das Event APIs:**

- **REST Produce** — POST para produzir mensagens
- **REST Consume** — POST para consumir um batch de mensagens
- **SSE Stream** — GET para streaming contínuo de mensagens em tempo real
- **WebSocket** — comunicação bidirecional pub/sub em tempo real
- **Webhook** — entrega push para URLs registradas com retry e HMAC
- **Deploy com 1 clique** — cria rotas APISIX automaticamente
- **Slug-based routing** — URL pública desacoplada do nome real do tópico/subject

> **Importante:** Os mesmos protocolos (REST, SSE, WebSocket, Webhook) funcionam de forma idêntica independente do provedor (Kafka ou NATS). A interface \`StreamProvider\` abstrai as diferenças internamente.`,
    },
    {
      id: "arquitetura",
      title: "Arquitetura",
      body: `O Event Gateway opera com 3 componentes:

\`\`\`
Client → APISIX (auth, rate limit, SSL) → Event Gateway (Go) → Kafka / NATS
                                                ↓
Dashboard Backend (control plane) → cria rotas APISIX + salva configs no PostgreSQL
                                                ↓
Event Gateway (data plane) → lê configs via LISTEN/NOTIFY
\`\`\`

**StreamProvider — Interface unificada:**

O Event Gateway usa uma interface \`StreamProvider\` que abstrai Kafka e NATS:

| Operação | Kafka | NATS Core | NATS JetStream |
|----------|-------|-----------|----------------|
| **Publish** | Produz no tópico | Publica no subject | Publica no subject (com ack) |
| **FetchOnce** | Consumer group (batch) | QueueSubscribe (timeout) | PullSubscribe (durable) |
| **Subscribe** | Consumer group (streaming) | QueueSubscribe (push) | PullSubscribe (polling) |
| **ListGroups** | Lista consumer groups | ❌ Não suportado | Lista consumers duráveis |
| **Partition** | 0..N partições | Sempre 0 | Sempre 0 |
| **Offset** | Offset Kafka | -1 (sem offset) | Sequence number |

**Fluxo de uma mensagem produzida via Event API:**

\`\`\`
Client → POST https://api.example.com/events/orders/produce
       → APISIX: aplica key-auth + limit-count
       → proxy-rewrite: /events/orders/produce → /topics/orders/produce
       → Event Gateway: produz via StreamProvider (Kafka ou NATS)
       → Retorna { partition, offset, timestamp }
\`\`\`

**Fluxo SSE (streaming):**

\`\`\`
Client → GET https://api.example.com/events/orders/stream
       → APISIX: auth + timeout 3600s
       → Event Gateway: Subscribe() → envia eventos via SSE
       → id: 0-42
         event: message
         data: {"key":"user-1","value":"...","partition":0,"offset":42}
\`\`\`

**Componentes:**

| Componente | Função |
|-----------|--------|
| **Event Gateway** | Serviço Go (porta 8090) — tradução de protocolo Stream ↔ HTTP/SSE/WS/Webhook |
| **APISIX** | Proxy reverso — auth, rate limit, SSL, rewrite de URI |
| **Backend** | Control plane — CRUD de Event APIs, deploy de rotas APISIX |
| **PostgreSQL** | Armazena configs de Event APIs + LISTEN/NOTIFY para reload |`,
    },
  ],
}
