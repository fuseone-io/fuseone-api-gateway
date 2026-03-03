import type { DocCategory } from "./types"

export const politicasPluginsCategory: DocCategory = {
  slug: "politicas-plugins",
  title: "Politicas e Plugins",
  description:
    "Entenda o sistema de politicas do FuseOne: como elas funcionam, como configura-las e o catalogo completo por categoria.",
  icon: "Puzzle",
  articles: [
    {
      slug: "visao-geral-politicas",
      title: "O que sao Politicas?",
      description:
        "Entenda o conceito de politicas, como elas funcionam no pipeline de processamento e as categorias disponiveis.",
      icon: "Layers",
      tags: ["politicas", "plugins", "overview"],
      content: [
        {
          id: "conceito",
          title: "O Conceito de Politicas",
          body: `No FuseOne, **politicas** sao os blocos fundamentais de construcao para definir o comportamento das suas APIs. Cada politica adiciona uma capacidade especifica ao pipeline de processamento — seja autenticacao, controle de trafego, transformacao de dados ou observabilidade.

Quando uma requisicao chega ao gateway, ela percorre uma cadeia de politicas configuradas na rota. Cada politica pode:

- **Inspecionar** a requisicao (headers, body, IP do cliente, etc.)
- **Modificar** a requisicao ou resposta (adicionar headers, reescrever URIs, transformar body)
- **Rejeitar** a requisicao (retornar 401, 403, 429, etc.)
- **Registrar** informacoes (logs, metricas, traces)

As politicas sao a forma principal de adicionar logica ao processamento das suas APIs sem escrever codigo. O FuseOne oferece dezenas de politicas prontas que cobrem os cenarios mais comuns em gerenciamento de APIs.

> **Nota:** Internamente, o gateway implementa politicas como plugins extensiveis. Voce pode ver referencia a "plugins" em contextos tecnicos, mas na interface do dashboard utilizamos o termo "politicas" para maior clareza.`,
        },
        {
          id: "categorias",
          title: "Categorias de Politicas",
          body: `As politicas do FuseOne sao organizadas em seis categorias principais, cada uma com uma cor distinta no editor visual:

### Autenticacao
Politicas que verificam a identidade do chamador. Determinam **quem** esta fazendo a requisicao. Exemplos: validacao de API Key, verificacao de token JWT, autenticacao Basic, integracao OpenID Connect.

### Seguranca
Politicas que protegem a API contra acessos indevidos e abusos. Controlam **de onde** e **sob quais condicoes** as requisicoes sao aceitas. Exemplos: restricao por IP, bloqueio de URIs, CORS, restricao por consumidor.

### Controle de Trafego
Politicas que gerenciam o volume e a distribuicao do trafego. Definem **quanto** trafego e permitido e como ele e distribuido. Exemplos: rate limiting, controle de conexoes, traffic splitting, cache de proxy.

### Transformacao
Politicas que modificam requisicoes e respostas em transito. Alteram **o que** e enviado ao upstream ou devolvido ao cliente. Exemplos: reescrita de URI, modificacao de headers, transcodificacao gRPC-REST, injecao de falhas.

### Observabilidade
Politicas que registram informacoes sobre o trafego. Definem **como** o trafego e monitorado e registrado. Exemplos: loggers HTTP, Kafka, Elasticsearch.

### IA (Inteligencia Artificial)
Politicas especializadas para proxy de modelos de IA. Permitem rotear requisicoes para provedores como OpenAI, Anthropic e outros, com fallback automatico, guardrails de prompt e controle de custos.

> **Dica:** No editor visual de fluxo, cada categoria possui uma cor e um icone distintos, facilitando a identificacao rapida das politicas configuradas no pipeline.`,
        },
        {
          id: "como-funcionam",
          title: "Como as Politicas Funcionam",
          body: `Cada politica opera em uma **fase** especifica do ciclo de processamento da requisicao:

### Fase de Requisicao (Request Phase)
A politica e executada quando a requisicao chega ao gateway, **antes** de ser encaminhada ao upstream. A maioria das politicas de autenticacao, seguranca e controle de trafego opera nesta fase.

Se uma politica nesta fase rejeitar a requisicao (ex: autenticacao invalida), o processamento e interrompido imediatamente e a resposta de erro e enviada ao cliente sem tocar no upstream.

### Fase de Resposta (Response Phase)
A politica e executada **apos** o upstream retornar a resposta, antes dela ser enviada ao cliente. Politicas de transformacao de resposta e CORS operam nesta fase.

### Fase de Log (Log Phase)
Executada de forma assincrona **apos** a resposta ser enviada ao cliente. Politicas de logging e metricas operam nesta fase. Como sao assincronas, nao adicionam latencia a requisicao.

### Ordem de Execucao
Dentro de cada fase, as politicas sao executadas em uma ordem de prioridade pre-definida pelo gateway. Por exemplo, na fase de requisicao:

1. Politicas de autenticacao (prioridade mais alta)
2. Politicas de seguranca
3. Politicas de controle de trafego
4. Politicas de transformacao (prioridade mais baixa)

> **Atencao:** A ordem de prioridade e gerenciada automaticamente pelo gateway. Voce nao precisa se preocupar com a sequencia — basta adicionar as politicas desejadas e o gateway as executara na ordem correta.`,
        },
        {
          id: "escopo",
          title: "Escopo de Aplicacao",
          body: `Politicas podem ser aplicadas em diferentes escopos, do mais especifico ao mais abrangente:

### Escopo de Rota
A politica e aplicada apenas a uma rota especifica. Este e o escopo mais comum e e configurado diretamente no editor de fluxo da rota.

### Escopo de Service
A politica e aplicada a todas as rotas vinculadas a um service. Util quando voce quer a mesma politica em um grupo de rotas relacionadas sem repetir a configuracao.

### Escopo de Consumidor
A politica e aplicada a um consumidor especifico, independente da rota acessada. Por exemplo, voce pode definir um rate limit diferente para cada consumidor.

### Escopo Global
A politica e aplicada a **todas** as rotas do gateway. Ideal para politicas de observabilidade (loggers), seguranca basica (CORS) ou headers padrao que devem afetar todo o trafego.

### Precedencia
Quando a mesma politica e configurada em multiplos escopos, a configuracao mais especifica tem precedencia:

**Rota > Consumidor > Service > Global**

> **Dica:** Use politicas globais para requisitos transversais (logging, CORS) e politicas de rota para requisitos especificos de cada API. Isso reduz duplicacao e facilita a manutencao.`,
        },
      ],
    },
    {
      slug: "configurando-politicas",
      title: "Configurando Politicas",
      description:
        "Aprenda as diferentes formas de adicionar e configurar politicas: editor visual, modo JSON e templates.",
      icon: "Settings",
      tags: ["configuracao", "flow-editor", "templates"],
      content: [
        {
          id: "editor-visual",
          title: "Configuracao pelo Editor Visual",
          body: `A forma mais intuitiva de configurar politicas e pelo **editor visual de fluxo**. Ao adicionar uma politica a uma rota, um painel lateral de configuracao e aberto com campos de formulario para cada parametro.

### Campos Comuns
A maioria das politicas possui estes campos:

- **Habilitada** — Toggle para ativar/desativar a politica sem remover a configuracao
- **Parametros obrigatorios** — Campos marcados com asterisco que devem ser preenchidos
- **Parametros opcionais** — Campos com valores padrao que podem ser ajustados conforme necessario

### Validacao em Tempo Real
O editor valida os valores a medida que voce preenche:

- Campos obrigatorios nao preenchidos sao destacados em vermelho
- Valores fora do intervalo aceito mostram mensagem de erro
- O botao **Salvar** so fica habilitado quando a configuracao e valida

### Documentacao Integrada
Cada politica no painel de configuracao possui um link para a **documentacao completa**. Clique no icone de informacao ao lado do nome da politica para abrir a referencia com descricao detalhada de todos os parametros, exemplos de uso e comportamentos esperados.

> **Dica:** Passe o mouse sobre qualquer campo do formulario para ver uma tooltip com a descricao do parametro. Isso ajuda a entender rapidamente o que cada opcao faz sem precisar consultar a documentacao.`,
        },
        {
          id: "modo-json",
          title: "Configuracao via JSON",
          body: `Para configuracoes avancadas ou quando voce precisa de mais controle, use o **modo JSON** da politica:

1. No painel de configuracao da politica, clique na aba **JSON**
2. Edite o JSON de configuracao diretamente
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
  "rejected_msg": "Limite de requisicoes excedido"
}
\`\`\`

O modo JSON e especialmente util para:
- Copiar configuracoes entre rotas ou ambientes
- Configurar politicas com parametros aninhados complexos
- Aplicar configuracoes exportadas de outro sistema
- Debug — ver exatamente o que sera enviado ao gateway

> **Nota:** Alteracoes feitas no modo JSON sao refletidas automaticamente no formulario visual e vice-versa. Voce pode alternar livremente entre os dois modos.`,
        },
        {
          id: "templates",
          title: "Templates de Politicas (Plugin Configs)",
          body: `**Templates de politicas** permitem salvar conjuntos pre-configurados de politicas para reuso. Em vez de configurar a mesma combinacao de politicas repetidamente, voce cria um template uma vez e o aplica a multiplas rotas.

### Criando um Template
1. Configure as politicas desejadas em uma rota
2. Na secao de templates, clique em **Salvar como Template**
3. De um nome descritivo (ex: "API Publica com Rate Limit")
4. O template armazena a configuracao completa de todas as politicas selecionadas

### Aplicando um Template
1. No editor de fluxo de uma rota, clique em **Aplicar Template**
2. Selecione o template desejado da lista
3. As politicas do template serao adicionadas ao pipeline
4. Voce pode ajustar parametros individuais apos aplicar

### Casos de Uso Comuns
- **API Publica** — CORS + Rate Limit + Key Auth
- **API Interna** — IP Restriction + HTTP Logger
- **API com Alta Seguranca** — JWT Auth + Consumer Restriction + IP Restriction + Rate Limit
- **API de Monitoramento** — HTTP Logger + Kafka Logger + Request ID

> **Dica:** Mantenha uma biblioteca de templates padronizados para sua organizacao. Isso garante consistencia nas politicas aplicadas e acelera a criacao de novas APIs.`,
        },
        {
          id: "politicas-globais",
          title: "Politicas Globais",
          body: `**Politicas globais** sao aplicadas automaticamente a todas as rotas do gateway, sem necessidade de configuracao individual. Elas sao ideais para requisitos transversais que devem afetar todo o trafego.

### Configurando Politicas Globais
1. Acesse **Configuracoes** na barra lateral
2. Navegue ate a secao de **Politicas Globais**
3. Adicione e configure as politicas desejadas
4. As politicas serao aplicadas a todas as rotas existentes e futuras

### Politicas Recomendadas para Escopo Global
- **CORS** — Configuracao padrao de Cross-Origin Resource Sharing para todas as APIs
- **Request ID** — Adiciona um identificador unico a cada requisicao para rastreamento
- **HTTP Logger** — Registra todas as requisicoes em um destino centralizado de logs
- **Real IP** — Determina o IP real do cliente quando ha proxies intermediarios

### Interacao com Politicas de Rota
Quando a mesma politica esta configurada tanto globalmente quanto em uma rota especifica, a configuracao da rota tem **precedencia**. Isso permite definir valores padrao globais e sobrescrever em rotas que precisam de comportamento diferente.

Por exemplo, se o rate limit global e de 100 req/min, voce pode configurar uma rota especifica para aceitar 1000 req/min sobrescrevendo a politica localmente.

> **Atencao:** Politicas globais afetam **todas** as rotas, incluindo rotas criadas no futuro. Tenha cuidado ao adicionar politicas restritivas (como autenticacao) no escopo global, pois isso pode bloquear o acesso a APIs que deveriam ser publicas.`,
        },
      ],
    },
    {
      slug: "categorias-politicas",
      title: "Catalogo de Politicas",
      description:
        "Referencia completa de todas as politicas disponiveis, organizadas por categoria com descricoes e casos de uso.",
      icon: "BookOpen",
      tags: ["catalogo", "categorias", "referencia"],
      content: [
        {
          id: "autenticacao",
          title: "Autenticacao",
          body: `Politicas de autenticacao verificam a identidade do chamador antes de permitir o acesso a API. O FuseOne suporta diversos metodos de autenticacao:

- **key-auth** — Autenticacao por chave de API. O consumidor envia uma chave unica em um header (padrao: \`apikey\`) ou query parameter. Simples de implementar, ideal para integracao entre servicos.
- **jwt-auth** — Autenticacao por token JWT (JSON Web Token). O consumidor envia um token assinado que o gateway valida localmente sem necessidade de consultar um servico externo. Suporta algoritmos HS256, HS512, RS256 e ES256.
- **basic-auth** — Autenticacao HTTP Basic (usuario e senha codificados em Base64). Simples mas menos seguro — use apenas em cenarios internos ou combinado com HTTPS.
- **openid-connect** — Integracao com provedores de identidade compativel com OpenID Connect (Keycloak, Auth0, Okta, etc.). O gateway valida tokens de acesso e pode realizar o fluxo completo de autenticacao OAuth 2.0.
- **forward-auth** — Delega a decisao de autenticacao para um servico externo. O gateway envia os headers da requisicao para uma URL configurada e aceita ou rejeita com base na resposta. Maximo de flexibilidade para logicas customizadas.

> **Dica:** Para APIs publicas com autenticacao, prefira **jwt-auth** por ser stateless e performatico. Para integracao entre servicos internos, **key-auth** e a opcao mais simples. Para SSO corporativo, use **openid-connect**.`,
        },
        {
          id: "seguranca",
          title: "Seguranca",
          body: `Politicas de seguranca protegem suas APIs contra acessos nao autorizados, abusos e ataques:

- **ip-restriction** — Restringe o acesso por enderecos IP. Suporta allowlist (apenas IPs autorizados) e denylist (IPs bloqueados). Aceita enderecos individuais e faixas CIDR (ex: \`10.0.0.0/24\`). Essencial para APIs internas que so devem ser acessadas de redes especificas.
- **uri-blocker** — Bloqueia requisicoes a URIs que correspondam a padroes configurados. Util para proteger endpoints administrativos ou bloquear paths conhecidos de ataques (ex: \`/wp-admin\`, \`/.env\`, \`/actuator\`).
- **cors** — Configura headers de Cross-Origin Resource Sharing. Define quais origens, metodos e headers sao permitidos em requisicoes cross-origin. Indispensavel para APIs consumidas por aplicacoes frontend em dominios diferentes.
- **consumer-restriction** — Restringe o acesso a consumidores, grupos ou metodos de autenticacao especificos. Permite criar ACLs (listas de controle de acesso) granulares. Por exemplo, apenas consumidores do grupo "premium" podem acessar determinada rota.

> **Nota:** Politicas de seguranca sao executadas apos a autenticacao no pipeline. Isso permite combinar autenticacao com restricao por consumidor — primeiro identifica quem e, depois verifica se tem permissao.`,
        },
        {
          id: "trafego",
          title: "Controle de Trafego",
          body: `Politicas de controle de trafego gerenciam o volume de requisicoes e a distribuicao de carga:

- **limit-req** — Limita a taxa de requisicoes por segundo usando o algoritmo leaky bucket. Aceita uma taxa base (\`rate\`) e um burst maximo. Chave de agrupamento configuravel por IP, consumidor, variavel ou header. Ideal para proteger backends contra picos de trafego.
- **limit-conn** — Limita o numero de conexoes simultaneas ativas. Quando o limite e atingido, requisicoes excedentes podem ser enfileiradas ou rejeitadas. Protege backends que tem limite de conexoes simultaneas.
- **limit-count** — Limita o numero total de requisicoes em uma janela de tempo (ex: 1000 requisicoes por hora). Suporta janela fixa e janela deslizante. A contagem pode ser compartilhada entre multiplas instancias do gateway via Redis. Ideal para implementar quotas de uso.
- **traffic-split** — Divide o trafego entre multiplos upstreams com base em pesos ou regras. Essencial para deploys canary (enviar 5% do trafego para a nova versao), testes A/B e migracao gradual entre servicos.
- **proxy-cache** — Armazena respostas em cache para reduzir a carga no backend. Suporta cache em memoria e em disco. Configuravel por metodo HTTP, status code e headers de controle de cache. Melhora significativamente o tempo de resposta para conteudo que muda com pouca frequencia.

> **Dica:** Combine \`limit-req\` (taxa por segundo) com \`limit-count\` (quota por periodo) para protecao em camadas. O rate limit impede picos instantaneos, enquanto a quota controla o consumo total ao longo do tempo.`,
        },
        {
          id: "transformacao",
          title: "Transformacao",
          body: `Politicas de transformacao modificam requisicoes e respostas em transito, permitindo adaptar o formato dos dados sem alterar o codigo do backend:

- **proxy-rewrite** — Reescreve a URI, host e headers antes de encaminhar ao upstream. Permite adicionar, remover ou modificar headers da requisicao. Util para adaptar o path quando o backend espera uma estrutura de URI diferente da exposta pela API.
- **response-rewrite** — Modifica a resposta do upstream antes de envia-la ao cliente. Permite alterar o status code, headers e body da resposta. Pode usar variaveis do gateway para injetar informacoes dinamicas (ex: adicionar header com o tempo de processamento).
- **grpc-transcode** — Converte requisicoes REST (JSON/HTTP) em chamadas gRPC e vice-versa. Permite expor servicos gRPC como APIs REST tradicionais sem alterar o servico backend. Requer a definicao do proto (Protocol Buffers) para mapear os endpoints.
- **fault-injection** — Injeta falhas artificiais (delays e abortos) nas requisicoes para testes de resiliencia. Util para validar se os clientes lidam corretamente com timeouts e erros do gateway. Configure a porcentagem de requisicoes afetadas e o tipo de falha.

> **Atencao:** A politica \`fault-injection\` deve ser usada apenas em ambientes de teste e staging. Nunca habilite injecao de falhas em producao, pois isso afetara o trafego real dos seus usuarios.`,
        },
        {
          id: "observabilidade",
          title: "Observabilidade",
          body: `Politicas de observabilidade registram informacoes sobre o trafego, permitindo monitoramento, debugging e auditoria:

- **http-logger** — Envia logs de requisicao/resposta para um endpoint HTTP externo. Cada log inclui metadados completos: URI, metodo, status code, latencia, IP do cliente, headers e body (configuravel). Suporta batching para enviar multiplos logs em uma unica requisicao, reduzindo overhead.
- **kafka-logger** — Envia logs para um topico Apache Kafka. Ideal para pipelines de processamento de dados em tempo real. Suporta configuracao de brokers, topico, particao e formato de serializacao. Excelente para cenarios de alta vazao onde a durabilidade dos logs e critica.

### Outros Loggers Disponiveis
Alem dos loggers principais, o gateway suporta destinos adicionais:
- **elasticsearch-logger** — Envia logs diretamente para Elasticsearch
- **clickhouse-logger** — Armazena logs no ClickHouse para analytics
- **file-logger** — Grava logs em arquivo local no servidor do gateway
- **tcp-logger** / **udp-logger** — Envia logs via protocolo TCP ou UDP

### Metricas Integradas
Alem dos loggers, o dashboard do FuseOne coleta metricas automaticamente de todas as rotas: volume de requisicoes, distribuicao de status codes, latencia (p50, p95, p99) e trafego por consumidor. Essas metricas sao exibidas no painel de **Monitoramento**.

> **Dica:** Configure pelo menos um logger em escopo global para ter visibilidade completa de todo o trafego. Combine com o monitoramento integrado do dashboard para uma visao 360 graus das suas APIs.`,
        },
        {
          id: "ia",
          title: "IA (Inteligencia Artificial)",
          body: `Politicas de IA transformam o gateway em um **AI Gateway**, permitindo rotear e gerenciar requisicoes para provedores de modelos de linguagem:

- **ai-proxy** — Proxy inteligente para modelos de IA. Roteia requisicoes para provedores como OpenAI, Anthropic, Azure OpenAI, Cohere e outros usando uma interface unificada. Traduz automaticamente o formato da requisicao para o provedor configurado, permitindo trocar de provedor sem alterar o codigo do cliente.
- **ai-proxy-multi** — Versao avancada que suporta multiplos provedores simultaneamente. Permite configurar estrategias de fallback (se o provedor primario falhar, tenta o secundario) e balanceamento de carga entre provedores. Ideal para alta disponibilidade e otimizacao de custos.
- **ai-prompt-guard** — Implementa guardrails de seguranca para prompts. Permite definir regras que inspecionam o conteudo dos prompts enviados pelos usuarios e bloqueiam requisicoes que contenham conteudo proibido, tentativas de prompt injection ou padroes maliciosos.

### Casos de Uso
- **Gateway unificado** — Exponha uma unica API que roteia para diferentes provedores de IA conforme o modelo solicitado
- **Fallback automatico** — Se a API da OpenAI estiver indisponivel, redirecione automaticamente para Anthropic
- **Controle de custos** — Aplique rate limiting por consumidor para controlar gastos com APIs de IA
- **Seguranca de prompts** — Bloqueie prompts que tentem extrair dados sensiveis ou contornar instrucoes do sistema

> **Nota:** As politicas de IA sao especialmente uteis em cenarios empresariais onde voce precisa centralizar o acesso a modelos de IA, controlar custos e garantir conformidade com politicas de seguranca da organizacao.`,
        },
      ],
    },
  ],
}
