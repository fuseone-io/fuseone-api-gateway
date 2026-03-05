import type { DocCategory } from "./types"

export const requestTracingCategory: DocCategory = {
  slug: "request-tracing",
  title: "Request Tracing",
  description: "Rastreamento distribuido de requests com visualizacao waterfall",
  icon: "Activity",
  articles: [
    {
      slug: "tracing-introducao",
      title: "Introducao ao Tracing",
      description: "O que e o request tracing e como ele funciona no FuseOne",
      icon: "Activity",
      tags: ["tracing", "opentelemetry", "observabilidade", "waterfall"],
      content: [
        {
          id: "o-que-e",
          title: "O que e Request Tracing?",
          body: `O Request Tracing (rastreamento de requests) permite visualizar o caminho completo de uma requisicao HTTP atraves do API Gateway, incluindo:

- **Tempo em cada plugin**: Quanto tempo key-auth, rate-limiting, proxy-rewrite e outros plugins levaram
- **Tempo no upstream**: Quanto o servico de backend demorou para responder
- **Tempo do gateway**: Overhead do processamento interno do gateway
- **Erros**: Em qual etapa ocorreu um erro

Isso e essencial para identificar gargalos de performance e diagnosticar problemas em producao.`,
        },
        {
          id: "como-funciona",
          title: "Como Funciona",
          body: `O FuseOne usa o **OpenTelemetry** integrado ao API Gateway para gerar spans (unidades de rastreamento) em cada etapa do processamento:

1. O API Gateway recebe um request
2. O plugin OpenTelemetry (habilitado automaticamente) cria spans para cada fase (access, rewrite, log) e cada plugin executado
3. Os spans sao enviados em formato OTLP (protobuf) para o backend do FuseOne
4. O backend agrupa spans por trace_id e persiste no PostgreSQL
5. O frontend exibe os traces como waterfall interativo

**Amostragem**: A taxa de amostragem (sample_rate) controla quantos requests sao tracados. Em ambientes de alta carga, uma taxa de 10-50% e recomendada. Configure via variavel de ambiente \`TRACING_SAMPLE_RATE\`.`,
        },
        {
          id: "habilitando",
          title: "Tracing Automatico",
          body: `**O tracing e habilitado automaticamente para todas as rotas** — voce nao precisa adicionar nada ao flow das suas APIs.

Quando o FuseOne inicia, ele cria uma Global Rule do sistema com o plugin \`opentelemetry\` ativo. Isso garante que **toda requisicao** que passa pelo gateway gera traces automaticamente, sem configuracao manual.

**Como funciona internamente**:
- O FuseOne gerencia uma Global Rule com ID \`fuseone_platform\`
- Esta rule inclui: \`request-id\` (correlacao), \`prometheus\` (metricas) e \`opentelemetry\` (tracing)
- A taxa de amostragem e aplicada globalmente via \`TRACING_SAMPLE_RATE\`

**Para desabilitar o tracing**:
- Defina a variavel de ambiente \`TRACING_ENABLED=false\`
- Reinicie o backend — o plugin opentelemetry sera removido da Global Rule automaticamente

**Para ajustar a amostragem**:
- Defina \`TRACING_SAMPLE_RATE=0.1\` para capturar 10% dos requests
- Reinicie o backend para aplicar a nova taxa`,
        },
      ],
    },
    {
      slug: "tracing-visualizacao",
      title: "Visualizacao Waterfall",
      description: "Como interpretar o waterfall de spans e diagnosticar problemas",
      icon: "BarChart3",
      tags: ["waterfall", "spans", "diagnostico", "performance"],
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
- Duracao em milissegundos
- Porcentagem do tempo total`,
        },
        {
          id: "diagnostico",
          title: "Diagnosticando Problemas",
          body: `Use o waterfall para identificar:

**Upstream lento**: Se a barra do upstream ocupa >80% do tempo, o problema esta no servico de backend, nao no gateway.

**Plugin lento**: Se um plugin especifico (ex: forward-auth) esta demorando, considere otimizar ou remover.

**Muitos plugins**: Se ha muitos spans de plugins pequenos que juntos somam muito tempo, considere consolidar ou remover plugins desnecessarios.

**Erros**: Spans vermelhos indicam onde o erro ocorreu. Clique no span para ver os atributos detalhados.`,
        },
      ],
    },
    {
      slug: "tracing-configuracao",
      title: "Configuracao do Tracing",
      description: "Parametros de configuracao, amostragem e retencao",
      icon: "Settings",
      tags: ["configuracao", "sample-rate", "retencao", "postgresql"],
      content: [
        {
          id: "env-vars",
          title: "Variaveis de Ambiente",
          body: `O tracing e configurado via variaveis de ambiente no backend:

| Variavel | Padrao | Descricao |
|----------|--------|-----------|
| \`TRACING_ENABLED\` | \`true\` | Habilita/desabilita o tracing |
| \`TRACING_SAMPLE_RATE\` | \`1.0\` | Taxa de amostragem (0.0 a 1.0) |
| \`TRACING_RETENTION_DAYS\` | \`7\` | Dias de retencao dos traces |
| \`TRACING_BUFFER_SIZE\` | \`1000\` | Tamanho do buffer interno |
| \`TRACING_FLUSH_INTERVAL_SEC\` | \`5\` | Intervalo de flush em segundos |`,
        },
        {
          id: "retencao",
          title: "Retencao e Performance",
          body: `Os traces sao armazenados no PostgreSQL com particionamento mensal. Um job de limpeza roda a cada hora e:

1. Remove traces mais antigos que \`retention_days\`
2. Cria automaticamente partitions para o mes corrente e proximo

**Recomendacoes por ambiente**:
- **Producao com alto trafego** (>1000 req/s): sample_rate=0.1, retention_days=3
- **Producao com trafego moderado** (<100 req/s): sample_rate=0.5, retention_days=7
- **Staging/QA**: sample_rate=1.0, retention_days=14
- **Desenvolvimento**: sample_rate=1.0, retention_days=30

**Estimativa de storage**: Cada trace ocupa ~2-5 KB no PostgreSQL (dependendo da quantidade de spans e atributos). Com 1000 req/s e sample_rate=0.1, isso gera ~100 traces/s = ~40 MB/hora = ~1 GB/dia.`,
        },
      ],
    },
    {
      slug: "tracing-troubleshooting",
      title: "Troubleshooting com Traces",
      description: "Cenarios praticos de diagnostico usando o request tracing",
      icon: "Search",
      tags: ["troubleshooting", "diagnostico", "latencia", "erros", "timeout"],
      content: [
        {
          id: "cenario-latencia",
          title: "Cenario: Latencia Alta",
          body: `**Sintoma**: Requests demorando mais de 2 segundos.

**Como investigar**:
1. Va em **Monitoring > Traces**
2. Filtre por **Duration > 2000ms**
3. Clique em um trace para abrir o waterfall
4. Identifique qual span ocupa a maior parte do tempo:

- **Upstream domina (>80%)**: O backend esta lento. Verifique o servico de destino, banco de dados, ou dependencias externas.
- **Plugin domina**: Um plugin especifico esta causando overhead. Plugins como \`forward-auth\` fazem chamadas HTTP extras e podem adicionar latencia significativa.
- **Gateway overhead alto**: Se o tempo fora dos spans de plugin/upstream e alto, pode indicar problemas de conectividade com o etcd ou sobrecarga do worker Nginx.

**Dica**: Use o filtro de duration para encontrar os requests mais lentos e compare o waterfall de um request lento com um rapido da mesma rota.`,
        },
        {
          id: "cenario-erros",
          title: "Cenario: Erros 5xx Intermitentes",
          body: `**Sintoma**: Alguns requests retornam 502/503/504 esporadicamente.

**Como investigar**:
1. Filtre por **Status: Errors (5xx)**
2. Abra varios traces com erro
3. No waterfall, procure spans vermelhos (error)

**Padroes comuns**:
- **502 Bad Gateway**: O span do upstream mostra erro — o backend retornou resposta invalida ou a conexao foi recusada. Verifique se o upstream esta saudavel.
- **503 Service Unavailable**: O circuit breaker (\`api-breaker\` plugin) pode ter aberto. Verifique o span do plugin.
- **504 Gateway Timeout**: O span do upstream mostra duracao igual ao timeout configurado. O backend demorou demais. Aumente o timeout ou otimize o backend.

**Dica**: Compare o trace com erro com um trace bem-sucedido da mesma rota para identificar a diferenca.`,
        },
        {
          id: "cenario-auth",
          title: "Cenario: Falhas de Autenticacao",
          body: `**Sintoma**: Requests retornando 401/403 inesperadamente.

**Como investigar**:
1. Filtre por **Status: 4xx**
2. Abra o trace e procure o span do plugin de autenticacao
3. Verifique os atributos do span para detalhes do erro

**Plugins de auth e seus spans**:
- \`apisix.access.key-auth\`: Verifica header \`apikey\`. Atributo \`error\` mostra se a key nao foi encontrada.
- \`apisix.access.jwt-auth\`: Valida JWT. Atributo pode mostrar "token expired" ou "invalid signature".
- \`apisix.access.basic-auth\`: HTTP Basic. Atributo mostra se usuario/senha nao conferem.
- \`apisix.access.forward-auth\`: Chamada HTTP externa. O span mostra a duracao e status da chamada ao servico de auth.

**Dica**: Se o \`forward-auth\` esta retornando 401, verifique tambem o trace do servico de auth (se ele tambem tiver tracing habilitado).`,
        },
        {
          id: "cenario-rate-limit",
          title: "Cenario: Rate Limiting Inesperado",
          body: `**Sintoma**: Requests retornando 429 Too Many Requests quando nao deveria.

**Como investigar**:
1. Filtre por **Status: 4xx** e procure traces com status 429
2. Abra o trace e localize o span \`apisix.access.limit-count\` ou \`apisix.access.limit-req\`
3. Os atributos do span mostram:
   - \`limit\`: Limite configurado
   - \`remaining\`: Requests restantes na janela
   - \`window\`: Janela de tempo

**Causas comuns**:
- Limite muito baixo para o trafego real
- Janela de tempo muito curta
- Consumer ID incorreto (todos os requests caindo no mesmo bucket)
- Redis/etcd de contagem com problemas de sincronizacao

**Dica**: Compare o trace com 429 com requests normais para verificar se o consumer_id esta sendo identificado corretamente.`,
        },
      ],
    },
  ],
}
