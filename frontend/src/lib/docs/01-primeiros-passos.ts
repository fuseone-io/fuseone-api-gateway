import type { DocCategory } from "./types"

export const primeirosPassosCategory: DocCategory = {
  slug: "primeiros-passos",
  title: "Primeiros Passos",
  description:
    "Aprenda os fundamentos do FuseOne API Gateway: o que ele faz, como instalar e como criar sua primeira API.",
  icon: "Rocket",
  articles: [
    {
      slug: "visao-geral",
      title: "Visao Geral",
      description:
        "Entenda o que e o FuseOne API Gateway, sua arquitetura e principais capacidades.",
      icon: "Info",
      tags: ["introducao", "arquitetura", "overview"],
      content: [
        {
          id: "o-que-e",
          title: "O que e o FuseOne API Gateway?",
          body: `O **FuseOne API Gateway** e uma plataforma completa para gerenciamento do ciclo de vida de APIs. Ele atua como ponto central de entrada para todas as requisicoes destinadas aos seus servicos, oferecendo controle total sobre roteamento, seguranca, transformacao e observabilidade.

Com o FuseOne voce pode:

- Criar e publicar APIs de forma visual, sem necessidade de editar arquivos de configuracao manualmente
- Aplicar politicas de seguranca como autenticacao, rate limiting e restricao de IP
- Monitorar o trafego em tempo real com metricas detalhadas de latencia, volume e erros
- Gerenciar o ciclo de vida completo das APIs, desde o rascunho ate a depreciacao
- Configurar balanceamento de carga inteligente entre multiplos upstreams

> **Nota:** O FuseOne API Gateway combina um dashboard moderno com um gateway de alta performance, oferecendo o melhor dos dois mundos: facilidade de uso e desempenho em producao.`,
        },
        {
          id: "arquitetura",
          title: "Arquitetura da Plataforma",
          body: `A plataforma FuseOne e composta por quatro componentes principais que trabalham juntos:

- **API Gateway** — O motor de proxy reverso de alta performance que processa todas as requisicoes. Ele executa as politicas configuradas (autenticacao, rate limiting, transformacao, etc.) e encaminha o trafego para os upstreams corretos.
- **Dashboard (Frontend)** — Interface web moderna construida com Next.js e shadcn/ui. Permite gerenciar APIs, configurar politicas, visualizar metricas e administrar usuarios de forma intuitiva.
- **Backend API** — Servidor Go que orquestra a comunicacao entre o dashboard e o gateway. Gerencia usuarios, permissoes, audit log e configuracoes do sistema.
- **PostgreSQL** — Banco de dados relacional que armazena dados do dashboard: usuarios, roles, configuracoes de auditoria e preferencias do sistema.
- **etcd** — Armazenamento distribuido de chave-valor utilizado pelo gateway para manter a configuracao de rotas, upstreams e politicas com alta disponibilidade.

> **Dica:** O gateway utiliza o etcd como fonte da verdade para configuracoes de API. Isso garante que mudancas aplicadas pelo dashboard entrem em vigor imediatamente, sem necessidade de reiniciar o servico.`,
        },
        {
          id: "capacidades",
          title: "Principais Capacidades",
          body: `O FuseOne API Gateway oferece um conjunto abrangente de funcionalidades organizadas em categorias:

### Roteamento Inteligente
Suporte a roteamento por host, URI, metodos HTTP, headers e parametros de query. Inclui suporte a expressoes regulares, wildcards e variaveis de rota.

### Seguranca
Autenticacao via API Key, JWT, Basic Auth, OpenID Connect e Forward Auth. Protecao contra abusos com rate limiting, restricao por IP e bloqueio de URIs maliciosas.

### Controle de Trafego
Balanceamento de carga com algoritmos roundrobin, consistent hashing, EWMA e least connections. Cache de proxy, traffic splitting para deploys canary e circuit breaker.

### Transformacao
Reescrita de requisicoes e respostas, transcodificacao gRPC-REST, injecao de falhas para testes de resiliencia e composicao de APIs.

### Observabilidade
Metricas detalhadas por rota, consumidor e upstream. Integracao com loggers HTTP, Kafka, Elasticsearch e outros destinos. Dashboard de monitoramento em tempo real.

### AI Gateway
Proxy inteligente para modelos de IA (OpenAI, Anthropic, etc.) com suporte a multi-provider, fallback automatico, guardrails de prompt e controle de custos.`,
        },
        {
          id: "navegacao",
          title: "Navegando pelo Dashboard",
          body: `O dashboard do FuseOne e organizado nas seguintes areas principais, acessiveis pela barra lateral:

- **Dashboard** — Visao geral com metricas agregadas: total de requisicoes, latencia media, taxa de erros e APIs ativas.
- **APIs** — Listagem e gerenciamento de todas as APIs (rotas) configuradas. Aqui voce cria, edita e remove rotas.
- **Monitoramento** — Graficos detalhados de trafego, analytics por rota e sistema de alertas.
- **Promotions** — Gerenciamento de promocao de configuracoes entre ambientes (dev, staging, producao).
- **Reports** — Geracao de relatorios de uso e performance das APIs.
- **Configuracoes** — Administracao de usuarios, roles, ambientes, conexoes OAuth e preferencias do sistema.

> **Dica:** Use o campo de busca no topo da barra lateral para encontrar rapidamente qualquer secao do dashboard. Voce tambem pode colapsar a barra lateral clicando no icone de menu para ter mais espaco de trabalho.`,
        },
      ],
    },
    {
      slug: "instalacao",
      title: "Instalacao e Configuracao",
      description:
        "Guia completo para instalar e configurar o FuseOne API Gateway no seu ambiente de desenvolvimento.",
      icon: "Download",
      tags: ["instalacao", "docker", "configuracao"],
      content: [
        {
          id: "pre-requisitos",
          title: "Pre-requisitos",
          body: `Antes de iniciar a instalacao, certifique-se de que voce tem os seguintes softwares instalados:

- **Docker** e **Docker Compose** — Necessarios para executar a infraestrutura (gateway, etcd e PostgreSQL). Versao recomendada: Docker 24+ e Compose v2+.
- **Go 1.22+** — Para compilar e executar o backend. O projeto utiliza modulos Go.
- **Node.js 20+** — Para executar o frontend Next.js.
- **pnpm** — Gerenciador de pacotes utilizado pelo frontend. Instale com \`npm install -g pnpm\`.
- **Make** — Para executar os comandos do Makefile que simplificam o desenvolvimento.
- **Air** (opcional) — Ferramenta de hot reload para Go. O Makefile ja cuida da instalacao automaticamente.

> **Nota:** Em sistemas Linux, certifique-se de que seu usuario tem permissao para executar comandos Docker sem \`sudo\`. Adicione seu usuario ao grupo docker com \`sudo usermod -aG docker $USER\`.`,
        },
        {
          id: "infraestrutura",
          title: "Iniciando a Infraestrutura",
          body: `O primeiro passo e subir os servicos de infraestrutura via Docker Compose. O FuseOne fornece um Makefile que simplifica todo o processo:

\`\`\`bash
make infra
\`\`\`

Este comando executa \`docker compose up\` e inicia tres servicos:

- **API Gateway** — Proxy reverso escutando na porta \`9080\` (HTTP) e \`9443\` (HTTPS). A API Admin fica disponivel na porta \`9180\`.
- **etcd** — Armazenamento de configuracao na porta \`2379\`.
- **PostgreSQL** — Banco de dados na porta \`5432\` com o database \`fuseone\` pre-criado.

Aguarde ate que todos os containers estejam com status **healthy** antes de prosseguir. Voce pode verificar com:

\`\`\`bash
docker compose ps
\`\`\`

> **Dica:** Se voce precisar resetar a infraestrutura do zero, use \`docker compose down -v\` para remover os volumes e depois execute \`make infra\` novamente.`,
        },
        {
          id: "configuracao-env",
          title: "Configuracao do Ambiente",
          body: `O FuseOne utiliza variaveis de ambiente para configuracao. Copie o arquivo de exemplo para criar sua configuracao local:

\`\`\`bash
cp .env.example .env
\`\`\`

As principais variaveis de configuracao sao:

- \`DATABASE_URL\` — String de conexao do PostgreSQL (ex: \`postgres://fuseone:fuseone@localhost:5432/fuseone?sslmode=disable\`)
- \`APISIX_ADMIN_URL\` — URL da API Admin do gateway (padrao: \`http://localhost:9180\`)
- \`APISIX_ADMIN_KEY\` — Chave de autenticacao da API Admin
- \`JWT_SECRET\` — Segredo utilizado para assinar tokens JWT de autenticacao do dashboard
- \`PORT\` — Porta do servidor backend (padrao: \`8080\`)

> **Atencao:** Nunca commite o arquivo \`.env\` no repositorio. Ele ja esta incluido no \`.gitignore\` por padrao. Em ambientes de producao, utilize variaveis de ambiente do sistema ou um gerenciador de segredos.`,
        },
        {
          id: "iniciando-servicos",
          title: "Iniciando Backend e Frontend",
          body: `Com a infraestrutura rodando e o \`.env\` configurado, inicie o backend e o frontend em terminais separados:

### Backend (Go)
\`\`\`bash
make backend
\`\`\`
O backend utiliza **Air** para hot reload automatico. Qualquer alteracao nos arquivos \`.go\` reinicia o servidor automaticamente. O servidor estara disponivel em \`http://localhost:8080\`.

Na primeira execucao, o backend aplica automaticamente todas as migracoes SQL pendentes no PostgreSQL e cria o usuario administrador padrao.

### Frontend (Next.js)
\`\`\`bash
make frontend
\`\`\`
Este comando executa \`pnpm dev\` no diretorio \`frontend/\`. O dashboard estara disponivel em \`http://localhost:3000\`.

### Acessando o Dashboard
Abra \`http://localhost:3000\` no seu navegador. Faca login com as credenciais padrao:

- **Email**: \`admin@fuseone.io\`
- **Senha**: \`admin\`

> **Atencao:** Altere a senha padrao do administrador imediatamente apos o primeiro login. Acesse **Configuracoes > Usuarios** para gerenciar credenciais.`,
        },
      ],
    },
    {
      slug: "primeiro-api",
      title: "Criando sua Primeira API",
      description:
        "Tutorial passo a passo para criar, configurar e testar sua primeira API no FuseOne.",
      icon: "Zap",
      tags: ["tutorial", "guia-rapido", "api"],
      content: [
        {
          id: "criar-rota",
          title: "Passo 1: Criando uma Rota",
          body: `Uma **rota** define como o gateway deve encaminhar as requisicoes recebidas. Vamos criar uma rota simples que redireciona chamadas para um servico backend.

1. No dashboard, acesse **APIs** na barra lateral
2. Clique no botao **Nova API** no canto superior direito
3. Preencha os campos basicos:
   - **Nome**: \`minha-primeira-api\`
   - **Descricao**: Uma descricao clara do que a API faz
   - **URI**: \`/api/v1/produtos/*\` — O caminho que o gateway vai interceptar
   - **Metodos**: Selecione \`GET\` e \`POST\`
   - **Host**: Deixe vazio para aceitar qualquer host, ou especifique um dominio

A URI suporta wildcards (\`*\`) para capturar sub-caminhos e variaveis de rota. Por exemplo, \`/api/v1/produtos/:id\` captura o ID do produto como parametro.

> **Dica:** Use prefixos de versao nas URIs (como \`/api/v1/\`) para facilitar o versionamento futuro das suas APIs.`,
        },
        {
          id: "configurar-upstream",
          title: "Passo 2: Configurando o Upstream",
          body: `O **upstream** define o servico backend para onde o gateway vai encaminhar as requisicoes. Configure o destino da sua rota:

1. Na secao **Upstream** do formulario de criacao, defina:
   - **Tipo**: \`roundrobin\` (distribui carga igualmente entre os nos)
   - **Nos**: Adicione os enderecos dos seus servidores backend

2. Adicione pelo menos um no:
   - **Host**: \`127.0.0.1\` (ou o IP/dominio do seu servico)
   - **Porta**: \`3001\` (a porta do seu servico backend)
   - **Peso**: \`1\` (para balanceamento igualitario)

Voce pode adicionar multiplos nos para alta disponibilidade. O gateway distribuira as requisicoes automaticamente entre eles com base no algoritmo de balanceamento selecionado.

### Algoritmos de Balanceamento Disponiveis
- **roundrobin** — Distribuicao circular simples (padrao)
- **chash** — Consistent hashing baseado em um header ou variavel
- **ewma** — Escolhe o no com menor latencia media
- **least_conn** — Encaminha para o no com menos conexoes ativas

> **Nota:** Para ambientes de desenvolvimento local, um unico no e suficiente. Em producao, recomenda-se pelo menos dois nos para garantir disponibilidade.`,
        },
        {
          id: "adicionar-auth",
          title: "Passo 3: Adicionando Autenticacao",
          body: `Para proteger sua API, adicione uma politica de autenticacao. A forma mais simples e usar **Key Auth** (autenticacao por chave de API):

1. No editor de fluxo da rota, clique em **Adicionar Politica**
2. Na galeria de politicas, selecione **Key Auth** na categoria **Autenticacao**
3. Configure os parametros:
   - **Header**: \`X-API-Key\` (header onde o consumidor envia a chave)

A politica sera adicionada ao pipeline de requisicao. Toda chamada que nao incluir uma chave valida no header especificado recebera uma resposta \`401 Unauthorized\`.

### Criando um Consumidor
Para que a autenticacao funcione, voce precisa criar pelo menos um **consumidor** com uma chave:

1. Acesse a secao de consumidores no gateway
2. Crie um consumidor com username \`app-mobile\`
3. Adicione a credencial key-auth com uma chave, por exemplo: \`minha-chave-secreta-123\`

Agora, requisicoes com o header \`X-API-Key: minha-chave-secreta-123\` serao autenticadas e associadas ao consumidor \`app-mobile\`.

> **Dica:** Em producao, prefira usar **JWT Auth** ou **OpenID Connect** para autenticacao mais robusta. Key Auth e ideal para integracao entre servicos internos.`,
        },
        {
          id: "testar-api",
          title: "Passo 4: Testando a API",
          body: `Com a rota criada e a autenticacao configurada, vamos testar a API usando \`curl\`:

### Teste sem autenticacao (deve retornar 401)
\`\`\`bash
curl -i http://localhost:9080/api/v1/produtos/
\`\`\`
Resposta esperada: \`HTTP/1.1 401 Unauthorized\`

### Teste com autenticacao valida
\`\`\`bash
curl -i -H "X-API-Key: minha-chave-secreta-123" http://localhost:9080/api/v1/produtos/
\`\`\`
Resposta esperada: \`HTTP/1.1 200 OK\` com o corpo da resposta do seu servico backend.

### Teste com metodo nao permitido (deve retornar 404)
\`\`\`bash
curl -i -X DELETE -H "X-API-Key: minha-chave-secreta-123" http://localhost:9080/api/v1/produtos/1
\`\`\`
Como a rota aceita apenas GET e POST, requisicoes DELETE serao rejeitadas.

> **Nota:** A porta \`9080\` e a porta padrao do gateway para trafego HTTP. Em producao, use a porta \`9443\` com HTTPS habilitado.`,
        },
        {
          id: "monitorar",
          title: "Passo 5: Monitorando Metricas",
          body: `Apos fazer algumas requisicoes de teste, acesse a secao de monitoramento para visualizar as metricas da sua API:

1. Na barra lateral, acesse **Monitoramento**
2. Na aba **Analytics**, voce vera graficos de:
   - **Requisicoes por segundo** — Volume de trafego ao longo do tempo
   - **Latencia** — Tempo de resposta em percentis (p50, p95, p99)
   - **Status HTTP** — Distribuicao de codigos de resposta (2xx, 4xx, 5xx)
   - **Trafego por rota** — Comparativo entre suas APIs

3. Use o seletor de periodo para ajustar o intervalo de tempo (ultima hora, ultimas 24h, ultimos 7 dias)

Voce tambem pode acessar metricas especificas de uma rota pela pagina de detalhes da API:

1. Acesse **APIs** e clique na sua rota
2. Navegue ate a aba **Analytics**
3. Veja metricas isoladas daquela rota especifica

> **Dica:** Configure alertas na aba **Alertas** do monitoramento para ser notificado quando a taxa de erros ultrapassar um limite ou a latencia ficar acima do aceitavel. Isso permite resposta rapida a incidentes.`,
        },
      ],
    },
  ],
}
