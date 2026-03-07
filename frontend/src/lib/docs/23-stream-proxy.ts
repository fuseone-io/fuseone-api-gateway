import type { DocCategory } from "./types"

export const streamProxyCategory: DocCategory = {
  slug: "stream-proxy",
  title: "Stream Proxy (TCP/UDP)",
  description:
    "Configure proxy de Camada 4 para protocolos não-HTTP como TCP, UDP, TLS e gRPC passthrough.",
  icon: "Wifi",
  articles: [
    {
      slug: "visao-geral-stream",
      title: "Visão Geral do Stream Proxy",
      description:
        "Entenda como o API Gateway pode rotear tráfego TCP/UDP além de HTTP.",
      icon: "Wifi",
      tags: ["stream", "tcp", "udp", "l4", "proxy", "overview"],
      content: [
        {
          id: "o-que-e",
          title: "O que é o Stream Proxy",
          body: `O Stream Proxy permite que o API Gateway atue como proxy de **Camada 4 (L4)** para protocolos não-HTTP. Enquanto rotas HTTP tradicionais operam na Camada 7, o stream proxy roteia tráfego TCP e UDP bruto diretamente para os backends.

**Casos de uso:**

- **Bancos de dados** — proxy para MySQL, PostgreSQL, Redis, MongoDB
- **Message brokers** — proxy para MQTT, AMQP, custom protocols
- **gRPC passthrough** — quando não é necessário inspecionar o payload gRPC
- **TLS passthrough** — encaminhar conexões TLS sem terminar no gateway
- **Protocolos proprietários** — qualquer protocolo sobre TCP/UDP

**Diferenças do proxy HTTP:**

| Aspecto | Proxy HTTP (L7) | Stream Proxy (L4) |
|---------|-----------------|-------------------|
| **Protocolo** | HTTP/HTTPS | TCP/UDP qualquer |
| **Roteamento** | Por URI, host, headers | Por porta e IP remoto |
| **Plugins** | Completo | Limitado (L4 apenas) |
| **Inspeção** | Headers, body, path | Apenas conexão |
| **SNI** | Via Host header | Via TLS SNI |

> **Pré-requisito:** O módulo stream deve estar habilitado na configuração do API Gateway. Caso apareça o aviso "Stream Proxy desabilitado", ative-o nas configurações do APISIX.`,
        },
        {
          id: "como-funciona",
          title: "Como Funciona",
          body: `O stream proxy opera no nível de conexão TCP/UDP:

1. **Cliente conecta** na porta configurada do gateway
2. **Gateway avalia** as regras de roteamento (porta de origem, IP remoto, SNI)
3. **Conexão é encaminhada** para o upstream de destino
4. **Dados fluem** bidirecionalmente entre cliente e backend
5. **Conexão encerra** quando qualquer lado fechar

**Roteamento por SNI (Server Name Indication):**

Para TLS passthrough, o gateway pode rotear baseado no SNI sem decriptar o tráfego:

\`\`\`json
{
  "sni": "db.exemplo.com",
  "upstream": {
    "type": "roundrobin",
    "nodes": {
      "postgres-primary:5432": 1
    }
  }
}
\`\`\`

**Roteamento por IP remoto:**

\`\`\`json
{
  "remote_addr": "10.0.0.0/8",
  "upstream": {
    "type": "roundrobin",
    "nodes": {
      "internal-service:9090": 1
    }
  }
}
\`\`\``,
        },
      ],
    },
    {
      slug: "configurando-stream-routes",
      title: "Configurando Stream Routes",
      description:
        "Crie e gerencie rotas de stream proxy para tráfego TCP/UDP.",
      icon: "Settings",
      tags: ["stream", "configuração", "rotas", "tcp", "udp"],
      content: [
        {
          id: "criando-rota",
          title: "Criando uma Rota Stream",
          body: `Para criar uma nova rota stream:

1. Acesse **Stream Proxy** no menu lateral
2. Clique em **Nova Rota Stream**
3. Preencha o formulário:
   - **ID** (opcional) — identificador da rota
   - **Descrição** — propósito da rota
   - **SNI** — nome do servidor para roteamento TLS (opcional)
   - **IP Remoto** — filtro de IP de origem em CIDR (opcional)
4. Configure o **Upstream**:
   - Tipo de balanceamento (roundrobin, chash, least_conn)
   - Nós de destino (host:porta e peso)
5. Adicione **plugins** L4 se necessário
6. Salve a rota

**Exemplo — proxy para PostgreSQL:**

\`\`\`json
{
  "desc": "Proxy PostgreSQL produção",
  "sni": "pg.exemplo.com",
  "upstream": {
    "type": "roundrobin",
    "nodes": {
      "pg-primary.internal:5432": 10,
      "pg-replica.internal:5432": 5
    }
  }
}
\`\`\``,
        },
        {
          id: "plugins-l4",
          title: "Plugins de Camada 4",
          body: `Os seguintes plugins são compatíveis com stream routes:

| Plugin | Descrição |
|--------|-----------|
| **mqtt-proxy** | Roteamento inteligente de tráfego MQTT por client_id |
| **ip-restriction** | Bloqueio/permissão por IP de origem |
| **limit-conn** | Limite de conexões simultâneas |
| **syslog** | Envio de logs para servidor syslog |
| **prometheus** | Coleta de métricas L4 |

**Exemplo com limit-conn:**

\`\`\`json
{
  "plugins": {
    "limit-conn": {
      "conn": 100,
      "burst": 50,
      "default_conn_delay": 0.1,
      "rejected_code": 503
    }
  }
}
\`\`\`

> **Nota:** Plugins de Camada 7 (como cors, rewrite, auth) não são compatíveis com stream routes, pois não há cabeçalhos HTTP para inspecionar.`,
        },
        {
          id: "boas-praticas-stream",
          title: "Boas Práticas",
          body: `**Segurança:**
- Use TLS passthrough para conexões de banco de dados em produção
- Restrinja IPs de origem com \`ip-restriction\` para serviços sensíveis
- Limite conexões simultâneas com \`limit-conn\` para evitar exaustão de recursos

**Performance:**
- Use \`least_conn\` como algoritmo de balanceamento para conexões de longa duração (bancos de dados, WebSockets)
- Configure timeouts adequados para evitar conexões ociosas consumindo recursos
- Monitore o número de conexões ativas via métricas Prometheus

**Monitoramento:**
- Habilite o plugin \`prometheus\` para coletar métricas L4
- Configure alertas para picos de conexões simultâneas
- Acompanhe erros de conexão no log de auditoria

**Limitações:**
- Não é possível inspecionar o conteúdo do tráfego (é L4, não L7)
- Roteamento baseado apenas em porta, IP e SNI (sem URL, headers, etc.)
- Health checks de upstream funcionam mas são baseados em conexão TCP, não em protocolo específico`,
        },
      ],
    },
  ],
}
