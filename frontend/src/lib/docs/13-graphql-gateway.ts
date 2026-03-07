import type { DocCategory } from "./types"

export const graphqlGatewayCategory: DocCategory = {
  slug: "graphql-gateway",
  title: "GraphQL Gateway",
  description:
    "Proteja, controle e converta APIs GraphQL com plugins de segurança, limites de complexidade e conversão REST-to-GraphQL.",
  icon: "Braces",
  articles: [
    // ── 1. Visão Geral ──────────────────────────────────────────────────
    {
      slug: "visao-geral-graphql",
      title: "Visão Geral do GraphQL Gateway",
      description:
        "Entenda como o API Gateway suporta APIs GraphQL, incluindo roteamento por operação, plugins de segurança e conversão REST-to-GraphQL.",
      icon: "Braces",
      tags: ["graphql", "overview", "gateway", "segurança"],
      content: [
        {
          id: "o-que-e",
          title: "O que é o GraphQL Gateway",
          body: `O GraphQL Gateway é um conjunto de funcionalidades do API Gateway que permite gerenciar, proteger e otimizar APIs GraphQL. Em vez de expor seu servidor GraphQL diretamente, você coloca o API Gateway na frente, ganhando controle total sobre quem pode executar quais queries, com qual complexidade e frequência.

Com o GraphQL Gateway você pode:

- **Filtrar rotas por operação** — diferencie queries, mutations e subscriptions para aplicar políticas específicas
- **Limitar profundidade** de queries para prevenir ataques de nesting excessivo
- **Controlar complexidade** com análise de custo por campo e multiplicadores de lista
- **Restringir queries** com allowlist de queries persistidas (persisted queries)
- **Bloquear introspecção** em produção para evitar exposição do schema
- **Converter REST em GraphQL** com o plugin degraphql, expondo uma facade REST sobre backends GraphQL

> **Nota:** Todos os plugins GraphQL funcionam na fase de request (access), analisando o body da requisição JSON (\`{query, variables, operationName}\`) antes de encaminhá-lo ao upstream.`,
        },
        {
          id: "como-funciona",
          title: "Como Funciona",
          body: `O API Gateway suporta nativamente variáveis de matching GraphQL nas rotas. Quando uma requisição GraphQL chega (POST com body JSON contendo \`query\`), o gateway pode extrair:

- **graphql_operation** — tipo da operação (query, mutation, subscription)
- **graphql_name** — nome da operação (ex: GetUser, CreateOrder)
- **graphql_root_fields** — campos raiz do query (ex: user, posts)

Essas variáveis podem ser usadas nas condições de match da rota, permitindo criar flows separados para diferentes operações GraphQL. Por exemplo, um flow para queries de leitura com cache habilitado e outro flow para mutations com rate limiting mais restritivo.

Os plugins de segurança GraphQL adicionam uma camada extra de proteção:

1. **graphql-allowlist** (prioridade 506) — verifica se o query está na lista de queries permitidas
2. **graphql-depth-limit** (prioridade 505) — verifica a profundidade máxima de nesting
3. **graphql-complexity** (prioridade 504) — calcula o custo total do query
4. **graphql-introspection-guard** (prioridade 503) — bloqueia queries de introspecção

A ordem de prioridade garante que queries desconhecidas sejam rejeitadas antes de gastar recursos com análise de profundidade ou complexidade.`,
        },
        {
          id: "casos-de-uso",
          title: "Casos de Uso",
          body: `**APIs GraphQL Públicas**

Se você expõe uma API GraphQL para consumidores externos (mobile apps, parceiros, third-parties), o GraphQL Gateway é essencial. Consumidores podem enviar queries arbitrariamente complexas que sobrecarregam seu backend. Com os plugins de segurança você limita o que pode ser executado.

**Backend-for-Frontend (BFF)**

Use o plugin degraphql para criar endpoints REST especificos para cada frontend (web, mobile, IoT) que internamente executam queries GraphQL otimizadas. Isso simplifica o consumo pelos frontends enquanto mantém a flexibilidade do GraphQL no backend.

**Microsserviços com GraphQL Federation**

Coloque o API Gateway na frente do seu router de federation (Apollo Gateway, Mesh) para adicionar autenticação, rate limiting e observabilidade centralizados, sem modificar o código dos subgraphs.

**Migrações REST → GraphQL**

Use o roteamento por operação para migrar gradualmente — endpoints legados continuam como REST enquanto novos endpoints usam GraphQL, tudo sob o mesmo domínio.`,
        },
      ],
    },
    // ── 2. Roteamento GraphQL ──────────────────────────────────────────
    {
      slug: "roteamento-graphql",
      title: "Roteamento por Operação GraphQL",
      description:
        "Configure flows que filtram por tipo de operação (query/mutation/subscription), nome e root fields.",
      icon: "GitBranch",
      tags: ["graphql", "roteamento", "operação", "vars", "matching"],
      content: [
        {
          id: "matching-graphql",
          title: "Matching de Operações GraphQL",
          body: `O API Gateway permite criar flows que correspondem a operações GraphQL específicas. No editor de flows, abra as opções da rota (ícone de engrenagem) e configure a seção **GraphQL Matching**:

**Operation** — filtra pelo tipo de operação GraphQL:
- \`query\` — operações de leitura
- \`mutation\` — operações de escrita
- \`subscription\` — operações de streaming
- Vazio = aceita todas as operações

**Operation Name** — filtra pelo nome da operação definido no query. Exemplo: se o cliente envia \`query GetUser { ... }\`, você pode criar um flow que só corresponde a \`GetUser\`.

**Root Fields** — filtra pelos campos raiz do query, separados por vírgula. Exemplo: \`user, posts\` corresponde a queries que acessam os campos \`user\` ou \`posts\` no nível raiz.

> **Dica:** Combine roteamento por operação com políticas diferentes. Por exemplo: queries de leitura com cache de 60s + mutations com rate limiting de 10 req/min.`,
        },
        {
          id: "exemplos-roteamento",
          title: "Exemplos de Roteamento",
          body: `**Flow 1: Queries de leitura com cache**

\`\`\`
URI: /graphql
Methods: POST
GraphQL Operation: query
Políticas: proxy-cache (ttl: 60), limit-count (100/min)
\`\`\`

**Flow 2: Mutations com rate limiting estrito**

\`\`\`
URI: /graphql
Methods: POST
GraphQL Operation: mutation
Políticas: limit-count (10/min), key-auth
\`\`\`

**Flow 3: Operação específica**

\`\`\`
URI: /graphql
Methods: POST
GraphQL Operation: query
Operation Name: InternalReport
Políticas: ip-restriction (somente IPs internos)
\`\`\`

Cada flow gera uma rota APISIX separada com \`vars\` contendo as condicoes GraphQL. O gateway avalia as rotas em ordem de prioridade e encaminha a requisicao para o primeiro flow que corresponde.`,
        },
        {
          id: "como-funciona-vars",
          title: "Como Funciona Internamente",
          body: `Quando você configura GraphQL Matching no flow editor, o sistema converte automaticamente para o formato \`vars\` do APISIX:

\`\`\`json
{
  "uri": "/graphql",
  "methods": ["POST"],
  "vars": [
    ["graphql_operation", "==", "query"],
    ["graphql_name", "==", "GetUser"]
  ]
}
\`\`\`

O APISIX extrai essas informações do body da requisição GraphQL automaticamente. Variáveis suportadas:

- \`graphql_operation\` — tipo: query, mutation ou subscription
- \`graphql_name\` — nome da operação (string após query/mutation/subscription)
- \`graphql_root_fields\` — campos raiz selecionados (use operador \`has\` para matching parcial)

> **Importante:** O matching GraphQL só funciona com requisições POST contendo body JSON válido com o campo \`query\`. Requisições GET com query na URL não são analisadas.`,
        },
      ],
    },
    // ── 3. Depth Limit ─────────────────────────────────────────────────
    {
      slug: "graphql-depth-limit",
      title: "GraphQL Depth Limit",
      description:
        "Limite a profundidade de nesting de queries GraphQL para prevenir ataques de profundidade excessiva.",
      icon: "Layers",
      tags: ["graphql", "segurança", "depth", "nesting", "plugin"],
      content: [
        {
          id: "visao-geral",
          title: "Visão Geral",
          body: `O plugin **Depth Limit** protege seu backend GraphQL contra queries com nesting excessivo. Queries profundamente aninhadas podem causar:

- Carga exponencial no banco de dados (N+1 queries multiplicados por cada nível)
- Consumo excessivo de memória no resolver
- Timeouts que degradam a experiência de todos os usuários

O plugin analisa o body da requisição, conta a profundidade máxima de chaves \`{ }\` (ignorando conteúdo dentro de strings) e rejeita ou loga queries que excedem o limite configurado.

**Exemplo de query com profundidade 4:**

\`\`\`graphql
query {          # depth 1
  users {        # depth 2
    posts {      # depth 3
      comments { # depth 4
        author {
          name
        }
      }
    }
  }
}
\`\`\``,
        },
        {
          id: "configuracao",
          title: "Configuração",
          body: `**max_depth** (inteiro, padrão: 10)

Profundidade máxima permitida. Valores recomendados:
- **5-7** para APIs públicas
- **10-15** para APIs internas
- **3-5** para endpoints GraphQL muito restritos

**action** (string, padrão: "reject")

Ação quando o limite é excedido:
- \`reject\` — retorna HTTP 400 com mensagem de erro
- \`log\` — apenas loga o aviso, permite a requisição

> **Dica:** Comece com \`action: "log"\` e um limite generoso para descobrir a profundidade real das queries dos seus clientes. Depois ajuste para \`reject\` com o limite adequado.`,
        },
        {
          id: "exemplos",
          title: "Exemplos de Configuração",
          body: `**API Pública — Limite estrito**

\`\`\`json
{
  "max_depth": 5,
  "action": "reject"
}
\`\`\`

Rejeita qualquer query com mais de 5 níveis de nesting. Ideal para APIs expostas na internet.

**Modo de Auditoria — Descoberta**

\`\`\`json
{
  "max_depth": 8,
  "action": "log"
}
\`\`\`

Loga queries profundas sem bloquear. Use durante o período de descoberta para entender o padrão de uso.

**Resposta de erro (quando rejeitado):**

\`\`\`json
{
  "message": "GraphQL query depth (7) exceeds maximum of 5"
}
\`\`\`

O status HTTP retornado e **400 Bad Request**.`,
        },
      ],
    },
    // ── 4. Complexity Limit ────────────────────────────────────────────
    {
      slug: "graphql-complexity",
      title: "GraphQL Complexity Limit",
      description:
        "Análise de custo por campo com pesos configuráveis e multiplicadores de lista.",
      icon: "Calculator",
      tags: ["graphql", "segurança", "complexity", "custo", "plugin"],
      content: [
        {
          id: "visao-geral",
          title: "Visão Geral",
          body: `O plugin **Complexity Limit** vai além do limite de profundidade e avalia o custo total de uma query GraphQL. Enquanto o depth limit pega queries profundas, o complexity limit pega queries **largas** — aquelas que buscam muitos campos ou listas grandes.

**Como funciona:**

1. O plugin escaneia a query buscando nomes de campos
2. Cada campo recebe um custo (configurável ou padrão)
3. Argumentos de lista (ex: \`first: 100\`) atuam como multiplicadores
4. O custo total é a soma de (custo_campo x multiplicador) para todos os campos
5. Se o total exceder o máximo, a requisição é rejeitada ou logada

**Exemplo:**

\`\`\`graphql
query {
  users(first: 100) {   # custo: 1 x 100 = 100
    name                 # custo: 1
    posts(first: 50) {   # custo: 1 x 50 = 50
      title              # custo: 1
      comments {         # custo: 1
        body             # custo: 1
      }
    }
  }
}
# Total: ~154
\`\`\``,
        },
        {
          id: "configuracao",
          title: "Configuração",
          body: `**max_complexity** (inteiro, padrão: 1000)

Custo máximo total permitido. Valores recomendados:
- **200-500** para APIs públicas
- **1000-2000** para APIs internas
- **100-200** para endpoints muito restritos

**default_field_cost** (inteiro, padrão: 1)

Custo padrão atribuído a cada campo que não tem custo específico.

**field_costs** (objeto, padrão: {})

Mapa de nomes de campo para custos específicos. Use para atribuir custos maiores a campos que envolvem operações caras:

\`\`\`json
{
  "field_costs": {
    "search": 10,
    "analytics": 20,
    "export": 50,
    "recommendations": 15
  }
}
\`\`\`

**list_size_argument** (string, padrão: "first")

Nome do argumento usado para detectar tamanho de listas. Comum: \`first\`, \`limit\`, \`count\`, \`pageSize\`.

**action** (string, padrão: "reject")

- \`reject\` — retorna HTTP 400
- \`log\` — apenas loga`,
        },
        {
          id: "estrategia",
          title: "Estratégia de Rollout",
          body: `**Passo 1: Descoberta**

Configure com \`action: "log"\` e um limite alto:

\`\`\`json
{
  "max_complexity": 5000,
  "default_field_cost": 1,
  "action": "log"
}
\`\`\`

Monitore os logs para entender os custos reais das queries dos seus clientes.

**Passo 2: Mapeamento de custos**

Identifique os campos mais caros (busca full-text, joins complexos, chamadas externas) e configure \`field_costs\` adequadamente.

**Passo 3: Enforcement gradual**

Reduza o \`max_complexity\` gradualmente e mude para \`action: "reject"\` quando estiver confiante nos limites.

> **Combinação recomendada:** Use depth limit + complexity limit juntos. O depth limit é rápido e pega ataques óbvios. O complexity limit é mais preciso e pega queries largas que o depth limit não detecta.`,
        },
      ],
    },
    // ── 5. Allowlist (Persisted Queries) ───────────────────────────────
    {
      slug: "graphql-allowlist",
      title: "Query Allowlist (Persisted Queries)",
      description:
        "Restrinja a execução apenas a queries pré-registradas, identificadas por hash MD5.",
      icon: "ListChecks",
      tags: ["graphql", "segurança", "allowlist", "persisted", "hash", "plugin"],
      content: [
        {
          id: "visao-geral",
          title: "Visão Geral",
          body: `O plugin **Query Allowlist** implementa persisted queries — somente queries pré-registradas podem ser executadas. Cada query é normalizada (whitespace colapsado) e hashada (MD5). Se o hash não estiver na lista de permitidas, a requisição é rejeitada (modo enforce) ou logada (modo auditoria).

**Por que usar persisted queries?**

- **Segurança máxima** — atacantes não podem enviar queries arbitrárias
- **Performance previsível** — você sabe exatamente quais queries serão executadas
- **Governança** — cada query nova passa por revisão antes de ser adicionada ao allowlist
- **Prevenção de exfiltração** — impede que dados sensíveis sejam acessados via queries crafted

**Fluxo de trabalho:**

1. Desenvolvedores escrevem queries no frontend
2. CI/CD extrai as queries e gera os hashes MD5
3. Hashes são adicionados à configuração do plugin
4. Em produção, apenas essas queries são permitidas`,
        },
        {
          id: "configuracao",
          title: "Configuração",
          body: `**enforce** (boolean, padrão: false)

- \`false\` — modo auditoria: loga queries desconhecidas mas permite
- \`true\` — modo enforcement: rejeita queries desconhecidas com HTTP 403

**allowed_queries** (array, padrão: [])

Lista de queries permitidas, cada uma com:
- \`name\` (string) — nome legível para referência (ex: "GetUser")
- \`hash\` (string) — hash MD5 da query normalizada

\`\`\`json
{
  "enforce": true,
  "allowed_queries": [
    { "name": "GetCurrentUser", "hash": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4" },
    { "name": "ListProducts", "hash": "f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3" },
    { "name": "CreateOrder", "hash": "1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d" }
  ]
}
\`\`\`

> **Dica:** A resposta de rejeição inclui o hash da query enviada, facilitando a adição ao allowlist:
> \`{"message": "GraphQL query not in allowlist", "hash": "abc123..."}\``,
        },
        {
          id: "gerando-hashes",
          title: "Gerando Hashes",
          body: `**Via linha de comando:**

\`\`\`bash
# Normalizar e gerar hash de uma query
echo -n 'query GetUser($id: ID!) { user(id: $id) { id name email } }' | \\
  tr -s '[:space:]' ' ' | sed 's/^ //;s/ $//' | md5sum
\`\`\`

**Via script no CI/CD:**

Extraia queries dos arquivos do frontend (ex: arquivos \`.graphql\` ou template literals) e gere hashes automaticamente durante o build.

**Normalização:**

O plugin normaliza queries antes de hashear:
1. Remove espaços em branco no início e fim
2. Colapsa múltiplos espaços/tabs/newlines em um único espaço

Isso significa que a mesma query formatada de formas diferentes gera o mesmo hash:

\`\`\`graphql
# Estas duas queries geram o MESMO hash:
query { user { name } }

query {
  user {
    name
  }
}
\`\`\`

> **Atenção:** Queries semanticamente equivalentes com campos em ordem diferente geram hashes DIFERENTES. A normalização é apenas de whitespace, não semântica.`,
        },
      ],
    },
    // ── 6. Introspection Guard ─────────────────────────────────────────
    {
      slug: "graphql-introspection-guard",
      title: "Introspection Guard",
      description:
        "Bloqueie queries de introspecção (__schema, __type) em ambientes de produção.",
      icon: "EyeOff",
      tags: ["graphql", "segurança", "introspecção", "schema", "produção", "plugin"],
      content: [
        {
          id: "visao-geral",
          title: "Visão Geral",
          body: `O plugin **Introspection Guard** bloqueia queries de introspecção GraphQL em produção. A introspecção permite que qualquer cliente descubra todo o schema da sua API — tipos, campos, argumentos, relações — o que é útil em desenvolvimento mas perigoso em produção.

**O que a introspecção expõe:**

- Lista completa de todos os tipos e campos
- Argumentos de cada campo com tipos e valores padrão
- Relacionamentos entre tipos
- Descrições de campos (que podem conter informações sensíveis)
- Diretivas customizadas

**Como o plugin funciona:**

1. Lê o body da requisição GraphQL
2. Busca por \`__schema\` ou \`__type\` no texto da query
3. Se encontrar, verifica se a operação está na lista de bypass
4. Se não estiver permitida, rejeita com HTTP 403 ou loga

> **Nota:** Bloquear introspecção é uma das primeiras recomendações de segurança para APIs GraphQL em produção. Ferramentas como GraphQL Voyager e GraphiQL dependem de introspecção para funcionar.`,
        },
        {
          id: "configuracao",
          title: "Configuração",
          body: `**block_introspection** (boolean, padrão: true)

- \`true\` — bloqueia queries com introspecção
- \`false\` — desativa o plugin (permite tudo)

**allowed_operation_names** (array de strings, padrão: [])

Lista de nomes de operação que podem fazer introspecção mesmo quando o bloqueio está ativo. Útil para ferramentas internas:

\`\`\`json
{
  "block_introspection": true,
  "allowed_operation_names": [
    "InternalSchemaCheck",
    "MonitoringIntrospection"
  ],
  "action": "reject"
}
\`\`\`

**action** (string, padrão: "reject")

- \`reject\` — retorna HTTP 403 com mensagem "GraphQL introspection is not allowed"
- \`log\` — apenas loga a tentativa de introspecção

> **Dica:** O plugin verifica o \`operationName\` do body JSON primeiro. Se nao existir, extrai o nome da operacao do texto do query (ex: \`query InternalSchemaCheck { __schema { ... } }\`).`,
        },
        {
          id: "boas-praticas",
          title: "Boas Práticas",
          body: `**1. Sempre habilite em produção**

Introspecção é uma das primeiras coisas que atacantes testam. Mesmo se você não tem dados sensíveis no schema, a informação estrutural ajuda a planejar ataques mais sofisticados.

**2. Use ambientes diferenciados**

- **Desenvolvimento/Staging** — introspecção habilitada (não use este plugin)
- **Produção** — introspecção bloqueada (plugin ativo)

Configure por ambiente usando o sistema de multi-ambiente do API Gateway.

**3. Bypass para tooling interno**

Se você usa ferramentas como Apollo Studio ou schema registry que precisam de introspecção, adicione os nomes de operação delas no \`allowed_operation_names\`. Combine com \`ip-restriction\` para garantir que só IPs internos possam executar essas operações.

**4. Combine com allowlist**

A combinação mais segura é:
1. **Introspection Guard** — bloqueia descoberta do schema
2. **Query Allowlist** — só permite queries conhecidas
3. **Depth Limit** — protege contra queries profundas das queries permitidas
4. **Complexity Limit** — protege contra queries largas

Essa pilha de defesa (defense in depth) garante máxima proteção para sua API GraphQL.`,
        },
      ],
    },
    // ── 7. REST-to-GraphQL (degraphql) ─────────────────────────────────
    {
      slug: "degraphql",
      title: "REST-to-GraphQL (degraphql)",
      description:
        "Converta endpoints REST em queries GraphQL automaticamente, expondo uma facade REST sobre backends GraphQL.",
      icon: "ArrowLeftRight",
      tags: ["graphql", "rest", "conversão", "degraphql", "facade", "plugin"],
      content: [
        {
          id: "visao-geral",
          title: "Visão Geral",
          body: `O plugin **degraphql** permite expor endpoints REST que internamente executam queries GraphQL no upstream. Você define um template de query GraphQL na configuração da rota, e quando uma requisição REST chega, o plugin substitui variáveis no template com parâmetros da requisição (path, query string, body) e envia a query GraphQL ao upstream.

**Casos de uso:**

- **Backend-for-Frontend** — crie endpoints REST otimizados para cada cliente (web, mobile, IoT) que internamente usam GraphQL
- **Migrações graduais** — exponha novos endpoints REST sobre um backend GraphQL existente
- **Simplificação** — consumidores que não querem/podem usar GraphQL recebem uma API REST convencional
- **Performance** — cada endpoint REST executa exatamente a query necessária, sem over-fetching

> **Nota:** O editor visual do degraphql (disponível no flow editor) facilita a criação de templates com auto-detecção de variáveis e biblioteca de templates prontos.`,
        },
        {
          id: "configuracao",
          title: "Configuração",
          body: `**query** (string, obrigatório)

O template da query GraphQL. Use variáveis com \`$nome\` que serão substituídas por parâmetros da requisição REST:

\`\`\`json
{
  "query": "query($id: ID!) { user(id: $id) { id name email avatar } }",
  "variables": ["id"]
}
\`\`\`

**variables** (array de strings)

Lista de nomes de parâmetros REST que serão mapeados para variáveis GraphQL. Os parâmetros são extraídos de:
- Path parameters (ex: \`/users/:id\` → variável \`id\`)
- Query string (ex: \`?filter=active\` → variável \`filter\`)

**Editor visual:**

O flow editor inclui um editor visual dedicado para o degraphql com:
- **Templates prontos** — Get by ID, List with Filter, Create Mutation, Search
- **Auto-detect** — extrai automaticamente variáveis \`$nome\` do template
- **Tabela de mapeamento** — mapeia parâmetros REST para variáveis GraphQL com tipos`,
        },
        {
          id: "exemplos",
          title: "Exemplos Práticos",
          body: `**Endpoint: GET /users/:id**

\`\`\`json
{
  "query": "query($id: ID!) { user(id: $id) { id name email avatar createdAt } }",
  "variables": ["id"]
}
\`\`\`

Requisição: \`GET /users/123\`
Query enviada ao upstream: \`query($id: ID!) { user(id: $id) { ... } }\` com \`variables: {"id": "123"}\`

**Endpoint: GET /products?category=X&limit=Y**

\`\`\`json
{
  "query": "query($category: String, $limit: Int) { products(filter: {category: $category}, first: $limit) { id name price imageUrl } }",
  "variables": ["category", "limit"]
}
\`\`\`

**Endpoint: POST /orders (mutation)**

\`\`\`json
{
  "query": "mutation($input: CreateOrderInput!) { createOrder(input: $input) { id status total createdAt } }",
  "variables": ["input"]
}
\`\`\`

> **Dica:** Combine com \`proxy-cache\` para cachear respostas de endpoints REST-to-GraphQL de leitura. Como cada endpoint REST tem um URL fixo, o cache funciona perfeitamente.`,
        },
      ],
    },
    // ── 8. Boas Práticas ───────────────────────────────────────────────
    {
      slug: "boas-praticas-graphql",
      title: "Boas Práticas para APIs GraphQL",
      description:
        "Recomendações de segurança, performance e operação para APIs GraphQL no API Gateway.",
      icon: "Shield",
      tags: ["graphql", "boas-praticas", "segurança", "performance"],
      content: [
        {
          id: "seguranca",
          title: "Segurança",
          body: `**1. Defense in Depth**

Nunca dependa de um único mecanismo de proteção. A pilha recomendada para APIs GraphQL públicas:

| Ordem | Plugin | Função |
|-------|--------|--------|
| 1 | key-auth ou jwt-auth | Autenticação |
| 2 | limit-count | Rate limiting |
| 3 | graphql-allowlist | Restringe a queries conhecidas |
| 4 | graphql-depth-limit | Previne nesting excessivo |
| 5 | graphql-complexity | Previne queries caras |
| 6 | graphql-introspection-guard | Bloqueia descoberta do schema |

**2. Sempre bloqueie introspecção em produção**

Mesmo com allowlist habilitado, bloqueie introspecção como defesa adicional.

**3. Use HTTPS**

Queries GraphQL frequentemente contêm dados sensiveis no body (variaveis com tokens, senhas, dados pessoais). Sempre use HTTPS.

**4. Valide inputs no upstream**

Os plugins do gateway fazem análise heurística — não substituem validação de input no servidor GraphQL.`,
        },
        {
          id: "performance",
          title: "Performance",
          body: `**1. Cache por operação**

Use roteamento por operação para aplicar cache seletivamente:
- Queries de leitura → proxy-cache com TTL adequado
- Mutations → sem cache

**2. Limite listas**

Configure \`graphql-complexity\` com \`list_size_argument\` para penalizar listas grandes. Um \`users(first: 1000)\` custa muito mais que \`users(first: 10)\`.

**3. Persisted queries para performance**

Além de segurança, persisted queries reduzem o tamanho das requisições. Clientes podem enviar apenas o hash em vez da query completa (se o upstream suportar APQ — Automatic Persisted Queries).

**4. Monitore complexidade**

Use \`action: "log"\` no complexity limit para coletar métricas de custo das queries. Identifique as queries mais caras e otimize seus resolvers.`,
        },
        {
          id: "operacao",
          title: "Operação",
          body: `**1. Rollout gradual**

Sempre comece com \`action: "log"\` em todos os plugins GraphQL. Monitore por 1-2 semanas, ajuste limites, depois mude para \`action: "reject"\`.

**2. Alertas**

Configure alertas no sistema de monitoramento para:
- Taxa alta de rejeições GraphQL (indica clientes quebrando)
- Queries com profundidade ou complexidade próxima do limite (indica necessidade de ajuste)
- Tentativas de introspecção (indica reconhecimento por atacantes)

**3. Documentação para consumidores**

Documente os limites de profundidade e complexidade na documentação da API. Consumidores precisam saber os limites para escrever queries adequadas.

**4. Ambientes diferenciados**

| Ambiente | Introspecção | Allowlist | Depth | Complexity |
|----------|-------------|-----------|-------|------------|
| Dev | Liberado | Desligado | 20 (log) | 5000 (log) |
| Staging | Bloqueado | Auditoria | 10 (reject) | 1000 (reject) |
| Produção | Bloqueado | Enforce | 7 (reject) | 500 (reject) |`,
        },
      ],
    },
  ],
}
