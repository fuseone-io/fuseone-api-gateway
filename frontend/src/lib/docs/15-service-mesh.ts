import type { DocCategory } from "./types"

export const serviceMeshCategory: DocCategory = {
  slug: "service-mesh",
  title: "Service Mesh",
  description:
    "Visualize a topologia de servicos, monitore a saude dos nos e gerencie service discovery com o API Gateway.",
  icon: "Network",
  articles: [
    {
      slug: "visao-geral-mesh",
      title: "Visao Geral do Service Mesh",
      description:
        "Entenda como o API Gateway funciona como control plane para service mesh, incluindo discovery, topologia e health checks.",
      icon: "Network",
      tags: ["mesh", "topologia", "discovery", "saude", "overview"],
      content: [
        {
          id: "o-que-e",
          title: "O que e o Service Mesh",
          body: `O modulo de Service Mesh do API Gateway fornece visibilidade completa sobre os servicos que compoe sua infraestrutura. Ele agrega dados de upstreams, rotas e health checks para construir uma visao unificada da topologia de servicos.

**Funcionalidades:**

- **Visualizacao de topologia** — grafo interativo mostrando servicos e suas dependencias
- **Service Discovery** — integracao com DNS, Consul, Nacos, Eureka e Kubernetes
- **Health monitoring** — status de cada no (healthy/unhealthy) em tempo real
- **Dependency mapping** — mapeamento automatico de dependencias entre servicos via rotas

> **Nota:** O API Gateway nao substitui um service mesh completo como Istio ou Linkerd. Ele fornece uma camada de observabilidade e controle focada em APIs, complementando (ou substituindo para casos mais simples) um service mesh dedicado.`,
        },
        {
          id: "como-funciona",
          title: "Como Funciona",
          body: `O Service Mesh do API Gateway opera sobre dados ja existentes no APISIX:

1. **Upstreams** — cada upstream representa um servico com seus nos (endpoints)
2. **Routes** — rotas conectam entrypoints a upstreams, definindo dependencias
3. **Health Checks** — active e passive health checks monitoram a saude dos nos
4. **Service Discovery** — upstreams com \`discovery_type\` descobrem nos automaticamente

O backend do API Gateway agrega essas informacoes via APISIX Admin API e Control API para construir:
- Uma lista de servicos com seus nos e status de saude
- Um grafo de dependencias baseado em rotas → upstreams
- Metricas agregadas (total servicos, nos saudaveis/nao-saudaveis)
- Status de cada tipo de service discovery em uso

Nenhuma tabela adicional no banco de dados e necessaria — tudo opera em tempo real sobre o estado do APISIX.`,
        },
      ],
    },
    {
      slug: "service-discovery",
      title: "Service Discovery",
      description:
        "Configure descoberta automatica de servicos com DNS, Consul, Nacos, Eureka ou Kubernetes.",
      icon: "Search",
      tags: ["mesh", "discovery", "consul", "kubernetes", "dns", "nacos"],
      content: [
        {
          id: "tipos",
          title: "Tipos de Discovery Suportados",
          body: `O API Gateway suporta os seguintes mecanismos de service discovery:

| Tipo | Descricao | Uso Comum |
|------|-----------|-----------|
| **dns** | Resolucao DNS (A/SRV records) | Kubernetes services, Docker Compose |
| **consul** | HashiCorp Consul service registry | Microservicos tradicionais |
| **nacos** | Alibaba Nacos discovery | Ecossistema Java/Spring Cloud |
| **eureka** | Netflix Eureka registry | Spring Cloud legacy |
| **kubernetes** | K8s service discovery nativo | Clusters Kubernetes |

Para usar discovery, configure o upstream com \`discovery_type\` e \`service_name\` em vez de \`nodes\` estaticos:

\`\`\`json
{
  "type": "roundrobin",
  "discovery_type": "dns",
  "service_name": "my-service.default.svc.cluster.local"
}
\`\`\`

O APISIX resolve automaticamente os nos do servico e atualiza o upstream. No dashboard do Service Mesh voce vera os nos descobertos com seu status de saude.`,
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

O APISIX resolve o nome DNS periodicamente e atualiza os nos do upstream. SRV records sao usados quando disponiveis para descobrir porta e peso.

**Vantagens:**
- Sem infraestrutura adicional
- Funciona com qualquer DNS (Kubernetes CoreDNS, Docker DNS, etc.)
- Simples de configurar

**Limitacoes:**
- TTL do DNS afeta a velocidade de atualizacao
- Sem metadados adicionais (tags, health)
- Sem notificacao push (polling baseado em TTL)`,
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
- Metadados de servico (tags, datacenter)
- Notificacao push via long polling (atualizacao rapida)

**Limitacoes:**
- Requer infraestrutura Consul
- Complexidade operacional adicional`,
        },
      ],
    },
    {
      slug: "topologia-servicos",
      title: "Topologia de Servicos",
      description:
        "Visualize o grafo de dependencias entre servicos com o viewer interativo de topologia.",
      icon: "GitBranch",
      tags: ["mesh", "topologia", "grafo", "dependencias", "visualizacao"],
      content: [
        {
          id: "grafo",
          title: "Grafo de Dependencias",
          body: `A pagina de Topologia (Service Mesh > Topologia) mostra um grafo interativo de todos os servicos e suas dependencias.

**Como o grafo e construido:**

1. Cada **upstream** com nos se torna um **no** no grafo
2. Cada **rota** que referencia um upstream cria uma **aresta** (dependencia)
3. Se uma rota referencia um **service** que referencia um upstream, a cadeia e seguida

**Interacoes disponiveis:**
- **Zoom** — scroll do mouse ou botoes de controle
- **Pan** — arraste o fundo
- **Selecionar** — clique em um no para ver detalhes
- **Fit View** — botao para ajustar a visao a todos os nos
- **Minimap** — visao geral no canto inferior direito

**Cores dos nos:**
- **Verde** — todos os nos saudaveis
- **Amarelo** — alguns nos nao-saudaveis
- **Vermelho** — todos os nos nao-saudaveis ou nenhum no
- **Cinza** — status desconhecido

> **Dica:** A topologia e atualizada em tempo real. Adicione novos servicos ou rotas e veja o grafo se atualizar automaticamente ao recarregar a pagina.`,
        },
        {
          id: "health-checks",
          title: "Health Checks",
          body: `O status de saude dos nos e determinado por health checks configurados nos upstreams:

**Active Health Check** — o API Gateway faz requisicoes periodicas para cada no:
- HTTP path (ex: /health)
- Intervalo de verificacao
- Numero de sucessos para marcar como saudavel
- Numero de falhas para marcar como nao-saudavel

**Passive Health Check** — analisa respostas de trafego real:
- Conta erros HTTP (5xx) e TCP
- Conta timeouts
- Marca nos como nao-saudaveis apos N falhas consecutivas

**Sem Health Check** — quando nao configurado, o status e "unknown" e o no e considerado sempre disponivel.

Recomendamos configurar pelo menos active health checks para todos os upstreams em producao. Isso garante que o API Gateway direciona trafego apenas para nos que estao realmente funcionando.`,
        },
      ],
    },
  ],
}
