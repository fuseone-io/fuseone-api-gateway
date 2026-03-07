import type { DocArticle } from "../types"

export const webhookArticle: DocArticle = {
  slug: "webhook-delivery",
  title: "Webhook Delivery",
  description:
    "Entrega push de mensagens para URLs registradas com retry automático e assinatura HMAC.",
  icon: "Webhook",
  tags: ["kafka", "nats", "webhook", "delivery", "hmac", "retry", "push"],
  content: [
    {
      id: "visao-geral-wh",
      title: "Visão Geral",
      body: `O Webhook Delivery Engine do Event Gateway entrega mensagens para URLs externas via **HTTP POST**, com:

- **Assinatura HMAC-SHA256** — payload assinado no header \`X-Webhook-Signature-256\`
- **Retry com backoff exponencial** — tentativas configuráveis (padrão: 3x com 10s, 30s, 90s)
- **Delivery log** — registro de cada tentativa com status HTTP e erros
- **Hot reload** — novas subscriptions são ativadas em tempo real via LISTEN/NOTIFY

**Fluxo:**

\`\`\`
Kafka topic / NATS subject → Event Gateway (consumer dedicado)
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

**Verificação (Node.js):**

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

app.post("/webhook", (req, res) => {
  const sig = req.headers["x-webhook-signature-256"];
  if (!verifySignature(JSON.stringify(req.body), SECRET, sig)) {
    return res.status(401).send("Invalid signature");
  }
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
      body: `O body do POST contém a mensagem em formato JSON:

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
| \`key\` | string | Chave da mensagem |
| \`value\` | any | Valor da mensagem (JSON) |
| \`partition\` | number | Partição (0 para NATS) |
| \`offset\` | number | Offset/sequence (-1 para NATS Core) |
| \`timestamp\` | string | Timestamp ISO 8601 |
| \`headers\` | object | Headers da mensagem |
| \`topic\` | string | Nome do tópico/subject |
| \`slug\` | string | Slug da Event API |

> **Resposta esperada:** O receiver deve retornar status **2xx** para confirmar o recebimento. Qualquer outro status ou timeout (30s) é tratado como falha e dispara retry.`,
    },
  ],
}
