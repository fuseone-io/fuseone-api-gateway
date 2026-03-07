import type { DocArticle } from "../types"

export const conexoesArticle: DocArticle = {
  slug: "conexoes-event-gateway",
  title: "Gerenciamento de Conexões",
  description:
    "Cadastre e gerencie conexões com clusters Kafka e servidores NATS no dashboard.",
  icon: "Cable",
  tags: ["kafka", "nats", "conexões", "clusters", "jetstream", "gerenciamento"],
  content: [
    {
      id: "criar-conexao",
      title: "Criando uma Conexão",
      body: `Para cadastrar uma nova conexão:

1. Acesse **Integrações > Event Gateway** no menu lateral
2. Clique em **Gerenciar Conexões**
3. Clique em **Criar Conexão**
4. Selecione o **Tipo de Conexão** (Apache Kafka ou NATS)
5. Preencha os campos específicos do provedor
6. Clique em **Salvar**

> **Nota:** O tipo de conexão não pode ser alterado após a criação. Para trocar de Kafka para NATS (ou vice-versa), crie uma nova conexão.`,
    },
    {
      id: "conexao-kafka",
      title: "Conexão Kafka",
      body: `**Campos para conexão Kafka:**

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| **Nome** | Sim | Nome identificador da conexão |
| **Descrição** | Não | Descrição do cluster |
| **Brokers** | Sim | Lista de brokers separados por vírgula (ex: \`kafka:9092, kafka2:9092\`) |
| **Protocolo de Segurança** | Sim | PLAINTEXT, SSL, SASL_PLAINTEXT, SASL_SSL |
| **Mecanismo SASL** | Condicional | PLAIN, SCRAM-SHA-256, SCRAM-SHA-512 (se SASL) |
| **Usuário/Senha SASL** | Condicional | Credenciais SASL |
| **Ativo** | Sim | Toggle para habilitar/desabilitar |

**Protocolos de Segurança:**

| Protocolo | Descrição | Quando Usar |
|-----------|-----------|-------------|
| **PLAINTEXT** | Sem criptografia nem autenticação | Desenvolvimento local |
| **SSL** | Criptografia TLS sem autenticação | Redes que requerem criptografia |
| **SASL_PLAINTEXT** | Autenticação SASL sem criptografia | Redes internas com controle de acesso |
| **SASL_SSL** | Autenticação SASL + criptografia TLS | **Produção**, clusters na nuvem (AWS MSK, Confluent Cloud) |

**Mecanismos SASL:**

- **PLAIN** — usuário/senha simples (mais comum com MSK, Confluent Cloud)
- **SCRAM-SHA-256** — challenge-response com hash SHA-256
- **SCRAM-SHA-512** — challenge-response com hash SHA-512 (mais seguro)`,
    },
    {
      id: "conexao-nats",
      title: "Conexão NATS",
      body: `**Campos para conexão NATS:**

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| **Nome** | Sim | Nome identificador da conexão |
| **Descrição** | Não | Descrição do servidor |
| **URLs NATS** | Sim | Lista de URLs separadas por vírgula (ex: \`nats://server:4222\`) |
| **Token** | Não | Token de autenticação simples |
| **NKey Seed** | Não | Seed NKey para autenticação Ed25519 (formato \`SUAA...\`) |
| **Credenciais** | Não | Conteúdo do arquivo \`.creds\` (JWT + NKey) |
| **JetStream** | Não | Habilita persistência e consumers duráveis |
| **TLS** | Não | Conecta com criptografia TLS |
| **Ativo** | Sim | Toggle para habilitar/desabilitar |

**NATS Core vs JetStream:**

| Feature | NATS Core | NATS JetStream |
|---------|-----------|----------------|
| **Persistência** | ❌ Efêmero | ✅ Persistente em disco |
| **Consumer Groups** | QueueSubscribe (balanceamento) | Durable Consumers (com offset) |
| **Replay** | ❌ Apenas mensagens futuras | ✅ Replay desde qualquer ponto |
| **Exactly-Once** | ❌ At-most-once | ✅ Suportado |
| **REST Consume** | Timeout-based (best effort) | Pull-based (confiável) |
| **Webhook** | ✅ Funciona | ✅ Funciona (com garantia de entrega) |

> **Recomendação:** Habilite **JetStream** para Event APIs que usam REST Consume, Webhook ou qualquer cenário que exija persistência e replay de mensagens. Use NATS Core apenas para pub/sub efêmero e baixa latência.

**Métodos de autenticação NATS:**

1. **Token** — autenticação simples com string compartilhada
2. **NKey** — autenticação Ed25519 com par de chaves (mais seguro, sem compartilhar segredos)
3. **Credentials (.creds)** — arquivo que combina JWT do usuário + NKey (para NATS com Account Server)

> **Auto-criação de streams:** Quando JetStream está habilitado, o Event Gateway cria automaticamente o stream NATS se ele não existir. O nome é derivado do subject: \`orders.events\` → stream \`ORDERS_EVENTS\`.`,
    },
    {
      id: "kafka-vs-nats",
      title: "Kafka vs NATS — Comparativo",
      body: `**Quando usar Kafka:**

- Volume muito alto de dados (> 100k msgs/s)
- Event sourcing e log compactado
- Múltiplos consumidores independentes no mesmo tópico
- Retenção longa de dados (dias/semanas)
- Ecossistema maduro (Kafka Connect, ksqlDB, Schema Registry)
- Compliance (PCI-DSS, HIPAA) — auditoria completa com offsets

**Quando usar NATS Core:**

- Comunicação entre microserviços (request/reply, pub/sub)
- Latência ultra-baixa (< 1ms)
- Comandos e controle em tempo real
- Cenários onde perder mensagens é aceitável
- Deploy simples (binário único, zero dependências)

**Quando usar NATS JetStream:**

- IoT e telemetria (alto volume, persistência necessária)
- Filas de trabalho (work queues) com acknowledgment
- Cenários que precisam de replay mas sem a complexidade do Kafka
- Edge computing (NATS roda em dispositivos embarcados)
- Quando precisar de Kafka-like guarantees com operação mais simples`,
    },
  ],
}
