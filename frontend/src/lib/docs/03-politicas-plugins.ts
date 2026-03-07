import type { DocCategory } from "./types"

export const politicasPluginsCategory: DocCategory = {
  slug: "politicas-plugins",
  title: "Políticas e Plugins",
  description:
    "Entenda o sistema de políticas do FuseOne: como elas funcionam, como configurá-las e o catálogo completo por categoria.",
  icon: "Puzzle",
  articles: [
    {
      slug: "visao-geral-politicas",
      title: "O que são Políticas?",
      description:
        "Entenda o conceito de políticas, como elas funcionam no pipeline de processamento e as categorias disponíveis.",
      icon: "Layers",
      tags: ["políticas", "plugins", "overview"],
      content: [
        {
          id: "conceito",
          title: "O Conceito de Políticas",
          body: `No FuseOne, **políticas** são os blocos fundamentais de construção para definir o comportamento das suas APIs. Cada política adiciona uma capacidade específica ao pipeline de processamento — seja autenticação, controle de tráfego, transformação de dados ou observabilidade.

Quando uma requisição chega ao gateway, ela percorre uma cadeia de políticas configuradas na rota. Cada política pode:

- **Inspecionar** a requisição (headers, body, IP do cliente, etc.)
- **Modificar** a requisição ou resposta (adicionar headers, reescrever URIs, transformar body)
- **Rejeitar** a requisição (retornar 401, 403, 429, etc.)
- **Registrar** informações (logs, métricas, traces)

As políticas são a forma principal de adicionar lógica ao processamento das suas APIs sem escrever código. O FuseOne oferece dezenas de políticas prontas que cobrem os cenários mais comuns em gerenciamento de APIs.

> **Nota:** Internamente, o gateway implementa políticas como plugins extensíveis. Você pode ver referência a "plugins" em contextos técnicos, mas na interface do dashboard utilizamos o termo "políticas" para maior clareza.`,
        },
        {
          id: "categorias",
          title: "Categorias de Políticas",
          body: `As políticas do FuseOne são organizadas em seis categorias principais, cada uma com uma cor distinta no editor visual:

### Autenticação
Políticas que verificam a identidade do chamador. Determinam **quem** está fazendo a requisição. Exemplos: validação de API Key, verificação de token JWT, autenticação Basic, integração OpenID Connect.

### Segurança
Políticas que protegem a API contra acessos indevidos e abusos. Controlam **de onde** e **sob quais condições** as requisições são aceitas. Exemplos: restrição por IP, bloqueio de URIs, CORS, restrição por consumidor.

### Controle de Tráfego
Políticas que gerenciam o volume e a distribuição do tráfego. Definem **quanto** tráfego é permitido e como ele é distribuído. Exemplos: rate limiting, controle de conexões, traffic splitting, cache de proxy.

### Transformação
Políticas que modificam requisições e respostas em trânsito. Alteram **o que** é enviado ao upstream ou devolvido ao cliente. Exemplos: reescrita de URI, modificação de headers, transcodificação gRPC-REST, injeção de falhas.

### Observabilidade
Políticas que registram informações sobre o tráfego. Definem **como** o tráfego é monitorado e registrado. Exemplos: loggers HTTP, Kafka, Elasticsearch.

### IA (Inteligência Artificial)
Políticas especializadas para proxy de modelos de IA. Permitem rotear requisições para provedores como OpenAI, Anthropic e outros, com fallback automático, guardrails de prompt e controle de custos.

> **Dica:** No editor visual de fluxo, cada categoria possui uma cor e um ícone distintos, facilitando a identificação rápida das políticas configuradas no pipeline.`,
        },
        {
          id: "como-funcionam",
          title: "Como as Políticas Funcionam",
          body: `Cada política opera em uma **fase** específica do ciclo de processamento da requisição:

### Fase de Requisição (Request Phase)
A política é executada quando a requisição chega ao gateway, **antes** de ser encaminhada ao upstream. A maioria das políticas de autenticação, segurança e controle de tráfego opera nesta fase.

Se uma política nesta fase rejeitar a requisição (ex: autenticação inválida), o processamento é interrompido imediatamente e a resposta de erro é enviada ao cliente sem tocar no upstream.

### Fase de Resposta (Response Phase)
A política é executada **após** o upstream retornar a resposta, antes dela ser enviada ao cliente. Políticas de transformação de resposta e CORS operam nesta fase.

### Fase de Log (Log Phase)
Executada de forma assíncrona **após** a resposta ser enviada ao cliente. Políticas de logging e métricas operam nesta fase. Como são assíncronas, não adicionam latência à requisição.

### Ordem de Execução
Dentro de cada fase, as políticas são executadas em uma ordem de prioridade pré-definida pelo gateway. Por exemplo, na fase de requisição:

1. Políticas de autenticação (prioridade mais alta)
2. Políticas de segurança
3. Políticas de controle de tráfego
4. Políticas de transformação (prioridade mais baixa)

> **Atenção:** A ordem de prioridade é gerenciada automaticamente pelo gateway. Você não precisa se preocupar com a sequência — basta adicionar as políticas desejadas e o gateway as executará na ordem correta.`,
        },
        {
          id: "escopo",
          title: "Escopo de Aplicação",
          body: `Políticas podem ser aplicadas em diferentes escopos, do mais específico ao mais abrangente:

### Escopo de Rota
A política é aplicada apenas a uma rota específica. Este é o escopo mais comum e é configurado diretamente no editor de fluxo da rota.

### Escopo de Service
A política é aplicada a todas as rotas vinculadas a um service. Útil quando você quer a mesma política em um grupo de rotas relacionadas sem repetir a configuração.

### Escopo de Consumidor
A política é aplicada a um consumidor específico, independente da rota acessada. Por exemplo, você pode definir um rate limit diferente para cada consumidor.

### Escopo Global
A política é aplicada a **todas** as rotas do gateway. Ideal para políticas de observabilidade (loggers), segurança básica (CORS) ou headers padrão que devem afetar todo o tráfego.

### Precedência
Quando a mesma política é configurada em múltiplos escopos, a configuração mais específica tem precedência:

**Rota > Consumidor > Service > Global**

> **Dica:** Use políticas globais para requisitos transversais (logging, CORS) e políticas de rota para requisitos específicos de cada API. Isso reduz duplicação e facilita a manutenção.`,
        },
      ],
    },
    {
      slug: "configurando-politicas",
      title: "Configurando Políticas",
      description:
        "Aprenda as diferentes formas de adicionar e configurar políticas: editor visual, modo JSON e templates.",
      icon: "Settings",
      tags: ["configuração", "flow-editor", "templates"],
      content: [
        {
          id: "editor-visual",
          title: "Configuração pelo Editor Visual",
          body: `A forma mais intuitiva de configurar políticas é pelo **editor visual de fluxo**. Ao adicionar uma política a uma rota, um painel lateral de configuração é aberto com campos de formulário para cada parâmetro.

### Campos Comuns
A maioria das políticas possui estes campos:

- **Habilitada** — Toggle para ativar/desativar a política sem remover a configuração
- **Parâmetros obrigatórios** — Campos marcados com asterisco que devem ser preenchidos
- **Parâmetros opcionais** — Campos com valores padrão que podem ser ajustados conforme necessário

### Validação em Tempo Real
O editor valida os valores à medida que você preenche:

- Campos obrigatórios não preenchidos são destacados em vermelho
- Valores fora do intervalo aceito mostram mensagem de erro
- O botão **Salvar** só fica habilitado quando a configuração é válida

### Documentação Integrada
Cada política no painel de configuração possui um link para a **documentação completa**. Clique no ícone de informação ao lado do nome da política para abrir a referência com descrição detalhada de todos os parâmetros, exemplos de uso e comportamentos esperados.

> **Dica:** Passe o mouse sobre qualquer campo do formulário para ver uma tooltip com a descrição do parâmetro. Isso ajuda a entender rapidamente o que cada opção faz sem precisar consultar a documentação.`,
        },
        {
          id: "modo-json",
          title: "Configuração via JSON",
          body: `Para configurações avançadas ou quando você precisa de mais controle, use o **modo JSON** da política:

1. No painel de configuração da política, clique na aba **JSON**
2. Edite o JSON de configuração diretamente
3. O editor valida a sintaxe em tempo real
4. Clique em **Aplicar** para salvar

### Exemplo: key-auth em JSON
\`\`\`json
{
  "header": "X-API-Key",
  "query": "api_key",
  "hide_credentials": true
}
\`\`\`

### Exemplo: limit-req em JSON
\`\`\`json
{
  "rate": 10,
  "burst": 20,
  "key_type": "var",
  "key": "remote_addr",
  "rejected_code": 429,
  "rejected_msg": "Limite de requisições excedido"
}
\`\`\`

O modo JSON é especialmente útil para:
- Copiar configurações entre rotas ou ambientes
- Configurar políticas com parâmetros aninhados complexos
- Aplicar configurações exportadas de outro sistema
- Debug — ver exatamente o que será enviado ao gateway

> **Nota:** Alterações feitas no modo JSON são refletidas automaticamente no formulário visual e vice-versa. Você pode alternar livremente entre os dois modos.`,
        },
        {
          id: "templates",
          title: "Templates de Políticas (Plugin Configs)",
          body: `**Templates de políticas** permitem salvar conjuntos pré-configurados de políticas para reuso. Em vez de configurar a mesma combinação de políticas repetidamente, você cria um template uma vez e o aplica a múltiplas rotas.

### Criando um Template
1. Configure as políticas desejadas em uma rota
2. Na seção de templates, clique em **Salvar como Template**
3. Dê um nome descritivo (ex: "API Pública com Rate Limit")
4. O template armazena a configuração completa de todas as políticas selecionadas

### Aplicando um Template
1. No editor de fluxo de uma rota, clique em **Aplicar Template**
2. Selecione o template desejado da lista
3. As políticas do template serão adicionadas ao pipeline
4. Você pode ajustar parâmetros individuais após aplicar

### Casos de Uso Comuns
- **API Pública** — CORS + Rate Limit + Key Auth
- **API Interna** — IP Restriction + HTTP Logger
- **API com Alta Segurança** — JWT Auth + Consumer Restriction + IP Restriction + Rate Limit
- **API de Monitoramento** — HTTP Logger + Kafka Logger + Request ID

> **Dica:** Mantenha uma biblioteca de templates padronizados para sua organização. Isso garante consistência nas políticas aplicadas e acelera a criação de novas APIs.`,
        },
        {
          id: "politicas-globais",
          title: "Políticas Globais",
          body: `**Políticas globais** são aplicadas automaticamente a todas as rotas do gateway, sem necessidade de configuração individual. Elas são ideais para requisitos transversais que devem afetar todo o tráfego.

### Configurando Políticas Globais
1. Acesse **Configurações** na barra lateral
2. Navegue até a seção de **Políticas Globais**
3. Adicione e configure as políticas desejadas
4. As políticas serão aplicadas a todas as rotas existentes e futuras

### Políticas Recomendadas para Escopo Global
- **CORS** — Configuração padrão de Cross-Origin Resource Sharing para todas as APIs
- **Request ID** — Adiciona um identificador único a cada requisição para rastreamento
- **HTTP Logger** — Registra todas as requisições em um destino centralizado de logs
- **Real IP** — Determina o IP real do cliente quando há proxies intermediários

### Interação com Políticas de Rota
Quando a mesma política está configurada tanto globalmente quanto em uma rota específica, a configuração da rota tem **precedência**. Isso permite definir valores padrão globais e sobrescrever em rotas que precisam de comportamento diferente.

Por exemplo, se o rate limit global é de 100 req/min, você pode configurar uma rota específica para aceitar 1000 req/min sobrescrevendo a política localmente.

> **Atenção:** Políticas globais afetam **todas** as rotas, incluindo rotas criadas no futuro. Tenha cuidado ao adicionar políticas restritivas (como autenticação) no escopo global, pois isso pode bloquear o acesso a APIs que deveriam ser públicas.`,
        },
      ],
    },
    {
      slug: "categorias-politicas",
      title: "Catálogo de Políticas",
      description:
        "Referência completa de todas as políticas disponíveis, organizadas por categoria com descrições e casos de uso.",
      icon: "BookOpen",
      tags: ["catálogo", "categorias", "referência"],
      content: [
        {
          id: "autenticacao",
          title: "Autenticação",
          body: `Políticas de autenticação verificam a identidade do chamador antes de permitir o acesso à API. O FuseOne suporta diversos métodos de autenticação:

- **key-auth** — Autenticação por chave de API. O consumidor envia uma chave única em um header (padrão: \`apikey\`) ou query parameter. Simples de implementar, ideal para integração entre serviços.
- **jwt-auth** — Autenticação por token JWT (JSON Web Token). O consumidor envia um token assinado que o gateway valida localmente sem necessidade de consultar um serviço externo. Suporta algoritmos HS256, HS512, RS256 e ES256.
- **basic-auth** — Autenticação HTTP Basic (usuário e senha codificados em Base64). Simples mas menos seguro — use apenas em cenários internos ou combinado com HTTPS.
- **openid-connect** — Integração com provedores de identidade compatível com OpenID Connect (Keycloak, Auth0, Okta, etc.). O gateway valida tokens de acesso e pode realizar o fluxo completo de autenticação OAuth 2.0.
- **forward-auth** — Delega a decisão de autenticação para um serviço externo. O gateway envia os headers da requisição para uma URL configurada e aceita ou rejeita com base na resposta. Máximo de flexibilidade para lógicas customizadas.

> **Dica:** Para APIs públicas com autenticação, prefira **jwt-auth** por ser stateless e performático. Para integração entre serviços internos, **key-auth** é a opção mais simples. Para SSO corporativo, use **openid-connect**.`,
        },
        {
          id: "seguranca",
          title: "Segurança",
          body: `Políticas de segurança protegem suas APIs contra acessos não autorizados, abusos e ataques:

- **ip-restriction** — Restringe o acesso por endereços IP. Suporta allowlist (apenas IPs autorizados) e denylist (IPs bloqueados). Aceita endereços individuais e faixas CIDR (ex: \`10.0.0.0/24\`). Essencial para APIs internas que só devem ser acessadas de redes específicas.
- **uri-blocker** — Bloqueia requisições a URIs que correspondam a padrões configurados. Útil para proteger endpoints administrativos ou bloquear paths conhecidos de ataques (ex: \`/wp-admin\`, \`/.env\`, \`/actuator\`).
- **cors** — Configura headers de Cross-Origin Resource Sharing. Define quais origens, métodos e headers são permitidos em requisições cross-origin. Indispensável para APIs consumidas por aplicações frontend em domínios diferentes.
- **consumer-restriction** — Restringe o acesso a consumidores, grupos ou métodos de autenticação específicos. Permite criar ACLs (listas de controle de acesso) granulares. Por exemplo, apenas consumidores do grupo "premium" podem acessar determinada rota.

> **Nota:** Políticas de segurança são executadas após a autenticação no pipeline. Isso permite combinar autenticação com restrição por consumidor — primeiro identifica quem é, depois verifica se tem permissão.`,
        },
        {
          id: "trafego",
          title: "Controle de Tráfego",
          body: `Políticas de controle de tráfego gerenciam o volume de requisições e a distribuição de carga:

- **limit-req** — Limita a taxa de requisições por segundo usando o algoritmo leaky bucket. Aceita uma taxa base (\`rate\`) e um burst máximo. Chave de agrupamento configurável por IP, consumidor, variável ou header. Ideal para proteger backends contra picos de tráfego.
- **limit-conn** — Limita o número de conexões simultâneas ativas. Quando o limite é atingido, requisições excedentes podem ser enfileiradas ou rejeitadas. Protege backends que têm limite de conexões simultâneas.
- **limit-count** — Limita o número total de requisições em uma janela de tempo (ex: 1000 requisições por hora). Suporta janela fixa e janela deslizante. A contagem pode ser compartilhada entre múltiplas instâncias do gateway via Redis. Ideal para implementar quotas de uso.
- **traffic-split** — Divide o tráfego entre múltiplos upstreams com base em pesos ou regras. Essencial para deploys canary (enviar 5% do tráfego para a nova versão), testes A/B e migração gradual entre serviços.
- **proxy-cache** — Armazena respostas em cache para reduzir a carga no backend. Suporta cache em memória e em disco. Configurável por método HTTP, status code e headers de controle de cache. Melhora significativamente o tempo de resposta para conteúdo que muda com pouca frequência.

> **Dica:** Combine \`limit-req\` (taxa por segundo) com \`limit-count\` (quota por período) para proteção em camadas. O rate limit impede picos instantâneos, enquanto a quota controla o consumo total ao longo do tempo.`,
        },
        {
          id: "transformacao",
          title: "Transformação",
          body: `Políticas de transformação modificam requisições e respostas em trânsito, permitindo adaptar o formato dos dados sem alterar o código do backend:

- **proxy-rewrite** — Reescreve a URI, host e headers antes de encaminhar ao upstream. Permite adicionar, remover ou modificar headers da requisição. Útil para adaptar o path quando o backend espera uma estrutura de URI diferente da exposta pela API.
- **response-rewrite** — Modifica a resposta do upstream antes de enviá-la ao cliente. Permite alterar o status code, headers e body da resposta. Pode usar variáveis do gateway para injetar informações dinâmicas (ex: adicionar header com o tempo de processamento).
- **grpc-transcode** — Converte requisições REST (JSON/HTTP) em chamadas gRPC e vice-versa. Permite expor serviços gRPC como APIs REST tradicionais sem alterar o serviço backend. Requer a definição do proto (Protocol Buffers) para mapear os endpoints.
- **fault-injection** — Injeta falhas artificiais (delays e abortos) nas requisições para testes de resiliência. Útil para validar se os clientes lidam corretamente com timeouts e erros do gateway. Configure a porcentagem de requisições afetadas e o tipo de falha.

> **Atenção:** A política \`fault-injection\` deve ser usada apenas em ambientes de teste e staging. Nunca habilite injeção de falhas em produção, pois isso afetará o tráfego real dos seus usuários.`,
        },
        {
          id: "observabilidade",
          title: "Observabilidade",
          body: `Políticas de observabilidade registram informações sobre o tráfego, permitindo monitoramento, debugging e auditoria:

- **http-logger** — Envia logs de requisição/resposta para um endpoint HTTP externo. Cada log inclui metadados completos: URI, método, status code, latência, IP do cliente, headers e body (configurável). Suporta batching para enviar múltiplos logs em uma única requisição, reduzindo overhead.
- **kafka-logger** — Envia logs para um tópico Apache Kafka. Ideal para pipelines de processamento de dados em tempo real. Suporta configuração de brokers, tópico, partição e formato de serialização. Excelente para cenários de alta vazão onde a durabilidade dos logs é crítica.

### Outros Loggers Disponíveis
Além dos loggers principais, o gateway suporta destinos adicionais:
- **elasticsearch-logger** — Envia logs diretamente para Elasticsearch
- **clickhouse-logger** — Armazena logs no ClickHouse para analytics
- **file-logger** — Grava logs em arquivo local no servidor do gateway
- **tcp-logger** / **udp-logger** — Envia logs via protocolo TCP ou UDP

### Métricas Integradas
Além dos loggers, o dashboard do FuseOne coleta métricas automaticamente de todas as rotas: volume de requisições, distribuição de status codes, latência (p50, p95, p99) e tráfego por consumidor. Essas métricas são exibidas no painel de **Monitoramento**.

> **Dica:** Configure pelo menos um logger em escopo global para ter visibilidade completa de todo o tráfego. Combine com o monitoramento integrado do dashboard para uma visão 360 graus das suas APIs.`,
        },
        {
          id: "ia",
          title: "IA (Inteligência Artificial)",
          body: `Políticas de IA transformam o gateway em um **AI Gateway**, permitindo rotear e gerenciar requisições para provedores de modelos de linguagem:

- **ai-proxy** — Proxy inteligente para modelos de IA. Roteia requisições para provedores como OpenAI, Anthropic, Azure OpenAI, Cohere e outros usando uma interface unificada. Traduz automaticamente o formato da requisição para o provedor configurado, permitindo trocar de provedor sem alterar o código do cliente.
- **ai-proxy-multi** — Versão avançada que suporta múltiplos provedores simultaneamente. Permite configurar estratégias de fallback (se o provedor primário falhar, tenta o secundário) e balanceamento de carga entre provedores. Ideal para alta disponibilidade e otimização de custos.
- **ai-prompt-guard** — Implementa guardrails de segurança para prompts. Permite definir regras que inspecionam o conteúdo dos prompts enviados pelos usuários e bloqueiam requisições que contenham conteúdo proibido, tentativas de prompt injection ou padrões maliciosos.

### Casos de Uso
- **Gateway unificado** — Exponha uma única API que roteia para diferentes provedores de IA conforme o modelo solicitado
- **Fallback automático** — Se a API da OpenAI estiver indisponível, redirecione automaticamente para Anthropic
- **Controle de custos** — Aplique rate limiting por consumidor para controlar gastos com APIs de IA
- **Segurança de prompts** — Bloqueie prompts que tentem extrair dados sensíveis ou contornar instruções do sistema

> **Nota:** As políticas de IA são especialmente úteis em cenários empresariais onde você precisa centralizar o acesso a modelos de IA, controlar custos e garantir conformidade com políticas de segurança da organização.`,
        },
      ],
    },
  ],
}
