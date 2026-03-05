import type { DocCategory } from "./types"

export const designStudioCategory: DocCategory = {
  slug: "design-studio",
  title: "API Design Studio",
  description:
    "Abordagem design-first para criacao de APIs: defina contratos, gere mocks automaticos e valide antes da implementacao.",
  icon: "PenTool",
  articles: [
    // ── 1. Introducao ──────────────────────────────────────────────────
    {
      slug: "introducao-design-first",
      title: "Introducao ao Design-First",
      description:
        "Entenda o conceito de design-first e como o API Design Studio facilita a criacao de APIs de qualidade.",
      icon: "PenTool",
      tags: ["design-first", "design studio", "contratos", "api design", "overview"],
      content: [
        {
          id: "o-que-e",
          title: "O que e Design-First?",
          body: `Design-First e uma abordagem onde voce define a API (endpoints, schemas, exemplos) **antes** de implementar o backend. O API Design Studio do FuseOne torna isso pratico com ferramentas visuais integradas.

Beneficios:

- **Alinhamento antecipado** — frontend e backend concordam no contrato antes de codificar
- **Desenvolvimento paralelo** — frontend integra com mocks enquanto backend implementa
- **Qualidade garantida** — testes de contrato validam que a implementacao segue o design
- **Documentacao automatica** — o contrato gera OpenAPI spec automaticamente

> **Diferencial FuseOne:** O Design Studio esta integrado diretamente no Flow Editor, sem ferramentas externas. O contrato vive junto com a configuracao de gateway.`,
        },
        {
          id: "workflow",
          title: "Workflow Design-First",
          body: `O workflow design-first tem 4 etapas:

1. **Design** — Defina os endpoints no Flow Editor e abra o Contract Panel para definir schemas de request/response, parametros e exemplos.

2. **Mock** — Clique "Generate Mock" no Contract Panel. O plugin \`mocking\` e automaticamente configurado com respostas baseadas nos seus exemplos. Salve a API como draft — ela ja responde com dados fake.

3. **Implement** — Quando o backend estiver pronto, conecte o upstream real no Endpoint Sheet. Desative o plugin de mocking.

4. **Verify** — Clique "Generate Tests" para criar uma Test Suite automatica a partir dos contratos. Execute os testes para validar que a implementacao segue o design original.

Cada etapa e opcional — voce pode pular direto para a implementacao ou usar apenas o mocking sem testes.`,
        },
      ],
    },
    // ── 2. Definindo Contratos ───────────────────────────────────────
    {
      slug: "definindo-contratos",
      title: "Definindo Contratos de API",
      description:
        "Como usar o Schema Editor e o Contract Panel para definir contratos de request/response.",
      icon: "ScrollText",
      tags: ["contrato", "schema", "json schema", "request", "response", "parametros"],
      content: [
        {
          id: "contract-panel",
          title: "Contract Panel",
          body: `O Contract Panel e acessado pelo botao **Contract** (icone de pergaminho) na barra de cada flow no Flow Editor. Ele abre um painel lateral com tres abas:

- **Request** — Schema e exemplo do body da requisicao
- **Response** — Schemas e exemplos para cada status code (200, 400, 500...)
- **Parameters** — Query params, path params, headers e cookies

O painel mostra um badge com o numero de responses definidas. Flows com contrato exibem um indicador "C" na lista lateral.`,
        },
        {
          id: "schema-editor",
          title: "Schema Editor",
          body: `O Schema Editor visual permite criar JSON Schemas sem escrever JSON manualmente:

- **Tipo raiz** — Escolha entre object, array, string, etc.
- **Propriedades** — Para objetos, adicione propriedades com nome, tipo, formato e descricao
- **Obrigatorio** — Marque campos como required com o checkbox "Req"
- **Tipos aninhados** — Propriedades do tipo "object" ou "array" expandem para sub-propriedades
- **Formatos** — Strings suportam formatos comuns: date-time, email, uri, uuid, hostname

**Inferir de JSON:** Clique "Infer from JSON", cole um exemplo real e o schema sera gerado automaticamente. Isso e util quando voce ja tem um payload de exemplo e quer estruturar o contrato a partir dele.

**Gerar exemplo:** Clique "Generate from Schema" para criar um JSON de exemplo baseado no schema definido.`,
        },
        {
          id: "responses",
          title: "Response Schemas",
          body: `Na aba Response voce define schemas para cada status code:

1. Selecione o status code no dropdown (200, 201, 400, etc.)
2. Clique "Add Response"
3. Defina o schema usando o Schema Editor
4. Adicione um exemplo ou gere a partir do schema
5. Adicione uma descricao (ex: "Lista de usuarios retornada com sucesso")

Cada response tem uma cor visual baseada no status:
- **2xx** — Verde (sucesso)
- **3xx** — Azul (redirect)
- **4xx** — Amarelo (erro do cliente)
- **5xx** — Vermelho (erro do servidor)

Voce pode definir quantas responses quiser — cada uma sera exportada como uma response no OpenAPI spec.`,
        },
        {
          id: "parametros",
          title: "Parametros",
          body: `Na aba Parameters voce define query params, path params, headers e cookies:

| Campo | Descricao |
|-------|-----------|
| **Name** | Nome do parametro (ex: \`page\`, \`id\`, \`Authorization\`) |
| **In** | Localizacao: query, path, header ou cookie |
| **Type** | Tipo do valor: string, integer, number, boolean |
| **Required** | Se o parametro e obrigatorio |
| **Description** | Descricao para documentacao |

**Auto-deteccao:** Ao clicar "Add Parameter" pela primeira vez, o sistema detecta automaticamente path params da URI (ex: \`/users/:id\` → parametro \`id\` do tipo path, required).`,
        },
      ],
    },
    // ── 3. Auto-Mock ──────────────────────────────────────────────────
    {
      slug: "auto-mock",
      title: "Auto-Mock a partir de Contratos",
      description:
        "Como gerar respostas mock automaticamente usando os schemas e exemplos definidos no contrato.",
      icon: "FlaskConical",
      tags: ["mock", "auto-mock", "mocking", "respostas fake", "desenvolvimento"],
      content: [
        {
          id: "como-funciona",
          title: "Como Funciona",
          body: `O botao **"Generate Mock"** no footer do Contract Panel converte os response schemas em configuracao do plugin \`mocking\`:

1. Para cada response (200, 400, 500...) e criado um **Mock Profile**
2. O body do mock vem do exemplo definido, ou e gerado a partir do schema
3. O profile ativo (default) e o primeiro status code 2xx
4. O plugin \`mocking\` e adicionado ao flow (ou atualizado se ja existir)

Apos gerar, voce pode ajustar os mocks no Mock Editor (clique no plugin mocking no flow).

> **Importante:** O plugin mocking intercepta a requisicao **antes** de enviar ao upstream. Enquanto estiver ativo, o backend real nao sera chamado.`,
        },
        {
          id: "validacao-request",
          title: "Validacao de Request",
          body: `O botao **"Generate Validation"** cria configuracao do plugin \`request-validation\`:

- Converte o \`request_schema\` em \`body_schema\` do plugin
- Define uma mensagem de rejeicao padrao
- Garante que requests fora do contrato retornam 400 Bad Request

Isso e util tanto no modo mock quanto em producao — garante que clientes enviam payloads no formato correto.`,
        },
      ],
    },
    // ── 4. Testes de Contrato ──────────────────────────────────────────
    {
      slug: "testes-contrato",
      title: "Testes de Contrato",
      description:
        "Gere test suites automaticas a partir dos contratos para validar a implementacao.",
      icon: "CheckCircle2",
      tags: ["testes", "contrato", "test suite", "validacao", "ci"],
      content: [
        {
          id: "geracao-automatica",
          title: "Geracao Automatica de Testes",
          body: `O Design Studio pode gerar Test Suites automaticamente a partir dos contratos definidos. Para cada flow com contrato, e criado um Test Step com:

- **Method + URL** — baseado no entrypoint do flow
- **Request body** — baseado no exemplo de request do contrato
- **Assertions**:
  - Status code igual ao esperado (ex: 200)
  - Campos do response body presentes (baseado no schema)
  - Response time menor que 2 segundos

A suite gerada recebe o nome "Contract Tests: {nome da API}" e a tag \`contract\`.

> **Nota:** A geracao de testes requer que a API ja esteja salva (com ID). Use o Dashboard do Design Studio para gerar testes de APIs existentes.`,
        },
        {
          id: "ciclo-verificacao",
          title: "Ciclo de Verificacao",
          body: `O ciclo de verificacao design-first funciona assim:

1. **Defina contratos** — schemas e exemplos no Contract Panel
2. **Implemente o backend** — conecte o upstream real
3. **Gere testes** — clique "Generate Tests" no Dashboard
4. **Execute** — va em Testing > Suites > Execute
5. **Valide** — se todos os steps passaram, a implementacao segue o contrato
6. **Monitore** — crie um Synthetic Monitor para validar continuamente

Se um teste falhar, compare o response real com o contrato para identificar a divergencia.`,
        },
      ],
    },
    // ── 5. Workflow Completo ──────────────────────────────────────────
    {
      slug: "workflow-completo",
      title: "Workflow Completo: Design ao Deploy",
      description:
        "Guia passo a passo do fluxo completo: design, mock, implementacao e verificacao.",
      icon: "Workflow",
      tags: ["workflow", "tutorial", "passo a passo", "deploy", "completo"],
      content: [
        {
          id: "passo-1-design",
          title: "Passo 1: Design",
          body: `1. Acesse **Design Studio** no menu lateral
2. Clique **"New API Design"** (ou va em APIs > New > "Design First")
3. Configure nome, context path e routing
4. No Flow Editor, clique no botao **Contract** (pergaminho) no flow
5. Na aba **Request**, defina o schema do body (ou cole um JSON e clique "Infer from JSON")
6. Na aba **Response**, adicione 200 OK com schema e exemplo
7. Na aba **Parameters**, adicione query/path params se necessario
8. Salve a API como draft`,
        },
        {
          id: "passo-2-mock",
          title: "Passo 2: Mock",
          body: `1. No Contract Panel, clique **"Generate Mock"**
2. O plugin \`mocking\` e adicionado com responses baseadas nos exemplos
3. Salve a API
4. Compartilhe a URL mock com o time de frontend
5. O frontend pode integrar enquanto o backend ainda nao existe

> **Dica:** Voce pode criar multiplos mock profiles (200, 400, 500) para testar cenarios de erro no frontend.`,
        },
        {
          id: "passo-3-implementacao",
          title: "Passo 3: Implementacao",
          body: `1. Quando o backend estiver pronto, abra a API no Flow Editor
2. Clique no icone **Endpoint** (servidor) para abrir o Endpoint Sheet
3. Configure o upstream real (host, porta, health checks)
4. Desative o plugin \`mocking\` (toggle no flow)
5. Faca deploy da API para o ambiente desejado

> **Importante:** Mantenha os contratos — eles serao usados para validar a implementacao.`,
        },
        {
          id: "passo-4-verificacao",
          title: "Passo 4: Verificacao",
          body: `1. No Dashboard do Design Studio, localize a API
2. Acesse Testing > Suites e execute a suite de contrato
3. Verifique que todos os steps passaram
4. Se algum falhou, compare o response real com o contrato
5. (Opcional) Crie um Synthetic Monitor para validar continuamente
6. (Opcional) Defina um SLA baseado nos requisitos do contrato

Parabens! Sua API esta em producao com qualidade garantida pelo contrato.`,
        },
      ],
    },
    // ── 6. OpenAPI Round-Trip ──────────────────────────────────────────
    {
      slug: "openapi-roundtrip",
      title: "OpenAPI Round-Trip",
      description:
        "Import e export de specs OpenAPI 3.0 com preservacao de schemas de contrato.",
      icon: "FileJson",
      tags: ["openapi", "import", "export", "swagger", "spec", "round-trip"],
      content: [
        {
          id: "export",
          title: "Export com Schemas",
          body: `Ao exportar uma API como OpenAPI 3.0, os contratos sao incluidos automaticamente:

- \`requestBody.content."application/json".schema\` — schema do request
- \`requestBody.content."application/json".example\` — exemplo do request
- \`responses."200".content."application/json".schema\` — schema do response
- \`parameters[]\` — parametros definidos no contrato

Isso gera uma spec OpenAPI completa e compativel com qualquer ferramenta (Swagger UI, Postman, Stoplight, etc).`,
        },
        {
          id: "import",
          title: "Import com Schemas",
          body: `Ao importar uma spec OpenAPI 3.0, os schemas sao automaticamente convertidos em contratos:

- \`requestBody\` → \`contract.request_schema\` + \`contract.request_example\`
- \`responses\` → \`contract.response_schemas\` por status code
- \`parameters\` → \`contract.parameters\`

Isso cria um **round-trip perfeito**: Import → editar → Export preserva todos os schemas.

> **Dica:** Importe specs de APIs existentes para criar contratos retroativamente e comecar a testar.`,
        },
      ],
    },
  ],
}
