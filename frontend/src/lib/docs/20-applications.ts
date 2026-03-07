import type { DocCategory } from "./types"

export const applicationsCategory: DocCategory = {
  slug: "applications",
  title: "Aplicações (Consumers)",
  description:
    "Gerencie consumidores de API, credenciais de autenticação e assinaturas de planos.",
  icon: "AppWindow",
  articles: [
    {
      slug: "visao-geral-aplicacoes",
      title: "Visão Geral de Aplicações",
      description:
        "Entenda o conceito de aplicações (consumers) e como elas se conectam às suas APIs.",
      icon: "AppWindow",
      tags: ["aplicações", "consumers", "credenciais", "autenticação", "overview"],
      content: [
        {
          id: "o-que-sao",
          title: "O que são Aplicações",
          body: `Aplicações representam os **consumidores** das suas APIs. Cada aplicação é uma entidade que possui credenciais de acesso e pode estar vinculada a um plano de consumo.

**Conceitos principais:**

- **Username** — identificador único da aplicação (ex: \`app-mobile\`, \`partner-acme\`)
- **Credenciais** — método de autenticação configurado (API Key, Basic Auth, JWT ou HMAC)
- **Plano** — grupo de consumo opcional que define limites de taxa e políticas compartilhadas
- **Descrição** — texto livre para documentar o propósito da aplicação

> **Nota:** No API Gateway, cada aplicação corresponde a um "consumer". O termo "aplicação" é usado na interface para ser mais intuitivo para equipes de negócio.`,
        },
        {
          id: "ciclo-de-vida",
          title: "Ciclo de Vida",
          body: `O fluxo típico para gerenciar aplicações é:

1. **Criar** — defina username, descrição e método de autenticação
2. **Configurar credenciais** — gere API Key, defina senha Basic Auth, configure JWT ou HMAC
3. **Associar plano** (opcional) — vincule a um plano para aplicar rate limits e políticas
4. **Monitorar** — acompanhe o uso via analytics da aplicação
5. **Revogar** — remova credenciais ou exclua a aplicação quando não for mais necessária

Cada aplicação pode ter apenas **um método de autenticação** ativo por vez. Para trocar o método, edite a aplicação e selecione o novo tipo de credencial.`,
        },
      ],
    },
    {
      slug: "metodos-autenticacao",
      title: "Métodos de Autenticação",
      description:
        "Configure API Key, Basic Auth, JWT e HMAC para autenticar consumidores nas suas APIs.",
      icon: "Key",
      tags: ["autenticação", "api-key", "basic-auth", "jwt", "hmac", "credenciais"],
      content: [
        {
          id: "api-key",
          title: "API Key (key-auth)",
          body: `O método mais simples de autenticação. O consumidor envia uma chave no header ou query parameter.

**Configuração:**

\`\`\`json
{
  "plugins": {
    "key-auth": {
      "key": "minha-chave-secreta-123"
    }
  }
}
\`\`\`

**Como usar:**

\`\`\`bash
curl -H "apikey: minha-chave-secreta-123" https://gateway.exemplo.com/api/v1/dados
\`\`\`

**Quando usar:**
- Integrações simples entre serviços
- APIs internas com controle de acesso básico
- Ambientes de desenvolvimento e testes

**Boas práticas:**
- Use chaves longas e aleatórias (mínimo 32 caracteres)
- Rotacione chaves periodicamente
- Nunca exponha chaves em repositórios de código`,
        },
        {
          id: "basic-auth",
          title: "Basic Auth (basic-auth)",
          body: `Autenticação baseada em usuário e senha via header HTTP Authorization.

**Configuração:**

\`\`\`json
{
  "plugins": {
    "basic-auth": {
      "username": "app-mobile",
      "password": "senha-segura-456"
    }
  }
}
\`\`\`

**Como usar:**

\`\`\`bash
curl -u app-mobile:senha-segura-456 https://gateway.exemplo.com/api/v1/dados
\`\`\`

**Quando usar:**
- Compatibilidade com sistemas legados
- Integrações que já usam Basic Auth`,
        },
        {
          id: "jwt-auth",
          title: "JWT (jwt-auth)",
          body: `Autenticação baseada em JSON Web Tokens. Ideal para arquiteturas modernas com tokens assinados.

**Configuração:**

\`\`\`json
{
  "plugins": {
    "jwt-auth": {
      "key": "consumer-jwt-key",
      "secret": "meu-segredo-jwt",
      "algorithm": "HS256",
      "exp": 86400
    }
  }
}
\`\`\`

O consumidor primeiro obtém um token via o endpoint \`/apisix/plugin/jwt/sign\` e depois o envia no header Authorization como Bearer token.

**Quando usar:**
- Aplicações web e mobile modernas
- Arquiteturas com Single Sign-On (SSO)
- Cenários que precisam de claims customizados no token`,
        },
        {
          id: "hmac-auth",
          title: "HMAC (hmac-auth)",
          body: `Autenticação baseada em assinatura HMAC do request. Oferece alta segurança pois cada requisição é assinada individualmente.

**Configuração:**

\`\`\`json
{
  "plugins": {
    "hmac-auth": {
      "access_key": "minha-access-key",
      "secret_key": "minha-secret-key",
      "algorithm": "hmac-sha256"
    }
  }
}
\`\`\`

O cliente deve gerar uma assinatura HMAC do request (método, path, headers, timestamp) e enviá-la no header Authorization.

**Quando usar:**
- APIs financeiras ou com requisitos de segurança elevados
- Integrações B2B com parceiros
- Cenários onde é necessário garantir integridade do request`,
        },
      ],
    },
    {
      slug: "analytics-aplicacoes",
      title: "Analytics de Aplicações",
      description:
        "Monitore o consumo, latência e erros de cada aplicação individualmente.",
      icon: "BarChart3",
      tags: ["analytics", "métricas", "consumo", "aplicações", "monitoramento"],
      content: [
        {
          id: "dashboard-consumidor",
          title: "Dashboard do Consumidor",
          body: `Cada aplicação possui uma página de analytics acessível via **Aplicações > [nome] > Analytics**. O dashboard mostra:

**Métricas disponíveis:**

- **Requisições totais** — volume total no período selecionado
- **Taxa de erros** — percentual de respostas 4xx e 5xx
- **Latência P50/P95/P99** — distribuição de tempo de resposta
- **Throughput** — requisições por segundo ao longo do tempo

**Filtros:**
- Período: últimas 1h, 6h, 24h, 7d ou intervalo customizado
- Agrupamento: por rota, por status code, por método HTTP

**Casos de uso:**
- Identificar consumidores que estão gerando muitos erros
- Verificar se um consumidor está respeitando os limites do plano
- Diagnosticar problemas de latência específicos de um consumidor`,
        },
      ],
    },
  ],
}
