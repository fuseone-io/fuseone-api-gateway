import type { DocCategory } from "./types"

export const requestTracingCategory: DocCategory = {
  slug: "request-tracing",
  title: "Request Tracing",
  description: "Rastreamento distribuído de requests com visualização waterfall",
  icon: "Activity",
  articles: [
    {
      slug: "tracing-introducao",
      title: "Introdução ao Tracing",
      description: "O que é o request tracing e como ele funciona no FuseOne",
      icon: "Activity",
      tags: ["tracing", "opentelemetry", "observabilidade", "waterfall"],
      content: [
        {
          id: "o-que-e",
          title: "O que é Request Tracing?",
          body: `O Request Tracing (rastreamento de requests) permite visualizar o caminho completo de uma requisição HTTP através do API Gateway, incluindo:

- **Tempo em cada plugin**: Quanto tempo key-auth, rate-limiting, proxy-rewrite e outros plugins levaram
- **Tempo no upstream**: Quanto o serviço de backend demorou para responder
- **Tempo do gateway**: Overhead do processamento interno do gateway
- **Erros**: Em qual etapa ocorreu um erro

Isso é essencial para identificar gargalos de performance e diagnosticar problemas em produção.`,
        },
        {
          id: "como-funciona",
          title: "Como Funciona",
          body: `O FuseOne usa o **OpenTelemetry** integrado ao API Gateway para gerar spans (unidades de rastreamento) em cada etapa do processamento:

1. O API Gateway recebe um request
2. O plugin OpenTelemetry (habilitado automaticamente) cria spans para cada fase (access, rewrite, log) e cada plugin executado
3. Os spans são enviados em formato OTLP (protobuf) para o backend do FuseOne
4. O backend agrupa spans por trace_id e persiste no PostgreSQL
5. O frontend exibe os traces como waterfall interativo

**Amostragem**: A taxa de amostragem (sample_rate) controla quantos requests são rastreados. Em ambientes de alta carga, uma taxa de 10-50% é recomendada. Configure via variável de ambiente \`TRACING_SAMPLE_RATE\`.`,
        },
        {
          id: "habilitando",
          title: "Tracing Automático",
          body: `**O tracing é habilitado automaticamente para todas as rotas** — você não precisa adicionar nada ao flow das suas APIs.

Quando o FuseOne inicia, ele cria uma Global Rule do sistema com o plugin \`opentelemetry\` ativo. Isso garante que **toda requisição** que passa pelo gateway gera traces automaticamente, sem configuração manual.

**Como funciona internamente**:
- O FuseOne gerencia uma Global Rule com ID \`fuseone_platform\`
- Esta rule inclui: \`request-id\` (correlação), \`prometheus\` (métricas) e \`opentelemetry\` (tracing)
- A taxa de amostragem é aplicada globalmente via \`TRACING_SAMPLE_RATE\`

**Para desabilitar o tracing**:
- Defina a variável de ambiente \`TRACING_ENABLED=false\`
- Reinicie o backend — o plugin opentelemetry será removido da Global Rule automaticamente

**Para ajustar a amostragem**:
- Defina \`TRACING_SAMPLE_RATE=0.1\` para capturar 10% dos requests
- Reinicie o backend para aplicar a nova taxa`,
        },
      ],
    },
    {
      slug: "tracing-visualizacao",
      title: "Visualização Waterfall",
      description: "Como interpretar o waterfall de spans e diagnosticar problemas",
      icon: "BarChart3",
      tags: ["waterfall", "spans", "diagnóstico", "performance"],
      content: [
        {
          id: "waterfall",
          title: "Entendendo o Waterfall",
          body: `O waterfall mostra cada span como uma barra horizontal proporcional ao tempo total do request:

- **Barras azuis (Server)**: Processamento principal no gateway (access, rewrite, log phases)
- **Barras verdes (Client)**: Chamadas para o upstream/backend
- **Barras cinzas (Internal)**: Processamento interno de plugins
- **Barras vermelhas (Error)**: Spans que terminaram com erro

Cada barra mostra:
- Nome do span (ex: \`apisix.access.key-auth\`)
- Duração em milissegundos
- Porcentagem do tempo total`,
        },
        {
          id: "diagnostico",
          title: "Diagnosticando Problemas",
          body: `Use o waterfall para identificar:

**Upstream lento**: Se a barra do upstream ocupa >80% do tempo, o problema está no serviço de backend, não no gateway.

**Plugin lento**: Se um plugin específico (ex: forward-auth) está demorando, considere otimizar ou remover.

**Muitos plugins**: Se há muitos spans de plugins pequenos que juntos somam muito tempo, considere consolidar ou remover plugins desnecessários.

**Erros**: Spans vermelhos indicam onde o erro ocorreu. Clique no span para ver os atributos detalhados.`,
        },
      ],
    },
    {
      slug: "tracing-configuracao",
      title: "Configuração do Tracing",
      description: "Parâmetros de configuração, amostragem e retenção",
      icon: "Settings",
      tags: ["configuração", "sample-rate", "retenção", "postgresql"],
      content: [
        {
          id: "env-vars",
          title: "Variáveis de Ambiente",
          body: `O tracing é configurado via variáveis de ambiente no backend:

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| \`TRACING_ENABLED\` | \`true\` | Habilita/desabilita o tracing |
| \`TRACING_SAMPLE_RATE\` | \`1.0\` | Taxa de amostragem (0.0 a 1.0) |
| \`TRACING_RETENTION_DAYS\` | \`7\` | Dias de retenção dos traces |
| \`TRACING_BUFFER_SIZE\` | \`1000\` | Tamanho do buffer interno |
| \`TRACING_FLUSH_INTERVAL_SEC\` | \`5\` | Intervalo de flush em segundos |`,
        },
        {
          id: "retencao",
          title: "Retenção e Performance",
          body: `Os traces são armazenados no PostgreSQL com particionamento mensal. Um job de limpeza roda a cada hora e:

1. Remove traces mais antigos que \`retention_days\`
2. Cria automaticamente partitions para o mês corrente e próximo

**Recomendações por ambiente**:
- **Produção com alto tráfego** (>1000 req/s): sample_rate=0.1, retention_days=3
- **Produção com tráfego moderado** (<100 req/s): sample_rate=0.5, retention_days=7
- **Staging/QA**: sample_rate=1.0, retention_days=14
- **Desenvolvimento**: sample_rate=1.0, retention_days=30

**Estimativa de storage**: Cada trace ocupa ~2-5 KB no PostgreSQL (dependendo da quantidade de spans e atributos). Com 1000 req/s e sample_rate=0.1, isso gera ~100 traces/s = ~40 MB/hora = ~1 GB/dia.`,
        },
      ],
    },
    {
      slug: "tracing-troubleshooting",
      title: "Troubleshooting com Traces",
      description: "Cenários práticos de diagnóstico usando o request tracing",
      icon: "Search",
      tags: ["troubleshooting", "diagnóstico", "latência", "erros", "timeout"],
      content: [
        {
          id: "cenario-latencia",
          title: "Cenário: Latência Alta",
          body: `**Sintoma**: Requests demorando mais de 2 segundos.

**Como investigar**:
1. Vá em **Monitoring > Traces**
2. Filtre por **Duration > 2000ms**
3. Clique em um trace para abrir o waterfall
4. Identifique qual span ocupa a maior parte do tempo:

- **Upstream domina (>80%)**: O backend está lento. Verifique o serviço de destino, banco de dados, ou dependências externas.
- **Plugin domina**: Um plugin específico está causando overhead. Plugins como \`forward-auth\` fazem chamadas HTTP extras e podem adicionar latência significativa.
- **Gateway overhead alto**: Se o tempo fora dos spans de plugin/upstream é alto, pode indicar problemas de conectividade com o etcd ou sobrecarga do worker Nginx.

**Dica**: Use o filtro de duration para encontrar os requests mais lentos e compare o waterfall de um request lento com um rápido da mesma rota.`,
        },
        {
          id: "cenario-erros",
          title: "Cenário: Erros 5xx Intermitentes",
          body: `**Sintoma**: Alguns requests retornam 502/503/504 esporadicamente.

**Como investigar**:
1. Filtre por **Status: Errors (5xx)**
2. Abra vários traces com erro
3. No waterfall, procure spans vermelhos (error)

**Padrões comuns**:
- **502 Bad Gateway**: O span do upstream mostra erro — o backend retornou resposta inválida ou a conexão foi recusada. Verifique se o upstream está saudável.
- **503 Service Unavailable**: O circuit breaker (\`api-breaker\` plugin) pode ter aberto. Verifique o span do plugin.
- **504 Gateway Timeout**: O span do upstream mostra duração igual ao timeout configurado. O backend demorou demais. Aumente o timeout ou otimize o backend.

**Dica**: Compare o trace com erro com um trace bem-sucedido da mesma rota para identificar a diferença.`,
        },
        {
          id: "cenario-auth",
          title: "Cenário: Falhas de Autenticação",
          body: `**Sintoma**: Requests retornando 401/403 inesperadamente.

**Como investigar**:
1. Filtre por **Status: 4xx**
2. Abra o trace e procure o span do plugin de autenticação
3. Verifique os atributos do span para detalhes do erro

**Plugins de auth e seus spans**:
- \`apisix.access.key-auth\`: Verifica header \`apikey\`. Atributo \`error\` mostra se a key não foi encontrada.
- \`apisix.access.jwt-auth\`: Valida JWT. Atributo pode mostrar "token expired" ou "invalid signature".
- \`apisix.access.basic-auth\`: HTTP Basic. Atributo mostra se usuário/senha não conferem.
- \`apisix.access.forward-auth\`: Chamada HTTP externa. O span mostra a duração e status da chamada ao serviço de auth.

**Dica**: Se o \`forward-auth\` está retornando 401, verifique também o trace do serviço de auth (se ele também tiver tracing habilitado).`,
        },
        {
          id: "cenario-rate-limit",
          title: "Cenário: Rate Limiting Inesperado",
          body: `**Sintoma**: Requests retornando 429 Too Many Requests quando não deveria.

**Como investigar**:
1. Filtre por **Status: 4xx** e procure traces com status 429
2. Abra o trace e localize o span \`apisix.access.limit-count\` ou \`apisix.access.limit-req\`
3. Os atributos do span mostram:
   - \`limit\`: Limite configurado
   - \`remaining\`: Requests restantes na janela
   - \`window\`: Janela de tempo

**Causas comuns**:
- Limite muito baixo para o tráfego real
- Janela de tempo muito curta
- Consumer ID incorreto (todos os requests caindo no mesmo bucket)
- Redis/etcd de contagem com problemas de sincronização

**Dica**: Compare o trace com 429 com requests normais para verificar se o consumer_id está sendo identificado corretamente.`,
        },
      ],
    },
  ],
}
