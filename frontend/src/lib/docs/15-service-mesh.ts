import type { DocCategory } from "./types"

export const serviceMeshCategory: DocCategory = {
  slug: "service-mesh",
  title: "Service Mesh",
  description:
    "Visualize a topologia de serviços, monitore a saúde dos nós e gerencie service discovery com o API Gateway.",
  icon: "Network",
  articles: [
    {
      slug: "visao-geral-mesh",
      title: "Visão Geral do Service Mesh",
      description:
        "Entenda como o API Gateway funciona como control plane para service mesh, incluindo discovery, topologia e health checks.",
      icon: "Network",
      tags: ["mesh", "topologia", "discovery", "saúde", "overview"],
      content: [
        {
          id: "o-que-e",
          title: "O que é o Service Mesh",
          body: `O módulo de Service Mesh do API Gateway fornece visibilidade completa sobre os serviços que compõem sua infraestrutura. Ele agrega dados de upstreams, rotas e health checks para construir uma visão unificada da topologia de serviços.

**Funcionalidades:**

- **Visualização de topologia** — grafo interativo mostrando serviços e suas dependências
- **Service Discovery** — integração com DNS, Consul, Nacos, Eureka e Kubernetes
- **Health monitoring** — status de cada nó (healthy/unhealthy) em tempo real
- **Dependency mapping** — mapeamento automático de dependências entre serviços via rotas

> **Nota:** O API Gateway não substitui um service mesh completo como Istio ou Linkerd. Ele fornece uma camada de observabilidade e controle focada em APIs, complementando (ou substituindo para casos mais simples) um service mesh dedicado.`,
        },
        {
          id: "como-funciona",
          title: "Como Funciona",
          body: `O Service Mesh do API Gateway opera sobre dados já existentes no APISIX:

1. **Upstreams** — cada upstream representa um serviço com seus nós (endpoints)
2. **Routes** — rotas conectam entrypoints a upstreams, definindo dependências
3. **Health Checks** — active e passive health checks monitoram a saúde dos nós
4. **Service Discovery** — upstreams com \`discovery_type\` descobrem nós automaticamente

O backend do API Gateway agrega essas informações via APISIX Admin API e Control API para construir:
- Uma lista de serviços com seus nós e status de saúde
- Um grafo de dependências baseado em rotas → upstreams
- Métricas agregadas (total serviços, nós saudáveis/não-saudáveis)
- Status de cada tipo de service discovery em uso

Nenhuma tabela adicional no banco de dados é necessária — tudo opera em tempo real sobre o estado do APISIX.`,
        },
      ],
    },
    {
      slug: "service-discovery",
      title: "Service Discovery",
      description:
        "Configure descoberta automática de serviços com DNS, Consul, Nacos, Eureka ou Kubernetes.",
      icon: "Search",
      tags: ["mesh", "discovery", "consul", "kubernetes", "dns", "nacos"],
      content: [
        {
          id: "tipos",
          title: "Tipos de Discovery Suportados",
          body: `O API Gateway suporta os seguintes mecanismos de service discovery:

| Tipo | Descrição | Uso Comum |
|------|-----------|-----------|
| **dns** | Resolução DNS (A/SRV records) | Kubernetes services, Docker Compose |
| **consul** | HashiCorp Consul service registry | Microservicos tradicionais |
| **nacos** | Alibaba Nacos discovery | Ecossistema Java/Spring Cloud |
| **eureka** | Netflix Eureka registry | Spring Cloud legacy |
| **kubernetes** | K8s service discovery nativo | Clusters Kubernetes |

Para usar discovery, configure o upstream com \`discovery_type\` e \`service_name\` em vez de \`nodes\` estáticos:

\`\`\`json
{
  "type": "roundrobin",
  "discovery_type": "dns",
  "service_name": "my-service.default.svc.cluster.local"
}
\`\`\`

O APISIX resolve automaticamente os nós do serviço e atualiza o upstream. No dashboard do Service Mesh você verá os nós descobertos com seu status de saúde.`,
        },
        {
          id: "configuracao-dns",
          title: "DNS Discovery",
          body: `O DNS discovery e o mais simples e funciona out-of-the-box com Kubernetes e Docker Compose.

**Configuracao no upstream:**

\`\`\`json
{
  "type": "roundrobin",
  "discovery_type": "dns",
  "service_name": "user-service.default.svc.cluster.local:8080"
}
\`\`\`

O APISIX resolve o nome DNS periodicamente e atualiza os nós do upstream. SRV records são usados quando disponíveis para descobrir porta e peso.

**Vantagens:**
- Sem infraestrutura adicional
- Funciona com qualquer DNS (Kubernetes CoreDNS, Docker DNS, etc.)
- Simples de configurar

**Limitações:**
- TTL do DNS afeta a velocidade de atualização
- Sem metadados adicionais (tags, health)
- Sem notificação push (polling baseado em TTL)`,
        },
        {
          id: "configuracao-consul",
          title: "Consul Discovery",
          body: `Para usar Consul como service registry, configure no APISIX (config.yaml):

\`\`\`yaml
discovery:
  consul:
    servers:
      - "http://consul:8500"
    token: "your-consul-token"
    skip_services:
      - "consul"
\`\`\`

**Upstream com Consul:**

\`\`\`json
{
  "type": "roundrobin",
  "discovery_type": "consul",
  "service_name": "user-service"
}
\`\`\`

**Vantagens:**
- Health checks nativos do Consul
- Metadados de serviço (tags, datacenter)
- Notificação push via long polling (atualização rápida)

**Limitações:**
- Requer infraestrutura Consul
- Complexidade operacional adicional`,
        },
      ],
    },
    {
      slug: "topologia-servicos",
      title: "Topologia de Serviços",
      description:
        "Visualize o grafo de dependências entre serviços com o viewer interativo de topologia.",
      icon: "GitBranch",
      tags: ["mesh", "topologia", "grafo", "dependências", "visualização"],
      content: [
        {
          id: "grafo",
          title: "Grafo de Dependências",
          body: `A página de Topologia (Service Mesh > Topologia) mostra um grafo interativo de todos os serviços e suas dependências.

**Como o grafo é construído:**

1. Cada **upstream** com nós se torna um **nó** no grafo
2. Cada **rota** que referencia um upstream cria uma **aresta** (dependência)
3. Se uma rota referencia um **service** que referencia um upstream, a cadeia é seguida

**Interações disponíveis:**
- **Zoom** — scroll do mouse ou botoes de controle
- **Pan** — arraste o fundo
- **Selecionar** — clique em um nó para ver detalhes
- **Fit View** — botão para ajustar a visão a todos os nós
- **Minimap** — visão geral no canto inferior direito

**Cores dos nós:**
- **Verde** — todos os nós saudáveis
- **Amarelo** — alguns nós não-saudáveis
- **Vermelho** — todos os nós não-saudáveis ou nenhum nó
- **Cinza** — status desconhecido

> **Dica:** A topologia é atualizada em tempo real. Adicione novos serviços ou rotas e veja o grafo se atualizar automaticamente ao recarregar a página.`,
        },
        {
          id: "health-checks",
          title: "Health Checks",
          body: `O status de saúde dos nós é determinado por health checks configurados nos upstreams:

**Active Health Check** — o API Gateway faz requisições periódicas para cada nó:
- HTTP path (ex: /health)
- Intervalo de verificação
- Número de sucessos para marcar como saudável
- Número de falhas para marcar como não-saudável

**Passive Health Check** — analisa respostas de tráfego real:
- Conta erros HTTP (5xx) e TCP
- Conta timeouts
- Marca nós como não-saudáveis após N falhas consecutivas

**Sem Health Check** — quando não configurado, o status é "unknown" e o nó é considerado sempre disponível.

Recomendamos configurar pelo menos active health checks para todos os upstreams em produção. Isso garante que o API Gateway direciona tráfego apenas para nós que estão realmente funcionando.`,
        },
      ],
    },
  ],
}
