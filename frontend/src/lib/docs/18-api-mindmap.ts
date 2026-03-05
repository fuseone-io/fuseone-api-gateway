import type { DocCategory } from "./types"

export const apiMindmapCategory: DocCategory = {
  slug: "api-mindmap",
  title: "API Mindmap",
  description:
    "Crie APIs visualmente a partir de entidades e relacionamentos usando o canvas interativo do Design Studio.",
  icon: "Network",
  articles: [
    // ── 1. Introducao ──────────────────────────────────────────────────
    {
      slug: "introducao-mindmap",
      title: "Introducao ao API Mindmap",
      description:
        "Entenda como usar o canvas visual para modelar APIs a partir de entidades e relacionamentos.",
      icon: "Network",
      tags: ["mindmap", "design studio", "entidades", "canvas", "visual"],
      content: [
        {
          id: "o-que-e",
          title: "O que e o API Mindmap?",
          body: `O API Mindmap e uma ferramenta visual do Design Studio que permite modelar APIs a partir de **entidades e relacionamentos** antes de definir endpoints manualmente.

Em vez de comecar pela lista de rotas, voce comeca pela **ideia**:

1. Crie entidades (User, Product, Order...)
2. Defina campos e tipos para cada entidade
3. Conecte entidades com relacionamentos (1:1, 1:N, N:N)
4. Marque operacoes CRUD por entidade
5. Clique **"Generate API"** — o sistema cria tudo automaticamente

O resultado e uma API completa com flows, contracts (schemas), exemplos e opcionalmente mocks.

> **Diferencial:** Nenhuma ferramenta de API management oferece mindmap → API. A maioria comeca pelo YAML/JSON — nos comecamos pela ideia.`,
        },
        {
          id: "quando-usar",
          title: "Quando Usar",
          body: `O API Mindmap e ideal para:

- **Greenfield APIs** — voce esta criando uma API do zero e quer modelar as entidades antes
- **Prototipacao rapida** — precisa de uma API funcional (com mocks) em minutos
- **Workshops de design** — alinhar equipe sobre a estrutura da API visualmente
- **Migracoes** — modelar a API alvo antes de migrar de um sistema legado

Para APIs que ja existem ou que voce ja tem uma spec OpenAPI, use o **Import OpenAPI** ou **Design First** (contracts manuais).`,
        },
      ],
    },
    // ── 2. Entidades e Campos ──────────────────────────────────────────
    {
      slug: "entidades-campos",
      title: "Entidades e Campos",
      description:
        "Como criar entidades, definir campos com tipos, e configurar chaves primarias.",
      icon: "Box",
      tags: ["entidade", "campos", "tipos", "pk", "schema"],
      content: [
        {
          id: "criando-entidades",
          title: "Criando Entidades",
          body: `Para adicionar uma entidade ao canvas:

1. Clique no botao **"+ Entity"** na toolbar
2. A entidade aparece no centro do canvas com um campo \`id\` (UUID) pre-configurado
3. O editor lateral abre automaticamente para voce configurar

Cada entidade tem:
- **Nome** — ex: "User", "Product", "Order"
- **Plural** — auto-derivado (users, products) ou customizado
- **Cor** — para identificacao visual no canvas
- **Campos** — propriedades da entidade
- **Operacoes** — CRUD e custom

Voce pode arrastar entidades pelo canvas para organizar visualmente.`,
        },
        {
          id: "definindo-campos",
          title: "Definindo Campos",
          body: `Na aba **Fields** do editor lateral, adicione campos com:

| Propriedade | Descricao |
|-------------|-----------|
| **Name** | Nome do campo (ex: \`email\`, \`price\`, \`created_at\`) |
| **Type** | Tipo do valor (ver tabela abaixo) |
| **Required** | Se o campo e obrigatorio |
| **PK** | Marca como chave primaria (excluido do body de criacao) |
| **Array** | Transforma em array do tipo selecionado |

**Tipos disponiveis:**

| Tipo | Schema | Exemplo |
|------|--------|---------|
| Text | \`string\` | "Hello" |
| Integer | \`integer\` | 42 |
| Decimal | \`number\` | 3.14 |
| Boolean | \`boolean\` | true |
| UUID | \`string (format: uuid)\` | "550e8400-..." |
| Email | \`string (format: email)\` | "user@example.com" |
| Date/Time | \`string (format: date-time)\` | "2024-01-01T..." |
| URL | \`string (format: uri)\` | "https://..." |
| Object | \`object\` | {} |
| Array | \`array\` | [] |

> **Dica:** Comece sempre com um campo \`id\` do tipo UUID marcado como PK. O sistema ja cria isso automaticamente.`,
        },
      ],
    },
    // ── 3. Relacionamentos ──────────────────────────────────────────────
    {
      slug: "relacionamentos",
      title: "Relacionamentos entre Entidades",
      description:
        "Como criar e configurar relacionamentos 1:1, 1:N e N:N entre entidades.",
      icon: "GitBranch",
      tags: ["relacionamento", "1:N", "N:N", "1:1", "edges"],
      content: [
        {
          id: "criando-relacionamentos",
          title: "Criando Relacionamentos",
          body: `Para criar um relacionamento:

1. **Arraste** de um handle (ponto) de uma entidade para outra
2. O editor lateral abre para configurar o relacionamento
3. Selecione a **cardinalidade**: 1:1, 1:N ou N:N

Os handles estao nos 4 lados de cada entidade (topo, direita, baixo, esquerda).

**Regras:**
- Nao e possivel criar relacionamento de uma entidade para ela mesma
- Nao e possivel criar relacionamento duplicado entre o mesmo par`,
        },
        {
          id: "cardinalidades",
          title: "Cardinalidades e Geracao",
          body: `Cada tipo de cardinalidade gera endpoints diferentes:

**1:1 (One to One)**
- Visual: linha solida azul
- Geracao: nenhum endpoint adicional (apenas referencia)

**1:N (One to Many)**
- Visual: linha solida com badge "1:N"
- Geracao: endpoint nested \`GET /parents/:parentId/children\`
- Exemplo: User (1) → Order (N) gera \`GET /users/:userId/orders\`

**N:N (Many to Many)**
- Visual: linha tracejada roxa animada
- Geracao: endpoints de associacao (futuro)

**Field Mapping:**
Voce pode configurar qual campo da entidade source mapeia para qual campo da target:
- Source field: geralmente \`id\` (PK da entidade pai)
- Target field: geralmente \`{parent}Id\` (FK na entidade filha)`,
        },
      ],
    },
    // ── 4. Operacoes CRUD ──────────────────────────────────────────────
    {
      slug: "operacoes-crud",
      title: "Operacoes CRUD e Custom",
      description:
        "Configure quais operacoes cada entidade suporta e adicione operacoes customizadas.",
      icon: "Settings",
      tags: ["crud", "operacoes", "custom", "get", "post", "put", "delete"],
      content: [
        {
          id: "crud-padrao",
          title: "Operacoes CRUD Padrao",
          body: `Na aba **Operations** do editor lateral, marque as operacoes CRUD:

| Operacao | Metodo | Endpoint Gerado | Response |
|----------|--------|----------------|----------|
| **List** | GET | \`/{plural}\` | Array/paginado |
| **Get by ID** | GET | \`/{plural}/:id\` | Objeto + 404 |
| **Create** | POST | \`/{plural}\` | 201 + objeto |
| **Update** | PUT | \`/{plural}/:id\` | Objeto + 404 |
| **Delete** | DELETE | \`/{plural}/:id\` | 204 + 404 |

Use **"Select All"** para habilitar CRUD completo de uma vez.

No canvas, cada entidade mostra 5 pontinhos coloridos no rodape:
- **Verde** = operacao habilitada
- **Cinza** = operacao desabilitada`,
        },
        {
          id: "operacoes-custom",
          title: "Operacoes Customizadas",
          body: `Alem do CRUD padrao, voce pode adicionar operacoes customizadas:

1. Na aba **Operations**, role ate "Custom Operations"
2. Digite o nome (ex: "Activate")
3. Selecione o metodo HTTP (POST, PATCH, etc.)
4. O path suffix e gerado automaticamente (ex: \`/:id/activate\`)

Exemplos comuns:
- \`POST /users/:id/activate\` — Ativar usuario
- \`POST /orders/:id/cancel\` — Cancelar pedido
- \`PATCH /products/:id/stock\` — Atualizar estoque`,
        },
      ],
    },
    // ── 5. Geracao de API ──────────────────────────────────────────────
    {
      slug: "geracao-api",
      title: "Geracao de API a partir do Mindmap",
      description:
        "Como o mindmap se transforma em uma API completa com flows, contracts e mocks.",
      icon: "Rocket",
      tags: ["geracao", "generate", "api", "flows", "contracts", "mocks"],
      content: [
        {
          id: "processo",
          title: "Processo de Geracao",
          body: `Ao clicar **"Generate API"** na toolbar:

1. Um dialog abre com opcoes de geracao
2. Configure nome, context path e opcoes
3. Clique **"Generate"**
4. O sistema cria a \`ApiDefinition\` completa
5. Voce e redirecionado para o editor de API com tudo pre-preenchido

**Opcoes de geracao:**

| Opcao | Descricao |
|-------|-----------|
| **API Name** | Nome da API (pre-preenchido com nome do mindmap) |
| **Context Path** | Path base (ex: \`/api\`, auto-derivado do nome) |
| **Generate contracts** | Cria schemas request/response para cada flow |
| **Generate mocks** | Adiciona plugin mocking com responses de exemplo |
| **Include timestamps** | Adiciona created_at/updated_at nos schemas |
| **Paginated lists** | Wrap responses de lista em envelope paginado |`,
        },
        {
          id: "o-que-e-gerado",
          title: "O que e Gerado",
          body: `Para cada entidade com operacoes habilitadas, o sistema gera:

**Flows (rotas):**
- Um flow por operacao CRUD habilitada
- Um flow por operacao customizada
- Flows nested para relacionamentos 1:N (ex: \`GET /users/:userId/orders\`)

**Contracts (schemas):**
- Request schema baseado nos campos (excluindo PK para POST)
- Response schemas por status code (200, 201, 204, 400, 404)
- Exemplos gerados automaticamente a partir dos schemas
- Parametros de path (ex: \`:id\`)

**Mocks (opcional):**
- Plugin \`mocking\` configurado com responses de exemplo
- Frontend pode integrar imediatamente

**Metadata:**
- Referencia ao mindmap original salva nos labels da API
- Permite futuro "Edit Mindmap" para APIs geradas`,
        },
      ],
    },
    // ── 6. Workflow Completo ──────────────────────────────────────────
    {
      slug: "workflow-mindmap",
      title: "Workflow Completo: Mindmap ao Deploy",
      description:
        "Guia passo a passo do fluxo completo usando o API Mindmap.",
      icon: "Workflow",
      tags: ["workflow", "tutorial", "passo a passo", "completo"],
      content: [
        {
          id: "passo-a-passo",
          title: "Passo a Passo",
          body: `**1. Modelar no Mindmap**
- Acesse Design Studio > API Mindmap (ou APIs > New > API Mindmap)
- Adicione entidades: User, Product, Order
- Defina campos para cada entidade
- Conecte User → Order (1:N) e Product → Order (N:N)
- Habilite CRUD completo em todas as entidades

**2. Gerar API**
- Clique "Generate API"
- Marque "Generate contracts" e "Generate mocks"
- Clique "Generate"

**3. Refinar no Flow Editor**
- Revise os flows gerados
- Ajuste schemas no Contract Panel se necessario
- Adicione plugins (auth, rate-limit, cors...)

**4. Testar com Mocks**
- Salve a API como draft
- Compartilhe a URL com o time de frontend
- O frontend integra com dados fake

**5. Implementar Backend**
- Conecte o upstream real
- Desative os mocks
- Execute os testes de contrato

**6. Deploy**
- Faca deploy para o ambiente desejado
- Monitore com alertas e metricas

> **Tempo total:** De uma ideia a uma API com mocks rodando em menos de 5 minutos.`,
        },
      ],
    },
  ],
}
