import type { DocCategory } from "./types"

export const apiCompositionCategory: DocCategory = {
  slug: "api-composition",
  title: "Composição de APIs",
  description:
    "Agregue múltiplas chamadas de backend em uma única resposta de API usando o plugin de composição.",
  icon: "GitMerge",
  articles: [
    // ── 1. Introdução à Composição ──────────────────────────────
    {
      slug: "introducao-composicao",
      title: "O que é Composição de APIs?",
      description:
        "Entenda o conceito de composição de APIs e como agregar múltiplas chamadas de backend em uma única resposta.",
      icon: "Layers",
      tags: ["composição", "agregação", "orquestração"],
      content: [
        {
          id: "conceito",
          title: "Conceito de Composição",
          body: `A **composição de APIs** é um padrão arquitetural que permite combinar os resultados de múltiplas chamadas a serviços de backend em uma única resposta de API. Em vez de o cliente fazer várias requisições separadas, o API Gateway orquestra as chamadas internamente e retorna um resultado unificado.

Esse padrão resolve problemas comuns em arquiteturas de microsserviços:

- **Redução de round-trips**: O cliente faz uma única chamada em vez de múltiplas
- **Menor latência**: Chamadas paralelas no backend são mais rápidas do que chamadas sequenciais do cliente
- **Simplicidade para o consumidor**: O cliente recebe uma resposta consolidada sem precisar conhecer os serviços internos
- **Menor consumo de banda**: Especialmente importante para clientes mobile

> **Nota:** A composição de APIs no gateway é ideal para cenários de leitura (GET). Para operações de escrita que exigem transações distribuídas, considere padrões como Saga ou Outbox implementados no backend.`,
        },
        {
          id: "padroes-composicao",
          title: "Padrões de Composição",
          body: `O API Gateway suporta três padrões principais de composição, cada um adequado a cenários diferentes:

### Pipeline (Sequencial)

No padrão pipeline, as chamadas são executadas **em sequência**, onde o resultado de uma etapa alimenta a próxima. É útil quando há dependência de dados entre os serviços.

**Exemplo:** Buscar o usuário (etapa 1), depois buscar os pedidos desse usuário (etapa 2) usando o ID retornado na etapa 1.

- Vantagem: Permite dependências entre etapas
- Desvantagem: A latência total é a soma de todas as etapas

### Paralelo (Concorrente)

No padrão paralelo, múltiplas chamadas são executadas **simultaneamente** e os resultados são agregados. É ideal quando os dados são independentes entre si.

**Exemplo:** Buscar perfil do usuário, últimos pedidos e recomendações ao mesmo tempo.

- Vantagem: Latência total é a da chamada mais lenta (não a soma)
- Desvantagem: Não suporta dependências entre etapas

### Condicional (Branching)

No padrão condicional, o fluxo de execução **varia com base em condições** definidas sobre os resultados das etapas anteriores. Permite criar lógica de negócio no gateway.

**Exemplo:** Se o usuário é premium, buscar recomendações personalizadas; caso contrário, retornar recomendações genéricas.

- Vantagem: Flexibilidade para lógica de negócio
- Desvantagem: Complexidade adicional na configuração

> **Dica:** Comece com o padrão paralelo para cenários simples. Evolua para pipeline quando houver dependências e condicional quando precisar de lógica de negócio.`,
        },
        {
          id: "quando-usar",
          title: "Quando Usar Composição",
          body: `A composição de APIs é indicada em cenários específicos. Entender quando usá-la — e quando evitá-la — é fundamental para um bom design de API.

**Use composição quando:**
- O cliente precisa de dados de múltiplos serviços em uma única tela
- Você quer reduzir a quantidade de chamadas de rede do frontend
- Os serviços de backend são estáveis e têm SLAs compatíveis
- As operações são de leitura (GET) sem efeitos colaterais

**Evite composição quando:**
- As operações envolvem escrita transacional (use Saga no backend)
- A lógica de negócio é muito complexa (mantenha no backend)
- Os serviços de backend têm latências muito diferentes (o mais lento domina)
- Você precisa de tratamento de erro granular por serviço

**Alternativas a considerar:**
- **BFF (Backend for Frontend)**: Quando a lógica de agregação é muito específica para um cliente
- **GraphQL**: Quando o cliente precisa de flexibilidade para escolher quais campos buscar
- **Event-driven**: Quando os dados podem ser pré-agregados via eventos

> **Atenção:** A composição no gateway adiciona responsabilidade ao gateway. Monitore a latência e o uso de recursos para garantir que o gateway não se torne um gargalo.`,
        },
      ],
    },
    // ── 2. Configurando o Plugin de Composição ──────────────────
    {
      slug: "configurando-composicao",
      title: "Configurando o Plugin de Composição",
      description:
        "Aprenda a configurar o plugin api-composition com nós, dependências e mapeamento de resposta.",
      icon: "Settings",
      tags: ["api-composition", "configuração", "pipeline"],
      content: [
        {
          id: "estrutura-plugin",
          title: "Estrutura do Plugin",
          body: `O plugin \`api-composition\` é um plugin customizado do FuseOne API Gateway que permite definir um fluxo de composição declarativo. A configuração é baseada em **nós** (nodes) que representam chamadas a serviços de backend.

**Estrutura básica:**

\`\`\`json
{
  "nodes": [...],
  "timeout": 10000,
  "response_mapping": {...}
}
\`\`\`

Cada **nó** (node) representa uma etapa no fluxo de composição:

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

- **id**: Identificador único do nó, usado para referências e dependências
- **uri**: URL completa do serviço de backend
- **method**: Método HTTP (GET, POST, etc.)
- **headers**: Headers adicionais a enviar ao serviço
- **timeout**: Timeout individual do nó em milissegundos
- **depends_on**: Lista de IDs de nós que devem completar antes deste
- **condition**: Condição para executar este nó (opcional)

> **Nota:** Nós sem \`depends_on\` são executados em paralelo automaticamente. O plugin otimiza a execução para minimizar a latência total.`,
        },
        {
          id: "configurando-nos",
          title: "Configurando Nós (Steps)",
          body: `Cada nó na composição representa uma chamada HTTP a um serviço de backend. Veja como configurar nós para diferentes cenários:

### Nó Básico (sem dependência)

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

### Nó com Dependência (pipeline)

\`\`\`json
{
  "id": "pedidos",
  "uri": "http://order-service:8080/api/orders?customer_id={{nodes.perfil.response.body.id}}",
  "method": "GET",
  "depends_on": ["perfil"],
  "timeout": 5000
}
\`\`\`

O campo \`depends_on: ["perfil"]\` garante que o nó "pedidos" só será executado após o nó "perfil" completar com sucesso. A expressão \`{{nodes.perfil.response.body.id}}\` referencia o campo \`id\` do corpo da resposta do nó "perfil".

### Nó com Body (POST)

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

> **Dica:** Use templates com a sintaxe \`{{...}}\` para referenciar dados da requisição original (\`params\`, \`headers\`, \`query\`) ou de nós anteriores (\`nodes.<id>.response\`).

**Variáveis disponíveis nos templates:**
- \`{{params.<nome>}}\`: Parâmetros da URL da rota
- \`{{headers.<nome>}}\`: Headers da requisição original
- \`{{query.<nome>}}\`: Parâmetros de query string
- \`{{body.<campo>}}\`: Corpo da requisição original (se POST/PUT)
- \`{{nodes.<id>.response.body.<campo>}}\`: Corpo da resposta de um nó anterior
- \`{{nodes.<id>.response.status}}\`: Status HTTP de um nó anterior`,
        },
        {
          id: "dependencias-condicoes",
          title: "Dependências e Condições",
          body: `O sistema de dependências e condições permite criar fluxos complexos com lógica de branching.

### Dependências Simples

Quando um nó depende de outro, ele só executa após o nó pai completar com sucesso (status 2xx). Se o nó pai falhar, o nó dependente não é executado.

\`\`\`json
{
  "id": "etapa-3",
  "depends_on": ["etapa-1", "etapa-2"]
}
\`\`\`

No exemplo acima, "etapa-3" só executa quando **ambos** "etapa-1" e "etapa-2" completarem com sucesso.

### Condições de Execução

O campo \`condition\` permite executar um nó apenas quando uma condição for verdadeira:

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
- \`contains\`: Contém (para strings e arrays)
- \`exists\`: Campo existe (não é null/undefined)

> **Nota:** Quando um nó condicional não é executado, seu resultado é \`null\` no mapeamento de resposta. Trate esse caso no \`response_mapping\`.

**Boas práticas:**
- Mantenha a árvore de dependências o mais rasa possível (menos níveis = menor latência)
- Evite dependências circulares — o plugin detecta e rejeita a configuração
- Use condições para evitar chamadas desnecessárias a serviços
- Defina timeouts individuais por nó de acordo com o SLA de cada serviço`,
        },
        {
          id: "mapeamento-resposta",
          title: "Mapeamento de Resposta",
          body: `O \`response_mapping\` define como os resultados dos nós são combinados na resposta final enviada ao cliente.

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

A resposta final será:

\`\`\`json
{
  "profile": { "id": 1, "name": "João", "plan": "premium" },
  "orders": [{ "id": 100, "total": 250.00 }],
  "recommendations": [{ "id": 42, "name": "Produto X" }]
}
\`\`\`

### Mapeamento com Transformação

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

Configure o comportamento quando um nó falha:

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

A estratégia \`partial\` retorna os resultados dos nós que completaram com sucesso e usa valores padrão para os que falharam. A estratégia \`abort\` retorna erro se qualquer nó falhar.

> **Dica:** Use a estratégia \`partial\` quando alguns dados são opcionais (ex: recomendações) e \`abort\` quando todos são obrigatórios (ex: dados de pagamento).

**Boas práticas:**
- Defina valores padrão para nós opcionais
- Use a estratégia \`partial\` para resiliência
- Mantenha o mapeamento simples — transformações complexas devem ficar no backend
- Documente a estrutura da resposta para os consumidores da API`,
        },
      ],
    },
    // ── 3. Exemplos Práticos ────────────────────────────────────
    {
      slug: "exemplos-composicao",
      title: "Exemplos Práticos",
      description:
        "Exemplos reais de composição de APIs: agregação de perfil, fan-out para múltiplos serviços e roteamento condicional.",
      icon: "BookOpen",
      tags: ["exemplos", "agregação", "fan-out"],
      content: [
        {
          id: "exemplo-perfil-pedidos",
          title: "Agregando Perfil e Pedidos",
          body: `Este exemplo demonstra um cenário comum: uma página de "Minha Conta" que precisa exibir o perfil do usuário junto com seus últimos pedidos e o saldo de pontos de fidelidade.

**Cenário:** O frontend faz uma única chamada ao gateway, que internamente consulta 3 serviços.

**Configuração completa:**

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

**Resultado:** Os 3 nós executam em paralelo (não há dependências). A latência total é a do serviço mais lento, não a soma dos três. Se o serviço de fidelidade falhar, a resposta ainda retorna perfil e pedidos com \`loyalty_points: 0\`.

> **Dica:** Este padrão é ideal para páginas de dashboard que precisam consolidar dados de múltiplos serviços.`,
        },
        {
          id: "exemplo-fan-out",
          title: "Fan-out para Múltiplos Serviços",
          body: `O padrão fan-out distribui a mesma requisição para múltiplos serviços e agrega os resultados. É útil para buscas federadas, onde você precisa consultar vários catálogos ou fontes de dados.

**Cenário:** Uma busca de produtos que consulta 3 catálogos diferentes (eletrônicos, livros, roupas) e retorna resultados unificados.

**Configuração:**

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

**Resultado:** As 3 buscas executam em paralelo. Se um catálogo estiver indisponível, os resultados dos outros ainda são retornados. O campo \`total\` soma os resultados de todos os catálogos.

> **Nota:** Em cenários de fan-out com muitos serviços, monitore o consumo de recursos do gateway. Cada nó consome uma conexão HTTP e memória para armazenar a resposta.

**Boas práticas para fan-out:**
- Limite o número de nós paralelos (10-20 max) para evitar sobrecarga
- Use timeouts individuais curtos para serviços não-críticos
- Configure \`error_handling: "partial"\` para resiliência
- Considere paginação para limitar o volume de dados retornados`,
        },
        {
          id: "exemplo-condicional",
          title: "Roteamento Condicional por Resposta",
          body: `O roteamento condicional permite que o fluxo de composição tome decisões com base nos resultados de etapas anteriores. Isso cria uma lógica de branching no gateway.

**Cenário:** Um endpoint de checkout que verifica o estoque, valida o pagamento e, dependendo do tipo de entrega escolhido, consulta serviços diferentes (correios ou motoboy).

**Configuração:**

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

**Fluxo de execução:**
1. O nó "estoque" executa primeiro (sem dependências)
2. Se o estoque está disponível, "pagamento" executa
3. Em paralelo, apenas um dos nós de frete executa (baseado em \`delivery_type\`)
4. A resposta combina os resultados com \`error_handling: "abort"\` — se qualquer nó crítico falhar, retorna erro

> **Atenção:** Use \`error_handling: "abort"\` em fluxos transacionais como checkout, onde todos os dados são obrigatórios. Retornar dados parciais pode causar problemas.

**Dicas para fluxos condicionais:**
- Mantenha as condições simples e fáceis de entender
- Documente o fluxo visualmente (o editor visual do FuseOne ajuda nisso)
- Teste todos os caminhos possíveis, incluindo cenários de erro
- Monitore quais caminhos são mais executados para otimizar performance`,
        },
      ],
    },
  ],
}
