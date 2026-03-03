import type { DocCategory } from "./types"

export const graphqlGatewayCategory: DocCategory = {
  slug: "graphql-gateway",
  title: "GraphQL Gateway",
  description:
    "Proteja, controle e converta APIs GraphQL com plugins de seguranca, limites de complexidade e conversao REST-to-GraphQL.",
  icon: "Braces",
  articles: [
    // ── 1. Visao Geral ──────────────────────────────────────────────────
    {
      slug: "visao-geral-graphql",
      title: "Visao Geral do GraphQL Gateway",
      description:
        "Entenda como o API Gateway suporta APIs GraphQL, incluindo roteamento por operacao, plugins de seguranca e conversao REST-to-GraphQL.",
      icon: "Braces",
      tags: ["graphql", "overview", "gateway", "seguranca"],
      content: [
        {
          id: "o-que-e",
          title: "O que e o GraphQL Gateway",
          body: `O GraphQL Gateway e um conjunto de funcionalidades do API Gateway que permite gerenciar, proteger e otimizar APIs GraphQL. Em vez de expor seu servidor GraphQL diretamente, voce coloca o API Gateway na frente, ganhando controle total sobre quem pode executar quais queries, com qual complexidade e frequencia.

Com o GraphQL Gateway voce pode:

- **Filtrar rotas por operacao** — diferencie queries, mutations e subscriptions para aplicar politicas especificas
- **Limitar profundidade** de queries para prevenir ataques de nesting excessivo
- **Controlar complexidade** com analise de custo por campo e multiplicadores de lista
- **Restringir queries** com allowlist de queries persistidas (persisted queries)
- **Bloquear introspeccao** em producao para evitar exposicao do schema
- **Converter REST em GraphQL** com o plugin degraphql, expondo uma facade REST sobre backends GraphQL

> **Nota:** Todos os plugins GraphQL funcionam na fase de request (access), analisando o body da requisicao JSON (\`{query, variables, operationName}\`) antes de encaminha-lo ao upstream.`,
        },
        {
          id: "como-funciona",
          title: "Como Funciona",
          body: `O API Gateway suporta nativamente variaveis de matching GraphQL nas rotas. Quando uma requisicao GraphQL chega (POST com body JSON contendo \`query\`), o gateway pode extrair:

- **graphql_operation** — tipo da operacao (query, mutation, subscription)
- **graphql_name** — nome da operacao (ex: GetUser, CreateOrder)
- **graphql_root_fields** — campos raiz do query (ex: user, posts)

Essas variaveis podem ser usadas nas condicoes de match da rota, permitindo criar flows separados para diferentes operacoes GraphQL. Por exemplo, um flow para queries de leitura com cache habilitado e outro flow para mutations com rate limiting mais restritivo.

Os plugins de seguranca GraphQL adicionam uma camada extra de protecao:

1. **graphql-allowlist** (prioridade 506) — verifica se o query esta na lista de queries permitidas
2. **graphql-depth-limit** (prioridade 505) — verifica a profundidade maxima de nesting
3. **graphql-complexity** (prioridade 504) — calcula o custo total do query
4. **graphql-introspection-guard** (prioridade 503) — bloqueia queries de introspeccao

A ordem de prioridade garante que queries desconhecidas sejam rejeitadas antes de gastar recursos com analise de profundidade ou complexidade.`,
        },
        {
          id: "casos-de-uso",
          title: "Casos de Uso",
          body: `**APIs GraphQL Publicas**

Se voce expoe uma API GraphQL para consumidores externos (mobile apps, parceiros, third-parties), o GraphQL Gateway e essencial. Consumidores podem enviar queries arbitrariamente complexas que sobrecarregam seu backend. Com os plugins de seguranca voce limita o que pode ser executado.

**Backend-for-Frontend (BFF)**

Use o plugin degraphql para criar endpoints REST especificos para cada frontend (web, mobile, IoT) que internamente executam queries GraphQL otimizadas. Isso simplifica o consumo pelos frontends enquanto mantém a flexibilidade do GraphQL no backend.

**Microservicos com GraphQL Federation**

Coloque o API Gateway na frente do seu router de federation (Apollo Gateway, Mesh) para adicionar autenticacao, rate limiting e observabilidade centralizados, sem modificar o codigo dos subgraphs.

**Migracoes REST → GraphQL**

Use o roteamento por operacao para migrar gradualmente — endpoints legados continuam como REST enquanto novos endpoints usam GraphQL, tudo sob o mesmo dominio.`,
        },
      ],
    },
    // ── 2. Roteamento GraphQL ──────────────────────────────────────────
    {
      slug: "roteamento-graphql",
      title: "Roteamento por Operacao GraphQL",
      description:
        "Configure flows que filtram por tipo de operacao (query/mutation/subscription), nome e root fields.",
      icon: "GitBranch",
      tags: ["graphql", "roteamento", "operacao", "vars", "matching"],
      content: [
        {
          id: "matching-graphql",
          title: "Matching de Operacoes GraphQL",
          body: `O API Gateway permite criar flows que correspondem a operacoes GraphQL especificas. No editor de flows, abra as opcoes da rota (icone de engrenagem) e configure a secao **GraphQL Matching**:

**Operation** — filtra pelo tipo de operacao GraphQL:
- \`query\` — operacoes de leitura
- \`mutation\` — operacoes de escrita
- \`subscription\` — operacoes de streaming
- Vazio = aceita todas as operacoes

**Operation Name** — filtra pelo nome da operacao definido no query. Exemplo: se o cliente envia \`query GetUser { ... }\`, voce pode criar um flow que so corresponde a \`GetUser\`.

**Root Fields** — filtra pelos campos raiz do query, separados por virgula. Exemplo: \`user, posts\` corresponde a queries que acessam os campos \`user\` ou \`posts\` no nivel raiz.

> **Dica:** Combine roteamento por operacao com politicas diferentes. Por exemplo: queries de leitura com cache de 60s + mutations com rate limiting de 10 req/min.`,
        },
        {
          id: "exemplos-roteamento",
          title: "Exemplos de Roteamento",
          body: `**Flow 1: Queries de leitura com cache**

\`\`\`
URI: /graphql
Methods: POST
GraphQL Operation: query
Politicas: proxy-cache (ttl: 60), limit-count (100/min)
\`\`\`

**Flow 2: Mutations com rate limiting estrito**

\`\`\`
URI: /graphql
Methods: POST
GraphQL Operation: mutation
Politicas: limit-count (10/min), key-auth
\`\`\`

**Flow 3: Operacao especifica**

\`\`\`
URI: /graphql
Methods: POST
GraphQL Operation: query
Operation Name: InternalReport
Politicas: ip-restriction (somente IPs internos)
\`\`\`

Cada flow gera uma rota APISIX separada com \`vars\` contendo as condicoes GraphQL. O gateway avalia as rotas em ordem de prioridade e encaminha a requisicao para o primeiro flow que corresponde.`,
        },
        {
          id: "como-funciona-vars",
          title: "Como Funciona Internamente",
          body: `Quando voce configura GraphQL Matching no flow editor, o sistema converte automaticamente para o formato \`vars\` do APISIX:

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

O APISIX extrai essas informacoes do body da requisicao GraphQL automaticamente. Variaveis suportadas:

- \`graphql_operation\` — tipo: query, mutation ou subscription
- \`graphql_name\` — nome da operacao (string apos query/mutation/subscription)
- \`graphql_root_fields\` — campos raiz selecionados (use operador \`has\` para matching parcial)

> **Importante:** O matching GraphQL so funciona com requisicoes POST contendo body JSON valido com o campo \`query\`. Requisicoes GET com query na URL nao sao analisadas.`,
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
      tags: ["graphql", "seguranca", "depth", "nesting", "plugin"],
      content: [
        {
          id: "visao-geral",
          title: "Visao Geral",
          body: `O plugin **Depth Limit** protege seu backend GraphQL contra queries com nesting excessivo. Queries profundamente aninhadas podem causar:

- Carga exponencial no banco de dados (N+1 queries multiplicados por cada nivel)
- Consumo excessivo de memoria no resolver
- Timeouts que degradam a experiencia de todos os usuarios

O plugin analisa o body da requisicao, conta a profundidade maxima de chaves \`{ }\` (ignorando conteudo dentro de strings) e rejeita ou loga queries que excedem o limite configurado.

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
          title: "Configuracao",
          body: `**max_depth** (inteiro, padrao: 10)

Profundidade maxima permitida. Valores recomendados:
- **5-7** para APIs publicas
- **10-15** para APIs internas
- **3-5** para endpoints GraphQL muito restritos

**action** (string, padrao: "reject")

Acao quando o limite e excedido:
- \`reject\` — retorna HTTP 400 com mensagem de erro
- \`log\` — apenas loga o aviso, permite a requisicao

> **Dica:** Comece com \`action: "log"\` e um limite generoso para descobrir a profundidade real das queries dos seus clientes. Depois ajuste para \`reject\` com o limite adequado.`,
        },
        {
          id: "exemplos",
          title: "Exemplos de Configuracao",
          body: `**API Publica — Limite estrito**

\`\`\`json
{
  "max_depth": 5,
  "action": "reject"
}
\`\`\`

Rejeita qualquer query com mais de 5 niveis de nesting. Ideal para APIs expostas na internet.

**Modo de Auditoria — Descoberta**

\`\`\`json
{
  "max_depth": 8,
  "action": "log"
}
\`\`\`

Loga queries profundas sem bloquear. Use durante o periodo de descoberta para entender o padrao de uso.

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
        "Analise de custo por campo com pesos configuraveis e multiplicadores de lista.",
      icon: "Calculator",
      tags: ["graphql", "seguranca", "complexity", "custo", "plugin"],
      content: [
        {
          id: "visao-geral",
          title: "Visao Geral",
          body: `O plugin **Complexity Limit** vai alem do limite de profundidade e avalia o custo total de uma query GraphQL. Enquanto o depth limit pega queries profundas, o complexity limit pega queries **largas** — aquelas que buscam muitos campos ou listas grandes.

**Como funciona:**

1. O plugin escaneia a query buscando nomes de campos
2. Cada campo recebe um custo (configuravel ou padrao)
3. Argumentos de lista (ex: \`first: 100\`) atuam como multiplicadores
4. O custo total e a soma de (custo_campo x multiplicador) para todos os campos
5. Se o total exceder o maximo, a requisicao e rejeitada ou logada

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
          title: "Configuracao",
          body: `**max_complexity** (inteiro, padrao: 1000)

Custo maximo total permitido. Valores recomendados:
- **200-500** para APIs publicas
- **1000-2000** para APIs internas
- **100-200** para endpoints muito restritos

**default_field_cost** (inteiro, padrao: 1)

Custo padrao atribuido a cada campo que nao tem custo especifico.

**field_costs** (objeto, padrao: {})

Mapa de nomes de campo para custos especificos. Use para atribuir custos maiores a campos que envolvem operacoes caras:

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

**list_size_argument** (string, padrao: "first")

Nome do argumento usado para detectar tamanho de listas. Comum: \`first\`, \`limit\`, \`count\`, \`pageSize\`.

**action** (string, padrao: "reject")

- \`reject\` — retorna HTTP 400
- \`log\` — apenas loga`,
        },
        {
          id: "estrategia",
          title: "Estrategia de Rollout",
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

> **Combinacao recomendada:** Use depth limit + complexity limit juntos. O depth limit e rapido e pega ataques obvios. O complexity limit e mais preciso e pega queries largas que o depth limit nao detecta.`,
        },
      ],
    },
    // ── 5. Allowlist (Persisted Queries) ───────────────────────────────
    {
      slug: "graphql-allowlist",
      title: "Query Allowlist (Persisted Queries)",
      description:
        "Restrinja a execucao apenas a queries pre-registradas, identificadas por hash MD5.",
      icon: "ListChecks",
      tags: ["graphql", "seguranca", "allowlist", "persisted", "hash", "plugin"],
      content: [
        {
          id: "visao-geral",
          title: "Visao Geral",
          body: `O plugin **Query Allowlist** implementa persisted queries — somente queries pre-registradas podem ser executadas. Cada query e normalizada (whitespace colapsado) e hashada (MD5). Se o hash nao estiver na lista de permitidas, a requisicao e rejeitada (modo enforce) ou logada (modo auditoria).

**Por que usar persisted queries?**

- **Seguranca maxima** — atacantes nao podem enviar queries arbitrarias
- **Performance previsivel** — voce sabe exatamente quais queries serao executadas
- **Governanca** — cada query nova passa por revisao antes de ser adicionada ao allowlist
- **Prevencao de exfiltracao** — impede que dados sensíveis sejam acessados via queries crafted

**Fluxo de trabalho:**

1. Desenvolvedores escrevem queries no frontend
2. CI/CD extrai as queries e gera os hashes MD5
3. Hashes sao adicionados a configuracao do plugin
4. Em producao, apenas essas queries sao permitidas`,
        },
        {
          id: "configuracao",
          title: "Configuracao",
          body: `**enforce** (boolean, padrao: false)

- \`false\` — modo auditoria: loga queries desconhecidas mas permite
- \`true\` — modo enforcement: rejeita queries desconhecidas com HTTP 403

**allowed_queries** (array, padrao: [])

Lista de queries permitidas, cada uma com:
- \`name\` (string) — nome legivel para referencia (ex: "GetUser")
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

> **Dica:** A resposta de rejeicao inclui o hash da query enviada, facilitando a adição ao allowlist:
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

**Normalizacao:**

O plugin normaliza queries antes de hashear:
1. Remove espacos em branco no inicio e fim
2. Colapsa multiplos espacos/tabs/newlines em um unico espaco

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

> **Atencao:** Queries semanticamente equivalentes com campos em ordem diferente geram hashes DIFERENTES. A normalizacao e apenas de whitespace, nao semantica.`,
        },
      ],
    },
    // ── 6. Introspection Guard ─────────────────────────────────────────
    {
      slug: "graphql-introspection-guard",
      title: "Introspection Guard",
      description:
        "Bloqueie queries de introspeccao (__schema, __type) em ambientes de producao.",
      icon: "EyeOff",
      tags: ["graphql", "seguranca", "introspeccao", "schema", "producao", "plugin"],
      content: [
        {
          id: "visao-geral",
          title: "Visao Geral",
          body: `O plugin **Introspection Guard** bloqueia queries de introspeccao GraphQL em producao. A introspeccao permite que qualquer cliente descubra todo o schema da sua API — tipos, campos, argumentos, relacoes — o que e util em desenvolvimento mas perigoso em producao.

**O que a introspeccao expoe:**

- Lista completa de todos os tipos e campos
- Argumentos de cada campo com tipos e valores padrao
- Relacionamentos entre tipos
- Descricoes de campos (que podem conter informacoes sensiveis)
- Diretivas customizadas

**Como o plugin funciona:**

1. Le o body da requisicao GraphQL
2. Busca por \`__schema\` ou \`__type\` no texto da query
3. Se encontrar, verifica se a operacao esta na lista de bypass
4. Se nao estiver permitida, rejeita com HTTP 403 ou loga

> **Nota:** Bloquear introspeccao e uma das primeiras recomendacoes de seguranca para APIs GraphQL em producao. Ferramentas como GraphQL Voyager e GraphiQL dependem de introspeccao para funcionar.`,
        },
        {
          id: "configuracao",
          title: "Configuracao",
          body: `**block_introspection** (boolean, padrao: true)

- \`true\` — bloqueia queries com introspeccao
- \`false\` — desativa o plugin (permite tudo)

**allowed_operation_names** (array de strings, padrao: [])

Lista de nomes de operacao que podem fazer introspeccao mesmo quando o bloqueio esta ativo. Util para ferramentas internas:

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

**action** (string, padrao: "reject")

- \`reject\` — retorna HTTP 403 com mensagem "GraphQL introspection is not allowed"
- \`log\` — apenas loga a tentativa de introspeccao

> **Dica:** O plugin verifica o \`operationName\` do body JSON primeiro. Se nao existir, extrai o nome da operacao do texto do query (ex: \`query InternalSchemaCheck { __schema { ... } }\`).`,
        },
        {
          id: "boas-praticas",
          title: "Boas Praticas",
          body: `**1. Sempre habilite em producao**

Introspeccao e uma das primeiras coisas que atacantes testam. Mesmo se voce nao tem dados sensiveis no schema, a informacao estrutural ajuda a planejar ataques mais sofisticados.

**2. Use ambientes diferenciados**

- **Desenvolvimento/Staging** — introspeccao habilitada (nao use este plugin)
- **Producao** — introspeccao bloqueada (plugin ativo)

Configure por ambiente usando o sistema de multi-ambiente do API Gateway.

**3. Bypass para tooling interno**

Se voce usa ferramentas como Apollo Studio ou schema registry que precisam de introspeccao, adicione os nomes de operacao delas no \`allowed_operation_names\`. Combine com \`ip-restriction\` para garantir que so IPs internos possam executar essas operacoes.

**4. Combine com allowlist**

A combinacao mais segura e:
1. **Introspection Guard** — bloqueia descoberta do schema
2. **Query Allowlist** — so permite queries conhecidas
3. **Depth Limit** — protege contra queries profundas das queries permitidas
4. **Complexity Limit** — protege contra queries largas

Essa pilha de defesa (defense in depth) garante maxima protecao para sua API GraphQL.`,
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
      tags: ["graphql", "rest", "conversao", "degraphql", "facade", "plugin"],
      content: [
        {
          id: "visao-geral",
          title: "Visao Geral",
          body: `O plugin **degraphql** permite expor endpoints REST que internamente executam queries GraphQL no upstream. Voce define um template de query GraphQL na configuracao da rota, e quando uma requisicao REST chega, o plugin substitui variaveis no template com parametros da requisicao (path, query string, body) e envia a query GraphQL ao upstream.

**Casos de uso:**

- **Backend-for-Frontend** — crie endpoints REST otimizados para cada cliente (web, mobile, IoT) que internamente usam GraphQL
- **Migracoes graduais** — exponha novos endpoints REST sobre um backend GraphQL existente
- **Simplificacao** — consumidores que nao querem/podem usar GraphQL recebem uma API REST convencional
- **Performance** — cada endpoint REST executa exatamente a query necessaria, sem over-fetching

> **Nota:** O editor visual do degraphql (disponivel no flow editor) facilita a criacao de templates com auto-deteccao de variaveis e biblioteca de templates prontos.`,
        },
        {
          id: "configuracao",
          title: "Configuracao",
          body: `**query** (string, obrigatorio)

O template da query GraphQL. Use variaveis com \`$nome\` que serao substituidas por parametros da requisicao REST:

\`\`\`json
{
  "query": "query($id: ID!) { user(id: $id) { id name email avatar } }",
  "variables": ["id"]
}
\`\`\`

**variables** (array de strings)

Lista de nomes de parametros REST que serao mapeados para variaveis GraphQL. Os parametros sao extraidos de:
- Path parameters (ex: \`/users/:id\` → variavel \`id\`)
- Query string (ex: \`?filter=active\` → variavel \`filter\`)

**Editor visual:**

O flow editor inclui um editor visual dedicado para o degraphql com:
- **Templates prontos** — Get by ID, List with Filter, Create Mutation, Search
- **Auto-detect** — extrai automaticamente variaveis \`$nome\` do template
- **Tabela de mapeamento** — mapeia parametros REST para variaveis GraphQL com tipos`,
        },
        {
          id: "exemplos",
          title: "Exemplos Praticos",
          body: `**Endpoint: GET /users/:id**

\`\`\`json
{
  "query": "query($id: ID!) { user(id: $id) { id name email avatar createdAt } }",
  "variables": ["id"]
}
\`\`\`

Requisicao: \`GET /users/123\`
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
    // ── 8. Boas Praticas ───────────────────────────────────────────────
    {
      slug: "boas-praticas-graphql",
      title: "Boas Praticas para APIs GraphQL",
      description:
        "Recomendacoes de seguranca, performance e operacao para APIs GraphQL no API Gateway.",
      icon: "Shield",
      tags: ["graphql", "boas-praticas", "seguranca", "performance"],
      content: [
        {
          id: "seguranca",
          title: "Seguranca",
          body: `**1. Defense in Depth**

Nunca dependa de um unico mecanismo de protecao. A pilha recomendada para APIs GraphQL publicas:

| Ordem | Plugin | Funcao |
|-------|--------|--------|
| 1 | key-auth ou jwt-auth | Autenticacao |
| 2 | limit-count | Rate limiting |
| 3 | graphql-allowlist | Restringe a queries conhecidas |
| 4 | graphql-depth-limit | Previne nesting excessivo |
| 5 | graphql-complexity | Previne queries caras |
| 6 | graphql-introspection-guard | Bloqueia descoberta do schema |

**2. Sempre bloqueie introspeccao em producao**

Mesmo com allowlist habilitado, bloqueie introspeccao como defesa adicional.

**3. Use HTTPS**

Queries GraphQL frequentemente contêm dados sensiveis no body (variaveis com tokens, senhas, dados pessoais). Sempre use HTTPS.

**4. Valide inputs no upstream**

Os plugins do gateway fazem analise heuristica — nao substituem validacao de input no servidor GraphQL.`,
        },
        {
          id: "performance",
          title: "Performance",
          body: `**1. Cache por operacao**

Use roteamento por operacao para aplicar cache seletivamente:
- Queries de leitura → proxy-cache com TTL adequado
- Mutations → sem cache

**2. Limite listas**

Configure \`graphql-complexity\` com \`list_size_argument\` para penalizar listas grandes. Um \`users(first: 1000)\` custa muito mais que \`users(first: 10)\`.

**3. Persisted queries para performance**

Alem de seguranca, persisted queries reduzem o tamanho das requisicoes. Clientes podem enviar apenas o hash em vez da query completa (se o upstream suportar APQ — Automatic Persisted Queries).

**4. Monitore complexidade**

Use \`action: "log"\` no complexity limit para coletar metricas de custo das queries. Identifique as queries mais caras e otimize seus resolvers.`,
        },
        {
          id: "operacao",
          title: "Operacao",
          body: `**1. Rollout gradual**

Sempre comece com \`action: "log"\` em todos os plugins GraphQL. Monitore por 1-2 semanas, ajuste limites, depois mude para \`action: "reject"\`.

**2. Alertas**

Configure alertas no sistema de monitoramento para:
- Taxa alta de rejeicoes GraphQL (indica clientes quebrando)
- Queries com profundidade ou complexidade proxima do limite (indica necessidade de ajuste)
- Tentativas de introspeccao (indica reconhecimento por atacantes)

**3. Documentacao para consumidores**

Documente os limites de profundidade e complexidade na documentacao da API. Consumidores precisam saber os limites para escrever queries adequadas.

**4. Ambientes diferenciados**

| Ambiente | Introspeccao | Allowlist | Depth | Complexity |
|----------|-------------|-----------|-------|------------|
| Dev | Liberado | Desligado | 20 (log) | 5000 (log) |
| Staging | Bloqueado | Auditoria | 10 (reject) | 1000 (reject) |
| Producao | Bloqueado | Enforce | 7 (reject) | 500 (reject) |`,
        },
      ],
    },
  ],
}
