import type { DocCategory } from "./types"

export const kafkaGatewayCategory: DocCategory = {
  slug: "kafka-gateway",
  title: "Event Gateway (Kafka)",
  description:
    "Exponha tópicos Kafka como APIs gerenciadas via REST, SSE, WebSocket e Webhook, com governance completo pelo API Gateway.",
  icon: "Radio",
  articles: [
    {
      slug: "visao-geral-kafka",
      title: "Visão Geral do Event Gateway",
      description:
        "Entenda a arquitetura do Event Gateway e como ele transforma tópicos Kafka em APIs gerenciadas.",
      icon: "Radio",
      tags: ["kafka", "eventos", "mensageria", "overview", "event-api"],
      content: [
        {
          id: "o-que-e",
          title: "O que é o Event Gateway",
          body: `O Event Gateway do FuseOne transforma tópicos Kafka em **APIs gerenciadas** — expostas via REST, SSE (Server-Sent Events) e WebSocket, com auth, rate limiting e SSL aplicados automaticamente pelo APISIX.

**Dois modos de uso:**

1. **Topic Browser** (admin) — navegue tópicos, produza e consuma mensagens para debug diretamente pelo dashboard
2. **Event APIs** (produção) — exponha tópicos como endpoints REST/SSE para aplicações externas, com governance completo

**Funcionalidades das Event APIs:**

- **REST Produce** — POST para produzir mensagens no Kafka
- **REST Consume** — POST para consumir um batch de mensagens
- **SSE Stream** — GET para streaming contínuo de mensagens em tempo real
- **WebSocket** — comunicação bidirecional pub/sub em tempo real
- **Webhook** — entrega push para URLs registradas com retry e HMAC
- **Deploy com 1 clique** — cria rotas APISIX automaticamente
- **Slug-based routing** — URL pública desacoplada do nome real do tópico

> **Arquitetura:** O Event Gateway é um serviço Go separado que faz a mediação de protocolo entre o Kafka e os clients. O APISIX funciona como proxy reverso — aplicando auth, rate limit e SSL como faz com qualquer rota.`,
        },
        {
          id: "arquitetura",
          title: "Arquitetura",
          body: `O Event Gateway opera com 3 componentes:

\`\`\`
Client → APISIX (auth, rate limit, SSL) → Event Gateway (Go) → Kafka
                                                ↓
Dashboard Backend (control plane) → cria rotas APISIX + salva configs no PostgreSQL
                                                ↓
Event Gateway (data plane) → lê configs via LISTEN/NOTIFY
\`\`\`

**Fluxo de uma mensagem produzida via Event API:**

\`\`\`
Client → POST https://api.example.com/events/orders/produce
       → APISIX: aplica key-auth + limit-count
       → proxy-rewrite: /events/orders/produce → /topics/orders/produce
       → Event Gateway: produz no Kafka via franz-go
       → Retorna { partition, offset, timestamp }
\`\`\`

**Fluxo SSE (streaming):**

\`\`\`
Client → GET https://api.example.com/events/orders/stream
       → APISIX: auth + timeout 3600s
       → Event Gateway: cria consumer group, envia eventos via SSE
       → id: 0-42
         event: message
         data: {"key":"user-1","value":"...","partition":0,"offset":42}
\`\`\`

**Fluxo WebSocket (bidirecional):**

\`\`\`
Client → GET wss://api.example.com/events/orders/ws (upgrade)
       → APISIX: auth + enable_websocket: true
       → Event Gateway: cria consumer + producer, sessão bidirecional
       ← { type: "connected", group: "fuseone-eg-ws-abc123" }
       ← { type: "message", key: "user-1", value: {...} }
       → { action: "publish", key: "reply", value: {...} }
       ← { type: "published", partition: 0, offset: 99 }
\`\`\`

**Componentes:**

| Componente | Função |
|-----------|--------|
| **Event Gateway** | Serviço Go (porta 8090) — tradução de protocolo Kafka ↔ HTTP/SSE/WS/Webhook |
| **APISIX** | Proxy reverso — auth, rate limit, SSL, rewrite de URI |
| **Backend** | Control plane — CRUD de Event APIs, deploy de rotas APISIX |
| **PostgreSQL** | Armazena configs de Event APIs + LISTEN/NOTIFY para reload |`,
        },
      ],
    },
    {
      slug: "event-apis",
      title: "Event APIs",
      description:
        "Crie e gerencie Event APIs que expõem tópicos Kafka como endpoints REST, SSE e WebSocket.",
      icon: "Zap",
      tags: ["kafka", "event-api", "rest", "sse", "websocket", "deploy"],
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
| **Conexão Kafka** | Sim | Selecione uma conexão existente |
| **Nome do Tópico** | Sim | Nome real do tópico Kafka (ex: \`prod.events.orders.v2\`) |
| **Context Path** | Não | Prefixo da URL (padrão: \`/events\`) |
| **Consumer Group Prefix** | Não | Prefixo para consumer groups (padrão: \`fuseone-eg\`) |
| **Auto Offset Reset** | Não | \`latest\` ou \`earliest\` (padrão: \`latest\`) |

4. Habilite os protocolos desejados (REST Produce, REST Consume, SSE, WebSocket)
5. Clique em **Salvar**

> **Slug vs Topic Name:** O slug \`orders\` pode mapear para o tópico \`prod.events.orders.v2\`. O slug é usado na URL pública, desacoplando a nomenclatura interna do Kafka.`,
        },
        {
          id: "protocolos",
          title: "Protocolos Disponíveis",
          body: `Cada Event API pode habilitar um ou mais protocolos:

| Protocolo | Método | Endpoint | Descrição |
|-----------|--------|----------|-----------|
| **REST Produce** | POST | \`/events/{slug}/produce\` | Produz uma mensagem no Kafka |
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
\`\`\`

Retorna eventos no formato SSE:

\`\`\`
id: 0-42
event: message
data: {"key":"user-1","value":"...","partition":0,"offset":42}

: keepalive

id: 0-43
event: message
data: {"key":"user-2","value":"...","partition":0,"offset":43}
\`\`\`

**WebSocket — Conectando:**

\`\`\`javascript
const ws = new WebSocket(
  "wss://api.example.com/events/orders/ws?group=my-group&offset=latest",
  { headers: { "Authorization": "Bearer <token>" } }
);

ws.onopen = () => console.log("Connected");
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // msg.type: "connected" | "message" | "published" | "pong" | "error"
};

// Publicar mensagem
ws.send(JSON.stringify({
  action: "publish",
  key: "user-123",
  value: { event: "order.created", data: {} },
  headers: { source: "checkout" }
}));
\`\`\`

O WebSocket permite **pub/sub bidirecional** — receba mensagens do Kafka e publique novas no mesmo tópico, tudo em uma única conexão.`,
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
- **Plugins configurados** — auth, rate-limit, ou qualquer plugin APISIX que você configurar
- **Labels** — \`_fuseone_event_api: <id>\` para rastreabilidade

**Undeploy:** Remove todas as rotas APISIX e volta o status para "Draft".

> **Nenhum plugin custom é necessário.** O APISIX funciona como proxy reverso normal — a inteligência está no deployer que cria as rotas automaticamente.`,
        },
        {
          id: "plugins-auth",
          title: "Auth e Rate Limiting",
          body: `O campo \`apisix_plugins\` de uma Event API permite configurar qualquer plugin APISIX nas rotas:

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

Esses plugins são injetados em **todas as rotas** da Event API (produce, consume, stream, ws) junto com o \`proxy-rewrite\`. O APISIX aplica auth e rate-limit **antes** de encaminhar para o Event Gateway.

> **Dica:** Configure plugins via a API ou edite o campo \`apisix_plugins\` diretamente no JSON da Event API. Qualquer plugin suportado pelo APISIX pode ser utilizado.`,
        },
      ],
    },
    {
      slug: "websocket-kafka",
      title: "WebSocket Pub/Sub",
      description:
        "Protocolo WebSocket bidirecional para publicar e consumir mensagens Kafka em tempo real.",
      icon: "Plug",
      tags: ["kafka", "websocket", "pub/sub", "realtime", "bidirecional"],
      content: [
        {
          id: "visao-geral-ws",
          title: "Visão Geral",
          body: `O WebSocket do Event Gateway oferece **comunicação bidirecional** entre clientes e o Kafka. Uma única conexão WebSocket permite:

- **Receber mensagens** do Kafka em tempo real (consumer)
- **Publicar mensagens** de volta ao tópico (producer)
- **Ping/Pong** para manter a conexão ativa

**Quando usar WebSocket vs SSE:**

| Cenário | Recomendação |
|---------|-------------|
| Apenas consumir eventos | **SSE** — mais simples, reconexão automática |
| Publicar + consumir | **WebSocket** — bidirecional |
| Dashboard em tempo real | **WebSocket** — menor latência |
| Integração backend-to-backend | **REST** — mais simples |
| Muitos consumidores passivos | **SSE** — melhor escalabilidade |

**Endpoint:** \`GET /events/{slug}/ws\`

**Query params:**
- \`group\` — nome do consumer group (opcional, gera sessão única se omitido)
- \`offset\` — \`latest\` ou \`earliest\` (padrão: configurado na Event API)`,
        },
        {
          id: "protocolo-ws",
          title: "Protocolo de Mensagens",
          body: `O WebSocket usa JSON para todas as mensagens.

**Mensagens do cliente → servidor (inbound):**

\`\`\`typescript
interface WSInboundMessage {
  action: "publish" | "ping";
  key?: string;        // Chave da mensagem Kafka
  value?: any;         // Valor da mensagem (JSON)
  headers?: Record<string, string>;  // Headers Kafka
}
\`\`\`

**Mensagens do servidor → cliente (outbound):**

\`\`\`typescript
interface WSOutboundMessage {
  type: "connected" | "message" | "published" | "pong" | "error";
  key?: string;
  value?: any;
  partition?: number;
  offset?: number;
  timestamp?: string;  // ISO 8601
  headers?: Record<string, string>;
  message?: string;    // Para "connected" e "error"
  group?: string;      // Consumer group ID
  topic?: string;      // Nome do tópico Kafka
}
\`\`\`

**Fluxo de uma sessão:**

1. Cliente conecta → recebe \`{ type: "connected", group: "...", topic: "..." }\`
2. Mensagens Kafka chegam → recebe \`{ type: "message", key: "...", value: {...}, ... }\`
3. Cliente publica → envia \`{ action: "publish", key: "...", value: {...} }\`
4. Confirmação → recebe \`{ type: "published", partition: 0, offset: 42 }\`
5. Keepalive — servidor envia ping WebSocket a cada 30s`,
        },
        {
          id: "exemplos-ws",
          title: "Exemplos de Uso",
          body: `**JavaScript (Browser):**

\`\`\`javascript
const ws = new WebSocket("wss://api.example.com/events/orders/ws?group=dashboard");

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case "connected":
      console.log("Conectado ao grupo:", msg.group);
      break;
    case "message":
      console.log("Evento recebido:", msg.key, msg.value);
      break;
    case "published":
      console.log("Publicado em:", msg.partition, msg.offset);
      break;
    case "error":
      console.error("Erro:", msg.message);
      break;
  }
};

// Publicar
function publish(key, value) {
  ws.send(JSON.stringify({
    action: "publish",
    key: key,
    value: value,
    headers: { source: "frontend" }
  }));
}

publish("user-42", { event: "click", page: "/checkout" });
\`\`\`

**Python (websockets):**

\`\`\`python
import asyncio, json, websockets

async def main():
    uri = "wss://api.example.com/events/orders/ws"
    headers = {"Authorization": "Bearer <token>"}

    async with websockets.connect(uri, extra_headers=headers) as ws:
        # Receber mensagens em background
        async def consumer():
            async for raw in ws:
                msg = json.loads(raw)
                print(f"[{msg['type']}] {msg}")

        # Publicar uma mensagem
        await ws.send(json.dumps({
            "action": "publish",
            "key": "sensor-1",
            "value": {"temp": 23.5}
        }))

        await consumer()

asyncio.run(main())
\`\`\`

**curl (wscat):**

\`\`\`bash
# Instalar: npm install -g wscat
wscat -c "wss://api.example.com/events/orders/ws?group=debug" \\
  -H "Authorization: Bearer <token>"

# No prompt, enviar:
{"action":"publish","key":"test","value":{"hello":"world"}}
{"action":"ping"}
\`\`\``,
        },
        {
          id: "consumer-groups-ws",
          title: "Consumer Groups e Sessões",
          body: `Cada conexão WebSocket cria um **consumer group** no Kafka. O comportamento depende do parâmetro \`group\`:

**Sem parâmetro \`group\`:**
- Gera um ID de sessão único (ex: \`fuseone-eg-ws-a3b7c9\`)
- Cada conexão recebe **todas** as mensagens do tópico
- Ideal para dashboards individuais

**Com parâmetro \`group\`:**
- Usa o group ID fornecido (ex: \`fuseone-eg-ws-dashboard\`)
- Múltiplas conexões com o mesmo group **dividem** as partições
- Ideal para balanceamento de carga entre consumidores

**Exemplo — 3 conexões com mesmo group:**

\`\`\`
Tópico orders (3 partições):
  Partição 0 → conexão WS #1
  Partição 1 → conexão WS #2
  Partição 2 → conexão WS #3
\`\`\`

**Nomeação do consumer group:**

\`\`\`
{consumer_group_prefix}-ws-{group_ou_session_id}
\`\`\`

Exemplo: \`fuseone-eg-ws-dashboard\` ou \`fuseone-eg-ws-a3b7c9\`

> **Importante:** O auto offset reset (\`latest\` ou \`earliest\`) é aplicado apenas na primeira vez que o consumer group se conecta. Reconexões com o mesmo group retomam do último offset commitado.`,
        },
      ],
    },
    {
      slug: "webhook-delivery",
      title: "Webhook Delivery",
      description:
        "Entrega push de mensagens Kafka para URLs registradas com retry automático e assinatura HMAC.",
      icon: "Webhook",
      tags: ["kafka", "webhook", "delivery", "hmac", "retry", "push"],
      content: [
        {
          id: "visao-geral-wh",
          title: "Visão Geral",
          body: `O Webhook Delivery Engine do Event Gateway entrega mensagens Kafka para URLs externas via **HTTP POST**, com:

- **Assinatura HMAC-SHA256** — payload assinado no header \`X-Webhook-Signature-256\`
- **Retry com backoff exponencial** — tentativas configuráveis (padrão: 3x com 10s, 30s, 90s)
- **Delivery log** — registro de cada tentativa com status HTTP e erros
- **Hot reload** — novas subscriptions são ativadas em tempo real via LISTEN/NOTIFY

**Fluxo:**

\`\`\`
Kafka topic → Event Gateway (consumer dedicado)
    ↓
Para cada mensagem, para cada subscriber ativo:
    → POST https://cliente.com/webhook
      Content-Type: application/json
      X-Webhook-Signature-256: sha256=<hex>
      X-Delivery-ID: <uuid>
      X-Event-API-ID: <uuid>
    ↓
    Sucesso (2xx): registra no delivery log
    Falha: retry com backoff → falha permanente após esgotar tentativas
\`\`\`

**Diferença dos outros protocolos:**

| Protocolo | Modelo | Quem inicia |
|-----------|--------|-------------|
| REST | Request/Response | Cliente |
| SSE | Streaming unidirecional | Cliente |
| WebSocket | Bidirecional | Cliente |
| **Webhook** | **Push** | **Servidor** |`,
        },
        {
          id: "configuracao-wh",
          title: "Configuração",
          body: `Para configurar webhooks em uma Event API:

1. Acesse a página de detalhes da Event API
2. Habilite o toggle **Webhook** nos protocolos
3. Na seção **Webhook Subscriptions**, clique em **Adicionar Webhook**
4. Preencha:

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| **URL** | Sim | Endpoint que receberá o POST |
| **Secret** | Não | Chave para assinatura HMAC-SHA256 |
| **Descrição** | Não | Identificador da subscription |
| **Ativo** | Sim | Toggle para habilitar/desabilitar |

5. Clique em **Salvar**

**Múltiplos subscribers:** Uma Event API pode ter vários webhooks. Cada mensagem é entregue para **todos** os subscribers ativos em paralelo.

**Retry Policy (padrão):**
\`\`\`json
{
  "max_attempts": 3,
  "backoff_seconds": [10, 30, 90]
}
\`\`\``,
        },
        {
          id: "assinatura-hmac",
          title: "Assinatura HMAC",
          body: `Se um webhook tem \`secret\` configurado, cada request inclui o header \`X-Webhook-Signature-256\` com a assinatura HMAC-SHA256 do body.

**Formato:** \`sha256=<hex-encoded-hmac>\`

**Verificação no receiver (Node.js):**

\`\`\`javascript
const crypto = require("crypto");

function verifySignature(body, secret, signature) {
  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}

// Express middleware
app.post("/webhook", (req, res) => {
  const sig = req.headers["x-webhook-signature-256"];
  if (!verifySignature(JSON.stringify(req.body), SECRET, sig)) {
    return res.status(401).send("Invalid signature");
  }
  // Process event...
  res.status(200).send("OK");
});
\`\`\`

**Verificação (Python):**

\`\`\`python
import hmac, hashlib

def verify_signature(body: bytes, secret: str, signature: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
\`\`\`

**Headers incluídos em cada request:**

| Header | Descrição |
|--------|-----------|
| \`Content-Type\` | \`application/json\` |
| \`X-Webhook-Signature-256\` | Assinatura HMAC-SHA256 (se secret configurado) |
| \`X-Delivery-ID\` | UUID único da entrega |
| \`X-Event-API-ID\` | UUID da Event API |
| \`User-Agent\` | \`FuseOne-Event-Gateway/1.0\` |`,
        },
        {
          id: "payload-wh",
          title: "Payload",
          body: `O body do POST contém a mensagem Kafka em formato JSON:

\`\`\`json
{
  "key": "user-123",
  "value": { "event": "order.created", "data": { "amount": 99.90 } },
  "partition": 0,
  "offset": 42,
  "timestamp": "2024-01-15T10:30:00Z",
  "headers": { "source": "checkout-service" },
  "topic": "prod.events.orders.v2",
  "slug": "orders"
}
\`\`\`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| \`key\` | string | Chave da mensagem Kafka |
| \`value\` | any | Valor da mensagem (JSON) |
| \`partition\` | number | Partição Kafka |
| \`offset\` | number | Offset na partição |
| \`timestamp\` | string | Timestamp da mensagem (ISO 8601) |
| \`headers\` | object | Headers Kafka (key/value) |
| \`topic\` | string | Nome real do tópico Kafka |
| \`slug\` | string | Slug da Event API |

> **Resposta esperada:** O receiver deve retornar status **2xx** para confirmar o recebimento. Qualquer outro status ou timeout (30s) é tratado como falha e dispara retry.`,
        },
      ],
    },
    {
      slug: "configuracao-kafka",
      title: "Configuração da Infraestrutura",
      description:
        "Configure a infraestrutura Kafka e o Event Gateway para uso com o API Gateway.",
      icon: "Settings",
      tags: ["kafka", "configuração", "docker", "helm", "infraestrutura"],
      content: [
        {
          id: "docker-compose",
          title: "Docker Compose",
          body: `O API Gateway inclui configuração Docker Compose para Kafka com profile opcional:

\`\`\`bash
# Iniciar infraestrutura base + Kafka + Event Gateway
docker compose --profile kafka up -d
\`\`\`

Isso inicia os seguintes serviços:

| Serviço | Imagem | Porta | Função |
|---------|--------|-------|--------|
| **zookeeper** | confluentinc/cp-zookeeper:7.6.0 | 2181 | Coordenação do cluster Kafka |
| **kafka** | confluentinc/cp-kafka:7.6.0 | 9092 | Broker Kafka |
| **kafka-bridge** | strimzi/kafka-bridge:0.29.0 | 8082 | Proxy REST para topic browser |
| **event-gateway** | fuseone/event-gateway | 8090 | Mediação de protocolo para Event APIs |

**Variáveis de ambiente do Event Gateway:**

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| \`SERVER_PORT\` | \`8090\` | Porta HTTP do Event Gateway |
| \`DB_HOST\` | \`postgres\` | Host do PostgreSQL (mesmo banco do backend) |
| \`DB_PORT\` | \`5432\` | Porta do PostgreSQL |
| \`DB_NAME\` | \`fuseone_gateway\` | Nome do banco de dados |
| \`DB_USER\` | \`gateway\` | Usuário do banco |
| \`DB_PASSWORD\` | \`gateway\` | Senha do banco |

> **Nota:** O Event Gateway compartilha o mesmo PostgreSQL do backend. Ele lê as configs das Event APIs e recebe notificações de mudança via \`LISTEN/NOTIFY\`.`,
        },
        {
          id: "helm",
          title: "Deploy com Helm",
          body: `Para Kubernetes, habilite o Event Gateway no Helm chart:

\`\`\`yaml
# values.yaml
eventGateway:
  enabled: true

  image:
    repository: devopsfuseone/fuseone-event-gateway
    tag: "latest"

  replicas: 2

  resources:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 500m
      memory: 256Mi

  service:
    type: ClusterIP
    port: 8090
\`\`\`

\`\`\`bash
helm upgrade --install fuseone ./charts/fuseone \\
  --set eventGateway.enabled=true
\`\`\`

O chart cria automaticamente:
- **Deployment** com liveness/readiness probes em \`/health\`
- **Service** ClusterIP na porta 8090
- **ConfigMap** com variáveis do PostgreSQL (host/porta detectados automaticamente)
- **Secret** com credenciais do banco (herda do backend por padrão)

> **Dica:** O Event Gateway usa as mesmas credenciais de banco do backend por padrão. Configure \`eventGateway.secrets.dbUser\` e \`eventGateway.secrets.dbPassword\` para usar credenciais separadas.`,
        },
        {
          id: "bridge-properties",
          title: "Configuração do Kafka Bridge",
          body: `O Kafka Bridge (Strimzi) é usado para o **topic browser** do dashboard. O arquivo \`kafka-bridge.properties\` configura:

\`\`\`properties
bridge.id=fuseone-bridge
kafka.bootstrap.servers=kafka:29092
http.host=0.0.0.0
http.port=8080
http.cors.enabled=true
http.cors.allowedOrigins=*
http.consumer.enabled=true
http.producer.enabled=true
\`\`\`

> **Nota:** O Kafka Bridge é usado apenas pelo topic browser (admin). As Event APIs usam o Event Gateway, que se conecta diretamente ao Kafka via protocolo nativo (franz-go).`,
        },
      ],
    },
    {
      slug: "conexoes-kafka",
      title: "Gerenciamento de Conexões",
      description:
        "Cadastre, edite e gerencie conexões com clusters Kafka no dashboard.",
      icon: "Cable",
      tags: ["kafka", "conexões", "clusters", "gerenciamento"],
      content: [
        {
          id: "criar-conexao",
          title: "Criando uma Conexão",
          body: `Para cadastrar uma nova conexão Kafka:

1. Acesse **Integrações > Kafka** no menu lateral
2. Clique em **Gerenciar Conexões**
3. Clique em **Criar Conexão**
4. Preencha os campos:

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| **Nome** | Sim | Nome identificador da conexão |
| **Descrição** | Não | Descrição do cluster |
| **Brokers** | Sim | Lista de brokers (ex: \`kafka:9092,kafka2:9092\`) |
| **Protocolo de Segurança** | Sim | PLAINTEXT, SSL, SASL_PLAINTEXT, SASL_SSL |
| **Mecanismo SASL** | Condicional | PLAIN, SCRAM-SHA-256, SCRAM-SHA-512 (se SASL) |
| **Usuário/Senha SASL** | Condicional | Credenciais SASL |
| **Bridge URL** | Sim | URL do Kafka Bridge (para topic browser) |
| **Ativo** | Sim | Toggle para habilitar/desabilitar |

5. Clique em **Salvar**

A conexão é usada tanto pelo topic browser (via Bridge) quanto pelas Event APIs (via Event Gateway com conexão nativa).`,
        },
        {
          id: "protocolos",
          title: "Protocolos de Segurança",
          body: `O API Gateway suporta 4 protocolos de segurança para conexões Kafka:

| Protocolo | Descrição | Quando Usar |
|-----------|-----------|-------------|
| **PLAINTEXT** | Sem criptografia nem autenticação | Desenvolvimento local, redes internas |
| **SSL** | Criptografia TLS sem autenticação | Redes que requerem criptografia |
| **SASL_PLAINTEXT** | Autenticação SASL sem criptografia | Redes internas com controle de acesso |
| **SASL_SSL** | Autenticação SASL + criptografia TLS | Produção, clusters na nuvem |

**Mecanismos SASL suportados:**

- **PLAIN** — usuário/senha simples (mais comum com MSK, Confluent Cloud)
- **SCRAM-SHA-256** — challenge-response com hash SHA-256
- **SCRAM-SHA-512** — challenge-response com hash SHA-512 (mais seguro)

> **Segurança:** As credenciais SASL são armazenadas no PostgreSQL. Para ambientes de produção, considere usar um secret manager externo.`,
        },
      ],
    },
    {
      slug: "topicos-kafka",
      title: "Navegação de Tópicos",
      description:
        "Navegue por tópicos Kafka, visualize partições e configurações de cada tópico.",
      icon: "List",
      tags: ["kafka", "tópicos", "partições", "browser"],
      content: [
        {
          id: "browser",
          title: "Topic Browser",
          body: `O Topic Browser permite navegar pelos tópicos de um cluster Kafka conectado.

**Acessando:**

1. Vá para **Integrações > Kafka**
2. Selecione uma conexão ativa na tabela
3. Clique em **Ver Tópicos**

A lista mostra todos os tópicos do cluster. Use o campo de busca para filtrar.

> **Nota:** O topic browser usa o Kafka Bridge (REST). As Event APIs usam o Event Gateway (protocolo nativo). São funcionalidades complementares.`,
        },
        {
          id: "produzir-consumir",
          title: "Produzir e Consumir (Debug)",
          body: `Na página de detalhes de um tópico:

**Aba Produzir:**
- Envie mensagens ao tópico com chave, valor e headers
- Feedback com offset e partição da mensagem produzida

**Aba Consumir:**
- Informe um Group ID e consuma um batch de mensagens
- Tabela com offset, partição, chave, valor e headers

> **Dica:** Produzir/consumir via dashboard é para debug e teste. Para uso em produção, crie uma Event API e use os endpoints REST/SSE.`,
        },
      ],
    },
  ],
}
