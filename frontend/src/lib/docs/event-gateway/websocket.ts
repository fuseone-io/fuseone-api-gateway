import type { DocArticle } from "../types"

export const websocketArticle: DocArticle = {
  slug: "websocket-event-gateway",
  title: "WebSocket Pub/Sub",
  description:
    "Protocolo WebSocket bidirecional para publicar e consumir mensagens em tempo real.",
  icon: "Plug",
  tags: ["kafka", "nats", "websocket", "pub/sub", "realtime", "bidirecional"],
  content: [
    {
      id: "visao-geral-ws",
      title: "Visão Geral",
      body: `O WebSocket do Event Gateway oferece **comunicação bidirecional** entre clientes e o provedor (Kafka ou NATS). Uma única conexão WebSocket permite:

- **Receber mensagens** em tempo real (consumer)
- **Publicar mensagens** de volta ao tópico/subject (producer)
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
  key?: string;
  value?: any;
  headers?: Record<string, string>;
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
  timestamp?: string;
  headers?: Record<string, string>;
  message?: string;
  group?: string;
  topic?: string;
}
\`\`\`

**Fluxo de uma sessão:**

1. Cliente conecta → recebe \`{ type: "connected", group: "...", topic: "..." }\`
2. Mensagens chegam → recebe \`{ type: "message", key: "...", value: {...}, ... }\`
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
ws.send(JSON.stringify({
  action: "publish",
  key: "user-42",
  value: { event: "click", page: "/checkout" },
  headers: { source: "frontend" }
}));
\`\`\`

**Python (websockets):**

\`\`\`python
import asyncio, json, websockets

async def main():
    uri = "wss://api.example.com/events/orders/ws"
    headers = {"Authorization": "Bearer <token>"}

    async with websockets.connect(uri, extra_headers=headers) as ws:
        async def consumer():
            async for raw in ws:
                msg = json.loads(raw)
                print(f"[{msg['type']}] {msg}")

        await ws.send(json.dumps({
            "action": "publish",
            "key": "sensor-1",
            "value": {"temp": 23.5}
        }))

        await consumer()

asyncio.run(main())
\`\`\`

**wscat (CLI):**

\`\`\`bash
wscat -c "wss://api.example.com/events/orders/ws?group=debug" \\
  -H "Authorization: Bearer <token>"

# Enviar:
{"action":"publish","key":"test","value":{"hello":"world"}}
{"action":"ping"}
\`\`\``,
    },
  ],
}
