import type { DocCategory } from "./types"

export const plansCategory: DocCategory = {
  slug: "plans",
  title: "Planos de Consumo",
  description:
    "Configure grupos de consumidores com limites de taxa e políticas compartilhadas.",
  icon: "CreditCard",
  articles: [
    {
      slug: "visao-geral-planos",
      title: "Visão Geral de Planos",
      description:
        "Entenda como planos agrupam consumidores e aplicam políticas compartilhadas de rate limiting.",
      icon: "CreditCard",
      tags: ["planos", "consumer-groups", "rate-limit", "políticas", "overview"],
      content: [
        {
          id: "o-que-sao",
          title: "O que são Planos",
          body: `Planos são **grupos de consumidores** (consumer groups) que compartilham políticas e limites de taxa. Eles permitem definir níveis de acesso diferentes para suas APIs.

**Exemplos de planos:**

| Plano | Rate Limit | Descrição |
|-------|-----------|-----------|
| **Free** | 100 req/hora | Acesso básico para testes e desenvolvimento |
| **Starter** | 1.000 req/hora | Para aplicações em produção com tráfego leve |
| **Business** | 10.000 req/hora | Para aplicações com tráfego moderado |
| **Enterprise** | 100.000 req/hora | Para grandes integrações e parceiros |

**Conceitos principais:**

- **ID do plano** — identificador único (ex: \`plan-free\`, \`plan-business\`)
- **Descrição** — texto explicativo do plano
- **Plugins** — políticas aplicadas a todos os membros do grupo (rate-limit, etc.)
- **Membros** — aplicações (consumers) vinculadas ao plano`,
        },
        {
          id: "como-funciona",
          title: "Como Funciona",
          body: `Quando uma aplicação está vinculada a um plano, as políticas do plano são aplicadas **antes** das políticas individuais da aplicação.

**Ordem de execução:**

1. Políticas globais (Global Policies)
2. Políticas do **plano** (consumer group)
3. Políticas da **rota** (API flow)
4. Políticas da **aplicação** (consumer)

Isso significa que um rate limit no plano afeta **todas** as aplicações do grupo de forma compartilhada. Por exemplo, se o plano "Free" tem limite de 100 req/hora e 3 aplicações estão nele, as 3 juntas não podem exceder 100 requisições por hora.

> **Dica:** Para limites individuais por aplicação, configure o rate-limit diretamente na aplicação, não no plano.`,
        },
      ],
    },
    {
      slug: "configurando-planos",
      title: "Configurando Planos",
      description:
        "Crie planos com rate limiting e vincule aplicações para controlar o acesso às APIs.",
      icon: "Settings",
      tags: ["planos", "configuração", "rate-limit", "criação"],
      content: [
        {
          id: "criando-plano",
          title: "Criando um Plano",
          body: `Para criar um novo plano:

1. Acesse **Planos** no menu lateral
2. Clique em **Novo Plano**
3. Preencha o formulário:
   - **ID** — identificador único (ex: \`plan-starter\`)
   - **Descrição** — o que o plano oferece
4. Configure as políticas desejadas (rate-limit, etc.)
5. Salve o plano

**Exemplo de configuração com rate-limit:**

\`\`\`json
{
  "id": "plan-starter",
  "desc": "Plano Starter - 1000 req/hora",
  "plugins": {
    "limit-count": {
      "count": 1000,
      "time_window": 3600,
      "rejected_code": 429,
      "rejected_msg": "Limite do plano excedido. Faça upgrade para continuar."
    }
  }
}
\`\`\``,
        },
        {
          id: "vinculando-aplicacoes",
          title: "Vinculando Aplicações",
          body: `Para vincular uma aplicação a um plano:

1. Acesse **Aplicações** no menu lateral
2. Edite a aplicação desejada
3. No campo **Plano**, selecione o plano desejado
4. Salve as alterações

A aplicação passa a herdar todas as políticas do plano imediatamente. Você pode verificar o plano atual de cada aplicação na lista de aplicações (coluna "Plano").

**Removendo do plano:**

Para desvincular, edite a aplicação e remova a seleção do plano. As políticas do plano deixam de ser aplicadas imediatamente.`,
        },
        {
          id: "boas-praticas",
          title: "Boas Práticas",
          body: `**Nomenclatura:**
- Use IDs descritivos: \`plan-free\`, \`plan-pro\`, \`plan-enterprise\`
- Inclua limites na descrição para fácil referência

**Rate Limiting:**
- Defina limites realistas baseados na capacidade do seu backend
- Use \`limit-count\` para limites por janela de tempo (mais previsível)
- Considere \`limit-req\` para controle de burst (mais granular)

**Monitoramento:**
- Acompanhe as métricas de cada plano via analytics
- Configure alertas para planos próximos do limite
- Revise periodicamente se os limites estão adequados

**Migração entre planos:**
- Altere o plano da aplicação a qualquer momento
- A mudança é imediata — novos limites passam a valer instantaneamente
- Sem downtime ou interrupção de serviço`,
        },
      ],
    },
  ],
}
