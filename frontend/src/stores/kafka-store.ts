import { create } from "zustand"
import { api } from "@/lib/api-client"
import type {
  KafkaConnection,
  KafkaTopic,
  KafkaMessage,
  ConsumerGroupInfo,
  ProduceRequest,
  ConsumeRequest,
} from "@/types/kafka"

interface KafkaState {
  connections: KafkaConnection[]
  topics: string[]
  currentTopic: KafkaTopic | null
  messages: KafkaMessage[]
  consumerGroups: ConsumerGroupInfo[]
  loadingConnections: boolean
  loadingTopics: boolean
  loadingTopic: boolean
  loadingMessages: boolean
  loadingConsumerGroups: boolean
  producing: boolean

  fetchConnections: () => Promise<void>
  createConnection: (data: Partial<KafkaConnection>) => Promise<KafkaConnection>
  updateConnection: (id: string, data: Partial<KafkaConnection>) => Promise<KafkaConnection>
  deleteConnection: (id: string) => Promise<void>
  fetchTopics: (connectionId: string) => Promise<void>
  fetchTopic: (connectionId: string, topicName: string) => Promise<void>
  produceMessage: (connectionId: string, topic: string, req: ProduceRequest) => Promise<void>
  consumeMessages: (connectionId: string, topic: string, req: ConsumeRequest) => Promise<void>
  fetchConsumerGroups: (connectionId: string) => Promise<void>
}

export const useKafkaStore = create<KafkaState>((set) => ({
  connections: [],
  topics: [],
  currentTopic: null,
  messages: [],
  consumerGroups: [],
  loadingConnections: false,
  loadingTopics: false,
  loadingTopic: false,
  loadingMessages: false,
  loadingConsumerGroups: false,
  producing: false,

  fetchConnections: async () => {
    set({ loadingConnections: true })
    try {
      const res = await api.listKafkaConnections()
      set({ connections: res.data || [] })
    } finally {
      set({ loadingConnections: false })
    }
  },

  createConnection: async (data) => {
    const res = await api.createKafkaConnection(data)
    const conn = res.data
    set((s) => ({ connections: [...s.connections, conn] }))
    return conn
  },

  updateConnection: async (id, data) => {
    const res = await api.updateKafkaConnection(id, data)
    const updated = res.data
    set((s) => ({
      connections: s.connections.map((c) => (c.id === id ? updated : c)),
    }))
    return updated
  },

  deleteConnection: async (id) => {
    await api.deleteKafkaConnection(id)
    set((s) => ({
      connections: s.connections.filter((c) => c.id !== id),
    }))
  },

  fetchTopics: async (connectionId) => {
    set({ loadingTopics: true })
    try {
      const res = await api.listKafkaTopics(connectionId)
      set({ topics: res.data || [] })
    } finally {
      set({ loadingTopics: false })
    }
  },

  fetchTopic: async (connectionId, topicName) => {
    set({ loadingTopic: true })
    try {
      const res = await api.getKafkaTopic(connectionId, topicName)
      set({ currentTopic: res.data })
    } finally {
      set({ loadingTopic: false })
    }
  },

  produceMessage: async (connectionId, topic, req) => {
    set({ producing: true })
    try {
      await api.produceKafkaMessage(connectionId, topic, req)
    } finally {
      set({ producing: false })
    }
  },

  consumeMessages: async (connectionId, topic, req) => {
    set({ loadingMessages: true })
    try {
      const res = await api.consumeKafkaMessages(connectionId, topic, req)
      set({ messages: res.data || [] })
    } finally {
      set({ loadingMessages: false })
    }
  },

  fetchConsumerGroups: async (connectionId) => {
    set({ loadingConsumerGroups: true })
    try {
      const res = await api.listKafkaConsumerGroups(connectionId)
      set({ consumerGroups: res.data || [] })
    } finally {
      set({ loadingConsumerGroups: false })
    }
  },
}))
