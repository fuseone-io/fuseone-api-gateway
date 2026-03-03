import type { DocCategory } from "./types"

export const monitoramentoCategory: DocCategory = {
  slug: "monitoramento-alertas",
  title: "Monitoramento e Alertas",
  description:
    "Acompanhe metricas em tempo real, configure debug logging e receba alertas sobre anomalias no seu API Gateway.",
  icon: "Activity",
  articles: [
    // ── 1. Dashboard de Metricas ────────────────────────────────────────
    {
      slug: "dashboard-metricas",
      title: "Dashboard de Metricas",
      description:
        "Visao geral do dashboard de monitoramento, metricas disponveis, filtros e detalhamento por rota e consumidor.",
      icon: "BarChart3",
      tags: ["metricas", "dashboard", "latencia"],
      content: [
        {
          id: "visao-geral-dashboard",
          title: "Visao Geral",
          body: `O dashboard de monitoramento do FuseOne fornece visibilidade completa sobre o trafego que passa pelo API Gateway. Ele coleta metricas automaticamente de todas as rotas configuradas, sem necessidade de instrumentacao adicional.

Acesse o dashboard pelo menu **Monitoramento** na barra lateral. A pagina principal exibe cards com as metricas mais importantes:

- **Requisicoes/s** — Taxa de requisicoes por segundo no periodo selecionado
- **Latencia p50 / p99** — Percentis de latencia (metade das requisicoes e abaixo do p50; 99% abaixo do p99)
- **Taxa de erro** — Percentual de respostas com codigo HTTP 4xx e 5xx
- **Bandwidth** — Volume de dados trafegados (entrada + saida) em bytes

Abaixo dos cards, graficos de serie temporal mostram a evolucao dessas metricas ao longo do tempo, permitindo identificar tendencias e anomalias rapidamente.

> **Nota:** As metricas sao coletadas a cada 15 segundos e ficam disponiveis com atraso maximo de 30 segundos. Dados historicos sao retidos por 90 dias por padrao.`,
        },
        {
          id: "filtros-periodo",
          title: "Filtros e Periodo",
          body: `O dashboard permite filtrar os dados em diversas dimensoes para focar na informacao relevante:

### Filtros de Periodo
Selecione o intervalo de tempo usando os botoes rapidos ou um intervalo customizado:

- **Ultima hora** — Resolucao de 15 segundos por ponto
- **Ultimas 24h** — Resolucao de 5 minutos por ponto
- **Ultimos 7 dias** — Resolucao de 1 hora por ponto
- **Ultimos 30 dias** — Resolucao de 6 horas por ponto
- **Customizado** — Selecione data/hora de inicio e fim

### Filtros por Dimensao
- **Rota** — Filtre por uma rota especifica (ou grupo de rotas)
- **Consumidor** — Visualize metricas de um consumer autenticado
- **Status code** — Isole requisicoes por faixa de status (2xx, 4xx, 5xx)
- **Upstream** — Filtre por servidor de destino

> **Dica:** Voce pode combinar multiplos filtros simultaneamente. Por exemplo, visualize apenas requisicoes 5xx da rota \`/api/pagamentos\` nas ultimas 24 horas para investigar um problema especifico.`,
        },
        {
          id: "detalhamento-rota",
          title: "Detalhamento por Rota",
          body: `Clicando em uma rota especifica no dashboard, voce acessa a pagina de detalhamento com metricas granulares daquela rota:

- **Distribuicao de status codes** — Grafico de pizza mostrando a proporcao de 2xx, 3xx, 4xx e 5xx
- **Histograma de latencia** — Distribuicao das latencias para identificar outliers
- **Top consumers** — Ranking dos consumidores que mais utilizam esta rota
- **Upstream response time** — Tempo de resposta do servidor de destino (separado da latencia do gateway)
- **Bandwidth por direcao** — Bytes de entrada (request) e saida (response) separadamente

A pagina de detalhamento tambem exibe o **log de requisicoes recentes** (ultimas 100) com informacoes resumidas: timestamp, consumer, status code, latencia e tamanho da resposta.

> **Nota:** O log de requisicoes recentes nao inclui o corpo da requisicao/resposta por padrao. Para capturar corpos completos, utilize o recurso de Debug Logging descrito no proximo artigo.

Essas metricas granulares sao essenciais para diagnosticar problemas de performance, identificar rotas sobrecarregadas e planejar capacidade.`,
        },
        {
          id: "detalhamento-consumer",
          title: "Detalhamento por Consumidor",
          body: `O detalhamento por consumidor permite analisar o comportamento de uso de cada cliente ou aplicacao que se autentica no API Gateway.

Na pagina do consumidor voce encontra:

- **Volume de requisicoes** — Total e taxa por segundo ao longo do tempo
- **Top rotas** — Quais rotas o consumidor mais utiliza
- **Taxa de erro** — Se o consumidor esta gerando muitos erros (pode indicar integracao incorreta)
- **Consumo de rate limit** — Quanto da cota alocada o consumidor esta utilizando
- **Tokens de IA** — Se o consumidor utiliza rotas de IA, exibe o consumo de tokens

Essas informacoes sao valiosas para:

- **Suporte tecnico** — Diagnosticar problemas reportados por um cliente especifico
- **Planejamento de capacidade** — Identificar clientes com crescimento acelerado de uso
- **Billing** — Gerar relatorios de uso para cobranca por consumo
- **Seguranca** — Detectar padroes de uso anomalos que podem indicar abuso

> **Dica:** Configure alertas por consumidor para ser notificado quando um cliente ultrapassar thresholds de uso predefinidos, permitindo acao proativa antes que problemas ocorram.`,
        },
      ],
    },

    // ── 2. Debug Logging ────────────────────────────────────────────────
    {
      slug: "debug-logging",
      title: "Debug Logging",
      description:
        "Capture requisicoes e respostas completas para depuracao, com filtros por rota e codigo de status.",
      icon: "Bug",
      tags: ["debug", "logging", "troubleshooting"],
      content: [
        {
          id: "o-que-e-debug-log",
          title: "O que e o Debug Logging",
          body: `O Debug Logging e um recurso que permite capturar o conteudo completo de requisicoes e respostas que passam pelo API Gateway. Diferente do log padrao (que registra apenas metadados como status code e latencia), o debug log captura headers, query parameters e bodies completos.

Este recurso e projetado para uso temporario durante investigacao de problemas. Ele nao deve ficar habilitado permanentemente em producao, pois:

- **Aumenta o uso de disco** — Corpos de requisicao e resposta podem ser grandes
- **Impacta performance** — A captura adiciona latencia marginal ao processamento
- **Riscos de privacidade** — Corpos podem conter dados sensiveis (tokens, senhas, PII)

> **Atencao:** Sempre defina um tempo limite ao habilitar debug logging. O FuseOne desabilita automaticamente a captura apos o periodo configurado para evitar que ela fique ativa inadvertidamente.`,
        },
        {
          id: "habilitando-debug",
          title: "Habilitando o Debug Log",
          body: `Para habilitar o debug logging em uma rota, acesse **APIs > [sua rota] > Debug** e clique em **Iniciar Captura**. Configure os seguintes parametros:

- **Duracao** — Tempo maximo de captura: 5 min, 15 min, 30 min, 1 hora ou customizado (maximo 4 horas)
- **Limite de registros** — Numero maximo de requisicoes a capturar (padrao: 100)
- **Filtro de status** — Capturar apenas requisicoes com determinados status codes (ex: somente 5xx)
- **Capturar request body** — Habilita a captura do corpo da requisicao
- **Capturar response body** — Habilita a captura do corpo da resposta
- **Tamanho maximo do body** — Limite em KB para truncar corpos grandes (padrao: 64 KB)

Apos configurar, clique em **Iniciar**. O botao mudara para um indicador pulsante indicando que a captura esta ativa.

\`\`\`
Status: Capturando (12/100 registros | 4:32 restantes)
\`\`\`

> **Dica:** Se voce sabe que o problema ocorre apenas em requisicoes com erro, use o filtro de status \`4xx,5xx\` para evitar capturar requisicoes bem-sucedidas e economizar espaco.`,
        },
        {
          id: "analisando-logs",
          title: "Analisando os Logs Capturados",
          body: `Apos a captura, os registros ficam disponiveis na aba **Debug** da rota. Cada registro exibe:

- **Timestamp** — Data e hora exata da requisicao
- **Consumer** — Identidade do consumidor (se autenticado)
- **Metodo e URI** — Ex: \`GET /api/v1/produtos?page=2\`
- **Status code** — Codigo de resposta HTTP
- **Latencia** — Tempo total de processamento
- **Request headers** — Todos os headers da requisicao
- **Response headers** — Todos os headers da resposta
- **Request body** — Corpo da requisicao (se capturado)
- **Response body** — Corpo da resposta (se capturado)

Voce pode filtrar e buscar dentro dos registros capturados por qualquer campo. Clicando em um registro, ele expande mostrando os detalhes completos em um formato legivel com syntax highlighting para JSON e XML.

> **Nota:** Os registros de debug sao armazenados temporariamente e removidos automaticamente apos 24 horas. Se precisar preserva-los, exporte para JSON antes que expirem.

A funcionalidade de debug logging e especialmente util para diagnosticar:

- Erros de transformacao de request/response
- Problemas de autenticacao (headers incorretos)
- Divergencias entre o que o cliente envia e o que o upstream recebe`,
        },
        {
          id: "privacidade-seguranca",
          title: "Privacidade e Seguranca",
          body: `O debug logging captura dados potencialmente sensiveis. O FuseOne inclui mecanismos para minimizar riscos de exposicao:

### Mascaramento Automatico
Os seguintes campos sao automaticamente mascarados nos logs:

- **Authorization header** — Exibe apenas o tipo (Bearer, Basic) e os ultimos 4 caracteres
- **API Keys** — Exibe apenas os ultimos 4 caracteres
- **Cookies** — Nomes sao preservados, valores sao mascarados

### Mascaramento Customizado
Voce pode configurar regras adicionais de mascaramento em **Configuracoes > Seguranca > Mascaramento de Logs**:

- Mascarar campos especificos no body (ex: \`password\`, \`cpf\`, \`credit_card\`)
- Mascarar headers customizados
- Aplicar regex para detectar e mascarar padroes (ex: numeros de cartao de credito)

### Controle de Acesso
O acesso aos debug logs e restrito por permissao RBAC. Apenas usuarios com a permissao \`debug_logs:read\` podem visualizar os registros capturados. A acao de iniciar captura requer \`debug_logs:write\`.

> **Atencao:** Mesmo com mascaramento, evite capturar debug logs de rotas que processam dados altamente sensiveis (ex: endpoints de pagamento) em ambientes de producao, a menos que estritamente necessario.`,
        },
      ],
    },

    // ── 3. Sistema de Alertas ───────────────────────────────────────────
    {
      slug: "sistema-alertas",
      title: "Sistema de Alertas",
      description:
        "Crie regras de alerta para taxa de erro, latencia, queda de trafego e orcamento de IA.",
      icon: "Bell",
      tags: ["alertas", "notificacoes", "monitoramento"],
      content: [
        {
          id: "criando-alertas",
          title: "Criando Regras de Alerta",
          body: `O sistema de alertas do FuseOne permite monitorar metricas continuamente e notificar sua equipe quando thresholds sao ultrapassados. Acesse **Monitoramento > Alertas** para gerenciar suas regras.

Para criar uma nova regra de alerta, clique em **Novo Alerta** e configure:

- **Nome** — Nome descritivo para o alerta (ex: "Taxa de erro alta - API Pagamentos")
- **Metrica** — A metrica a ser monitorada:
  - *Taxa de erro* — Percentual de requisicoes com erro (4xx/5xx)
  - *Latencia p99* — Percentil 99 de latencia
  - *Queda de trafego* — Reducao percentual no volume de requisicoes
  - *Token budget* — Consumo de tokens de IA atingiu percentual do orcamento
  - *Cost budget* — Custo de IA atingiu percentual do orcamento
- **Operador e valor** — Condicao de disparo (ex: "maior que 5%", "acima de 500ms")
- **Escopo** — Global, por rota especifica ou por consumidor

> **Nota:** Cada regra de alerta e avaliada independentemente. Voce pode ter multiplas regras para a mesma metrica com thresholds diferentes (ex: warning em 2% de erro, critical em 5%).`,
        },
        {
          id: "janela-avaliacao",
          title: "Janela de Avaliacao",
          body: `A janela de avaliacao determina o periodo de tempo sobre o qual a metrica e calculada antes de decidir se o alerta deve disparar. Configurar corretamente a janela e essencial para evitar falsos positivos.

Opcoes de janela disponiveis:

- **1 minuto** — Alta sensibilidade, pode gerar alertas por picos momentaneos
- **5 minutos** — Bom equilibrio entre velocidade e estabilidade (recomendado para a maioria dos casos)
- **15 minutos** — Menos sensivel, ideal para metricas com variacao natural alta
- **1 hora** — Para tendencias de longo prazo (ex: queda gradual de trafego)

Alem da janela, voce pode configurar a **contagem de violacoes** necessaria para disparar o alerta. Por exemplo: "disparar se a metrica violar o threshold em 3 de 5 janelas consecutivas".

\`\`\`
Janela: 5 minutos
Threshold: Taxa de erro > 5%
Violacoes: 3 de 5
\`\`\`

Neste exemplo, o alerta so dispara se a taxa de erro exceder 5% em pelo menos 3 das ultimas 5 janelas de 5 minutos. Isso reduz significativamente os falsos positivos causados por picos momentaneos.

> **Dica:** Comece com janelas de 5 minutos e violacoes de 2/3. Ajuste com base na experiencia — se receber muitos falsos positivos, aumente a janela ou as violacoes necessarias.`,
        },
        {
          id: "canais-notificacao",
          title: "Canais de Notificacao",
          body: `Quando um alerta dispara, notificacoes sao enviadas pelos canais configurados. O FuseOne suporta os seguintes canais:

### Email
Configure enderecos de email para receber notificacoes. Multiplos destinatarios podem ser adicionados separados por virgula.

### Slack Webhook
Integre com o Slack para receber notificacoes em um canal especifico. Configure a URL do webhook do Slack e opcionalmente customize o template da mensagem.

### Webhook Generico
Envie notificacoes para qualquer endpoint HTTP. O FuseOne envia um POST com payload JSON contendo detalhes do alerta:

\`\`\`json
{
  "alert_name": "Taxa de erro alta",
  "status": "firing",
  "metric": "error_rate",
  "value": 7.2,
  "threshold": 5.0,
  "scope": "route:/api/pagamentos",
  "fired_at": "2025-01-15T14:30:00Z"
}
\`\`\`

Gerencie canais de notificacao em **Configuracoes > Notificacoes**. Cada canal pode ser associado a um ou mais alertas, e cada alerta pode enviar para multiplos canais.

> **Dica:** Configure pelo menos dois canais para alertas criticos (ex: Slack para visibilidade imediata da equipe + email para registro formal). Isso garante que ninguem perca uma notificacao importante.`,
        },
        {
          id: "estados-historico",
          title: "Estados e Historico",
          body: `Cada alerta possui um estado que indica sua situacao atual:

- **OK** — A metrica esta dentro dos limites configurados. Este e o estado normal.
- **Firing** — O threshold foi violado e o alerta esta ativo. Notificacoes foram enviadas.
- **Acknowledged** — Um membro da equipe reconheceu o alerta. Novas notificacoes nao sao enviadas ate que o estado mude.
- **Silenced** — O alerta foi temporariamente silenciado (util durante manutencoes planejadas).

O fluxo tipico de um alerta e:

1. Alerta em **OK** — metricas normais
2. Threshold violado — estado muda para **Firing**, notificacoes sao enviadas
3. Equipe reconhece — estado muda para **Acknowledged** (via dashboard ou link na notificacao)
4. Problema resolvido — metrica volta ao normal, estado retorna para **OK**

O historico completo de transicoes de estado e mantido para cada alerta, incluindo:

- Data/hora de cada mudanca de estado
- Valor da metrica no momento do disparo
- Quem reconheceu o alerta (usuario)
- Duracao de cada incidente (tempo entre firing e ok)

> **Nota:** O historico de alertas e retido por 180 dias. Utilize os dados historicos para identificar padroes recorrentes e ajustar thresholds proativamente.`,
        },
      ],
    },

    // ── 4. Saude dos Upstreams ──────────────────────────────────────────
    {
      slug: "upstream-health",
      title: "Saude dos Upstreams",
      description:
        "Monitore a saude dos seus servidores de destino com health checks ativos e passivos.",
      icon: "HeartPulse",
      tags: ["upstream", "health-check", "disponibilidade"],
      content: [
        {
          id: "como-funciona-health",
          title: "Como Funcionam os Health Checks",
          body: `Os health checks garantem que o API Gateway envie requisicoes apenas para servidores de destino (upstreams) que estejam saudaveis. Quando um upstream e detectado como indisponivel, ele e automaticamente removido do pool de balanceamento, e o trafego e redistribuido para os upstreams restantes.

O API Gateway suporta dois tipos de health check:

### Health Check Ativo
O gateway envia requisicoes periodicas de verificacao (probes) para cada upstream. Se o upstream nao responder ou retornar erro, e marcado como "unhealthy". Esse metodo detecta problemas proativamente, antes que requisicoes reais sejam afetadas.

### Health Check Passivo
O gateway monitora as respostas das requisicoes reais. Se um upstream retornar muitos erros consecutivos (ex: 5 erros 5xx seguidos), e marcado como "unhealthy". Esse metodo nao gera trafego adicional, mas so detecta problemas quando requisicoes reais falham.

> **Dica:** Para a melhor protecao, combine ambos os tipos: health check ativo para deteccao proativa e passivo como camada adicional de seguranca.`,
        },
        {
          id: "dashboard-saude",
          title: "Dashboard de Saude",
          body: `O dashboard de saude dos upstreams fornece uma visao consolidada do estado de todos os servidores de destino. Acesse via **Monitoramento > Upstreams**.

A pagina exibe uma tabela com todos os upstreams configurados e suas informacoes:

- **Nome/ID** — Identificador do upstream
- **Nodes** — Lista de servidores (IP:porta) no pool
- **Status** — Indicador visual por node: verde (healthy), vermelho (unhealthy), cinza (sem check)
- **Uptime** — Percentual de tempo em que o node esteve saudavel nas ultimas 24 horas
- **Ultimo check** — Timestamp da ultima verificacao de saude
- **Latencia** — Tempo de resposta do health check ativo (se configurado)

Clicando em um upstream, voce acessa o detalhamento com:

- **Historico de status** — Timeline mostrando transicoes entre healthy e unhealthy
- **Metricas do health check** — Latencia das probes ao longo do tempo
- **Logs de transicao** — Registros de quando cada node mudou de estado e o motivo

> **Nota:** Upstreams sem health check configurado aparecem com status cinza (desconhecido). Recomendamos configurar health checks para todos os upstreams em producao.`,
        },
        {
          id: "configurando-health-ativo",
          title: "Configurando Health Check Ativo",
          body: `O health check ativo e configurado no upstream. Acesse **APIs > Upstreams > [upstream] > Health Check** para configurar:

### Parametros Principais
- **Tipo** — HTTP ou HTTPS (para verificar endpoints HTTPS)
- **Path** — Caminho do endpoint de verificacao (ex: \`/health\`, \`/ping\`)
- **Host** — Header Host a enviar na probe (opcional)
- **Intervalo** — Tempo entre verificacoes em segundos (padrao: 10s)
- **Timeout** — Tempo maximo de espera pela resposta (padrao: 3s)

### Criterios de Saude
- **Healthy — Status codes** — Codigos que indicam saude (padrao: 200)
- **Healthy — Successes** — Numero de verificacoes consecutivas bem-sucedidas para marcar como healthy (padrao: 2)
- **Unhealthy — Status codes** — Codigos que indicam falha (padrao: 500, 502, 503)
- **Unhealthy — Failures** — Numero de verificacoes consecutivas falhadas para marcar como unhealthy (padrao: 3)
- **Unhealthy — Timeouts** — Numero de timeouts consecutivos para marcar como unhealthy (padrao: 3)

> **Atencao:** Certifique-se de que o endpoint de health check da sua aplicacao e leve e rapido. Evite endpoints que facam queries ao banco de dados ou chamadas a servicos externos, pois isso pode causar falsos negativos.`,
        },
        {
          id: "configurando-health-passivo",
          title: "Configurando Health Check Passivo",
          body: `O health check passivo monitora as respostas das requisicoes reais para detectar upstreams com problema. Ele nao gera trafego adicional, pois analisa o trafego ja existente.

### Parametros de Configuracao
- **Healthy — Status codes** — Codigos de resposta que contam como sucesso (padrao: 200-299)
- **Healthy — Successes** — Numero de respostas bem-sucedidas consecutivas para restaurar um node marcado como unhealthy (padrao: 5)
- **Unhealthy — Status codes** — Codigos que contam como falha (padrao: 500, 502, 503, 504)
- **Unhealthy — Failures** — Numero de falhas consecutivas para marcar como unhealthy (padrao: 5)
- **Unhealthy — Timeouts** — Numero de timeouts consecutivos para marcar como unhealthy (padrao: 7)

Quando um node e marcado como unhealthy pelo check passivo, ele e removido do pool de balanceamento. Para ser restaurado, ele precisa receber requisicoes bem-sucedidas — mas como esta fora do pool, isso so acontece se:

1. O health check **ativo** estiver configurado e detectar que o node voltou
2. O administrador restaurar manualmente o node via dashboard

> **Dica:** Por essa razao, recomendamos sempre combinar health check passivo com ativo. O passivo detecta problemas rapidamente (nas requisicoes reais), e o ativo garante a recuperacao automatica quando o node volta a funcionar.

A combinacao de ambos os tipos oferece a melhor protecao: deteccao rapida de falhas e recuperacao automatica de nodes restaurados.`,
        },
      ],
    },
  ],
}
