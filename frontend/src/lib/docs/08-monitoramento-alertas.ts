import type { DocCategory } from "./types"

export const monitoramentoCategory: DocCategory = {
  slug: "monitoramento-alertas",
  title: "Monitoramento e Alertas",
  description:
    "Acompanhe métricas em tempo real, configure debug logging e receba alertas sobre anomalias no seu API Gateway.",
  icon: "Activity",
  articles: [
    // ── 1. Dashboard de Métricas ────────────────────────────────────────
    {
      slug: "dashboard-metricas",
      title: "Dashboard de Métricas",
      description:
        "Visão geral do dashboard de monitoramento, métricas disponíveis, filtros e detalhamento por rota e consumidor.",
      icon: "BarChart3",
      tags: ["métricas", "dashboard", "latência"],
      content: [
        {
          id: "visao-geral-dashboard",
          title: "Visão Geral",
          body: `O dashboard de monitoramento do FuseOne fornece visibilidade completa sobre o tráfego que passa pelo API Gateway. Ele coleta métricas automaticamente de todas as rotas configuradas, sem necessidade de instrumentação adicional.

Acesse o dashboard pelo menu **Monitoramento** na barra lateral. A página principal exibe cards com as métricas mais importantes:

- **Requisições/s** — Taxa de requisições por segundo no período selecionado
- **Latência p50 / p99** — Percentis de latência (metade das requisições é abaixo do p50; 99% abaixo do p99)
- **Taxa de erro** — Percentual de respostas com código HTTP 4xx e 5xx
- **Bandwidth** — Volume de dados trafegados (entrada + saída) em bytes

Abaixo dos cards, gráficos de série temporal mostram a evolução dessas métricas ao longo do tempo, permitindo identificar tendências e anomalias rapidamente.

> **Nota:** As métricas são coletadas a cada 15 segundos e ficam disponíveis com atraso máximo de 30 segundos. Dados históricos são retidos por 90 dias por padrão.`,
        },
        {
          id: "filtros-periodo",
          title: "Filtros e Período",
          body: `O dashboard permite filtrar os dados em diversas dimensões para focar na informação relevante:

### Filtros de Período
Selecione o intervalo de tempo usando os botões rápidos ou um intervalo customizado:

- **Última hora** — Resolução de 15 segundos por ponto
- **Últimas 24h** — Resolução de 5 minutos por ponto
- **Últimos 7 dias** — Resolução de 1 hora por ponto
- **Últimos 30 dias** — Resolução de 6 horas por ponto
- **Customizado** — Selecione data/hora de início e fim

### Filtros por Dimensão
- **Rota** — Filtre por uma rota específica (ou grupo de rotas)
- **Consumidor** — Visualize métricas de um consumer autenticado
- **Status code** — Isole requisições por faixa de status (2xx, 4xx, 5xx)
- **Upstream** — Filtre por servidor de destino

> **Dica:** Você pode combinar múltiplos filtros simultaneamente. Por exemplo, visualize apenas requisições 5xx da rota \`/api/pagamentos\` nas últimas 24 horas para investigar um problema específico.`,
        },
        {
          id: "detalhamento-rota",
          title: "Detalhamento por Rota",
          body: `Clicando em uma rota específica no dashboard, você acessa a página de detalhamento com métricas granulares daquela rota:

- **Distribuição de status codes** — Gráfico de pizza mostrando a proporção de 2xx, 3xx, 4xx e 5xx
- **Histograma de latência** — Distribuição das latências para identificar outliers
- **Top consumers** — Ranking dos consumidores que mais utilizam esta rota
- **Upstream response time** — Tempo de resposta do servidor de destino (separado da latência do gateway)
- **Bandwidth por direção** — Bytes de entrada (request) e saída (response) separadamente

A página de detalhamento também exibe o **log de requisições recentes** (últimas 100) com informações resumidas: timestamp, consumer, status code, latência e tamanho da resposta.

> **Nota:** O log de requisições recentes não inclui o corpo da requisição/resposta por padrão. Para capturar corpos completos, utilize o recurso de Debug Logging descrito no próximo artigo.

Essas métricas granulares são essenciais para diagnosticar problemas de performance, identificar rotas sobrecarregadas e planejar capacidade.`,
        },
        {
          id: "detalhamento-consumer",
          title: "Detalhamento por Consumidor",
          body: `O detalhamento por consumidor permite analisar o comportamento de uso de cada cliente ou aplicação que se autentica no API Gateway.

Na página do consumidor você encontra:

- **Volume de requisições** — Total e taxa por segundo ao longo do tempo
- **Top rotas** — Quais rotas o consumidor mais utiliza
- **Taxa de erro** — Se o consumidor está gerando muitos erros (pode indicar integração incorreta)
- **Consumo de rate limit** — Quanto da cota alocada o consumidor está utilizando
- **Tokens de IA** — Se o consumidor utiliza rotas de IA, exibe o consumo de tokens

Essas informações são valiosas para:

- **Suporte técnico** — Diagnosticar problemas reportados por um cliente específico
- **Planejamento de capacidade** — Identificar clientes com crescimento acelerado de uso
- **Billing** — Gerar relatórios de uso para cobrança por consumo
- **Segurança** — Detectar padrões de uso anômalos que podem indicar abuso

> **Dica:** Configure alertas por consumidor para ser notificado quando um cliente ultrapassar thresholds de uso predefinidos, permitindo ação proativa antes que problemas ocorram.`,
        },
      ],
    },

    // ── 2. Debug Logging ────────────────────────────────────────────────
    {
      slug: "debug-logging",
      title: "Debug Logging",
      description:
        "Capture requisições e respostas completas para depuração, com filtros por rota e código de status.",
      icon: "Bug",
      tags: ["debug", "logging", "troubleshooting"],
      content: [
        {
          id: "o-que-e-debug-log",
          title: "O que é o Debug Logging",
          body: `O Debug Logging é um recurso que permite capturar o conteúdo completo de requisições e respostas que passam pelo API Gateway. Diferente do log padrão (que registra apenas metadados como status code e latência), o debug log captura headers, query parameters e bodies completos.

Este recurso é projetado para uso temporário durante investigação de problemas. Ele não deve ficar habilitado permanentemente em produção, pois:

- **Aumenta o uso de disco** — Corpos de requisição e resposta podem ser grandes
- **Impacta performance** — A captura adiciona latência marginal ao processamento
- **Riscos de privacidade** — Corpos podem conter dados sensíveis (tokens, senhas, PII)

> **Atenção:** Sempre defina um tempo limite ao habilitar debug logging. O FuseOne desabilita automaticamente a captura após o período configurado para evitar que ela fique ativa inadvertidamente.`,
        },
        {
          id: "habilitando-debug",
          title: "Habilitando o Debug Log",
          body: `Para habilitar o debug logging em uma rota, acesse **APIs > [sua rota] > Debug** e clique em **Iniciar Captura**. Configure os seguintes parâmetros:

- **Duração** — Tempo máximo de captura: 5 min, 15 min, 30 min, 1 hora ou customizado (máximo 4 horas)
- **Limite de registros** — Número máximo de requisições a capturar (padrão: 100)
- **Filtro de status** — Capturar apenas requisições com determinados status codes (ex: somente 5xx)
- **Capturar request body** — Habilita a captura do corpo da requisição
- **Capturar response body** — Habilita a captura do corpo da resposta
- **Tamanho máximo do body** — Limite em KB para truncar corpos grandes (padrão: 64 KB)

Após configurar, clique em **Iniciar**. O botão mudará para um indicador pulsante indicando que a captura está ativa.

\`\`\`
Status: Capturando (12/100 registros | 4:32 restantes)
\`\`\`

> **Dica:** Se você sabe que o problema ocorre apenas em requisições com erro, use o filtro de status \`4xx,5xx\` para evitar capturar requisições bem-sucedidas e economizar espaço.`,
        },
        {
          id: "analisando-logs",
          title: "Analisando os Logs Capturados",
          body: `Após a captura, os registros ficam disponíveis na aba **Debug** da rota. Cada registro exibe:

- **Timestamp** — Data e hora exata da requisição
- **Consumer** — Identidade do consumidor (se autenticado)
- **Método e URI** — Ex: \`GET /api/v1/produtos?page=2\`
- **Status code** — Código de resposta HTTP
- **Latência** — Tempo total de processamento
- **Request headers** — Todos os headers da requisição
- **Response headers** — Todos os headers da resposta
- **Request body** — Corpo da requisição (se capturado)
- **Response body** — Corpo da resposta (se capturado)

Você pode filtrar e buscar dentro dos registros capturados por qualquer campo. Clicando em um registro, ele expande mostrando os detalhes completos em um formato legível com syntax highlighting para JSON e XML.

> **Nota:** Os registros de debug são armazenados temporariamente e removidos automaticamente após 24 horas. Se precisar preservá-los, exporte para JSON antes que expirem.

A funcionalidade de debug logging é especialmente útil para diagnosticar:

- Erros de transformação de request/response
- Problemas de autenticação (headers incorretos)
- Divergências entre o que o cliente envia e o que o upstream recebe`,
        },
        {
          id: "privacidade-seguranca",
          title: "Privacidade e Segurança",
          body: `O debug logging captura dados potencialmente sensíveis. O FuseOne inclui mecanismos para minimizar riscos de exposição:

### Mascaramento Automático
Os seguintes campos são automaticamente mascarados nos logs:

- **Authorization header** — Exibe apenas o tipo (Bearer, Basic) e os últimos 4 caracteres
- **API Keys** — Exibe apenas os últimos 4 caracteres
- **Cookies** — Nomes são preservados, valores são mascarados

### Mascaramento Customizado
Você pode configurar regras adicionais de mascaramento em **Configurações > Segurança > Mascaramento de Logs**:

- Mascarar campos específicos no body (ex: \`password\`, \`cpf\`, \`credit_card\`)
- Mascarar headers customizados
- Aplicar regex para detectar e mascarar padrões (ex: números de cartão de crédito)

### Controle de Acesso
O acesso aos debug logs é restrito por permissão RBAC. Apenas usuários com a permissão \`debug_logs:read\` podem visualizar os registros capturados. A ação de iniciar captura requer \`debug_logs:write\`.

> **Atenção:** Mesmo com mascaramento, evite capturar debug logs de rotas que processam dados altamente sensíveis (ex: endpoints de pagamento) em ambientes de produção, a menos que estritamente necessário.`,
        },
      ],
    },

    // ── 3. Sistema de Alertas ───────────────────────────────────────────
    {
      slug: "sistema-alertas",
      title: "Sistema de Alertas",
      description:
        "Crie regras de alerta para taxa de erro, latência, queda de tráfego e orçamento de IA.",
      icon: "Bell",
      tags: ["alertas", "notificações", "monitoramento"],
      content: [
        {
          id: "criando-alertas",
          title: "Criando Regras de Alerta",
          body: `O sistema de alertas do FuseOne permite monitorar métricas continuamente e notificar sua equipe quando thresholds são ultrapassados. Acesse **Monitoramento > Alertas** para gerenciar suas regras.

Para criar uma nova regra de alerta, clique em **Novo Alerta** e configure:

- **Nome** — Nome descritivo para o alerta (ex: "Taxa de erro alta - API Pagamentos")
- **Métrica** — A métrica a ser monitorada:
  - *Taxa de erro* — Percentual de requisições com erro (4xx/5xx)
  - *Latência p99* — Percentil 99 de latência
  - *Queda de tráfego* — Redução percentual no volume de requisições
  - *Token budget* — Consumo de tokens de IA atingiu percentual do orçamento
  - *Cost budget* — Custo de IA atingiu percentual do orçamento
- **Operador e valor** — Condição de disparo (ex: "maior que 5%", "acima de 500ms")
- **Escopo** — Global, por rota específica ou por consumidor

> **Nota:** Cada regra de alerta é avaliada independentemente. Você pode ter múltiplas regras para a mesma métrica com thresholds diferentes (ex: warning em 2% de erro, critical em 5%).`,
        },
        {
          id: "janela-avaliacao",
          title: "Janela de Avaliação",
          body: `A janela de avaliação determina o período de tempo sobre o qual a métrica é calculada antes de decidir se o alerta deve disparar. Configurar corretamente a janela é essencial para evitar falsos positivos.

Opções de janela disponíveis:

- **1 minuto** — Alta sensibilidade, pode gerar alertas por picos momentâneos
- **5 minutos** — Bom equilíbrio entre velocidade e estabilidade (recomendado para a maioria dos casos)
- **15 minutos** — Menos sensível, ideal para métricas com variação natural alta
- **1 hora** — Para tendências de longo prazo (ex: queda gradual de tráfego)

Além da janela, você pode configurar a **contagem de violações** necessária para disparar o alerta. Por exemplo: "disparar se a métrica violar o threshold em 3 de 5 janelas consecutivas".

\`\`\`
Janela: 5 minutos
Threshold: Taxa de erro > 5%
Violações: 3 de 5
\`\`\`

Neste exemplo, o alerta só dispara se a taxa de erro exceder 5% em pelo menos 3 das últimas 5 janelas de 5 minutos. Isso reduz significativamente os falsos positivos causados por picos momentâneos.

> **Dica:** Comece com janelas de 5 minutos e violações de 2/3. Ajuste com base na experiência — se receber muitos falsos positivos, aumente a janela ou as violações necessárias.`,
        },
        {
          id: "canais-notificacao",
          title: "Canais de Notificação",
          body: `Quando um alerta dispara, notificações são enviadas pelos canais configurados. O FuseOne suporta os seguintes canais:

### Email
Configure endereços de email para receber notificações. Múltiplos destinatários podem ser adicionados separados por vírgula.

### Slack Webhook
Integre com o Slack para receber notificações em um canal específico. Configure a URL do webhook do Slack e opcionalmente customize o template da mensagem.

### Webhook Genérico
Envie notificações para qualquer endpoint HTTP. O FuseOne envia um POST com payload JSON contendo detalhes do alerta:

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

Gerencie canais de notificação em **Configurações > Notificações**. Cada canal pode ser associado a um ou mais alertas, e cada alerta pode enviar para múltiplos canais.

> **Dica:** Configure pelo menos dois canais para alertas críticos (ex: Slack para visibilidade imediata da equipe + email para registro formal). Isso garante que ninguém perca uma notificação importante.`,
        },
        {
          id: "estados-historico",
          title: "Estados e Histórico",
          body: `Cada alerta possui um estado que indica sua situação atual:

- **OK** — A métrica está dentro dos limites configurados. Este é o estado normal.
- **Firing** — O threshold foi violado e o alerta está ativo. Notificações foram enviadas.
- **Acknowledged** — Um membro da equipe reconheceu o alerta. Novas notificações não são enviadas até que o estado mude.
- **Silenced** — O alerta foi temporariamente silenciado (útil durante manutenções planejadas).

O fluxo típico de um alerta é:

1. Alerta em **OK** — métricas normais
2. Threshold violado — estado muda para **Firing**, notificações são enviadas
3. Equipe reconhece — estado muda para **Acknowledged** (via dashboard ou link na notificação)
4. Problema resolvido — métrica volta ao normal, estado retorna para **OK**

O histórico completo de transições de estado é mantido para cada alerta, incluindo:

- Data/hora de cada mudança de estado
- Valor da métrica no momento do disparo
- Quem reconheceu o alerta (usuário)
- Duração de cada incidente (tempo entre firing e ok)

> **Nota:** O histórico de alertas é retido por 180 dias. Utilize os dados históricos para identificar padrões recorrentes e ajustar thresholds proativamente.`,
        },
      ],
    },

    // ── 4. Saúde dos Upstreams ──────────────────────────────────────────
    {
      slug: "upstream-health",
      title: "Saúde dos Upstreams",
      description:
        "Monitore a saúde dos seus servidores de destino com health checks ativos e passivos.",
      icon: "HeartPulse",
      tags: ["upstream", "health-check", "disponibilidade"],
      content: [
        {
          id: "como-funciona-health",
          title: "Como Funcionam os Health Checks",
          body: `Os health checks garantem que o API Gateway envie requisições apenas para servidores de destino (upstreams) que estejam saudáveis. Quando um upstream é detectado como indisponível, ele é automaticamente removido do pool de balanceamento, e o tráfego é redistribuído para os upstreams restantes.

O API Gateway suporta dois tipos de health check:

### Health Check Ativo
O gateway envia requisições periódicas de verificação (probes) para cada upstream. Se o upstream não responder ou retornar erro, é marcado como "unhealthy". Esse método detecta problemas proativamente, antes que requisições reais sejam afetadas.

### Health Check Passivo
O gateway monitora as respostas das requisições reais. Se um upstream retornar muitos erros consecutivos (ex: 5 erros 5xx seguidos), é marcado como "unhealthy". Esse método não gera tráfego adicional, mas só detecta problemas quando requisições reais falham.

> **Dica:** Para a melhor proteção, combine ambos os tipos: health check ativo para detecção proativa e passivo como camada adicional de segurança.`,
        },
        {
          id: "dashboard-saude",
          title: "Dashboard de Saúde",
          body: `O dashboard de saúde dos upstreams fornece uma visão consolidada do estado de todos os servidores de destino. Acesse via **Monitoramento > Upstreams**.

A página exibe uma tabela com todos os upstreams configurados e suas informações:

- **Nome/ID** — Identificador do upstream
- **Nodes** — Lista de servidores (IP:porta) no pool
- **Status** — Indicador visual por node: verde (healthy), vermelho (unhealthy), cinza (sem check)
- **Uptime** — Percentual de tempo em que o node esteve saudável nas últimas 24 horas
- **Último check** — Timestamp da última verificação de saúde
- **Latência** — Tempo de resposta do health check ativo (se configurado)

Clicando em um upstream, você acessa o detalhamento com:

- **Histórico de status** — Timeline mostrando transições entre healthy e unhealthy
- **Métricas do health check** — Latência das probes ao longo do tempo
- **Logs de transição** — Registros de quando cada node mudou de estado e o motivo

> **Nota:** Upstreams sem health check configurado aparecem com status cinza (desconhecido). Recomendamos configurar health checks para todos os upstreams em produção.`,
        },
        {
          id: "configurando-health-ativo",
          title: "Configurando Health Check Ativo",
          body: `O health check ativo é configurado no upstream. Acesse **APIs > Upstreams > [upstream] > Health Check** para configurar:

### Parâmetros Principais
- **Tipo** — HTTP ou HTTPS (para verificar endpoints HTTPS)
- **Path** — Caminho do endpoint de verificação (ex: \`/health\`, \`/ping\`)
- **Host** — Header Host a enviar na probe (opcional)
- **Intervalo** — Tempo entre verificações em segundos (padrão: 10s)
- **Timeout** — Tempo máximo de espera pela resposta (padrão: 3s)

### Critérios de Saúde
- **Healthy — Status codes** — Códigos que indicam saúde (padrão: 200)
- **Healthy — Successes** — Número de verificações consecutivas bem-sucedidas para marcar como healthy (padrão: 2)
- **Unhealthy — Status codes** — Códigos que indicam falha (padrão: 500, 502, 503)
- **Unhealthy — Failures** — Número de verificações consecutivas falhadas para marcar como unhealthy (padrão: 3)
- **Unhealthy — Timeouts** — Número de timeouts consecutivos para marcar como unhealthy (padrão: 3)

> **Atenção:** Certifique-se de que o endpoint de health check da sua aplicação é leve e rápido. Evite endpoints que façam queries ao banco de dados ou chamadas a serviços externos, pois isso pode causar falsos negativos.`,
        },
        {
          id: "configurando-health-passivo",
          title: "Configurando Health Check Passivo",
          body: `O health check passivo monitora as respostas das requisições reais para detectar upstreams com problema. Ele não gera tráfego adicional, pois analisa o tráfego já existente.

### Parâmetros de Configuração
- **Healthy — Status codes** — Códigos de resposta que contam como sucesso (padrão: 200-299)
- **Healthy — Successes** — Número de respostas bem-sucedidas consecutivas para restaurar um node marcado como unhealthy (padrão: 5)
- **Unhealthy — Status codes** — Códigos que contam como falha (padrão: 500, 502, 503, 504)
- **Unhealthy — Failures** — Número de falhas consecutivas para marcar como unhealthy (padrão: 5)
- **Unhealthy — Timeouts** — Número de timeouts consecutivos para marcar como unhealthy (padrão: 7)

Quando um node é marcado como unhealthy pelo check passivo, ele é removido do pool de balanceamento. Para ser restaurado, ele precisa receber requisições bem-sucedidas — mas como está fora do pool, isso só acontece se:

1. O health check **ativo** estiver configurado e detectar que o node voltou
2. O administrador restaurar manualmente o node via dashboard

> **Dica:** Por essa razão, recomendamos sempre combinar health check passivo com ativo. O passivo detecta problemas rapidamente (nas requisições reais), e o ativo garante a recuperação automática quando o node volta a funcionar.

A combinação de ambos os tipos oferece a melhor proteção: detecção rápida de falhas e recuperação automática de nodes restaurados.`,
        },
      ],
    },
  ],
}
