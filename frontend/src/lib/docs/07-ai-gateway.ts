import type { DocCategory } from "./types"

export const aiGatewayCategory: DocCategory = {
  slug: "ai-gateway",
  title: "AI Gateway",
  description:
    "Gerencie provedores de IA, roteamento multi-modelo, fallback automático, tracking de tokens e custos.",
  icon: "Bot",
  articles: [
    // ── 1. Visão Geral ──────────────────────────────────────────────────
    {
      slug: "visao-geral-ai",
      title: "Visão Geral do AI Gateway",
      description:
        "Entenda o que é o AI Gateway, quais provedores são suportados e os principais recursos disponíveis.",
      icon: "Bot",
      tags: ["ia", "llm", "overview", "providers"],
      content: [
        {
          id: "o-que-e",
          title: "O que é o AI Gateway",
          body: `O AI Gateway é uma camada de proxy inteligente que fica entre suas aplicações e os provedores de modelos de linguagem (LLMs). Em vez de cada serviço se conectar diretamente a APIs como OpenAI ou Anthropic, todas as requisições passam pelo API Gateway, que centraliza autenticação, roteamento, monitoramento e controle de custos.

Com essa abordagem você obtém:

- **Ponto único de entrada** para todas as chamadas de IA, simplificando governança e auditoria
- **Troca de provedor sem alterar código** — basta mudar a configuração da rota
- **Visibilidade completa** sobre consumo de tokens, latência e erros por modelo
- **Políticas de segurança** como rate limiting baseado em tokens, guardrails de prompt e moderação de conteúdo

> **Nota:** O AI Gateway funciona como um plugin do API Gateway. Você não precisa de infraestrutura adicional — basta habilitar os plugins de IA na rota desejada.`,
        },
        {
          id: "provedores-suportados",
          title: "Provedores Suportados",
          body: `O AI Gateway suporta nativamente os seguintes provedores de modelos de linguagem:

- **OpenAI** — GPT-4o, GPT-4o-mini, o1, o3 e demais modelos da família GPT
- **Anthropic** — Claude Opus, Claude Sonnet e Claude Haiku
- **Google Gemini** — Gemini 2.0, Gemini 1.5 Pro e Gemini 1.5 Flash
- **DeepSeek** — DeepSeek V3 e DeepSeek R1
- **Azure OpenAI** — Modelos OpenAI hospedados na infraestrutura Azure
- **Ollama** — Modelos locais (Llama, Mistral, Qwen e outros) via API compatível
- **AWS Bedrock** — Modelos disponíveis no Amazon Bedrock (Claude, Titan, etc.)
- **Cohere** — Command R e modelos de embedding

Cada provedor possui um esquema de configuração específico (endpoint, modelo, chave de API). O plugin \`ai-proxy\` abstrai essas diferenças, permitindo que suas aplicações usem um formato de requisição unificado independente do provedor escolhido.

> **Dica:** Você pode configurar múltiplos provedores simultaneamente e usar o plugin \`ai-proxy-multi\` para distribuir tráfego entre eles com base em peso, custo ou disponibilidade.`,
        },
        {
          id: "recursos-principais",
          title: "Recursos Principais",
          body: `O AI Gateway oferece um conjunto abrangente de funcionalidades para gerenciar workloads de IA em produção:

### Roteamento Multi-Modelo
Distribua requisições entre diferentes modelos e provedores com base em peso, custo ou regras customizadas. Ideal para testes A/B, migração gradual entre modelos e otimização de custos.

### Fallback Automático
Quando um provedor retorna erro (HTTP 429, 5xx ou timeout), o gateway redireciona automaticamente a requisição para um provedor alternativo, garantindo alta disponibilidade.

### Tracking de Tokens e Custos
Acompanhe em tempo real o consumo de tokens (prompt + completion) por rota, consumidor e modelo. Configure modelos de custo personalizados e receba alertas quando orçamentos forem atingidos.

### Guardrails de Segurança
Proteja suas aplicações contra prompt injection, conteúdo inadequado e uso abusivo com plugins dedicados de validação de entrada e moderação de saída.

### Streaming Nativo
Suporte completo a Server-Sent Events (SSE) para respostas em streaming, mantendo tracking de tokens mesmo em modo stream.

> **Nota:** Todos esses recursos são configurados via plugins, sem necessidade de alterar o código das suas aplicações.`,
        },
      ],
    },

    // ── 2. Configurando AI Proxy ────────────────────────────────────────
    {
      slug: "configurando-ai-proxy",
      title: "Configurando o AI Proxy",
      description:
        "Passo a passo para configurar o plugin ai-proxy: provedor, modelo, autenticação e streaming.",
      icon: "Settings",
      tags: ["ai-proxy", "configuração", "providers"],
      content: [
        {
          id: "como-funciona",
          title: "Como Funciona o AI Proxy",
          body: `O plugin \`ai-proxy\` transforma o API Gateway em um proxy transparente para provedores de IA. Quando habilitado em uma rota, ele intercepta as requisições, traduz o formato para a API do provedor configurado e retorna a resposta no formato padrão.

O fluxo de uma requisição é o seguinte:

1. A aplicação envia uma requisição no formato padrão (compatível com OpenAI Chat Completions)
2. O \`ai-proxy\` valida a requisição e aplica guardrails configurados
3. O plugin traduz a requisição para o formato nativo do provedor (ex: Anthropic Messages API)
4. A resposta do provedor é normalizada de volta ao formato padrão
5. Métricas de tokens e latência são registradas automaticamente

> **Dica:** Como o formato de entrada é padronizado, você pode trocar o provedor (ex: de OpenAI para Anthropic) sem alterar nenhuma linha de código na sua aplicação.`,
        },
        {
          id: "configuracao-basica",
          title: "Configuração Básica",
          body: `Para habilitar o AI Proxy em uma rota, adicione o plugin \`ai-proxy\` com as seguintes configurações:

\`\`\`json
{
  "provider": "openai",
  "model": "gpt-4o",
  "api_key": "\${{secrets.OPENAI_API_KEY}}",
  "timeout": 60000
}
\`\`\`

Os campos principais são:

- \`provider\` — Nome do provedor: \`openai\`, \`anthropic\`, \`gemini\`, \`deepseek\`, \`ollama\`, \`azure\`, \`bedrock\`
- \`model\` — Identificador do modelo no provedor (ex: \`gpt-4o\`, \`claude-sonnet-4-20250514\`, \`gemini-2.0-flash\`)
- \`api_key\` — Chave de autenticação. Recomendamos usar referência a secrets: \`\${{secrets.NOME_DA_SECRET}}\`
- \`timeout\` — Timeout em milissegundos para a requisição ao provedor (padrão: 60000)

> **Atenção:** Nunca insira chaves de API diretamente na configuração. Sempre utilize o gerenciador de secrets do FuseOne para armazenar credenciais de forma segura.`,
        },
        {
          id: "configuracao-provedor",
          title: "Configuração por Provedor",
          body: `Cada provedor possui campos de configuração específicos além dos campos básicos:

### OpenAI / Azure OpenAI
- \`base_url\` — URL base da API (obrigatório para Azure, ex: \`https://seu-recurso.openai.azure.com\`)
- \`api_version\` — Versão da API Azure (ex: \`2024-06-01\`)
- \`organization\` — ID da organização OpenAI (opcional)

### Anthropic
- \`max_tokens\` — Limite de tokens na resposta (obrigatório para Claude, padrão: 4096)
- \`anthropic_version\` — Versão da API Anthropic (padrão: \`2023-06-01\`)

### Google Gemini
- \`project_id\` — ID do projeto Google Cloud
- \`location\` — Região do endpoint (ex: \`us-central1\`)

### Ollama (Modelos Locais)
- \`base_url\` — URL do servidor Ollama (ex: \`http://ollama:11434\`)
- \`keep_alive\` — Tempo para manter o modelo carregado em memória

> **Dica:** No editor visual de plugins, os campos específicos de cada provedor são exibidos automaticamente ao selecionar o provedor desejado.`,
        },
        {
          id: "streaming",
          title: "Suporte a Streaming",
          body: `O AI Proxy suporta respostas em streaming via Server-Sent Events (SSE). Para habilitar, basta que a aplicação envie \`"stream": true\` no corpo da requisição — o plugin cuidará da tradução automática para o formato de streaming do provedor.

Comportamentos importantes do modo streaming:

- **Contagem de tokens** é feita de forma acumulativa conforme os chunks são recebidos, garantindo métricas precisas mesmo em modo stream
- **Timeout** se aplica ao tempo total da resposta, não a cada chunk individualmente
- **Fallback** funciona normalmente — se o provedor retornar erro antes de iniciar o stream, a requisição é redirecionada ao provedor alternativo
- **Buffering** pode ser configurado para cenários onde você precisa processar a resposta completa antes de enviá-la ao cliente

Para desabilitar streaming globalmente em uma rota (ignorando o campo \`stream\` do request), configure:

\`\`\`json
{
  "override_stream": false
}
\`\`\`

> **Nota:** Nem todos os modelos suportam streaming. Consulte a documentação do provedor para verificar compatibilidade.`,
        },
      ],
    },

    // ── 3. Multi-Modelo e Fallback ──────────────────────────────────────
    {
      slug: "multi-modelo-fallback",
      title: "Multi-Modelo e Fallback",
      description:
        "Configure roteamento multi-modelo com distribuição por peso, fallback automático e roteamento por custo.",
      icon: "GitBranch",
      tags: ["ai-proxy-multi", "fallback", "multi-modelo"],
      content: [
        {
          id: "visao-geral-multi",
          title: "Roteamento Multi-Modelo",
          body: `O plugin \`ai-proxy-multi\` permite configurar múltiplos provedores e modelos em uma única rota. As requisições são distribuídas entre os backends configurados de acordo com a estratégia escolhida.

Cenários de uso comuns:

- **Alta disponibilidade** — Se o provedor primário falhar, o tráfego é automaticamente redirecionado para o secundário
- **Otimização de custos** — Direcionar a maior parte do tráfego para modelos mais baratos, reservando modelos premium para requisições complexas
- **Testes A/B** — Comparar qualidade de respostas entre modelos diferentes em produção
- **Migração gradual** — Mover tráfego progressivamente de um modelo antigo para um novo

> **Nota:** O \`ai-proxy-multi\` utiliza o \`ai-proxy\` internamente para cada backend. Todas as configurações de provedor, autenticação e streaming se aplicam individualmente a cada backend.`,
        },
        {
          id: "distribuicao-peso",
          title: "Distribuição por Peso",
          body: `A estratégia mais simples é a distribuição por peso (weighted round-robin). Cada backend recebe um peso relativo que determina a proporção de requisições direcionadas a ele.

Exemplo de configuração com dois backends:

\`\`\`json
{
  "strategy": "weighted",
  "backends": [
    {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "weight": 80,
      "api_key": "\${{secrets.OPENAI_KEY}}"
    },
    {
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514",
      "weight": 20,
      "api_key": "\${{secrets.ANTHROPIC_KEY}}"
    }
  ]
}
\`\`\`

Neste exemplo, 80% das requisições vão para GPT-4o-mini e 20% para Claude Sonnet. Os pesos são relativos — você pode usar qualquer escala numérica (1-100, 1-10, etc.).

> **Dica:** Comece com peso baixo (5-10%) no novo modelo e aumente gradualmente conforme ganha confiança na qualidade das respostas.`,
        },
        {
          id: "fallback-automatico",
          title: "Fallback Automático",
          body: `O fallback automático garante que suas aplicações continuem funcionando mesmo quando um provedor de IA fica indisponível. Quando o backend primário retorna um erro, o gateway tenta automaticamente o próximo backend na lista.

Erros que acionam o fallback:

- **HTTP 429** — Rate limit excedido no provedor
- **HTTP 5xx** — Erro interno do provedor (500, 502, 503)
- **Timeout** — Provedor não respondeu dentro do tempo configurado
- **Erro de conexão** — Provedor inacessível

Configuração de fallback:

\`\`\`json
{
  "strategy": "fallback",
  "backends": [
    { "provider": "openai", "model": "gpt-4o", "priority": 1 },
    { "provider": "anthropic", "model": "claude-sonnet-4-20250514", "priority": 2 },
    { "provider": "deepseek", "model": "deepseek-v3", "priority": 3 }
  ],
  "retry_timeout": 30
}
\`\`\`

O campo \`priority\` define a ordem de tentativa. O \`retry_timeout\` (em segundos) define quanto tempo esperar antes de tentar novamente o backend que falhou.

> **Atenção:** O fallback adiciona latência à requisição quando o backend primário falha. Considere configurar timeouts mais curtos no backend primário para acionar o fallback mais rapidamente.`,
        },
        {
          id: "roteamento-custo",
          title: "Roteamento por Custo",
          body: `A estratégia de roteamento por custo seleciona automaticamente o modelo mais barato que atende aos requisitos da requisição. Isso é útil quando você tem múltiplos modelos disponíveis e quer minimizar custos sem sacrificar funcionalidade.

Configuração de custo por modelo:

\`\`\`json
{
  "strategy": "cost_optimized",
  "backends": [
    {
      "provider": "deepseek",
      "model": "deepseek-v3",
      "cost_per_1k_input": 0.00027,
      "cost_per_1k_output": 0.0011,
      "max_context": 64000
    },
    {
      "provider": "openai",
      "model": "gpt-4o",
      "cost_per_1k_input": 0.0025,
      "cost_per_1k_output": 0.01,
      "max_context": 128000
    }
  ],
  "budget_limit_daily": 50.00
}
\`\`\`

O gateway estima o custo da requisição com base no tamanho do prompt e seleciona o backend mais econômico. Se o orçamento diário (\`budget_limit_daily\`) for atingido, requisições são rejeitadas com HTTP 429.

> **Dica:** Combine roteamento por custo com fallback para garantir que, se o modelo mais barato estiver indisponível, a requisição ainda seja atendida por um modelo alternativo.`,
        },
      ],
    },

    // ── 4. Tracking de Tokens e Custos ──────────────────────────────────
    {
      slug: "tokens-custos",
      title: "Tracking de Tokens e Custos",
      description:
        "Acompanhe consumo de tokens, custos por provedor e modelo, configure alertas de orçamento.",
      icon: "DollarSign",
      tags: ["tokens", "custos", "métricas", "budget"],
      content: [
        {
          id: "dashboard-ai",
          title: "Dashboard de IA",
          body: `O dashboard de IA oferece uma visão consolidada do consumo de tokens e custos em todas as rotas que utilizam plugins de IA. Acesse-o pelo menu **Monitoramento > AI Analytics**.

Os gráficos e métricas disponíveis incluem:

- **Tokens totais** — Soma de tokens de input (prompt) e output (completion) no período selecionado
- **Custo estimado** — Valor em dólar calculado com base nos modelos de custo configurados
- **Requisições por modelo** — Distribuição de chamadas entre os diferentes modelos e provedores
- **Latência por provedor** — Tempo médio de resposta (TTFB e total) de cada provedor
- **Taxa de erro por provedor** — Percentual de requisições com falha por provedor

Você pode filtrar os dados por:

- **Período** — Última hora, 24h, 7 dias, 30 dias ou intervalo customizado
- **Rota** — Visualizar métricas de uma rota específica
- **Consumidor** — Filtrar por consumer do API Gateway
- **Provedor/Modelo** — Isolar dados de um provedor ou modelo específico`,
        },
        {
          id: "modelos-custo",
          title: "Modelos de Custo",
          body: `Para que o tracking de custos funcione corretamente, você precisa configurar os modelos de custo para cada provedor e modelo utilizado. O FuseOne já inclui modelos de custo pré-configurados para os provedores mais populares, mas você pode customizá-los.

Cada modelo de custo define:

- \`cost_per_1k_input\` — Custo por 1.000 tokens de input (prompt)
- \`cost_per_1k_output\` — Custo por 1.000 tokens de output (completion)
- \`cost_per_request\` — Custo fixo por requisição (opcional, para modelos com pricing por request)

Exemplo de configuração customizada:

\`\`\`json
{
  "provider": "openai",
  "model": "gpt-4o",
  "cost_per_1k_input": 0.0025,
  "cost_per_1k_output": 0.01,
  "currency": "USD"
}
\`\`\`

> **Nota:** Os custos são estimativas baseadas na contagem de tokens reportada pelo provedor. Para modelos locais (Ollama), a contagem de tokens é feita via tokenizador aproximado e o custo pode ser configurado para refletir o custo de infraestrutura.

Acesse **Configurações > AI > Modelos de Custo** para gerenciar os modelos de custo.`,
        },
        {
          id: "alertas-orcamento",
          title: "Alertas de Orçamento",
          body: `Configure alertas para ser notificado quando o consumo de IA atingir limites predefinidos. Os alertas de orçamento podem ser configurados em diferentes níveis:

### Alerta Global
Monitora o custo total de todas as rotas de IA combinadas. Útil para controlar o gasto total da organização.

### Alerta por Rota
Monitora o custo de uma rota específica. Ideal para identificar rotas com consumo anormal.

### Alerta por Consumidor
Monitora o custo gerado por um consumer específico. Útil para billing e controle de uso por cliente.

Para cada alerta você configura:

- **Limite** — Valor em dólar que aciona o alerta (ex: $100/dia)
- **Janela** — Período de avaliação: hora, dia, semana ou mês
- **Ação** — O que acontece ao atingir o limite:
  - *Notificar* — Envia notificação sem bloquear tráfego
  - *Throttle* — Reduz a taxa de requisições permitidas
  - *Bloquear* — Rejeita novas requisições com HTTP 429

> **Atenção:** Alertas com ação de bloqueio podem impactar a disponibilidade das suas aplicações. Use com cautela e sempre configure um canal de notificação para ser avisado antes do bloqueio.`,
        },
        {
          id: "tracking-por-consumer",
          title: "Tracking por Consumidor",
          body: `O tracking por consumidor permite identificar exatamente quanto cada cliente ou aplicação está consumindo dos seus serviços de IA. Para que isso funcione, as requisições precisam ser autenticadas com um consumer do API Gateway.

O fluxo funciona assim:

1. A requisição chega ao gateway com uma credencial (API Key, JWT, etc.)
2. O middleware de autenticação identifica o consumer
3. O plugin de IA processa a requisição e registra os tokens consumidos
4. As métricas são associadas ao consumer identificado

No dashboard, você pode visualizar:

- **Ranking de consumidores** — Ordenado por tokens consumidos ou custo gerado
- **Histórico de consumo** — Evolução do uso ao longo do tempo por consumidor
- **Detalhamento por modelo** — Quais modelos cada consumidor está utilizando

> **Dica:** Combine tracking por consumidor com alertas de orçamento para implementar cotas de uso. Por exemplo, limite cada cliente a 1 milhão de tokens por mês e envie uma notificação quando atingir 80% da cota.

Essas informações são essenciais para cenários de billing onde você precisa cobrar clientes pelo uso de IA ou alocar custos internamente entre equipes.`,
        },
      ],
    },

    // ── 5. Segurança e Guardrails de IA ─────────────────────────────────
    {
      slug: "guardrails-ai",
      title: "Segurança e Guardrails de IA",
      description:
        "Proteja suas aplicações de IA com validação de prompts, moderação de conteúdo e rate limiting por tokens.",
      icon: "ShieldCheck",
      tags: ["segurança", "prompt-guard", "guardrails"],
      content: [
        {
          id: "prompt-guard",
          title: "AI Prompt Guard",
          body: `O plugin \`ai-prompt-guard\` valida as mensagens de entrada antes de enviá-las ao provedor de IA. Ele protege contra tentativas de prompt injection, jailbreak e uso indevido dos seus endpoints de IA.

Recursos disponíveis:

- **Regex de bloqueio** — Defina expressões regulares para bloquear mensagens que contenham padrões perigosos (ex: "ignore previous instructions", "system prompt")
- **Regex de permissão** — Defina padrões que as mensagens devem seguir (whitelist), rejeitando qualquer mensagem fora do padrão
- **Tamanho máximo** — Limite o tamanho máximo do prompt em caracteres ou tokens
- **Validação de roles** — Garanta que apenas roles permitidos (user, system) sejam enviados

Exemplo de configuração:

\`\`\`json
{
  "deny_patterns": [
    "ignore.*previous.*instructions",
    "reveal.*system.*prompt",
    "act as.*DAN"
  ],
  "max_prompt_tokens": 4096
}
\`\`\`

> **Nota:** O prompt guard é executado antes do request ser enviado ao provedor, evitando custos com requisições maliciosas.`,
        },
        {
          id: "moderacao-conteudo",
          title: "Moderação de Conteúdo",
          body: `O plugin \`ai-content-moderation\` analisa tanto as mensagens de entrada quanto as respostas do modelo para detectar conteúdo inadequado, tóxico ou que viole as políticas da sua organização.

A moderação pode ser feita de duas formas:

### Moderação via Provedor Externo
Integre com serviços de moderação como AWS Comprehend ou Azure Content Safety para análise avançada de conteúdo. A configuração requer credenciais do serviço de moderação.

### Moderação por Regras Locais
Defina listas de palavras-chave e padrões que devem ser bloqueados na entrada ou na saída. Mais simples e sem custo adicional, porém menos sofisticada.

Configuração de exemplo com moderação por regras:

\`\`\`json
{
  "check_input": true,
  "check_output": true,
  "blocked_terms": ["lista", "de", "termos"],
  "action": "block"
}
\`\`\`

A ação pode ser \`block\` (rejeita a requisição com HTTP 400), \`warn\` (adiciona header de aviso mas permite a requisição) ou \`redact\` (substitui o conteúdo detectado por asteriscos).

> **Dica:** Para ambientes de produção com requisitos de compliance, recomendamos a moderação via provedor externo, que oferece detecção mais precisa e categorizada.`,
        },
        {
          id: "request-rewrite",
          title: "AI Request Rewrite",
          body: `O plugin \`ai-request-rewrite\` permite transformar a requisição antes de enviá-la ao provedor de IA. Isso é útil para injetar system prompts padrão, adicionar contexto ou sanitizar a entrada do usuário.

Casos de uso comuns:

- **System prompt padrão** — Garanta que todas as requisições incluam instruções de comportamento definidas pela sua organização
- **Contexto automático** — Injete informações relevantes (ex: dados do usuário, timestamp) no prompt
- **Sanitização** — Remova ou substitua informações sensíveis (PII) antes de enviar ao provedor

Exemplo de configuração:

\`\`\`json
{
  "prepend_system_message": "Você é um assistente da empresa X. Responda sempre em português e de forma profissional.",
  "strip_system_messages": false,
  "inject_metadata": {
    "user_id": "$consumer_name",
    "timestamp": "$request_time"
  }
}
\`\`\`

O campo \`prepend_system_message\` adiciona uma mensagem de sistema no início da conversa. Se \`strip_system_messages\` for \`true\`, todas as mensagens de sistema enviadas pelo cliente são removidas (útil para impedir que clientes sobrescrevam o system prompt).

> **Atenção:** O request rewrite é executado após o prompt guard. Se a mensagem original for bloqueada pelo prompt guard, o rewrite não será executado.`,
        },
        {
          id: "rate-limiting-tokens",
          title: "Rate Limiting por Tokens",
          body: `Além do rate limiting tradicional baseado em número de requisições, o AI Gateway oferece rate limiting baseado em tokens. Isso é essencial porque uma única requisição de IA pode consumir desde dezenas até centenas de milhares de tokens.

O plugin \`ai-rate-limiting\` permite definir limites por:

- **Tokens de input por minuto/hora** — Limite o total de tokens de prompt enviados
- **Tokens de output por minuto/hora** — Limite o total de tokens de resposta gerados
- **Tokens totais por minuto/hora** — Limite combinado de input + output
- **Custo por período** — Limite baseado no custo estimado em dólar

Exemplo de configuração:

\`\`\`json
{
  "total_tokens_per_minute": 100000,
  "total_tokens_per_day": 5000000,
  "cost_per_day": 25.00,
  "rejected_code": 429,
  "rejected_msg": "Cota de tokens excedida. Tente novamente mais tarde."
}
\`\`\`

Os limites podem ser configurados por rota ou por consumidor. Quando o limite é atingido, o gateway retorna HTTP 429 com uma mensagem customizável e headers indicando quando o limite será resetado (\`Retry-After\`).

> **Dica:** Combine rate limiting por tokens com rate limiting por requisições para proteção em camadas — por exemplo, máximo de 60 requisições por minuto E máximo de 100.000 tokens por minuto.`,
        },
      ],
    },
  ],
}
