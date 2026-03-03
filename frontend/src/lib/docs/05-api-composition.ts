import type { DocCategory } from "./types"

export const apiCompositionCategory: DocCategory = {
  slug: "api-composition",
  title: "Composicao de APIs",
  description:
    "Agregue multiplas chamadas de backend em uma unica resposta de API usando o plugin de composicao.",
  icon: "GitMerge",
  articles: [
    // ── 1. Introducao a Composicao ──────────────────────────────
    {
      slug: "introducao-composicao",
      title: "O que e Composicao de APIs?",
      description:
        "Entenda o conceito de composicao de APIs e como agregar multiplas chamadas de backend em uma unica resposta.",
      icon: "Layers",
      tags: ["composicao", "agregacao", "orquestracao"],
      content: [
        {
          id: "conceito",
          title: "Conceito de Composicao",
          body: `A **composicao de APIs** e um padrao arquitetural que permite combinar os resultados de multiplas chamadas a servicos de backend em uma unica resposta de API. Em vez de o cliente fazer varias requisicoes separadas, o API Gateway orquestra as chamadas internamente e retorna um resultado unificado.

Esse padrao resolve problemas comuns em arquiteturas de microsservicos:

- **Reducao de round-trips**: O cliente faz uma unica chamada em vez de multiplas
- **Menor latencia**: Chamadas paralelas no backend sao mais rapidas do que chamadas sequenciais do cliente
- **Simplicidade para o consumidor**: O cliente recebe uma resposta consolidada sem precisar conhecer os servicos internos
- **Menor consumo de banda**: Especialmente importante para clientes mobile

> **Nota:** A composicao de APIs no gateway e ideal para cenarios de leitura (GET). Para operacoes de escrita que exigem transacoes distribuidas, considere padroes como Saga ou Outbox implementados no backend.`,
        },
        {
          id: "padroes-composicao",
          title: "Padroes de Composicao",
          body: `O API Gateway suporta tres padroes principais de composicao, cada um adequado a cenarios diferentes:

### Pipeline (Sequencial)

No padrao pipeline, as chamadas sao executadas **em sequencia**, onde o resultado de uma etapa alimenta a proxima. E util quando ha dependencia de dados entre os servicos.

**Exemplo:** Buscar o usuario (etapa 1), depois buscar os pedidos desse usuario (etapa 2) usando o ID retornado na etapa 1.

- Vantagem: Permite dependencias entre etapas
- Desvantagem: A latencia total e a soma de todas as etapas

### Paralelo (Concorrente)

No padrao paralelo, multiplas chamadas sao executadas **simultaneamente** e os resultados sao agregados. E ideal quando os dados sao independentes entre si.

**Exemplo:** Buscar perfil do usuario, ultimos pedidos e recomendacoes ao mesmo tempo.

- Vantagem: Latencia total e a da chamada mais lenta (nao a soma)
- Desvantagem: Nao suporta dependencias entre etapas

### Condicional (Branching)

No padrao condicional, o fluxo de execucao **varia com base em condicoes** definidas sobre os resultados das etapas anteriores. Permite criar logica de negocio no gateway.

**Exemplo:** Se o usuario e premium, buscar recomendacoes personalizadas; caso contrario, retornar recomendacoes genericas.

- Vantagem: Flexibilidade para logica de negocio
- Desvantagem: Complexidade adicional na configuracao

> **Dica:** Comece com o padrao paralelo para cenarios simples. Evolua para pipeline quando houver dependencias e condicional quando precisar de logica de negocio.`,
        },
        {
          id: "quando-usar",
          title: "Quando Usar Composicao",
          body: `A composicao de APIs e indicada em cenarios especificos. Entender quando usa-la — e quando evita-la — e fundamental para um bom design de API.

**Use composicao quando:**
- O cliente precisa de dados de multiplos servicos em uma unica tela
- Voce quer reduzir a quantidade de chamadas de rede do frontend
- Os servicos de backend sao estáveis e tem SLAs compativeis
- As operacoes sao de leitura (GET) sem efeitos colaterais

**Evite composicao quando:**
- As operacoes envolvem escrita transacional (use Saga no backend)
- A logica de negocio e muito complexa (mantenha no backend)
- Os servicos de backend tem latencias muito diferentes (o mais lento domina)
- Voce precisa de tratamento de erro granular por servico

**Alternativas a considerar:**
- **BFF (Backend for Frontend)**: Quando a logica de agregacao e muito especifica para um cliente
- **GraphQL**: Quando o cliente precisa de flexibilidade para escolher quais campos buscar
- **Event-driven**: Quando os dados podem ser pre-agregados via eventos

> **Atencao:** A composicao no gateway adiciona responsabilidade ao gateway. Monitore a latencia e o uso de recursos para garantir que o gateway nao se torne um gargalo.`,
        },
      ],
    },
    // ── 2. Configurando o Plugin de Composicao ──────────────────
    {
      slug: "configurando-composicao",
      title: "Configurando o Plugin de Composicao",
      description:
        "Aprenda a configurar o plugin api-composition com nos, dependencias e mapeamento de resposta.",
      icon: "Settings",
      tags: ["api-composition", "configuracao", "pipeline"],
      content: [
        {
          id: "estrutura-plugin",
          title: "Estrutura do Plugin",
          body: `O plugin \`api-composition\` e um plugin customizado do FuseOne API Gateway que permite definir um fluxo de composicao declarativo. A configuracao e baseada em **nos** (nodes) que representam chamadas a servicos de backend.

**Estrutura basica:**

\`\`\`json
{
  "nodes": [...],
  "timeout": 10000,
  "response_mapping": {...}
}
\`\`\`

Cada **no** (node) representa uma etapa no fluxo de composicao:

\`\`\`json
{
  "id": "identificador-unico",
  "uri": "http://servico:8080/endpoint",
  "method": "GET",
  "headers": {},
  "timeout": 5000,
  "depends_on": [],
  "condition": null
}
\`\`\`

- **id**: Identificador unico do no, usado para referencias e dependencias
- **uri**: URL completa do servico de backend
- **method**: Metodo HTTP (GET, POST, etc.)
- **headers**: Headers adicionais a enviar ao servico
- **timeout**: Timeout individual do no em milissegundos
- **depends_on**: Lista de IDs de nos que devem completar antes deste
- **condition**: Condicao para executar este no (opcional)

> **Nota:** Nos sem \`depends_on\` sao executados em paralelo automaticamente. O plugin otimiza a execucao para minimizar a latencia total.`,
        },
        {
          id: "configurando-nos",
          title: "Configurando Nos (Steps)",
          body: `Cada no na composicao representa uma chamada HTTP a um servico de backend. Veja como configurar nos para diferentes cenarios:

### No Basico (sem dependencia)

\`\`\`json
{
  "id": "perfil",
  "uri": "http://user-service:8080/api/users/{{params.userId}}",
  "method": "GET",
  "headers": {
    "Authorization": "{{headers.Authorization}}"
  },
  "timeout": 3000
}
\`\`\`

### No com Dependencia (pipeline)

\`\`\`json
{
  "id": "pedidos",
  "uri": "http://order-service:8080/api/orders?customer_id={{nodes.perfil.response.body.id}}",
  "method": "GET",
  "depends_on": ["perfil"],
  "timeout": 5000
}
\`\`\`

O campo \`depends_on: ["perfil"]\` garante que o no "pedidos" so sera executado apos o no "perfil" completar com sucesso. A expressao \`{{nodes.perfil.response.body.id}}\` referencia o campo \`id\` do corpo da resposta do no "perfil".

### No com Body (POST)

\`\`\`json
{
  "id": "recomendacoes",
  "uri": "http://recommendation-service:8080/api/recommend",
  "method": "POST",
  "body": {
    "user_id": "{{nodes.perfil.response.body.id}}",
    "categories": "{{nodes.pedidos.response.body.categories}}"
  },
  "depends_on": ["perfil", "pedidos"],
  "timeout": 5000
}
\`\`\`

> **Dica:** Use templates com a sintaxe \`{{...}}\` para referenciar dados da requisicao original (\`params\`, \`headers\`, \`query\`) ou de nos anteriores (\`nodes.<id>.response\`).

**Variaveis disponiveis nos templates:**
- \`{{params.<nome>}}\`: Parametros da URL da rota
- \`{{headers.<nome>}}\`: Headers da requisicao original
- \`{{query.<nome>}}\`: Parametros de query string
- \`{{body.<campo>}}\`: Corpo da requisicao original (se POST/PUT)
- \`{{nodes.<id>.response.body.<campo>}}\`: Corpo da resposta de um no anterior
- \`{{nodes.<id>.response.status}}\`: Status HTTP de um no anterior`,
        },
        {
          id: "dependencias-condicoes",
          title: "Dependencias e Condicoes",
          body: `O sistema de dependencias e condicoes permite criar fluxos complexos com logica de branching.

### Dependencias Simples

Quando um no depende de outro, ele so executa apos o no pai completar com sucesso (status 2xx). Se o no pai falhar, o no dependente nao e executado.

\`\`\`json
{
  "id": "etapa-3",
  "depends_on": ["etapa-1", "etapa-2"]
}
\`\`\`

No exemplo acima, "etapa-3" so executa quando **ambos** "etapa-1" e "etapa-2" completarem com sucesso.

### Condicoes de Execucao

O campo \`condition\` permite executar um no apenas quando uma condicao for verdadeira:

\`\`\`json
{
  "id": "bonus-premium",
  "uri": "http://loyalty-service:8080/api/bonus",
  "depends_on": ["perfil"],
  "condition": {
    "field": "nodes.perfil.response.body.plan",
    "operator": "eq",
    "value": "premium"
  }
}
\`\`\`

**Operadores suportados:**
- \`eq\`: Igual
- \`neq\`: Diferente
- \`gt\`, \`gte\`: Maior que, maior ou igual
- \`lt\`, \`lte\`: Menor que, menor ou igual
- \`contains\`: Contem (para strings e arrays)
- \`exists\`: Campo existe (nao e null/undefined)

> **Nota:** Quando um no condicional nao e executado, seu resultado e \`null\` no mapeamento de resposta. Trate esse caso no \`response_mapping\`.

**Boas praticas:**
- Mantenha a arvore de dependencias o mais rasa possivel (menos niveis = menor latencia)
- Evite dependencias circulares — o plugin detecta e rejeita a configuracao
- Use condicoes para evitar chamadas desnecessarias a servicos
- Defina timeouts individuais por no de acordo com o SLA de cada servico`,
        },
        {
          id: "mapeamento-resposta",
          title: "Mapeamento de Resposta",
          body: `O \`response_mapping\` define como os resultados dos nos sao combinados na resposta final enviada ao cliente.

### Mapeamento Simples

\`\`\`json
{
  "response_mapping": {
    "profile": "{{nodes.perfil.response.body}}",
    "orders": "{{nodes.pedidos.response.body.items}}",
    "recommendations": "{{nodes.recomendacoes.response.body.products}}"
  }
}
\`\`\`

A resposta final sera:

\`\`\`json
{
  "profile": { "id": 1, "name": "Joao", "plan": "premium" },
  "orders": [{ "id": 100, "total": 250.00 }],
  "recommendations": [{ "id": 42, "name": "Produto X" }]
}
\`\`\`

### Mapeamento com Transformacao

\`\`\`json
{
  "response_mapping": {
    "user": {
      "name": "{{nodes.perfil.response.body.name}}",
      "email": "{{nodes.perfil.response.body.email}}",
      "total_orders": "{{nodes.pedidos.response.body.total}}"
    },
    "is_premium": "{{nodes.perfil.response.body.plan == 'premium'}}"
  }
}
\`\`\`

### Tratamento de Erros

Configure o comportamento quando um no falha:

\`\`\`json
{
  "error_handling": {
    "strategy": "partial",
    "default_values": {
      "recomendacoes": []
    }
  }
}
\`\`\`

A estrategia \`partial\` retorna os resultados dos nos que completaram com sucesso e usa valores padrao para os que falharam. A estrategia \`abort\` retorna erro se qualquer no falhar.

> **Dica:** Use a estrategia \`partial\` quando alguns dados sao opcionais (ex: recomendacoes) e \`abort\` quando todos sao obrigatorios (ex: dados de pagamento).

**Boas praticas:**
- Defina valores padrao para nos opcionais
- Use a estrategia \`partial\` para resiliencia
- Mantenha o mapeamento simples — transformacoes complexas devem ficar no backend
- Documente a estrutura da resposta para os consumidores da API`,
        },
      ],
    },
    // ── 3. Exemplos Praticos ────────────────────────────────────
    {
      slug: "exemplos-composicao",
      title: "Exemplos Praticos",
      description:
        "Exemplos reais de composicao de APIs: agregacao de perfil, fan-out para multiplos servicos e roteamento condicional.",
      icon: "BookOpen",
      tags: ["exemplos", "agregacao", "fan-out"],
      content: [
        {
          id: "exemplo-perfil-pedidos",
          title: "Agregando Perfil e Pedidos",
          body: `Este exemplo demonstra um cenario comum: uma pagina de "Minha Conta" que precisa exibir o perfil do usuario junto com seus ultimos pedidos e o saldo de pontos de fidelidade.

**Cenario:** O frontend faz uma unica chamada ao gateway, que internamente consulta 3 servicos.

**Configuracao completa:**

\`\`\`json
{
  "nodes": [
    {
      "id": "perfil",
      "uri": "http://user-service:8080/api/users/{{params.userId}}",
      "method": "GET",
      "headers": { "Authorization": "{{headers.Authorization}}" },
      "timeout": 3000
    },
    {
      "id": "pedidos",
      "uri": "http://order-service:8080/api/orders?customer_id={{params.userId}}&limit=5",
      "method": "GET",
      "timeout": 5000
    },
    {
      "id": "fidelidade",
      "uri": "http://loyalty-service:8080/api/points/{{params.userId}}",
      "method": "GET",
      "timeout": 3000
    }
  ],
  "timeout": 8000,
  "response_mapping": {
    "user": {
      "name": "{{nodes.perfil.response.body.name}}",
      "email": "{{nodes.perfil.response.body.email}}",
      "avatar": "{{nodes.perfil.response.body.avatar_url}}"
    },
    "recent_orders": "{{nodes.pedidos.response.body.items}}",
    "loyalty_points": "{{nodes.fidelidade.response.body.balance}}"
  },
  "error_handling": {
    "strategy": "partial",
    "default_values": {
      "fidelidade": { "balance": 0 }
    }
  }
}
\`\`\`

**Resultado:** Os 3 nos executam em paralelo (nao ha dependencias). A latencia total e a do servico mais lento, nao a soma dos tres. Se o servico de fidelidade falhar, a resposta ainda retorna perfil e pedidos com \`loyalty_points: 0\`.

> **Dica:** Este padrao e ideal para paginas de dashboard que precisam consolidar dados de multiplos servicos.`,
        },
        {
          id: "exemplo-fan-out",
          title: "Fan-out para Multiplos Servicos",
          body: `O padrao fan-out distribui a mesma requisicao para multiplos servicos e agrega os resultados. E util para buscas federadas, onde voce precisa consultar varios catalagos ou fontes de dados.

**Cenario:** Uma busca de produtos que consulta 3 catalagos diferentes (eletronicos, livros, roupas) e retorna resultados unificados.

**Configuracao:**

\`\`\`json
{
  "nodes": [
    {
      "id": "eletronicos",
      "uri": "http://catalog-electronics:8080/api/search?q={{query.q}}&limit=10",
      "method": "GET",
      "timeout": 3000
    },
    {
      "id": "livros",
      "uri": "http://catalog-books:8080/api/search?q={{query.q}}&limit=10",
      "method": "GET",
      "timeout": 3000
    },
    {
      "id": "roupas",
      "uri": "http://catalog-clothing:8080/api/search?q={{query.q}}&limit=10",
      "method": "GET",
      "timeout": 3000
    }
  ],
  "timeout": 5000,
  "response_mapping": {
    "results": {
      "electronics": "{{nodes.eletronicos.response.body.items}}",
      "books": "{{nodes.livros.response.body.items}}",
      "clothing": "{{nodes.roupas.response.body.items}}"
    },
    "total": "{{nodes.eletronicos.response.body.total + nodes.livros.response.body.total + nodes.roupas.response.body.total}}",
    "query": "{{query.q}}"
  },
  "error_handling": {
    "strategy": "partial",
    "default_values": {
      "eletronicos": { "items": [], "total": 0 },
      "livros": { "items": [], "total": 0 },
      "roupas": { "items": [], "total": 0 }
    }
  }
}
\`\`\`

**Resultado:** As 3 buscas executam em paralelo. Se um catalogo estiver indisponivel, os resultados dos outros ainda sao retornados. O campo \`total\` soma os resultados de todos os catalagos.

> **Nota:** Em cenarios de fan-out com muitos servicos, monitore o consumo de recursos do gateway. Cada no consome uma conexao HTTP e memoria para armazenar a resposta.

**Boas praticas para fan-out:**
- Limite o numero de nos paralelos (10-20 max) para evitar sobrecarga
- Use timeouts individuais curtos para servicos nao-criticos
- Configure \`error_handling: "partial"\` para resiliencia
- Considere paginacao para limitar o volume de dados retornados`,
        },
        {
          id: "exemplo-condicional",
          title: "Roteamento Condicional por Resposta",
          body: `O roteamento condicional permite que o fluxo de composicao tome decisoes com base nos resultados de etapas anteriores. Isso cria uma logica de branching no gateway.

**Cenario:** Um endpoint de checkout que verifica o estoque, valida o pagamento e, dependendo do tipo de entrega escolhido, consulta servicos diferentes (correios ou motoboy).

**Configuracao:**

\`\`\`json
{
  "nodes": [
    {
      "id": "estoque",
      "uri": "http://inventory-service:8080/api/check",
      "method": "POST",
      "body": { "items": "{{body.items}}" },
      "timeout": 3000
    },
    {
      "id": "pagamento",
      "uri": "http://payment-service:8080/api/validate",
      "method": "POST",
      "body": {
        "amount": "{{body.total}}",
        "method": "{{body.payment_method}}"
      },
      "depends_on": ["estoque"],
      "condition": {
        "field": "nodes.estoque.response.body.available",
        "operator": "eq",
        "value": true
      },
      "timeout": 5000
    },
    {
      "id": "frete-correios",
      "uri": "http://shipping-service:8080/api/correios/quote",
      "method": "POST",
      "body": { "zip": "{{body.zip_code}}", "weight": "{{nodes.estoque.response.body.total_weight}}" },
      "depends_on": ["estoque"],
      "condition": {
        "field": "body.delivery_type",
        "operator": "eq",
        "value": "correios"
      },
      "timeout": 5000
    },
    {
      "id": "frete-motoboy",
      "uri": "http://delivery-service:8080/api/motoboy/quote",
      "method": "POST",
      "body": { "address": "{{body.address}}", "items_count": "{{body.items.length}}" },
      "depends_on": ["estoque"],
      "condition": {
        "field": "body.delivery_type",
        "operator": "eq",
        "value": "motoboy"
      },
      "timeout": 3000
    }
  ],
  "timeout": 12000,
  "response_mapping": {
    "stock_available": "{{nodes.estoque.response.body.available}}",
    "payment_validated": "{{nodes.pagamento.response.body.approved}}",
    "shipping": {
      "type": "{{body.delivery_type}}",
      "cost": "{{nodes.frete-correios.response.body.cost || nodes.frete-motoboy.response.body.cost}}",
      "estimate": "{{nodes.frete-correios.response.body.days || nodes.frete-motoboy.response.body.minutes}}"
    }
  },
  "error_handling": {
    "strategy": "abort"
  }
}
\`\`\`

**Fluxo de execucao:**
1. O no "estoque" executa primeiro (sem dependencias)
2. Se o estoque esta disponivel, "pagamento" executa
3. Em paralelo, apenas um dos nos de frete executa (baseado em \`delivery_type\`)
4. A resposta combina os resultados com \`error_handling: "abort"\` — se qualquer no critico falhar, retorna erro

> **Atencao:** Use \`error_handling: "abort"\` em fluxos transacionais como checkout, onde todos os dados sao obrigatorios. Retornar dados parciais pode causar problemas.

**Dicas para fluxos condicionais:**
- Mantenha as condicoes simples e faceis de entender
- Documente o fluxo visualmente (o editor visual do FuseOne ajuda nisso)
- Teste todos os caminhos possiveis, incluindo cenarios de erro
- Monitore quais caminhos sao mais executados para otimizar performance`,
        },
      ],
    },
  ],
}
