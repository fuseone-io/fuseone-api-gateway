import type { DocCategory } from "./types"

export const kafkaGatewayCategory: DocCategory = {
  slug: "kafka-gateway",
  title: "Event Gateway (Kafka)",
  description:
    "Gerencie conexoes Kafka, navegue por topicos, produza e consuma mensagens diretamente pelo dashboard.",
  icon: "Radio",
  articles: [
    {
      slug: "visao-geral-kafka",
      title: "Visao Geral do Event Gateway",
      description:
        "Entenda como o API Gateway integra com Apache Kafka para fornecer uma interface REST para eventos.",
      icon: "Radio",
      tags: ["kafka", "eventos", "mensageria", "overview"],
      content: [
        {
          id: "o-que-e",
          title: "O que e o Event Gateway",
          body: `O modulo Event Gateway do FuseOne API Gateway permite gerenciar clusters Apache Kafka diretamente pelo dashboard. Ele utiliza o Strimzi Kafka Bridge como proxy REST para interagir com brokers Kafka sem necessidade de clientes nativos.

**Funcionalidades:**

- **Gerenciamento de conexoes** — cadastre e gerencie multiplos clusters Kafka
- **Topic browser** — navegue e inspecione topicos e particoes
- **Produtor REST** — envie mensagens para topicos via interface visual
- **Consumidor REST** — consuma mensagens de topicos para debug e teste
- **Consumer groups** — visualize grupos de consumidores ativos

> **Arquitetura:** O API Gateway conecta-se ao Kafka via Strimzi Kafka Bridge, que expoe uma API REST compativel. Nao ha conexao direta com brokers Kafka — toda comunicacao passa pelo bridge.`,
        },
        {
          id: "como-funciona",
          title: "Como Funciona",
          body: `O fluxo de integracao Kafka opera em 3 camadas:

1. **Dashboard (Frontend)** — interface visual para navegar topicos, produzir e consumir mensagens
2. **Gateway API (Backend)** — gerencia conexoes no PostgreSQL e proxy requests para o Kafka Bridge
3. **Kafka Bridge (Strimzi)** — converte chamadas REST em protocolo Kafka nativo

**Fluxo de uma mensagem produzida:**

\`\`\`
Dashboard → POST /api/kafka/{connId}/topics/{topic}/produce
         → Backend valida conexao → cria KafkaBridgeClient(bridge_url)
         → POST http://kafka-bridge:8080/topics/{topic}
         → Kafka Bridge → Kafka Broker → Topico
\`\`\`

**Fluxo de consumo:**

\`\`\`
Dashboard → POST /api/kafka/{connId}/topics/{topic}/consume { group_id }
         → Backend cria consumer temporario no Bridge
         → Subscribe ao topico → GET records → DELETE consumer
         → Retorna mensagens para o dashboard
\`\`\`

Cada conexao cadastrada armazena o \`bridge_url\` correspondente, permitindo multiplos clusters Kafka com bridges independentes.`,
        },
      ],
    },
    {
      slug: "configuracao-kafka",
      title: "Configuracao do Kafka",
      description:
        "Configure a infraestrutura Kafka (Zookeeper, Broker e Bridge) para uso com o API Gateway.",
      icon: "Settings",
      tags: ["kafka", "configuracao", "docker", "bridge", "infraestrutura"],
      content: [
        {
          id: "infraestrutura",
          title: "Infraestrutura com Docker Compose",
          body: `O API Gateway inclui configuracao Docker Compose para Kafka com profile opcional:

\`\`\`bash
# Iniciar infraestrutura base + Kafka
make infra-kafka

# Ou manualmente
docker compose --profile kafka up -d
\`\`\`

Isso inicia 3 servicos adicionais:

| Servico | Imagem | Porta | Funcao |
|---------|--------|-------|--------|
| **zookeeper** | confluentinc/cp-zookeeper:7.6.0 | 2181 (interno) | Coordenacao do cluster Kafka |
| **kafka** | confluentinc/cp-kafka:7.6.0 | 9092 | Broker Kafka |
| **kafka-bridge** | strimzi/kafka-bridge:0.29.0 | 8082 | Proxy REST para Kafka |

> **Nota:** O Kafka Bridge escuta na porta 8082 no host (8080 internamente). O backend se conecta ao bridge via HTTP.`,
        },
        {
          id: "variaveis-ambiente",
          title: "Variaveis de Ambiente",
          body: `Configure o backend para habilitar o modulo Kafka:

| Variavel | Padrao | Descricao |
|----------|--------|-----------|
| \`KAFKA_ENABLED\` | \`false\` | Habilita o modulo Kafka |
| \`KAFKA_DEFAULT_BRIDGE_URL\` | \`http://localhost:8082\` | URL padrao do Kafka Bridge |

As conexoes individuais armazenam seu proprio \`bridge_url\`, mas o valor padrao e usado ao criar novas conexoes.

\`\`\`bash
# .env
KAFKA_ENABLED=true
KAFKA_DEFAULT_BRIDGE_URL=http://kafka-bridge:8080
\`\`\``,
        },
        {
          id: "bridge-properties",
          title: "Configuracao do Kafka Bridge",
          body: `O arquivo \`kafka-bridge.properties\` na raiz do projeto configura o Strimzi Kafka Bridge:

\`\`\`properties
bridge.id=fuseone-bridge
kafka.bootstrap.servers=kafka:29092
http.host=0.0.0.0
http.port=8080
http.cors.enabled=true
http.cors.allowedOrigins=*
http.consumer.enabled=true
http.producer.enabled=true
\`\`\`

**Parametros importantes:**

- \`kafka.bootstrap.servers\` — endereco do broker Kafka (interno Docker: \`kafka:29092\`)
- \`http.consumer.enabled\` — habilita endpoints de consumo REST
- \`http.producer.enabled\` — habilita endpoints de producao REST

Para clusters com autenticacao SASL/SSL, adicione as propriedades de seguranca do Kafka:

\`\`\`properties
kafka.security.protocol=SASL_SSL
kafka.sasl.mechanism=PLAIN
kafka.sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username="user" password="pass";
\`\`\``,
        },
      ],
    },
    {
      slug: "conexoes-kafka",
      title: "Gerenciamento de Conexoes",
      description:
        "Cadastre, edite e gerencie conexoes com clusters Kafka no dashboard.",
      icon: "Cable",
      tags: ["kafka", "conexoes", "clusters", "gerenciamento"],
      content: [
        {
          id: "criar-conexao",
          title: "Criando uma Conexao",
          body: `Para cadastrar uma nova conexao Kafka:

1. Acesse **Event Gateway > Kafka** no menu lateral
2. Clique em **Gerenciar Conexoes** ou acesse a pagina de conexoes
3. Clique em **Criar Conexao**
4. Preencha os campos:

| Campo | Obrigatorio | Descricao |
|-------|-------------|-----------|
| **Nome** | Sim | Nome identificador da conexao |
| **Descricao** | Nao | Descricao do cluster |
| **Brokers** | Sim | Lista de brokers (ex: \`kafka:9092,kafka2:9092\`) |
| **Protocolo de Seguranca** | Sim | PLAINTEXT, SSL, SASL_PLAINTEXT, SASL_SSL |
| **Mecanismo SASL** | Condicional | PLAIN, SCRAM-SHA-256, SCRAM-SHA-512 (se SASL) |
| **Usuario/Senha SASL** | Condicional | Credenciais SASL |
| **Bridge URL** | Sim | URL do Kafka Bridge para este cluster |
| **Ativo** | Sim | Toggle para habilitar/desabilitar |

5. Clique em **Salvar**

> **Nota:** A conexao armazena o \`bridge_url\` que aponta para o Kafka Bridge configurado para o cluster correspondente. Para clusters diferentes, voce precisa de bridges diferentes.`,
        },
        {
          id: "protocolos",
          title: "Protocolos de Seguranca",
          body: `O API Gateway suporta 4 protocolos de seguranca para conexoes Kafka:

| Protocolo | Descricao | Quando Usar |
|-----------|-----------|-------------|
| **PLAINTEXT** | Sem criptografia nem autenticacao | Desenvolvimento local, redes internas |
| **SSL** | Criptografia TLS sem autenticacao | Redes que requerem criptografia |
| **SASL_PLAINTEXT** | Autenticacao SASL sem criptografia | Redes internas com controle de acesso |
| **SASL_SSL** | Autenticacao SASL + criptografia TLS | Producao, clusters na nuvem |

**Mecanismos SASL suportados:**

- **PLAIN** — usuario/senha simples (mais comum com MSK, Confluent Cloud)
- **SCRAM-SHA-256** — challenge-response com hash SHA-256
- **SCRAM-SHA-512** — challenge-response com hash SHA-512 (mais seguro)

> **Seguranca:** As credenciais SASL sao armazenadas no PostgreSQL. Para ambientes de producao, considere usar um secret manager externo.`,
        },
      ],
    },
    {
      slug: "topicos-kafka",
      title: "Navegacao de Topicos",
      description:
        "Navegue por topicos Kafka, visualize particoes e configuracoes de cada topico.",
      icon: "List",
      tags: ["kafka", "topicos", "particoes", "browser"],
      content: [
        {
          id: "browser",
          title: "Topic Browser",
          body: `O Topic Browser permite navegar pelos topicos de um cluster Kafka conectado.

**Acessando:**

1. Va para **Event Gateway > Kafka**
2. Selecione uma conexao ativa na tabela
3. Clique em **Ver Topicos**

A lista mostra todos os topicos do cluster com:
- Nome do topico
- Numero de particoes
- Link para detalhes

**Filtro:** Use o campo de busca para filtrar topicos por nome. Util em clusters com muitos topicos.`,
        },
        {
          id: "detalhes",
          title: "Detalhes do Topico",
          body: `A pagina de detalhes de um topico mostra:

**Aba Detalhes:**
- Tabela de particoes com: numero da particao, lider, replicas
- Configuracoes do topico (retention.ms, cleanup.policy, etc.)

**Aba Produzir:**
- Interface para enviar mensagens ao topico
- Campos: chave (opcional), valor (JSON), headers
- Feedback de sucesso com offset da mensagem produzida

**Aba Consumir:**
- Interface para consumir mensagens do topico
- Campos: Group ID (obrigatorio), Max bytes
- Tabela de resultados: offset, particao, chave, valor, headers
- Consumo temporario — o consumer group e criado e destruido a cada request

> **Dica:** O consumo via dashboard e voltado para debug e teste. Para consumo em producao, use consumidores nativos Kafka.`,
        },
      ],
    },
    {
      slug: "produzir-consumir",
      title: "Produzir e Consumir Mensagens",
      description:
        "Envie e receba mensagens Kafka diretamente pelo dashboard para debug e teste.",
      icon: "ArrowLeftRight",
      tags: ["kafka", "produzir", "consumir", "mensagens", "debug"],
      content: [
        {
          id: "produzir",
          title: "Produzindo Mensagens",
          body: `Para produzir uma mensagem em um topico Kafka:

1. Navegue ate o topico desejado
2. Clique na aba **Produzir**
3. Preencha os campos:

\`\`\`json
{
  "key": "user-123",
  "value": "{\\"event\\": \\"user.created\\", \\"data\\": {\\"name\\": \\"Joao\\"}}",
  "headers": {
    "content-type": "application/json",
    "source": "api-gateway"
  }
}
\`\`\`

4. Clique em **Enviar Mensagem**

**Retorno de sucesso:**
- Particao onde a mensagem foi gravada
- Offset atribuido

**Formato do valor:**
- O valor da mensagem e sempre uma string
- Para JSON, serialize o objeto como string
- O Kafka Bridge converte automaticamente para bytes

> **Content-Type:** O backend envia para o Bridge com \`application/vnd.kafka.json.v2+json\`, garantindo compatibilidade com o protocolo JSON do Strimzi.`,
        },
        {
          id: "consumir",
          title: "Consumindo Mensagens",
          body: `Para consumir mensagens de um topico Kafka:

1. Navegue ate o topico desejado
2. Clique na aba **Consumir**
3. Informe o **Group ID** (ex: \`debug-consumer-1\`)
4. Opcionalmente ajuste **Max Bytes**
5. Clique em **Consumir**

**Processo interno:**

O consumo via dashboard segue 4 etapas:

1. **Criar consumer** — POST /consumers/{group_id} (consumer temporario)
2. **Subscribe** — POST /consumers/{group_id}/instances/{instance}/subscription
3. **Poll records** — GET /consumers/{group_id}/instances/{instance}/records
4. **Deletar consumer** — DELETE /consumers/{group_id}/instances/{instance}

O consumer e criado e destruido a cada operacao para evitar vazamento de recursos.

**Resultado:**
- Tabela com: offset, particao, chave, valor, headers
- Valores longos sao truncados com opcao de expandir

> **Limitacao:** O consumo via dashboard retorna apenas as mensagens disponiveis no momento do poll. Para consumo continuo, use consumidores nativos.`,
        },
      ],
    },
  ],
}
