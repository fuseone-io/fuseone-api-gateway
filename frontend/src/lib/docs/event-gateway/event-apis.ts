import type { DocArticle } from "../types"

export const eventApisArticle: DocArticle = {
  slug: "event-apis",
  title: "Event APIs",
  description:
    "Crie e gerencie Event APIs que expõem tópicos Kafka ou subjects NATS como endpoints REST, SSE e WebSocket.",
  icon: "Zap",
  tags: ["kafka", "nats", "event-api", "rest", "sse", "websocket", "deploy"],
  content: [
    {
      id: "criar-event-api",
      title: "Criando uma Event API",
      body: `Para criar uma Event API:

1. Acesse **Integrações > Event APIs** no menu lateral
2. Clique em **Criar Event API**
3. Preencha os campos:

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| **Nome** | Sim | Nome identificador (ex: "Pedidos") |
| **Slug** | Sim | Usado na URL pública (ex: \`orders\`) |
| **Conexão** | Sim | Selecione uma conexão Kafka ou NATS |
| **Tópico / Subject** | Sim | Nome do tópico Kafka (ex: \`prod.events.orders.v2\`) ou subject NATS (ex: \`orders.events\`) |
| **Context Path** | Não | Prefixo da URL (padrão: \`/events\`) |
| **Consumer Group Prefix** | Não | Prefixo para consumer groups (padrão: \`fuseone-eg\`) |
| **Auto Offset Reset** | Não | \`latest\` ou \`earliest\` (padrão: \`latest\`) |

4. Habilite os protocolos desejados (REST Produce, REST Consume, SSE, WebSocket, Webhook)
5. Clique em **Salvar**

> **Slug vs Tópico:** O slug \`orders\` pode mapear para o tópico Kafka \`prod.events.orders.v2\` ou o subject NATS \`orders.events\`. O slug é usado na URL pública, desacoplando a nomenclatura interna.

> **NATS JetStream:** Ao usar uma conexão NATS com JetStream habilitado, o stream é criado automaticamente se não existir. O subject \`orders.events\` gera o stream \`ORDERS_EVENTS\`.`,
    },
    {
      id: "protocolos",
      title: "Protocolos Disponíveis",
      body: `Cada Event API pode habilitar um ou mais protocolos. Todos funcionam identicamente com Kafka e NATS:

| Protocolo | Método | Endpoint | Descrição |
|-----------|--------|----------|-----------|
| **REST Produce** | POST | \`/events/{slug}/produce\` | Produz uma mensagem |
| **REST Consume** | POST | \`/events/{slug}/consume\` | Consome um batch de mensagens |
| **SSE Stream** | GET | \`/events/{slug}/stream\` | Streaming contínuo via Server-Sent Events |
| **WebSocket** | GET | \`/events/{slug}/ws\` | Pub/sub bidirecional em tempo real |
| **Webhook** | — | — | Entrega push para URLs registradas via HTTP POST |

**REST Produce — Request:**

\`\`\`json
POST /events/orders/produce
{
  "key": "user-123",
  "value": "{\\"event\\": \\"order.created\\", \\"data\\": {...}}",
  "headers": { "source": "checkout-service" }
}
\`\`\`

**REST Produce — Response:**

\`\`\`json
{
  "partition": 0,
  "offset": 42,
  "timestamp": "2024-01-15T10:30:00Z"
}
\`\`\`

> **Para NATS Core:** \`partition\` é sempre \`0\` e \`offset\` é \`-1\` (sem persistência). Para NATS JetStream: \`offset\` é o sequence number do stream.

**REST Consume — Request:**

\`\`\`json
POST /events/orders/consume
{
  "group_id": "my-consumer",
  "timeout_ms": 5000
}
\`\`\`

**SSE Stream — Conectando:**

\`\`\`bash
curl -N -H "Authorization: Bearer <token>" \\
  "https://api.example.com/events/orders/stream?group=my-group&offset=latest"
\`\`\``,
    },
    {
      id: "deploy-undeploy",
      title: "Deploy e Undeploy",
      body: `Após criar e configurar uma Event API, você precisa **publicá-la** para que fique acessível:

1. Acesse a página de detalhes da Event API
2. Clique em **Publicar**
3. O sistema cria automaticamente rotas no APISIX para cada protocolo habilitado

**O que acontece no deploy:**

Para cada protocolo habilitado, uma rota APISIX é criada:

| Protocolo | Rota APISIX |
|-----------|-------------|
| REST Produce | \`POST /events/{slug}/produce → event-gateway:8090/topics/{slug}/produce\` |
| REST Consume | \`POST /events/{slug}/consume → event-gateway:8090/topics/{slug}/consume\` |
| SSE Stream | \`GET /events/{slug}/stream → event-gateway:8090/topics/{slug}/stream\` (timeout 3600s) |
| WebSocket | \`GET /events/{slug}/ws → event-gateway:8090/topics/{slug}/ws\` (enable_websocket: true) |

Cada rota inclui:
- **proxy-rewrite** — reescreve a URI pública para a URI interna do Event Gateway
- **Plugins configurados** — auth, rate-limit, ou qualquer plugin APISIX
- **Labels** — \`_fuseone_event_api: <id>\` para rastreabilidade

**Undeploy:** Remove todas as rotas APISIX e volta o status para "Draft".

> **Nenhum plugin custom é necessário.** O APISIX funciona como proxy reverso normal — a inteligência está no deployer que cria as rotas automaticamente.`,
    },
    {
      id: "plugins-auth",
      title: "Auth e Rate Limiting",
      body: `O campo \`apisix_plugins\` permite configurar qualquer plugin APISIX nas rotas da Event API:

**Exemplo — Key Auth + Rate Limit:**

\`\`\`json
{
  "key-auth": {},
  "limit-count": {
    "count": 1000,
    "time_window": 60,
    "rejected_code": 429
  }
}
\`\`\`

**Exemplo — JWT Auth:**

\`\`\`json
{
  "jwt-auth": {},
  "limit-req": {
    "rate": 100,
    "burst": 50
  }
}
\`\`\`

Esses plugins são injetados em **todas as rotas** da Event API junto com o \`proxy-rewrite\`. O APISIX aplica auth e rate-limit **antes** de encaminhar para o Event Gateway.`,
    },
  ],
}
