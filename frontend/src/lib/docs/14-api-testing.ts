import type { DocCategory } from "./types"

export const apiTestingCategory: DocCategory = {
  slug: "api-testing",
  title: "API Testing & Quality",
  description:
    "Teste automatizado de APIs, monitoramento sintético, SLAs e error budgets para garantir qualidade contínua.",
  icon: "FlaskConical",
  articles: [
    // ── 1. Visao Geral ──────────────────────────────────────────────────
    {
      slug: "visao-geral-testing",
      title: "Visão Geral do API Testing",
      description:
        "Entenda as funcionalidades de teste automatizado, monitoramento sintético e gestão de SLAs.",
      icon: "FlaskConical",
      tags: ["testing", "qualidade", "overview", "sla", "monitoramento"],
      content: [
        {
          id: "o-que-e",
          title: "O que é o API Testing",
          body: `O módulo de API Testing & Quality fornece ferramentas integradas para testar, monitorar e garantir a qualidade das suas APIs. Em vez de depender de ferramentas externas, você pode criar, executar e acompanhar testes diretamente no painel do API Gateway.

O módulo inclui três pilares:

- **Test Suites** — coleções de steps HTTP com assertions para validar comportamento de APIs
- **Synthetic Monitoring** — execução automática e periódica de test suites para monitorar disponibilidade
- **SLA Management** — definição e acompanhamento de objetivos de nível de serviço (availability, latência, error rate)

> **Nota:** Os testes são executados pelo backend do API Gateway, não pelo browser. Isso significa que eles podem acessar APIs internas e testar cenários de rede que o browser não alcançaria.`,
        },
        {
          id: "arquitetura",
          title: "Arquitetura",
          body: `O fluxo de execução de testes funciona assim:

1. **Definição** — você cria uma Test Suite com steps (requisições HTTP) e assertions (validações)
2. **Execução** — o backend executa cada step sequencialmente, avaliando assertions e extraindo variáveis
3. **Resultado** — um Test Run é criado com o status de cada step (passed/failed/error/skipped)
4. **Monitoramento** — Synthetic Monitors executam suites periodicamente e atualizam métricas de uptime
5. **SLA** — O SLA Evaluator compara métricas reais com os objetivos definidos e calcula o error budget

Cada componente funciona de forma independente:
- Você pode usar Test Suites sem monitors (testes manuais)
- Você pode ter SLAs sem monitors (baseados em métricas do Prometheus)
- Ou combinar tudo para um pipeline completo de qualidade`,
        },
      ],
    },
    // ── 2. Test Suites ──────────────────────────────────────────────────
    {
      slug: "test-suites",
      title: "Test Suites",
      description:
        "Crie coleções de steps HTTP com assertions para validar o comportamento das suas APIs.",
      icon: "ListChecks",
      tags: ["testing", "suite", "steps", "assertions", "http"],
      content: [
        {
          id: "conceitos",
          title: "Conceitos",
          body: `Uma **Test Suite** é uma coleção ordenada de **Steps**. Cada step representa uma requisição HTTP com validações:

**Step** — uma requisição HTTP:
- Method (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)
- URL (absoluta ou relativa ao gateway)
- Headers (opcionais)
- Body (para POST/PUT/PATCH)
- Delay (espera antes de executar, em ms)

**Assertion** — uma validação sobre a resposta:
- **status_code** — verifica o código HTTP (ex: eq 200)
- **header** — verifica um header da resposta (ex: Content-Type contains json)
- **body_json** — verifica um campo JSON via JSONPath (ex: $.data.id eq "123")
- **body_contains** — verifica se o body contém uma string
- **response_time** — verifica o tempo de resposta (ex: lt 500ms)

**Variáveis** — você pode extrair valores de respostas e usá-los em steps seguintes:
- Extract vars: mapeamento de JSONPath para nome de variável
- Uso: \`{{variavel}}\` na URL, headers ou body dos steps seguintes`,
        },
        {
          id: "criando-suite",
          title: "Criando uma Test Suite",
          body: `**1. Acesse Testing > Suites**

Clique em "Nova Suite" para criar uma nova suite de teste.

**2. Defina os steps**

Use o editor visual de steps para adicionar requisições:

\`\`\`
Step 1: POST /api/v1/users
  Body: {"name": "Test User", "email": "test@example.com"}
  Assertions:
    - status_code eq 201
    - body_json $.data.id neq ""
  Extract: $.data.id -> user_id

Step 2: GET /api/v1/users/{{user_id}}
  Assertions:
    - status_code eq 200
    - body_json $.data.name eq "Test User"
    - response_time lt 500

Step 3: DELETE /api/v1/users/{{user_id}}
  Assertions:
    - status_code eq 200
\`\`\`

**3. Execute**

Clique em "Executar" para rodar a suite. O resultado mostra o status de cada step com detalhes das assertions.

> **Dica:** Use tags para organizar suites por API, ambiente ou tipo de teste (smoke, regression, etc.).`,
        },
        {
          id: "assertions",
          title: "Tipos de Assertion",
          body: `| Tipo | Target | Operadores | Exemplo |
|------|--------|------------|---------|
| status_code | (nenhum) | eq, neq, gt, lt, gte, lte | status_code eq 200 |
| header | Nome do header | eq, neq, contains, matches | header Content-Type contains json |
| body_json | JSONPath | eq, neq, gt, lt, contains | body_json $.data.count gt 0 |
| body_contains | (nenhum) | contains | body_contains "success" |
| response_time | (nenhum) | lt, lte, gt, gte | response_time lt 500 |

**Operadores:**
- \`eq\` — igual
- \`neq\` — diferente
- \`gt\` / \`lt\` — maior / menor (numérico)
- \`gte\` / \`lte\` — maior ou igual / menor ou igual
- \`contains\` — contém substring
- \`matches\` — corresponde a regex`,
        },
      ],
    },
    // ── 3. Synthetic Monitoring ─────────────────────────────────────────
    {
      slug: "synthetic-monitoring",
      title: "Monitoramento Sintético",
      description:
        "Execute test suites periodicamente para monitorar disponibilidade e performance em tempo real.",
      icon: "HeartPulse",
      tags: ["testing", "synthetic", "monitoramento", "uptime", "disponibilidade"],
      content: [
        {
          id: "conceitos",
          title: "O que é Monitoramento Sintético",
          body: `O monitoramento sintético executa test suites automaticamente em intervalos regulares, simulando requisições reais de usuários. Diferente de monitoramento passivo (que analisa tráfego real), o sintético:

- **Detecta problemas antes dos usuários** — mesmo sem tráfego, o monitor continua testando
- **Mede disponibilidade real** — baseado em testes end-to-end, não apenas ping
- **Calcula uptime** — percentual de execuções com sucesso ao longo do tempo
- **Alerta rapidamente** — detecta falhas consecutivas e notifica

Cada monitor está associado a uma Test Suite e executa todos os steps periodicamente.`,
        },
        {
          id: "configuracao",
          title: "Configuração",
          body: `**Suite** — a test suite a ser executada (obrigatório)

**Intervalo** — frequência de execução em segundos:
- 60s (1 min) — para APIs críticas
- 300s (5 min) — padrão recomendado
- 900s (15 min) — para APIs de baixa prioridade

**Status do monitor:**
- **Up** — ultima execucao passou
- **Down** — ultima execucao falhou
- **Degraded** — passando mas com falhas intermitentes (consecutive_fail > 0 e < threshold)
- **Unknown** — nunca executou

**Metricas calculadas:**
- **Uptime %** — porcentagem de execuções com sucesso
- **Consecutive failures** — número de falhas consecutivas (usado para alertas)
- **Last run** — timestamp e ID da última execução

> **Dica:** Combine synthetic monitors com alertas. Configure um alerta para disparar quando consecutive_fail > 3 para detectar problemas persistentes.`,
        },
      ],
    },
    // ── 4. SLA Management ───────────────────────────────────────────────
    {
      slug: "sla-management",
      title: "Gestão de SLAs",
      description:
        "Defina objetivos de nivel de servico e acompanhe compliance com error budgets.",
      icon: "Target",
      tags: ["testing", "sla", "compliance", "error-budget", "disponibilidade"],
      content: [
        {
          id: "conceitos",
          title: "O que são SLAs",
          body: `Um **SLA** (Service Level Agreement) define os objetivos de qualidade para uma API:

- **Availability** — percentual de tempo que a API deve estar disponível (ex: 99.9%)
- **Latency P99** — latência máxima no percentil 99 (ex: 500ms)
- **Error Rate** — taxa máxima de erros aceitável (ex: 1%)

O sistema avalia continuamente essas métricas contra os objetivos e calcula:

- **Current metrics** — valores atuais de availability, latência e error rate
- **Compliance status** — compliant (dentro do SLA), at_risk (próximo do limite), breached (violou)
- **Error budget** — quanto "margem" resta antes de violar o SLA

**Exemplo:**
- SLA: 99.9% availability em 30 dias
- Budget total: 0.1% = ~43 minutos de downtime permitido em 30 dias
- Se já teve 20 min de downtime: budget remaining = 53.5%`,
        },
        {
          id: "error-budget",
          title: "Error Budgets",
          body: `O **error budget** é a quantidade de "falha permitida" dentro do SLA. É calculado como:

\`\`\`
budget_total = 100% - availability_target
budget_used = 100% - current_availability
budget_remaining = (budget_total - budget_used) / budget_total * 100
\`\`\`

**Exemplo prático:**
- Target: 99.9% (budget total: 0.1%)
- Atual: 99.95% (budget usado: 0.05%)
- Budget remaining: 50%

**Status de compliance:**
- **Compliant** (verde) — budget remaining > 25%
- **At Risk** (amarelo) — budget remaining entre 0% e 25%
- **Breached** (vermelho) — budget remaining <= 0%

> **Dica:** Use error budgets para tomar decisões sobre deploys. Se o budget está baixo, adie mudanças arriscadas. Se o budget está alto, é seguro fazer deploys mais agressivos.`,
        },
        {
          id: "configuracao",
          title: "Configurando SLAs",
          body: `**1. Crie uma definição de SLA**

Acesse Testing > SLA e clique em "Novo SLA". Defina:
- Nome e descrição
- API associada (opcional — pode ser global)
- Availability target (ex: 99.9%)
- Latency P99 target (ex: 500ms)
- Error rate target (ex: 1%)
- Eval window (7d, 30d ou 90d)

**2. Acompanhe o compliance**

O dashboard mostra:
- Gauges circulares com availability atual vs target
- Barra de error budget remaining
- Status de compliance por SLA
- Histórico de violações

**3. Configure alertas**

Recomendamos criar alertas para:
- Budget remaining < 50% — aviso preventivo
- Budget remaining < 25% — ação urgente
- Budget remaining <= 0% — SLA violado

> **Nota:** Os dados de métricas vêm do Prometheus via scraper de métricas. Certifique-se de que o scraper está habilitado e funcionando para que os SLAs sejam avaliados corretamente.`,
        },
      ],
    },
    // ── 5. Boas Praticas ────────────────────────────────────────────────
    {
      slug: "boas-praticas-testing",
      title: "Boas Práticas de Testing",
      description:
        "Recomendações para organizar testes, configurar monitors e definir SLAs efetivos.",
      icon: "Shield",
      tags: ["testing", "boas-praticas", "ci", "pipeline"],
      content: [
        {
          id: "organizacao",
          title: "Organização de Testes",
          body: `**1. Categorize suas suites**

Use tags para organizar:
- \`smoke\` — testes rápidos de sanidade (1-3 steps)
- \`regression\` — testes completos de funcionalidade
- \`performance\` — testes com assertions de tempo de resposta
- \`security\` — testes de autenticação e autorização

**2. Uma suite por funcionalidade**

Cada suite deve testar um fluxo específico:
- "User Registration Flow"
- "Order Creation and Payment"
- "Product Search and Filter"

**3. Use variaveis para encadear steps**

Extraia IDs e tokens de respostas e use em steps seguintes. Isso permite testar fluxos end-to-end completos.

**4. Assertions equilibradas**

Não exagere nas assertions. Foque em:
- Status code (sempre)
- Campos criticos do body
- Tempo de resposta (para suites de performance)`,
        },
        {
          id: "monitoring",
          title: "Monitoramento Efetivo",
          body: `**1. Smoke tests para monitors**

Use suites curtas (2-3 steps) para synthetic monitors. Testes longos aumentam o tempo de detecção de falhas.

**2. Intervalos adequados**

| Criticidade | Intervalo | Exemplo |
|-------------|-----------|---------|
| Crítica | 1 min | API de pagamentos, autenticação |
| Alta | 5 min | APIs de negócio core |
| Média | 15 min | APIs internas, backoffice |
| Baixa | 30 min | APIs de documentação, status |

**3. Alertas em camadas**

- 1 falha consecutiva → log
- 3 falhas consecutivas → notificação (Slack/email)
- 5 falhas consecutivas → alerta crítico (PagerDuty)

**4. Acompanhe tendencias**

Um monitor com uptime de 99.5% indica problemas intermitentes que merecem investigação, mesmo que não dispare alertas.`,
        },
        {
          id: "sla",
          title: "SLAs Efetivos",
          body: `**1. Comece conservador**

Para APIs novas, defina SLAs generosos (99% availability, 1000ms latência) e ajuste com base em dados reais.

**2. SLAs por tier de API**

| Tier | Availability | Latency P99 | Error Rate |
|------|-------------|-------------|------------|
| Platinum | 99.99% | 100ms | 0.1% |
| Gold | 99.9% | 500ms | 0.5% |
| Silver | 99.5% | 1000ms | 1% |
| Bronze | 99% | 2000ms | 2% |

**3. Eval windows**

- 7 dias — para detecção rápida de degradação
- 30 dias — padrão para SLAs contratuais
- 90 dias — para visão de longo prazo

**4. Error budget como ferramenta de decisao**

O error budget não é só uma métrica — é uma ferramenta de decisão:
- Budget > 50% → deploy agressivo permitido
- Budget 25-50% → deploy com cautela extra
- Budget < 25% → somente fixes críticos
- Budget esgotado → freeze de deploys até recuperação`,
        },
      ],
    },
  ],
}
