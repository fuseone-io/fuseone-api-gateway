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
      title: "Visão Geral",
      description:
        "Entenda o que é o FuseOne API Gateway, sua arquitetura e principais capacidades.",
      icon: "Info",
      tags: ["introdução", "arquitetura", "overview"],
      content: [
        {
          id: "o-que-e",
          title: "O que é o FuseOne API Gateway?",
          body: `O **FuseOne API Gateway** é uma plataforma completa para gerenciamento do ciclo de vida de APIs. Ele atua como ponto central de entrada para todas as requisições destinadas aos seus serviços, oferecendo controle total sobre roteamento, segurança, transformação e observabilidade.

Com o FuseOne você pode:

- Criar e publicar APIs de forma visual, sem necessidade de editar arquivos de configuração manualmente
- Aplicar políticas de segurança como autenticação, rate limiting e restrição de IP
- Monitorar o tráfego em tempo real com métricas detalhadas de latência, volume e erros
- Gerenciar o ciclo de vida completo das APIs, desde o rascunho até a depreciação
- Configurar balanceamento de carga inteligente entre múltiplos upstreams

> **Nota:** O FuseOne API Gateway combina um dashboard moderno com um gateway de alta performance, oferecendo o melhor dos dois mundos: facilidade de uso e desempenho em produção.`,
        },
        {
          id: "arquitetura",
          title: "Arquitetura da Plataforma",
          body: `A plataforma FuseOne é composta por quatro componentes principais que trabalham juntos:

- **API Gateway** — O motor de proxy reverso de alta performance que processa todas as requisições. Ele executa as políticas configuradas (autenticação, rate limiting, transformação, etc.) e encaminha o tráfego para os upstreams corretos.
- **Dashboard (Frontend)** — Interface web moderna construída com Next.js e shadcn/ui. Permite gerenciar APIs, configurar políticas, visualizar métricas e administrar usuários de forma intuitiva.
- **Backend API** — Servidor Go que orquestra a comunicação entre o dashboard e o gateway. Gerencia usuários, permissões, audit log e configurações do sistema.
- **PostgreSQL** — Banco de dados relacional que armazena dados do dashboard: usuários, roles, configurações de auditoria e preferências do sistema.
- **etcd** — Armazenamento distribuído de chave-valor utilizado pelo gateway para manter a configuração de rotas, upstreams e políticas com alta disponibilidade.

> **Dica:** O gateway utiliza o etcd como fonte da verdade para configurações de API. Isso garante que mudanças aplicadas pelo dashboard entrem em vigor imediatamente, sem necessidade de reiniciar o serviço.`,
        },
        {
          id: "capacidades",
          title: "Principais Capacidades",
          body: `O FuseOne API Gateway oferece um conjunto abrangente de funcionalidades organizadas em categorias:

### Roteamento Inteligente
Suporte a roteamento por host, URI, métodos HTTP, headers e parâmetros de query. Inclui suporte a expressões regulares, wildcards e variáveis de rota.

### Segurança
Autenticação via API Key, JWT, Basic Auth, OpenID Connect e Forward Auth. Proteção contra abusos com rate limiting, restrição por IP e bloqueio de URIs maliciosas.

### Controle de Tráfego
Balanceamento de carga com algoritmos roundrobin, consistent hashing, EWMA e least connections. Cache de proxy, traffic splitting para deploys canary e circuit breaker.

### Transformação
Reescrita de requisições e respostas, transcodificação gRPC-REST, injeção de falhas para testes de resiliência e composição de APIs.

### Observabilidade
Métricas detalhadas por rota, consumidor e upstream. Integração com loggers HTTP, Kafka, Elasticsearch e outros destinos. Dashboard de monitoramento em tempo real.

### AI Gateway
Proxy inteligente para modelos de IA (OpenAI, Anthropic, etc.) com suporte a multi-provider, fallback automático, guardrails de prompt e controle de custos.`,
        },
        {
          id: "navegacao",
          title: "Navegando pelo Dashboard",
          body: `O dashboard do FuseOne é organizado nas seguintes áreas principais, acessíveis pela barra lateral:

- **Dashboard** — Visão geral com métricas agregadas: total de requisições, latência média, taxa de erros e APIs ativas.
- **APIs** — Listagem e gerenciamento de todas as APIs (rotas) configuradas. Aqui você cria, edita e remove rotas.
- **Monitoramento** — Gráficos detalhados de tráfego, analytics por rota e sistema de alertas.
- **Promotions** — Gerenciamento de promoção de configurações entre ambientes (dev, staging, produção).
- **Reports** — Geração de relatórios de uso e performance das APIs.
- **Configurações** — Administração de usuários, roles, ambientes, conexões OAuth e preferências do sistema.

> **Dica:** Use o campo de busca no topo da barra lateral para encontrar rapidamente qualquer seção do dashboard. Você também pode colapsar a barra lateral clicando no ícone de menu para ter mais espaço de trabalho.`,
        },
      ],
    },
    {
      slug: "instalacao",
      title: "Instalação e Configuração",
      description:
        "Guia completo para instalar e configurar o FuseOne API Gateway no seu ambiente de desenvolvimento.",
      icon: "Download",
      tags: ["instalação", "docker", "configuração"],
      content: [
        {
          id: "pre-requisitos",
          title: "Pré-requisitos",
          body: `Antes de iniciar a instalação, certifique-se de que você tem os seguintes softwares instalados:

- **Docker** e **Docker Compose** — Necessários para executar a infraestrutura (gateway, etcd e PostgreSQL). Versão recomendada: Docker 24+ e Compose v2+.
- **Go 1.22+** — Para compilar e executar o backend. O projeto utiliza módulos Go.
- **Node.js 20+** — Para executar o frontend Next.js.
- **pnpm** — Gerenciador de pacotes utilizado pelo frontend. Instale com \`npm install -g pnpm\`.
- **Make** — Para executar os comandos do Makefile que simplificam o desenvolvimento.
- **Air** (opcional) — Ferramenta de hot reload para Go. O Makefile já cuida da instalação automaticamente.

> **Nota:** Em sistemas Linux, certifique-se de que seu usuário tem permissão para executar comandos Docker sem \`sudo\`. Adicione seu usuário ao grupo docker com \`sudo usermod -aG docker $USER\`.`,
        },
        {
          id: "infraestrutura",
          title: "Iniciando a Infraestrutura",
          body: `O primeiro passo é subir os serviços de infraestrutura via Docker Compose. O FuseOne fornece um Makefile que simplifica todo o processo:

\`\`\`bash
make infra
\`\`\`

Este comando executa \`docker compose up\` e inicia três serviços:

- **API Gateway** — Proxy reverso escutando na porta \`9080\` (HTTP) e \`9443\` (HTTPS). A API Admin fica disponível na porta \`9180\`.
- **etcd** — Armazenamento de configuração na porta \`2379\`.
- **PostgreSQL** — Banco de dados na porta \`5432\` com o database \`fuseone\` pré-criado.

Aguarde até que todos os containers estejam com status **healthy** antes de prosseguir. Você pode verificar com:

\`\`\`bash
docker compose ps
\`\`\`

> **Dica:** Se você precisar resetar a infraestrutura do zero, use \`docker compose down -v\` para remover os volumes e depois execute \`make infra\` novamente.`,
        },
        {
          id: "configuracao-env",
          title: "Configuração do Ambiente",
          body: `O FuseOne utiliza variáveis de ambiente para configuração. Copie o arquivo de exemplo para criar sua configuração local:

\`\`\`bash
cp .env.example .env
\`\`\`

As principais variáveis de configuração são:

- \`DATABASE_URL\` — String de conexão do PostgreSQL (ex: \`postgres://fuseone:fuseone@localhost:5432/fuseone?sslmode=disable\`)
- \`APISIX_ADMIN_URL\` — URL da API Admin do gateway (padrão: \`http://localhost:9180\`)
- \`APISIX_ADMIN_KEY\` — Chave de autenticação da API Admin
- \`JWT_SECRET\` — Segredo utilizado para assinar tokens JWT de autenticação do dashboard
- \`PORT\` — Porta do servidor backend (padrão: \`8080\`)

> **Atenção:** Nunca commite o arquivo \`.env\` no repositório. Ele já está incluído no \`.gitignore\` por padrão. Em ambientes de produção, utilize variáveis de ambiente do sistema ou um gerenciador de segredos.`,
        },
        {
          id: "iniciando-servicos",
          title: "Iniciando Backend e Frontend",
          body: `Com a infraestrutura rodando e o \`.env\` configurado, inicie o backend e o frontend em terminais separados:

### Backend (Go)
\`\`\`bash
make backend
\`\`\`
O backend utiliza **Air** para hot reload automático. Qualquer alteração nos arquivos \`.go\` reinicia o servidor automaticamente. O servidor estará disponível em \`http://localhost:8080\`.

Na primeira execução, o backend aplica automaticamente todas as migrações SQL pendentes no PostgreSQL e cria o usuário administrador padrão.

### Frontend (Next.js)
\`\`\`bash
make frontend
\`\`\`
Este comando executa \`pnpm dev\` no diretório \`frontend/\`. O dashboard estará disponível em \`http://localhost:3000\`.

### Acessando o Dashboard
Abra \`http://localhost:3000\` no seu navegador. Faça login com as credenciais padrão:

- **Email**: \`admin@fuseone.io\`
- **Senha**: \`admin\`

> **Atenção:** Altere a senha padrão do administrador imediatamente após o primeiro login. Acesse **Configurações > Usuários** para gerenciar credenciais.`,
        },
      ],
    },
    {
      slug: "primeiro-api",
      title: "Criando sua Primeira API",
      description:
        "Tutorial passo a passo para criar, configurar e testar sua primeira API no FuseOne.",
      icon: "Zap",
      tags: ["tutorial", "guia-rápido", "api"],
      content: [
        {
          id: "criar-rota",
          title: "Passo 1: Criando uma Rota",
          body: `Uma **rota** define como o gateway deve encaminhar as requisições recebidas. Vamos criar uma rota simples que redireciona chamadas para um serviço backend.

1. No dashboard, acesse **APIs** na barra lateral
2. Clique no botão **Nova API** no canto superior direito
3. Preencha os campos básicos:
   - **Nome**: \`minha-primeira-api\`
   - **Descrição**: Uma descrição clara do que a API faz
   - **URI**: \`/api/v1/produtos/*\` — O caminho que o gateway vai interceptar
   - **Métodos**: Selecione \`GET\` e \`POST\`
   - **Host**: Deixe vazio para aceitar qualquer host, ou especifique um domínio

A URI suporta wildcards (\`*\`) para capturar sub-caminhos e variáveis de rota. Por exemplo, \`/api/v1/produtos/:id\` captura o ID do produto como parâmetro.

> **Dica:** Use prefixos de versão nas URIs (como \`/api/v1/\`) para facilitar o versionamento futuro das suas APIs.`,
        },
        {
          id: "configurar-upstream",
          title: "Passo 2: Configurando o Upstream",
          body: `O **upstream** define o serviço backend para onde o gateway vai encaminhar as requisições. Configure o destino da sua rota:

1. Na seção **Upstream** do formulário de criação, defina:
   - **Tipo**: \`roundrobin\` (distribui carga igualmente entre os nós)
   - **Nós**: Adicione os endereços dos seus servidores backend

2. Adicione pelo menos um nó:
   - **Host**: \`127.0.0.1\` (ou o IP/domínio do seu serviço)
   - **Porta**: \`3001\` (a porta do seu serviço backend)
   - **Peso**: \`1\` (para balanceamento igualitário)

Você pode adicionar múltiplos nós para alta disponibilidade. O gateway distribuirá as requisições automaticamente entre eles com base no algoritmo de balanceamento selecionado.

### Algoritmos de Balanceamento Disponíveis
- **roundrobin** — Distribuição circular simples (padrão)
- **chash** — Consistent hashing baseado em um header ou variável
- **ewma** — Escolhe o nó com menor latência média
- **least_conn** — Encaminha para o nó com menos conexões ativas

> **Nota:** Para ambientes de desenvolvimento local, um único nó é suficiente. Em produção, recomenda-se pelo menos dois nós para garantir disponibilidade.`,
        },
        {
          id: "adicionar-auth",
          title: "Passo 3: Adicionando Autenticação",
          body: `Para proteger sua API, adicione uma política de autenticação. A forma mais simples é usar **Key Auth** (autenticação por chave de API):

1. No editor de fluxo da rota, clique em **Adicionar Política**
2. Na galeria de políticas, selecione **Key Auth** na categoria **Autenticação**
3. Configure os parâmetros:
   - **Header**: \`X-API-Key\` (header onde o consumidor envia a chave)

A política será adicionada ao pipeline de requisição. Toda chamada que não incluir uma chave válida no header especificado receberá uma resposta \`401 Unauthorized\`.

### Criando um Consumidor
Para que a autenticação funcione, você precisa criar pelo menos um **consumidor** com uma chave:

1. Acesse a seção de consumidores no gateway
2. Crie um consumidor com username \`app-mobile\`
3. Adicione a credencial key-auth com uma chave, por exemplo: \`minha-chave-secreta-123\`

Agora, requisições com o header \`X-API-Key: minha-chave-secreta-123\` serão autenticadas e associadas ao consumidor \`app-mobile\`.

> **Dica:** Em produção, prefira usar **JWT Auth** ou **OpenID Connect** para autenticação mais robusta. Key Auth é ideal para integração entre serviços internos.`,
        },
        {
          id: "testar-api",
          title: "Passo 4: Testando a API",
          body: `Com a rota criada e a autenticação configurada, vamos testar a API usando \`curl\`:

### Teste sem autenticação (deve retornar 401)
\`\`\`bash
curl -i http://localhost:9080/api/v1/produtos/
\`\`\`
Resposta esperada: \`HTTP/1.1 401 Unauthorized\`

### Teste com autenticação válida
\`\`\`bash
curl -i -H "X-API-Key: minha-chave-secreta-123" http://localhost:9080/api/v1/produtos/
\`\`\`
Resposta esperada: \`HTTP/1.1 200 OK\` com o corpo da resposta do seu serviço backend.

### Teste com método não permitido (deve retornar 404)
\`\`\`bash
curl -i -X DELETE -H "X-API-Key: minha-chave-secreta-123" http://localhost:9080/api/v1/produtos/1
\`\`\`
Como a rota aceita apenas GET e POST, requisições DELETE serão rejeitadas.

> **Nota:** A porta \`9080\` é a porta padrão do gateway para tráfego HTTP. Em produção, use a porta \`9443\` com HTTPS habilitado.`,
        },
        {
          id: "monitorar",
          title: "Passo 5: Monitorando Métricas",
          body: `Após fazer algumas requisições de teste, acesse a seção de monitoramento para visualizar as métricas da sua API:

1. Na barra lateral, acesse **Monitoramento**
2. Na aba **Analytics**, você verá gráficos de:
   - **Requisições por segundo** — Volume de tráfego ao longo do tempo
   - **Latência** — Tempo de resposta em percentis (p50, p95, p99)
   - **Status HTTP** — Distribuição de códigos de resposta (2xx, 4xx, 5xx)
   - **Tráfego por rota** — Comparativo entre suas APIs

3. Use o seletor de período para ajustar o intervalo de tempo (última hora, últimas 24h, últimos 7 dias)

Você também pode acessar métricas específicas de uma rota pela página de detalhes da API:

1. Acesse **APIs** e clique na sua rota
2. Navegue até a aba **Analytics**
3. Veja métricas isoladas daquela rota específica

> **Dica:** Configure alertas na aba **Alertas** do monitoramento para ser notificado quando a taxa de erros ultrapassar um limite ou a latência ficar acima do aceitável. Isso permite resposta rápida a incidentes.`,
        },
      ],
    },
  ],
}
