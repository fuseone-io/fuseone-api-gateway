export interface KafkaConnection {
  id: string
  name: string
  description: string
  connection_type: "kafka" | "nats"
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
  // Kafka fields
  brokers: string[]
  security_protocol: string
  sasl_mechanism?: string
  sasl_username?: string
  sasl_password?: string
  // NATS fields
  nats_urls?: string[]
  nats_token?: string
  nats_nkey_seed?: string
  nats_credentials?: string
  nats_jetstream?: boolean
  nats_tls?: boolean
}

export interface KafkaTopic {
  name: string
  partitions: KafkaPartition[]
  configs?: Record<string, string>
}

export interface KafkaPartition {
  partition: number
  leader: number
  replicas: number[]
}

export interface KafkaMessage {
  topic: string
  key: string
  value: string
  partition: number
  offset: number
  headers?: Record<string, string>
}

export interface ProduceRequest {
  key?: string
  value: string
  headers?: Record<string, string>
}

export interface ConsumeRequest {
  max_messages?: number
}

export interface ConsumerGroupInfo {
  group_id: string
  state: string
  members: number
}
