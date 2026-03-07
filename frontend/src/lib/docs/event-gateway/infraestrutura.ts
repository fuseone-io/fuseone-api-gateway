import type { DocArticle } from "../types"

export const infraestruturaArticle: DocArticle = {
  slug: "configuracao-infraestrutura",
  title: "Configuração da Infraestrutura",
  description:
    "Configure a infraestrutura Kafka, NATS e o Event Gateway para uso com o API Gateway.",
  icon: "Settings",
  tags: ["kafka", "nats", "configuração", "docker", "helm", "infraestrutura"],
  content: [
    {
      id: "docker-compose",
      title: "Docker Compose",
      body: `O API Gateway inclui configuração Docker Compose com profiles opcionais:

**Com Kafka:**

\`\`\`bash
docker compose --profile kafka up -d
\`\`\`

| Serviço | Imagem | Porta | Função |
|---------|--------|-------|--------|
| **zookeeper** | confluentinc/cp-zookeeper:7.6.0 | 2181 | Coordenação do cluster Kafka |
| **kafka** | confluentinc/cp-kafka:7.6.0 | 9092 | Broker Kafka |
| **event-gateway** | fuseone/event-gateway | 8090 | Mediação de protocolo |

**Com NATS:**

\`\`\`bash
docker compose --profile nats up -d
\`\`\`

| Serviço | Imagem | Porta | Função |
|---------|--------|-------|--------|
| **nats** | nats:2.10-alpine | 4222, 8222 | Servidor NATS (com JetStream habilitado) |
| **event-gateway** | fuseone/event-gateway | 8090 | Mediação de protocolo |

**Exemplo \`docker-compose.yml\` para NATS:**

\`\`\`yaml
nats:
  image: nats:2.10-alpine
  command: ["--js", "--sd", "/data", "-m", "8222"]
  ports:
    - "4222:4222"
    - "8222:8222"  # monitoring
  volumes:
    - nats-data:/data
  profiles:
    - nats
\`\`\`

> \`--js\` habilita JetStream, \`--sd /data\` configura o storage directory, \`-m 8222\` habilita o endpoint de monitoramento.

**Variáveis de ambiente do Event Gateway:**

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| \`SERVER_PORT\` | \`8090\` | Porta HTTP do Event Gateway |
| \`DB_HOST\` | \`postgres\` | Host do PostgreSQL |
| \`DB_PORT\` | \`5432\` | Porta do PostgreSQL |
| \`DB_NAME\` | \`fuseone_gateway\` | Nome do banco de dados |
| \`DB_USER\` | \`gateway\` | Usuário do banco |
| \`DB_PASSWORD\` | \`gateway\` | Senha do banco |

> O Event Gateway compartilha o mesmo PostgreSQL do backend. Ele lê as configs das Event APIs e recebe notificações de mudança via \`LISTEN/NOTIFY\`.`,
    },
    {
      id: "helm",
      title: "Deploy com Helm",
      body: `Para Kubernetes, habilite o Event Gateway no Helm chart:

\`\`\`yaml
# values.yaml
eventGateway:
  enabled: true
  image:
    repository: devopsfuseone/fuseone-event-gateway
    tag: "latest"
  replicas: 2
  resources:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 500m
      memory: 256Mi
  service:
    type: ClusterIP
    port: 8090
\`\`\`

\`\`\`bash
helm upgrade --install fuseone ./charts/fuseone \\
  --set eventGateway.enabled=true
\`\`\`

O chart cria automaticamente:
- **Deployment** com liveness/readiness probes em \`/health\`
- **Service** ClusterIP na porta 8090
- **ConfigMap** com variáveis do PostgreSQL
- **Secret** com credenciais do banco

> **NATS no Kubernetes:** Use o [NATS Helm chart oficial](https://github.com/nats-io/k8s/tree/main/helm/charts/nats) para deploy do servidor NATS. O Event Gateway se conecta via URL configurada na conexão do dashboard.`,
    },
  ],
}
