import type { DocCategory } from "./types"

export const aiGatewayCategory: DocCategory = {
  slug: "ai-gateway",
  title: "AI Gateway",
  description:
    "Gerencie provedores de IA, roteamento multi-modelo, fallback automatico, tracking de tokens e custos.",
  icon: "Bot",
  articles: [
    // ── 1. Visao Geral ──────────────────────────────────────────────────
    {
      slug: "visao-geral-ai",
      title: "Visao Geral do AI Gateway",
      description:
        "Entenda o que e o AI Gateway, quais provedores sao suportados e os principais recursos disponiveis.",
      icon: "Bot",
      tags: ["ia", "llm", "overview", "providers"],
      content: [
        {
          id: "o-que-e",
          title: "O que e o AI Gateway",
          body: `O AI Gateway e uma camada de proxy inteligente que fica entre suas aplicacoes e os provedores de modelos de linguagem (LLMs). Em vez de cada servico se conectar diretamente a APIs como OpenAI ou Anthropic, todas as requisicoes passam pelo API Gateway, que centraliza autenticacao, roteamento, monitoramento e controle de custos.

Com essa abordagem voce obtem:

- **Ponto unico de entrada** para todas as chamadas de IA, simplificando governanca e auditoria
- **Troca de provedor sem alterar codigo** — basta mudar a configuracao da rota
- **Visibilidade completa** sobre consumo de tokens, latencia e erros por modelo
- **Politicas de seguranca** como rate limiting baseado em tokens, guardrails de prompt e moderacao de conteudo

> **Nota:** O AI Gateway funciona como um plugin do API Gateway. Voce nao precisa de infraestrutura adicional — basta habilitar os plugins de IA na rota desejada.`,
        },
        {
          id: "provedores-suportados",
          title: "Provedores Suportados",
          body: `O AI Gateway suporta nativamente os seguintes provedores de modelos de linguagem:

- **OpenAI** — GPT-4o, GPT-4o-mini, o1, o3 e demais modelos da familia GPT
- **Anthropic** — Claude Opus, Claude Sonnet e Claude Haiku
- **Google Gemini** — Gemini 2.0, Gemini 1.5 Pro e Gemini 1.5 Flash
- **DeepSeek** — DeepSeek V3 e DeepSeek R1
- **Azure OpenAI** — Modelos OpenAI hospedados na infraestrutura Azure
- **Ollama** — Modelos locais (Llama, Mistral, Qwen e outros) via API compativel
- **AWS Bedrock** — Modelos disponiveis no Amazon Bedrock (Claude, Titan, etc.)
- **Cohere** — Command R e modelos de embedding

Cada provedor possui um esquema de configuracao especifico (endpoint, modelo, chave de API). O plugin \`ai-proxy\` abstrai essas diferencas, permitindo que suas aplicacoes usem um formato de requisicao unificado independente do provedor escolhido.

> **Dica:** Voce pode configurar multiplos provedores simultaneamente e usar o plugin \`ai-proxy-multi\` para distribuir trafego entre eles com base em peso, custo ou disponibilidade.`,
        },
        {
          id: "recursos-principais",
          title: "Recursos Principais",
          body: `O AI Gateway oferece um conjunto abrangente de funcionalidades para gerenciar workloads de IA em producao:

### Roteamento Multi-Modelo
Distribua requisicoes entre diferentes modelos e provedores com base em peso, custo ou regras customizadas. Ideal para testes A/B, migracao gradual entre modelos e otimizacao de custos.

### Fallback Automatico
Quando um provedor retorna erro (HTTP 429, 5xx ou timeout), o gateway redireciona automaticamente a requisicao para um provedor alternativo, garantindo alta disponibilidade.

### Tracking de Tokens e Custos
Acompanhe em tempo real o consumo de tokens (prompt + completion) por rota, consumidor e modelo. Configure modelos de custo personalizados e receba alertas quando orcamentos forem atingidos.

### Guardrails de Seguranca
Proteja suas aplicacoes contra prompt injection, conteudo inadequado e uso abusivo com plugins dedicados de validacao de entrada e moderacao de saida.

### Streaming Nativo
Suporte completo a Server-Sent Events (SSE) para respostas em streaming, mantendo tracking de tokens mesmo em modo stream.

> **Nota:** Todos esses recursos sao configurados via plugins, sem necessidade de alterar o codigo das suas aplicacoes.`,
        },
      ],
    },

    // ── 2. Configurando AI Proxy ────────────────────────────────────────
    {
      slug: "configurando-ai-proxy",
      title: "Configurando o AI Proxy",
      description:
        "Passo a passo para configurar o plugin ai-proxy: provedor, modelo, autenticacao e streaming.",
      icon: "Settings",
      tags: ["ai-proxy", "configuracao", "providers"],
      content: [
        {
          id: "como-funciona",
          title: "Como Funciona o AI Proxy",
          body: `O plugin \`ai-proxy\` transforma o API Gateway em um proxy transparente para provedores de IA. Quando habilitado em uma rota, ele intercepta as requisicoes, traduz o formato para a API do provedor configurado e retorna a resposta no formato padrao.

O fluxo de uma requisicao e o seguinte:

1. A aplicacao envia uma requisicao no formato padrao (compativel com OpenAI Chat Completions)
2. O \`ai-proxy\` valida a requisicao e aplica guardrails configurados
3. O plugin traduz a requisicao para o formato nativo do provedor (ex: Anthropic Messages API)
4. A resposta do provedor e normalizada de volta ao formato padrao
5. Metricas de tokens e latencia sao registradas automaticamente

> **Dica:** Como o formato de entrada e padronizado, voce pode trocar o provedor (ex: de OpenAI para Anthropic) sem alterar nenhuma linha de codigo na sua aplicacao.`,
        },
        {
          id: "configuracao-basica",
          title: "Configuracao Basica",
          body: `Para habilitar o AI Proxy em uma rota, adicione o plugin \`ai-proxy\` com as seguintes configuracoes:

\`\`\`json
{
  "provider": "openai",
  "model": "gpt-4o",
  "api_key": "\${{secrets.OPENAI_API_KEY}}",
  "timeout": 60000
}
\`\`\`

Os campos principais sao:

- \`provider\` — Nome do provedor: \`openai\`, \`anthropic\`, \`gemini\`, \`deepseek\`, \`ollama\`, \`azure\`, \`bedrock\`
- \`model\` — Identificador do modelo no provedor (ex: \`gpt-4o\`, \`claude-sonnet-4-20250514\`, \`gemini-2.0-flash\`)
- \`api_key\` — Chave de autenticacao. Recomendamos usar referencia a secrets: \`\${{secrets.NOME_DA_SECRET}}\`
- \`timeout\` — Timeout em milissegundos para a requisicao ao provedor (padrao: 60000)

> **Atencao:** Nunca insira chaves de API diretamente na configuracao. Sempre utilize o gerenciador de secrets do FuseOne para armazenar credenciais de forma segura.`,
        },
        {
          id: "configuracao-provedor",
          title: "Configuracao por Provedor",
          body: `Cada provedor possui campos de configuracao especificos alem dos campos basicos:

### OpenAI / Azure OpenAI
- \`base_url\` — URL base da API (obrigatorio para Azure, ex: \`https://seu-recurso.openai.azure.com\`)
- \`api_version\` — Versao da API Azure (ex: \`2024-06-01\`)
- \`organization\` — ID da organizacao OpenAI (opcional)

### Anthropic
- \`max_tokens\` — Limite de tokens na resposta (obrigatorio para Claude, padrao: 4096)
- \`anthropic_version\` — Versao da API Anthropic (padrao: \`2023-06-01\`)

### Google Gemini
- \`project_id\` — ID do projeto Google Cloud
- \`location\` — Regiao do endpoint (ex: \`us-central1\`)

### Ollama (Modelos Locais)
- \`base_url\` — URL do servidor Ollama (ex: \`http://ollama:11434\`)
- \`keep_alive\` — Tempo para manter o modelo carregado em memoria

> **Dica:** No editor visual de plugins, os campos especificos de cada provedor sao exibidos automaticamente ao selecionar o provedor desejado.`,
        },
        {
          id: "streaming",
          title: "Suporte a Streaming",
          body: `O AI Proxy suporta respostas em streaming via Server-Sent Events (SSE). Para habilitar, basta que a aplicacao envie \`"stream": true\` no corpo da requisicao — o plugin cuidara da traducao automatica para o formato de streaming do provedor.

Comportamentos importantes do modo streaming:

- **Contagem de tokens** e feita de forma acumulativa conforme os chunks sao recebidos, garantindo metricas precisas mesmo em modo stream
- **Timeout** se aplica ao tempo total da resposta, nao a cada chunk individualmente
- **Fallback** funciona normalmente — se o provedor retornar erro antes de iniciar o stream, a requisicao e redirecionada ao provedor alternativo
- **Buffering** pode ser configurado para cenarios onde voce precisa processar a resposta completa antes de envia-la ao cliente

Para desabilitar streaming globalmente em uma rota (ignorando o campo \`stream\` do request), configure:

\`\`\`json
{
  "override_stream": false
}
\`\`\`

> **Nota:** Nem todos os modelos suportam streaming. Consulte a documentacao do provedor para verificar compatibilidade.`,
        },
      ],
    },

    // ── 3. Multi-Modelo e Fallback ──────────────────────────────────────
    {
      slug: "multi-modelo-fallback",
      title: "Multi-Modelo e Fallback",
      description:
        "Configure roteamento multi-modelo com distribuicao por peso, fallback automatico e roteamento por custo.",
      icon: "GitBranch",
      tags: ["ai-proxy-multi", "fallback", "multi-modelo"],
      content: [
        {
          id: "visao-geral-multi",
          title: "Roteamento Multi-Modelo",
          body: `O plugin \`ai-proxy-multi\` permite configurar multiplos provedores e modelos em uma unica rota. As requisicoes sao distribuidas entre os backends configurados de acordo com a estrategia escolhida.

Cenarios de uso comuns:

- **Alta disponibilidade** — Se o provedor primario falhar, o trafego e automaticamente redirecionado para o secundario
- **Otimizacao de custos** — Direcionar a maior parte do trafego para modelos mais baratos, reservando modelos premium para requisicoes complexas
- **Testes A/B** — Comparar qualidade de respostas entre modelos diferentes em producao
- **Migracao gradual** — Mover trafego progressivamente de um modelo antigo para um novo

> **Nota:** O \`ai-proxy-multi\` utiliza o \`ai-proxy\` internamente para cada backend. Todas as configuracoes de provedor, autenticacao e streaming se aplicam individualmente a cada backend.`,
        },
        {
          id: "distribuicao-peso",
          title: "Distribuicao por Peso",
          body: `A estrategia mais simples e a distribuicao por peso (weighted round-robin). Cada backend recebe um peso relativo que determina a proporcao de requisicoes direcionadas a ele.

Exemplo de configuracao com dois backends:

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

Neste exemplo, 80% das requisicoes vao para GPT-4o-mini e 20% para Claude Sonnet. Os pesos sao relativos — voce pode usar qualquer escala numerica (1-100, 1-10, etc.).

> **Dica:** Comece com peso baixo (5-10%) no novo modelo e aumente gradualmente conforme ganha confianca na qualidade das respostas.`,
        },
        {
          id: "fallback-automatico",
          title: "Fallback Automatico",
          body: `O fallback automatico garante que suas aplicacoes continuem funcionando mesmo quando um provedor de IA fica indisponivel. Quando o backend primario retorna um erro, o gateway tenta automaticamente o proximo backend na lista.

Erros que acionam o fallback:

- **HTTP 429** — Rate limit excedido no provedor
- **HTTP 5xx** — Erro interno do provedor (500, 502, 503)
- **Timeout** — Provedor nao respondeu dentro do tempo configurado
- **Erro de conexao** — Provedor inacessivel

Configuracao de fallback:

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

> **Atencao:** O fallback adiciona latencia a requisicao quando o backend primario falha. Considere configurar timeouts mais curtos no backend primario para acionar o fallback mais rapidamente.`,
        },
        {
          id: "roteamento-custo",
          title: "Roteamento por Custo",
          body: `A estrategia de roteamento por custo seleciona automaticamente o modelo mais barato que atende aos requisitos da requisicao. Isso e util quando voce tem multiplos modelos disponiveis e quer minimizar custos sem sacrificar funcionalidade.

Configuracao de custo por modelo:

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

O gateway estima o custo da requisicao com base no tamanho do prompt e seleciona o backend mais economico. Se o orcamento diario (\`budget_limit_daily\`) for atingido, requisicoes sao rejeitadas com HTTP 429.

> **Dica:** Combine roteamento por custo com fallback para garantir que, se o modelo mais barato estiver indisponivel, a requisicao ainda seja atendida por um modelo alternativo.`,
        },
      ],
    },

    // ── 4. Tracking de Tokens e Custos ──────────────────────────────────
    {
      slug: "tokens-custos",
      title: "Tracking de Tokens e Custos",
      description:
        "Acompanhe consumo de tokens, custos por provedor e modelo, configure alertas de orcamento.",
      icon: "DollarSign",
      tags: ["tokens", "custos", "metricas", "budget"],
      content: [
        {
          id: "dashboard-ai",
          title: "Dashboard de IA",
          body: `O dashboard de IA oferece uma visao consolidada do consumo de tokens e custos em todas as rotas que utilizam plugins de IA. Acesse-o pelo menu **Monitoramento > AI Analytics**.

Os graficos e metricas disponiveis incluem:

- **Tokens totais** — Soma de tokens de input (prompt) e output (completion) no periodo selecionado
- **Custo estimado** — Valor em dolar calculado com base nos modelos de custo configurados
- **Requisicoes por modelo** — Distribuicao de chamadas entre os diferentes modelos e provedores
- **Latencia por provedor** — Tempo medio de resposta (TTFB e total) de cada provedor
- **Taxa de erro por provedor** — Percentual de requisicoes com falha por provedor

Voce pode filtrar os dados por:

- **Periodo** — Ultima hora, 24h, 7 dias, 30 dias ou intervalo customizado
- **Rota** — Visualizar metricas de uma rota especifica
- **Consumidor** — Filtrar por consumer do API Gateway
- **Provedor/Modelo** — Isolar dados de um provedor ou modelo especifico`,
        },
        {
          id: "modelos-custo",
          title: "Modelos de Custo",
          body: `Para que o tracking de custos funcione corretamente, voce precisa configurar os modelos de custo para cada provedor e modelo utilizado. O FuseOne ja inclui modelos de custo pre-configurados para os provedores mais populares, mas voce pode customiza-los.

Cada modelo de custo define:

- \`cost_per_1k_input\` — Custo por 1.000 tokens de input (prompt)
- \`cost_per_1k_output\` — Custo por 1.000 tokens de output (completion)
- \`cost_per_request\` — Custo fixo por requisicao (opcional, para modelos com pricing por request)

Exemplo de configuracao customizada:

\`\`\`json
{
  "provider": "openai",
  "model": "gpt-4o",
  "cost_per_1k_input": 0.0025,
  "cost_per_1k_output": 0.01,
  "currency": "USD"
}
\`\`\`

> **Nota:** Os custos sao estimativas baseadas na contagem de tokens reportada pelo provedor. Para modelos locais (Ollama), a contagem de tokens e feita via tokenizador aproximado e o custo pode ser configurado para refletir o custo de infraestrutura.

Acesse **Configuracoes > AI > Modelos de Custo** para gerenciar os modelos de custo.`,
        },
        {
          id: "alertas-orcamento",
          title: "Alertas de Orcamento",
          body: `Configure alertas para ser notificado quando o consumo de IA atingir limites predefinidos. Os alertas de orcamento podem ser configurados em diferentes niveis:

### Alerta Global
Monitora o custo total de todas as rotas de IA combinadas. Util para controlar o gasto total da organizacao.

### Alerta por Rota
Monitora o custo de uma rota especifica. Ideal para identificar rotas com consumo anormal.

### Alerta por Consumidor
Monitora o custo gerado por um consumer especifico. Util para billing e controle de uso por cliente.

Para cada alerta voce configura:

- **Limite** — Valor em dolar que aciona o alerta (ex: $100/dia)
- **Janela** — Periodo de avaliacao: hora, dia, semana ou mes
- **Acao** — O que acontece ao atingir o limite:
  - *Notificar* — Envia notificacao sem bloquear trafego
  - *Throttle* — Reduz a taxa de requisicoes permitidas
  - *Bloquear* — Rejeita novas requisicoes com HTTP 429

> **Atencao:** Alertas com acao de bloqueio podem impactar a disponibilidade das suas aplicacoes. Use com cautela e sempre configure um canal de notificacao para ser avisado antes do bloqueio.`,
        },
        {
          id: "tracking-por-consumer",
          title: "Tracking por Consumidor",
          body: `O tracking por consumidor permite identificar exatamente quanto cada cliente ou aplicacao esta consumindo dos seus servicos de IA. Para que isso funcione, as requisicoes precisam ser autenticadas com um consumer do API Gateway.

O fluxo funciona assim:

1. A requisicao chega ao gateway com uma credencial (API Key, JWT, etc.)
2. O middleware de autenticacao identifica o consumer
3. O plugin de IA processa a requisicao e registra os tokens consumidos
4. As metricas sao associadas ao consumer identificado

No dashboard, voce pode visualizar:

- **Ranking de consumidores** — Ordenado por tokens consumidos ou custo gerado
- **Historico de consumo** — Evolucao do uso ao longo do tempo por consumidor
- **Detalhamento por modelo** — Quais modelos cada consumidor esta utilizando

> **Dica:** Combine tracking por consumidor com alertas de orcamento para implementar cotas de uso. Por exemplo, limite cada cliente a 1 milhao de tokens por mes e envie uma notificacao quando atingir 80% da cota.

Essas informacoes sao essenciais para cenarios de billing onde voce precisa cobrar clientes pelo uso de IA ou alocar custos internamente entre equipes.`,
        },
      ],
    },

    // ── 5. Seguranca e Guardrails de IA ─────────────────────────────────
    {
      slug: "guardrails-ai",
      title: "Seguranca e Guardrails de IA",
      description:
        "Proteja suas aplicacoes de IA com validacao de prompts, moderacao de conteudo e rate limiting por tokens.",
      icon: "ShieldCheck",
      tags: ["seguranca", "prompt-guard", "guardrails"],
      content: [
        {
          id: "prompt-guard",
          title: "AI Prompt Guard",
          body: `O plugin \`ai-prompt-guard\` valida as mensagens de entrada antes de envia-las ao provedor de IA. Ele protege contra tentativas de prompt injection, jailbreak e uso indevido dos seus endpoints de IA.

Recursos disponiveis:

- **Regex de bloqueio** — Defina expressoes regulares para bloquear mensagens que contenham padroes perigosos (ex: "ignore previous instructions", "system prompt")
- **Regex de permissao** — Defina padroes que as mensagens devem seguir (whitelist), rejeitando qualquer mensagem fora do padrao
- **Tamanho maximo** — Limite o tamanho maximo do prompt em caracteres ou tokens
- **Validacao de roles** — Garanta que apenas roles permitidos (user, system) sejam enviados

Exemplo de configuracao:

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

> **Nota:** O prompt guard e executado antes do request ser enviado ao provedor, evitando custos com requisicoes maliciosas.`,
        },
        {
          id: "moderacao-conteudo",
          title: "Moderacao de Conteudo",
          body: `O plugin \`ai-content-moderation\` analisa tanto as mensagens de entrada quanto as respostas do modelo para detectar conteudo inadequado, toxico ou que viole as politicas da sua organizacao.

A moderacao pode ser feita de duas formas:

### Moderacao via Provedor Externo
Integre com servicos de moderacao como AWS Comprehend ou Azure Content Safety para analise avancada de conteudo. A configuracao requer credenciais do servico de moderacao.

### Moderacao por Regras Locais
Defina listas de palavras-chave e padroes que devem ser bloqueados na entrada ou na saida. Mais simples e sem custo adicional, porem menos sofisticada.

Configuracao de exemplo com moderacao por regras:

\`\`\`json
{
  "check_input": true,
  "check_output": true,
  "blocked_terms": ["lista", "de", "termos"],
  "action": "block"
}
\`\`\`

A acao pode ser \`block\` (rejeita a requisicao com HTTP 400), \`warn\` (adiciona header de aviso mas permite a requisicao) ou \`redact\` (substitui o conteudo detectado por asteriscos).

> **Dica:** Para ambientes de producao com requisitos de compliance, recomendamos a moderacao via provedor externo, que oferece deteccao mais precisa e categorizada.`,
        },
        {
          id: "request-rewrite",
          title: "AI Request Rewrite",
          body: `O plugin \`ai-request-rewrite\` permite transformar a requisicao antes de envia-la ao provedor de IA. Isso e util para injetar system prompts padrao, adicionar contexto ou sanitizar a entrada do usuario.

Casos de uso comuns:

- **System prompt padrao** — Garanta que todas as requisicoes incluam instrucoes de comportamento definidas pela sua organizacao
- **Contexto automatico** — Injete informacoes relevantes (ex: dados do usuario, timestamp) no prompt
- **Sanitizacao** — Remova ou substitua informacoes sensiveis (PII) antes de enviar ao provedor

Exemplo de configuracao:

\`\`\`json
{
  "prepend_system_message": "Voce e um assistente da empresa X. Responda sempre em portugues e de forma profissional.",
  "strip_system_messages": false,
  "inject_metadata": {
    "user_id": "$consumer_name",
    "timestamp": "$request_time"
  }
}
\`\`\`

O campo \`prepend_system_message\` adiciona uma mensagem de sistema no inicio da conversa. Se \`strip_system_messages\` for \`true\`, todas as mensagens de sistema enviadas pelo cliente sao removidas (util para impedir que clientes sobrescrevam o system prompt).

> **Atencao:** O request rewrite e executado apos o prompt guard. Se a mensagem original for bloqueada pelo prompt guard, o rewrite nao sera executado.`,
        },
        {
          id: "rate-limiting-tokens",
          title: "Rate Limiting por Tokens",
          body: `Alem do rate limiting tradicional baseado em numero de requisicoes, o AI Gateway oferece rate limiting baseado em tokens. Isso e essencial porque uma unica requisicao de IA pode consumir desde dezenas ate centenas de milhares de tokens.

O plugin \`ai-rate-limiting\` permite definir limites por:

- **Tokens de input por minuto/hora** — Limite o total de tokens de prompt enviados
- **Tokens de output por minuto/hora** — Limite o total de tokens de resposta gerados
- **Tokens totais por minuto/hora** — Limite combinado de input + output
- **Custo por periodo** — Limite baseado no custo estimado em dolar

Exemplo de configuracao:

\`\`\`json
{
  "total_tokens_per_minute": 100000,
  "total_tokens_per_day": 5000000,
  "cost_per_day": 25.00,
  "rejected_code": 429,
  "rejected_msg": "Cota de tokens excedida. Tente novamente mais tarde."
}
\`\`\`

Os limites podem ser configurados por rota ou por consumidor. Quando o limite e atingido, o gateway retorna HTTP 429 com uma mensagem customizavel e headers indicando quando o limite sera resetado (\`Retry-After\`).

> **Dica:** Combine rate limiting por tokens com rate limiting por requisicoes para protecao em camadas — por exemplo, maximo de 60 requisicoes por minuto E maximo de 100.000 tokens por minuto.`,
        },
      ],
    },
  ],
}
