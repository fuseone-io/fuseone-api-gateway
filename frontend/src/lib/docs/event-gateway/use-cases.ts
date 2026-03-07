import type { DocArticle } from "../types"

export const useCasesArticle: DocArticle = {
  slug: "use-cases-event-gateway",
  title: "Casos de Uso Reais",
  description:
    "Cenários práticos de uso do Event Gateway com Kafka e NATS em diferentes indústrias.",
  icon: "Lightbulb",
  tags: ["kafka", "nats", "use-cases", "ecommerce", "iot", "fintech", "saas", "logistica", "healthcare", "laboratorio", "exames", "auditoria"],
  content: [
    {
      id: "patterns",
      title: "Padrões de Entrega: Fire-and-Forget vs Delivery Garantida",
      body: `Antes dos casos de uso, é importante entender os dois padrões fundamentais de entrega de eventos:

**Fire-and-Forget (Dispara e Esquece)**

O produtor envia o evento e segue em frente — não espera confirmação de que o consumidor recebeu. Se o consumidor estiver offline, a mensagem pode ser perdida.

| Característica | Detalhe |
|---------------|---------|
| **Latência** | Mínima (sub-milissegundo) |
| **Persistência** | Não — mensagem existe apenas no momento da publicação |
| **Provedor ideal** | NATS Core (sem JetStream) |
| **Quando usar** | Logs, métricas, notificações UI, cache invalidation |
| **Risco** | Mensagem perdida se nenhum consumidor estiver ativo |

\`\`\`javascript
// Fire-and-forget: notificação de UI — se ninguém está escutando, tudo bem
await fetch("/events/notifications/produce", {
  method: "POST",
  headers: { "Authorization": "Bearer <key>", "Content-Type": "application/json" },
  body: JSON.stringify({
    key: userId,
    value: JSON.stringify({ type: "toast", message: "Pedido aprovado!" })
  })
});
// Não precisa verificar resposta — é fire-and-forget
\`\`\`

**Delivery Garantida (At-Least-Once)**

O evento é persistido no broker (Kafka ou NATS JetStream). Consumidores recebem a mensagem mesmo que estejam offline no momento da publicação — ao reconectar, retomam do último offset.

| Característica | Detalhe |
|---------------|---------|
| **Latência** | Baixa (milissegundos) |
| **Persistência** | Sim — retido por dias/meses/anos |
| **Provedor ideal** | Apache Kafka ou NATS JetStream |
| **Quando usar** | Transações, resultados de exames, pedidos, auditoria |
| **Garantia** | At-least-once (consumidor confirma com ACK/commit) |

\`\`\`python
# Delivery garantida: resultado de exame — NUNCA pode ser perdido
resp = requests.post("/events/lab-results/produce", json={
    "key": accession_number,
    "value": json.dumps({"event": "result.validated", "data": result_data})
})
# Verifica confirmação — Kafka retornou partition + offset
assert resp.status_code == 200
confirmation = resp.json()
print(f"Resultado persistido: partition={confirmation['partition']}, offset={confirmation['offset']}")
\`\`\`

**Resumo visual:**

\`\`\`
Fire-and-Forget (NATS Core):
  Producer → NATS → Consumer (se estiver online)
                  → ❌ perdido se offline

Delivery Garantida (Kafka / JetStream):
  Producer → Kafka → [Persistido no disco]
                        → Consumer (agora ou depois)
                        → Consumer reconecta e retoma
\`\`\`

> **Dica:** Os casos de uso abaixo indicam qual padrão usam. Na dúvida, comece com **delivery garantida** — é mais seguro. Use fire-and-forget apenas quando a perda de mensagens é aceitável e a latência mínima é prioridade.`,
    },
    {
      id: "ecommerce",
      title: "E-commerce: Notificações de Pedido em Tempo Real",
      body: `**Padrão:** Delivery Garantida (Kafka)

**Problema:** Uma plataforma de e-commerce precisa notificar múltiplos sistemas quando um pedido é criado — dashboard de operações, app do entregador, sistema de estoque e notificação push para o cliente.

**Provedor:** Apache Kafka — alta throughput, persistência para replay, consumer groups para escalar consumidores independentes.

**Protocolos usados:**
- **SSE** — dashboard de operações atualiza em tempo real
- **Webhook** — notificação push para sistema de estoque e entregador
- **REST Produce** — checkout service produz eventos de pedido

**Configuração da Event API:**

| Campo | Valor |
|-------|-------|
| Nome | Pedidos |
| Slug | \`orders\` |
| Tópico | \`prod.events.orders.v2\` |
| Conexão | Kafka Production (SASL_SSL) |
| Protocolos | REST Produce, SSE, Webhook |

**Checkout service produzindo evento:**

\`\`\`javascript
// Ao finalizar um pedido
await fetch("https://api.example.com/events/orders/produce", {
  method: "POST",
  headers: {
    "Authorization": "Bearer <api-key>",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    key: orderId,
    value: JSON.stringify({
      event: "order.created",
      data: { orderId, items, total, customerId }
    }),
    headers: { source: "checkout-service", version: "v2" }
  })
});
\`\`\`

**Dashboard de operações consumindo via SSE:**

\`\`\`javascript
const evtSource = new EventSource(
  "https://api.example.com/events/orders/stream?group=ops-dashboard&offset=latest",
  { headers: { "Authorization": "Bearer <token>" } }
);

evtSource.onmessage = (event) => {
  const order = JSON.parse(JSON.parse(event.data).value);
  updateDashboard(order);
};
\`\`\`

**Webhook para sistema de estoque:**

Configurado no dashboard, entrega automaticamente cada evento para \`https://estoque.internal/webhook/orders\` com HMAC e retry.`,
    },
    {
      id: "iot",
      title: "IoT: Telemetria de Dispositivos",
      body: `**Padrão:** Delivery Garantida (NATS JetStream)

**Problema:** Milhares de sensores IoT enviam dados de temperatura, umidade e pressão a cada 5 segundos. O sistema precisa armazenar para análise histórica e exibir em dashboards de monitoramento ao vivo.

**Provedor:** NATS JetStream — baixa latência, persistência, auto-criação de streams, ideal para edge-to-cloud.

**Protocolos usados:**
- **REST Produce** — sensores enviam dados via HTTP (simples de implementar em dispositivos)
- **SSE** — dashboards de monitoramento em tempo real
- **REST Consume** — jobs de análise buscam batches periódicos

**Configuração da Event API:**

| Campo | Valor |
|-------|-------|
| Nome | Sensores |
| Slug | \`sensors\` |
| Subject | \`iot.sensors.telemetry\` |
| Conexão | NATS Production (JetStream, TLS) |
| Protocolos | REST Produce, SSE, REST Consume |

**Sensor enviando dados (Python/MicroPython):**

\`\`\`python
import requests, json, time

API = "https://api.example.com/events/sensors/produce"
HEADERS = {"Authorization": "Bearer <device-key>", "Content-Type": "application/json"}

while True:
    payload = {
        "key": f"sensor-{DEVICE_ID}",
        "value": json.dumps({
            "device_id": DEVICE_ID,
            "temperature": read_temp(),
            "humidity": read_humidity(),
            "timestamp": time.time()
        })
    }
    requests.post(API, json=payload, headers=HEADERS)
    time.sleep(5)
\`\`\`

**Dashboard de monitoramento (SSE):**

\`\`\`javascript
const evtSource = new EventSource(
  "https://api.example.com/events/sensors/stream?group=monitor&offset=latest"
);

evtSource.onmessage = (e) => {
  const data = JSON.parse(JSON.parse(e.data).value);
  updateGauge(data.device_id, data.temperature, data.humidity);
};
\`\`\`

> **Por que NATS?** Sensores IoT geram altíssimo volume de mensagens pequenas. NATS JetStream oferece performance superior ao Kafka para este perfil de carga, com deploy mais simples (binário único) e suporte nativo a edge computing.`,
    },
    {
      id: "fintech",
      title: "Fintech: Eventos de Transação",
      body: `**Padrão:** Delivery Garantida (Kafka SASL_SSL)

**Problema:** Um sistema financeiro processa transações e precisa: (1) registrar cada transação para auditoria, (2) detectar fraudes em tempo real, (3) reconciliar batches com o sistema legado.

**Provedor:** Apache Kafka (SASL_SSL) — compliance PCI-DSS com auditoria via offsets, criptografia e autenticação obrigatórias.

**Protocolos usados:**
- **REST Produce** — serviço de pagamentos registra transações
- **Webhook** — alerta de fraude em tempo real para o SOC
- **REST Consume** — job de reconciliação roda a cada hora

**Configuração da Event API:**

| Campo | Valor |
|-------|-------|
| Nome | Transações |
| Slug | \`transactions\` |
| Tópico | \`prod.fin.transactions.v1\` |
| Conexão | Kafka Financeiro (SASL_SSL, SCRAM-SHA-512) |
| Protocolos | REST Produce, REST Consume, Webhook |
| Auto Offset | earliest (para reconciliação completa) |

**Plugins APISIX (segurança reforçada):**

\`\`\`json
{
  "jwt-auth": {},
  "limit-count": { "count": 5000, "time_window": 60 },
  "ip-restriction": { "whitelist": ["10.0.0.0/8"] }
}
\`\`\`

**Job de reconciliação (batch consume):**

\`\`\`python
import requests

resp = requests.post(
    "https://api.example.com/events/transactions/consume",
    json={"group_id": "reconciliation-job", "timeout_ms": 10000},
    headers={"Authorization": "Bearer <service-key>"}
)

for msg in resp.json()["data"]:
    tx = json.loads(msg["value"])
    reconcile_with_legacy(tx)
\`\`\`

> **Por que Kafka?** Retenção configurável (90 dias para PCI), offsets para auditoria precisa, SASL_SSL para compliance.`,
    },
    {
      id: "saas",
      title: "SaaS: Integrações Event-Driven",
      body: `**Padrão:** Fire-and-Forget (NATS Core)

**Problema:** Uma plataforma SaaS multi-tenant precisa enviar eventos para integrações de clientes (Zapier, webhooks customizados) quando ações ocorrem — novo lead, ticket fechado, pagamento recebido.

**Provedor:** NATS Core — ultra-leve, zero configuração de storage, perfeito para eventos efêmeros where fire-and-forget é aceitável.

**Protocolos usados:**
- **REST Produce** — serviços internos publicam eventos de domínio
- **Webhook** — entrega para integrações externas dos clientes
- **WebSocket** — UI em tempo real para notificações in-app

**Configuração da Event API:**

| Campo | Valor |
|-------|-------|
| Nome | Platform Events |
| Slug | \`platform-events\` |
| Subject | \`platform.events\` |
| Conexão | NATS Internal (sem JetStream) |
| Protocolos | REST Produce, Webhook, WebSocket |

**Backend publicando evento de domínio:**

\`\`\`go
payload := map[string]interface{}{
    "key":   tenantID,
    "value": map[string]interface{}{
        "event": "lead.created",
        "tenant_id": tenantID,
        "data": leadData,
    },
}
resp, _ := http.Post(
    "http://event-gateway:8090/topics/platform-events/produce",
    "application/json",
    toJSON(payload),
)
\`\`\`

**Notificações in-app via WebSocket:**

\`\`\`javascript
// Cada usuário conecta com seu tenant como group
const ws = new WebSocket(
  \`wss://api.example.com/events/platform-events/ws?group=tenant-\${tenantId}\`
);

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === "message") {
    showNotification(msg.value.event, msg.value.data);
  }
};
\`\`\`

> **Por que NATS Core?** Eventos de plataforma são efêmeros — se o webhook falha, o retry do engine cuida. Não precisa de persistência no broker.`,
    },
    {
      id: "logistica",
      title: "Logística: Rastreamento de Entregas",
      body: `**Padrão:** Delivery Garantida (Kafka)

**Problema:** Uma empresa de logística rastreia entregas em tempo real com atualizações de GPS dos motoristas. Clientes precisam ver o status no app, e o sistema interno precisa otimizar rotas.

**Provedor:** Apache Kafka — volume alto de updates GPS, persistência para histórico de rotas, particionamento por ID do motorista.

**Protocolos usados:**
- **REST Produce** — app do motorista envia posição GPS
- **SSE** — mapa ao vivo no app do cliente
- **Webhook** — notificação de "entrega chegou" para o cliente

**Configuração da Event API:**

| Campo | Valor |
|-------|-------|
| Nome | Tracking |
| Slug | \`tracking\` |
| Tópico | \`logistics.delivery.tracking\` |
| Protocolos | REST Produce, SSE, Webhook |

**App do motorista enviando GPS:**

\`\`\`kotlin
val payload = mapOf(
    "key" to driverId,
    "value" to gson.toJson(mapOf(
        "event" to "location.updated",
        "lat" to location.latitude,
        "lng" to location.longitude,
        "delivery_id" to currentDeliveryId
    ))
)
api.post("/events/tracking/produce", payload)
\`\`\`

**Mapa ao vivo no app do cliente (SSE):**

\`\`\`javascript
// Filtrado pelo delivery_id no frontend
const source = new EventSource(
  "https://api.example.com/events/tracking/stream?group=customer-app&offset=latest"
);

source.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  const loc = JSON.parse(msg.value);
  if (loc.delivery_id === myDeliveryId) {
    updateMap(loc.lat, loc.lng);
  }
};
\`\`\``,
    },
    {
      id: "healthcare",
      title: "Healthcare: Alertas de Monitoramento de Pacientes",
      body: `**Padrão:** Delivery Garantida (NATS JetStream)

**Problema:** Hospital monitora sinais vitais de pacientes em UTI. Leituras de SpO2, frequência cardíaca e pressão chegam a cada segundo. Alertas críticos precisam chegar à equipe médica em menos de 3 segundos.

**Provedor:** NATS JetStream — baixa latência + persistência para auditoria médica + replay para análise pós-incidente.

**Protocolos usados:**
- **REST Produce** — monitores de beira-leito enviam vitals
- **Webhook** — alertas críticos para sistema de paging/SMS
- **SSE** — painel de monitoramento da central de enfermagem

**Configuração — duas Event APIs:**

**1. Vitals (alta frequência):**

| Campo | Valor |
|-------|-------|
| Slug | \`vitals\` |
| Subject | \`hospital.vitals\` |
| Protocolos | REST Produce, SSE |

**2. Alertas (baixa frequência, alta prioridade):**

| Campo | Valor |
|-------|-------|
| Slug | \`alerts\` |
| Subject | \`hospital.alerts\` |
| Protocolos | REST Produce, Webhook, SSE |

**Monitor de beira-leito (publicando):**

\`\`\`python
# Leitura contínua de vitals
vitals = read_patient_vitals(patient_id)
requests.post(f"{API}/events/vitals/produce", json={
    "key": patient_id,
    "value": json.dumps(vitals)
})

# Se SpO2 abaixo do limiar → alerta crítico
if vitals["spo2"] < 90:
    requests.post(f"{API}/events/alerts/produce", json={
        "key": patient_id,
        "value": json.dumps({
            "level": "critical",
            "type": "low_spo2",
            "value": vitals["spo2"],
            "patient_id": patient_id,
            "room": room_number
        })
    })
\`\`\`

**Webhook para alerta crítico:**

Configurado para entregar em \`https://paging.hospital.internal/alert\` — dispara SMS para a equipe médica em <3 segundos.

> **Por que NATS JetStream?** Latência sub-milissegundo para alertas críticos, persistência para auditoria médica (compliance HIPAA), replay para análise pós-incidente.`,
    },
    {
      id: "laboratorio",
      title: "Laboratório de Exames: Pipeline de Resultados",
      body: `**Padrão:** Delivery Garantida (Kafka SASL_SSL)

**Problema:** Um laboratório de análises clínicas processa milhares de exames por dia. Os equipamentos analíticos (analisadores bioquímicos, hematológicos, imunoquímicos) geram resultados que precisam: (1) alimentar o LIS (Laboratory Information System), (2) notificar o médico quando um resultado crítico é detectado, (3) disponibilizar o laudo para o paciente no portal, (4) enviar para o convênio/operadora via integração HL7/FHIR.

**Provedor:** Apache Kafka (SASL_SSL) — rastreabilidade completa via offsets (exigência da ANVISA/RDC 302), retenção para auditoria laboratorial, particionamento por unidade/filial.

**Protocolos usados:**
- **REST Produce** — middleware de interfaceamento (LIS ↔ analisador) publica resultado
- **Webhook** — notificação de valor crítico para plantão médico
- **SSE** — painel de acompanhamento de produção do laboratório
- **REST Consume** — integração batch com operadoras de saúde (HL7/FHIR)

**Configuração — três Event APIs:**

**1. Resultados (fluxo principal):**

| Campo | Valor |
|-------|-------|
| Nome | Resultados |
| Slug | \`lab-results\` |
| Tópico | \`lab.results.v1\` |
| Conexão | Kafka Produção (SASL_SSL) |
| Protocolos | REST Produce, SSE, REST Consume |
| Auto Offset | earliest (para reprocessamento) |

**2. Alertas Críticos (valores de pânico):**

| Campo | Valor |
|-------|-------|
| Nome | Alertas Críticos |
| Slug | \`lab-critical\` |
| Tópico | \`lab.critical-alerts.v1\` |
| Protocolos | REST Produce, Webhook, SSE |

**3. Laudos Liberados (para portal do paciente):**

| Campo | Valor |
|-------|-------|
| Nome | Laudos |
| Slug | \`lab-reports\` |
| Tópico | \`lab.reports.released.v1\` |
| Protocolos | REST Produce, Webhook |

**Middleware de interfaceamento publicando resultado:**

\`\`\`python
import requests, json
from datetime import datetime

API = "https://api.lab.com/events"
HEADERS = {"Authorization": "Bearer <lis-key>", "Content-Type": "application/json"}

def on_result_from_analyzer(result):
    # 1. Publica resultado no fluxo principal
    requests.post(f"{API}/lab-results/produce", json={
        "key": result["accession_number"],
        "value": json.dumps({
            "event": "result.received",
            "accession_number": result["accession_number"],
            "patient_id": result["patient_id"],
            "exam_code": result["exam_code"],
            "exam_name": result["exam_name"],
            "result_value": result["value"],
            "unit": result["unit"],
            "reference_range": result["reference_range"],
            "analyzer_id": result["analyzer_id"],
            "branch_id": result["branch_id"],
            "timestamp": datetime.utcnow().isoformat()
        }),
        "headers": {"source": f"analyzer-{result['analyzer_id']}"}
    }, headers=HEADERS)

    # 2. Se valor crítico → alerta de pânico
    if is_panic_value(result):
        requests.post(f"{API}/lab-critical/produce", json={
            "key": result["accession_number"],
            "value": json.dumps({
                "level": "panic",
                "exam": result["exam_name"],
                "value": result["value"],
                "reference": result["reference_range"],
                "patient_id": result["patient_id"],
                "patient_name": result["patient_name"],
                "requesting_doctor": result["doctor_crm"],
                "branch": result["branch_id"]
            })
        }, headers=HEADERS)
\`\`\`

**Webhook para alerta de valor crítico (pânico):**

Configurado para entregar em \`https://lis.internal/api/panic-alert\` — dispara:
- Notificação push para o médico solicitante
- SMS para o bioquímico responsável
- Registro obrigatório no livro de ocorrências (RDC 302)

**Painel de produção do laboratório (SSE):**

\`\`\`javascript
const source = new EventSource(
  "https://api.lab.com/events/lab-results/stream?group=production-dashboard&offset=latest"
);

source.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  const result = JSON.parse(msg.value);
  updateProductionBoard({
    accession: result.accession_number,
    exam: result.exam_name,
    status: result.event, // result.received, result.validated, result.released
    analyzer: result.analyzer_id,
    branch: result.branch_id
  });
};
\`\`\`

**Integração com operadoras (batch HL7/FHIR):**

\`\`\`python
# Job roda a cada 30 min — consome laudos liberados e envia para operadoras
resp = requests.post(
    "https://api.lab.com/events/lab-reports/consume",
    json={"group_id": "fhir-integration", "timeout_ms": 10000},
    headers={"Authorization": "Bearer <integration-key>"}
)

for msg in resp.json()["data"]:
    report = json.loads(msg["value"])
    fhir_bundle = convert_to_fhir_diagnostic_report(report)
    send_to_operator(report["operator_code"], fhir_bundle)
\`\`\`

**Plugins APISIX (compliance laboratorial):**

\`\`\`json
{
  "jwt-auth": {},
  "limit-count": { "count": 10000, "time_window": 60 },
  "ip-restriction": { "whitelist": ["10.0.0.0/8", "172.16.0.0/12"] }
}
\`\`\`

> **Por que Kafka?** Laboratórios de exames exigem rastreabilidade total (ANVISA RDC 302). Kafka oferece retenção configurável (ex: 5 anos para exames), offsets para auditoria precisa de cada resultado, e particionamento por filial para laboratórios com múltiplas unidades. A persistência garante que nenhum resultado seja perdido mesmo em falhas de sistema.`,
    },
    {
      id: "laboratorio-nats",
      title: "Laboratório de Exames: Coleta e Status em Tempo Real",
      body: `**Padrão:** Delivery Garantida (NATS JetStream)

**Problema:** Um laboratório precisa rastrear o status das coletas em tempo real — desde a chegada do paciente na recepção, passagem pela sala de coleta, até o material chegar ao setor técnico. Enfermeiros, recepcionistas e setor técnico precisam ver atualizações instantâneas.

**Provedor:** NATS JetStream — baixa latência para atualizações de status em tempo real, persistência para garantir que nenhum evento de rastreio seja perdido.

**Protocolos usados:**
- **REST Produce** — terminais de coleta e recepção publicam mudanças de status
- **WebSocket** — painéis de TV na recepção e sala de coleta mostram fila em tempo real
- **SSE** — dashboard administrativo do laboratório

**Configuração da Event API:**

| Campo | Valor |
|-------|-------|
| Nome | Status Coleta |
| Slug | \`collection-status\` |
| Subject | \`lab.collection.status\` |
| Conexão | NATS Internal (JetStream, TLS) |
| Protocolos | REST Produce, WebSocket, SSE |

**Terminal de coleta publicando status:**

\`\`\`javascript
// Cada etapa do fluxo publica um evento
async function updateCollectionStatus(accession, status, details) {
  await fetch("https://api.lab.com/events/collection-status/produce", {
    method: "POST",
    headers: {
      "Authorization": "Bearer <terminal-key>",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      key: accession,
      value: JSON.stringify({
        event: \`collection.\${status}\`,
        accession_number: accession,
        status, // "checked_in", "called", "collecting", "collected", "received_by_lab"
        patient_name: details.patientName,
        priority: details.priority, // "normal", "urgent", "emergency"
        collector: details.collectorName,
        timestamp: new Date().toISOString()
      })
    })
  });
}

// Exemplos de uso
updateCollectionStatus("2024-001234", "checked_in", { patientName: "João Silva", priority: "normal" });
updateCollectionStatus("2024-001234", "called", { patientName: "João Silva", priority: "normal" });
updateCollectionStatus("2024-001234", "collecting", { patientName: "João Silva", collector: "Enf. Maria" });
updateCollectionStatus("2024-001234", "collected", { patientName: "João Silva", collector: "Enf. Maria" });
\`\`\`

**Painel de TV na recepção (WebSocket):**

\`\`\`javascript
const ws = new WebSocket(
  "wss://api.lab.com/events/collection-status/ws?group=reception-tv"
);

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === "message") {
    const evt = JSON.parse(msg.value);
    switch (evt.status) {
      case "checked_in":
        addToWaitingList(evt);
        break;
      case "called":
        moveToCalledList(evt);
        playCallSound(evt.patient_name);
        break;
      case "collecting":
        moveToInProgressList(evt);
        break;
      case "collected":
        removeFromBoard(evt.accession_number);
        break;
    }
  }
};
\`\`\`

> **Por que NATS JetStream?** Atualizações de status de coleta são eventos de alta frequência e baixa latência — o paciente precisa ver seu nome no painel instantaneamente. NATS JetStream oferece latência sub-milissegundo com persistência para garantir que nenhum status seja perdido em caso de queda do painel.`,
    },
    {
      id: "fintech-audit",
      title: "Fintech: Auditoria e Logs Fire-and-Forget com Kafka",
      body: `**Padrão:** Fire-and-Forget na Aplicação + Persistência no Broker (Kafka)

**Problema:** Uma fintech processa pagamentos PIX e TED em alta velocidade. Cada transação precisa gerar um registro de auditoria (compliance BACEN, LGPD) e logs operacionais para análise, mas a API de pagamento **não pode esperar** o sistema de auditoria confirmar o recebimento — o tempo de resposta ao cliente é crítico (< 100ms).

**Insight:** Fire-and-forget **não significa** que a mensagem pode se perder. Significa que o **produtor não espera pelo consumidor**. Usando Kafka como broker, a mensagem é persistida no tópico imediatamente — mesmo que o serviço de auditoria esteja offline, os eventos ficam retidos e serão processados quando ele voltar.

\`\`\`
Fluxo:
  API Pagamento → [POST fire-and-forget] → Kafka (persiste no disco)
       ↓                                        ↓
  Responde ao cliente                    Consumer de auditoria
  em < 100ms                             processa quando disponível
                                          (mesmo horas depois)
\`\`\`

**Provedor:** Apache Kafka (SASL_SSL) — o produtor "dispara e esquece" do ponto de vista da aplicação, mas o Kafka garante que a mensagem está persistida com retenção de 7 anos (exigência regulatória).

**Protocolos usados:**
- **REST Produce** — API de pagamento publica evento de auditoria (fire-and-forget)
- **REST Consume** — serviço de compliance consome batch para relatórios regulatórios
- **Webhook** — alerta em tempo real para operações suspeitas (SOC)

**Configuração — duas Event APIs:**

**1. Audit Trail (todos os eventos):**

| Campo | Valor |
|-------|-------|
| Nome | Audit Trail |
| Slug | \`audit-trail\` |
| Tópico | \`fin.audit.events.v1\` |
| Conexão | Kafka Financeiro (SASL_SSL, SCRAM-SHA-512) |
| Protocolos | REST Produce, REST Consume |
| Retenção | 2555 dias (7 anos — compliance BACEN) |
| Auto Offset | earliest |

**2. Operações Suspeitas (alertas):**

| Campo | Valor |
|-------|-------|
| Nome | Suspicious Ops |
| Slug | \`suspicious-ops\` |
| Tópico | \`fin.audit.suspicious.v1\` |
| Protocolos | REST Produce, Webhook, SSE |

**API de pagamento — fire-and-forget com Kafka:**

\`\`\`go
func (s *PaymentService) ProcessPIX(ctx context.Context, tx Transaction) (*PaymentResult, error) {
    // 1. Processa o pagamento (lógica crítica)
    result, err := s.ledger.Execute(ctx, tx)
    if err != nil {
        return nil, err
    }

    // 2. Fire-and-forget: publica auditoria via Event Gateway
    // Kafka persiste a mensagem — não precisa esperar o consumer
    go func() {
        payload, _ := json.Marshal(map[string]interface{}{
            "key": tx.ID,
            "value": map[string]interface{}{
                "event":          "transaction.completed",
                "transaction_id": tx.ID,
                "type":           tx.Type, // "pix", "ted", "boleto"
                "amount":         tx.Amount,
                "payer":          tx.PayerDocument,
                "payee":          tx.PayeeDocument,
                "status":         result.Status,
                "ip":             tx.OriginIP,
                "device_id":      tx.DeviceFingerprint,
                "timestamp":      time.Now().UTC().Format(time.RFC3339),
            },
            "headers": map[string]string{
                "source":      "payment-service",
                "trace_id":    ctx.Value("trace_id").(string),
                "idempotency": tx.IdempotencyKey,
            },
        })

        req, _ := http.NewRequest("POST",
            "http://event-gateway:8090/topics/audit-trail/produce",
            bytes.NewReader(payload))
        req.Header.Set("Content-Type", "application/json")
        req.Header.Set("Authorization", "Bearer "+s.auditAPIKey)

        resp, err := s.httpClient.Do(req)
        if err != nil {
            s.logger.Warn("audit event failed (will retry)", zap.Error(err))
            s.retryQueue.Push(payload) // fallback local para retry
            return
        }
        resp.Body.Close()
    }()

    // 3. Se transação suspeita → alerta separado
    if s.fraudDetector.IsSuspicious(tx) {
        go func() {
            http.Post(
                "http://event-gateway:8090/topics/suspicious-ops/produce",
                "application/json",
                toJSON(map[string]interface{}{
                    "key": tx.ID,
                    "value": map[string]interface{}{
                        "alert":     "suspicious_transaction",
                        "tx_id":     tx.ID,
                        "risk_score": s.fraudDetector.Score(tx),
                        "reason":    s.fraudDetector.Reason(tx),
                        "amount":    tx.Amount,
                    },
                }),
            )
        }()
    }

    // Retorna ao cliente imediatamente — auditoria é assíncrona
    return result, nil
}
\`\`\`

**Serviço de compliance — consume batch para relatórios:**

\`\`\`python
# Job roda a cada hora — gera relatórios regulatórios para BACEN
resp = requests.post(
    "https://api.fintech.com/events/audit-trail/consume",
    json={"group_id": "compliance-reports", "timeout_ms": 30000},
    headers={"Authorization": "Bearer <compliance-key>"}
)

for msg in resp.json()["data"]:
    event = json.loads(msg["value"])

    # Persiste no data lake para relatórios
    compliance_db.insert_audit_event(event)

    # Gera relatório BACEN se necessário
    if event["type"] == "pix" and event["amount"] > 50000:
        bacen_reporter.flag_large_transaction(event)
\`\`\`

**Webhook para operações suspeitas:**

Configurado para entregar em \`https://soc.internal/api/alert\` — dispara:
- Alerta no canal Slack do SOC (Security Operations Center)
- Bloqueio temporário da conta se risk_score > 0.9
- Registro no sistema antifraude para análise manual

**Por que Kafka e não NATS Core?**

| Critério | NATS Core (fire-and-forget puro) | Kafka (fire-and-forget + persistência) |
|----------|----------------------------------|----------------------------------------|
| Produtor bloqueia? | Não | Não (goroutine async) |
| Mensagem persiste? | **Não** — perdida se ninguém consome | **Sim** — retida por 7 anos |
| Consumer offline? | **Mensagem perdida** | **Mensagem esperando** no tópico |
| Auditoria completa? | ❌ Não garantida | ✅ 100% dos eventos retidos |
| Compliance BACEN? | ❌ Inaceitável | ✅ Rastreabilidade total |
| Latência do produtor | Sub-ms | Sub-ms (async via goroutine) |

> **Regra para fintechs:** Use Kafka quando o produtor pode ser fire-and-forget mas a **mensagem não pode se perder**. A persistência do Kafka garante que auditoria e logs estão sempre completos — essencial para compliance regulatório (BACEN, CVM, LGPD). O consumidor processa no seu próprio ritmo, sem impactar a latência da API de pagamento.`,
    },
    {
      id: "fire-and-forget-cache",
      title: "Fire-and-Forget: Cache Invalidation e Métricas",
      body: `**Padrão:** Fire-and-Forget (NATS Core)

**Problema:** Um sistema distribuído com múltiplos microsserviços precisa: (1) invalidar cache em todas as instâncias quando um dado muda, (2) coletar métricas de uso em tempo real para dashboards, (3) broadcast de configurações atualizadas. Nenhum desses cenários requer persistência — se um serviço estiver offline, ele simplesmente buscará o dado fresh na próxima request.

**Provedor:** NATS Core (sem JetStream) — latência mínima, zero overhead de storage, publish-subscribe puro.

**Por que Fire-and-Forget aqui?**

Estes cenários são inherently idempotentes e self-healing:
- **Cache invalidation** — se a mensagem se perde, o cache expira pelo TTL e o dado fresh é buscado
- **Métricas** — perder 1 datapoint entre milhares não afeta a acurácia do dashboard
- **Config broadcast** — cada serviço faz polling periódico como fallback

**Configuração — três Event APIs:**

**1. Cache Invalidation:**

| Campo | Valor |
|-------|-------|
| Slug | \`cache-invalidate\` |
| Subject | \`system.cache.invalidate\` |
| Conexão | NATS Internal (sem JetStream) |
| Protocolos | REST Produce, WebSocket |

**2. Métricas de Uso:**

| Campo | Valor |
|-------|-------|
| Slug | \`usage-metrics\` |
| Subject | \`system.metrics.usage\` |
| Conexão | NATS Internal (sem JetStream) |
| Protocolos | REST Produce, SSE |

**3. Config Broadcast:**

| Campo | Valor |
|-------|-------|
| Slug | \`config-update\` |
| Subject | \`system.config.updated\` |
| Conexão | NATS Internal (sem JetStream) |
| Protocolos | REST Produce, WebSocket |

**Cache invalidation — fire-and-forget:**

\`\`\`go
// Após atualizar um produto no banco
func (s *ProductService) Update(ctx context.Context, product Product) error {
    if err := s.repo.Save(ctx, product); err != nil {
        return err
    }

    // Fire-and-forget: invalida cache em todas as instâncias
    // Se falhar, não tem problema — TTL cuida
    go func() {
        http.Post(
            "http://event-gateway:8090/topics/cache-invalidate/produce",
            "application/json",
            toJSON(map[string]interface{}{
                "key": fmt.Sprintf("product:%s", product.ID),
                "value": map[string]interface{}{
                    "action": "invalidate",
                    "entity": "product",
                    "id":     product.ID,
                },
            }),
        )
        // Ignora erro propositalmente — é fire-and-forget
    }()

    return nil
}
\`\`\`

**Instâncias consumindo invalidação (WebSocket):**

\`\`\`javascript
// Cada instância do serviço conecta via WebSocket
const ws = new WebSocket("ws://event-gateway:8090/topics/cache-invalidate/ws");

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === "message") {
    const { entity, id } = msg.value;
    cache.delete(\`\${entity}:\${id}\`);
    console.log(\`Cache invalidated: \${entity}:\${id}\`);
  }
};
\`\`\`

**Métricas de uso — fire-and-forget:**

\`\`\`python
# Middleware que registra cada request — fire-and-forget
import threading

def metrics_middleware(request, response):
    # Não bloqueia o request — dispara em background
    threading.Thread(target=lambda: requests.post(
        "http://event-gateway:8090/topics/usage-metrics/produce",
        json={
            "key": request.path,
            "value": json.dumps({
                "path": request.path,
                "method": request.method,
                "status": response.status_code,
                "latency_ms": response.elapsed_ms,
                "user_id": request.user_id,
                "timestamp": time.time()
            })
        },
        timeout=1  # Timeout curto — se não responder, segue
    )).start()
    return response
\`\`\`

**Dashboard de métricas (SSE):**

\`\`\`javascript
const source = new EventSource(
  "http://event-gateway:8090/topics/usage-metrics/stream?group=metrics-dashboard"
);

source.onmessage = (e) => {
  const metric = JSON.parse(JSON.parse(e.data).value);
  updateRealTimeChart(metric.path, metric.latency_ms);
  incrementRequestCounter(metric.method, metric.status);
};
\`\`\`

> **Por que NATS Core?** Sem overhead de disco — cache invalidation e métricas são efêmeros por natureza. NATS Core processa milhões de mensagens por segundo com latência sub-milissegundo. Se um consumidor estiver offline, não há problema: o cache expira por TTL e as métricas perdidas são estatisticamente irrelevantes.

> **Regra prática:** Se você pode responder "sim" para "tudo bem se essa mensagem se perder?", use fire-and-forget com NATS Core. Se a resposta é "não", use Kafka ou NATS JetStream.`,
    },
  ],
}
