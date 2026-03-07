import { create } from "zustand"
import { api } from "@/lib/api-client"
import type {
  WebhookSubscription,
  WebhookDelivery,
  CreateWebhookRequest,
  UpdateWebhookRequest,
} from "@/types/webhook"

interface WebhookState {
  webhooks: WebhookSubscription[]
  deliveries: WebhookDelivery[]
  loading: boolean

  fetchWebhooks: (eventApiId: string) => Promise<void>
  createWebhook: (eventApiId: string, data: CreateWebhookRequest) => Promise<WebhookSubscription>
  updateWebhook: (eventApiId: string, whId: string, data: UpdateWebhookRequest) => Promise<WebhookSubscription>
  deleteWebhook: (eventApiId: string, whId: string) => Promise<void>
  fetchDeliveries: (eventApiId: string, whId: string) => Promise<void>
}

export const useWebhookStore = create<WebhookState>((set) => ({
  webhooks: [],
  deliveries: [],
  loading: false,

  fetchWebhooks: async (eventApiId) => {
    set({ loading: true })
    try {
      const res = await api.listWebhooks(eventApiId)
      set({ webhooks: res.data || [] })
    } finally {
      set({ loading: false })
    }
  },

  createWebhook: async (eventApiId, data) => {
    const res = await api.createWebhook(eventApiId, data)
    const wh = res.data
    set((s) => ({ webhooks: [...s.webhooks, wh] }))
    return wh
  },

  updateWebhook: async (eventApiId, whId, data) => {
    const res = await api.updateWebhook(eventApiId, whId, data)
    const updated = res.data
    set((s) => ({
      webhooks: s.webhooks.map((w) => (w.id === whId ? updated : w)),
    }))
    return updated
  },

  deleteWebhook: async (eventApiId, whId) => {
    await api.deleteWebhook(eventApiId, whId)
    set((s) => ({
      webhooks: s.webhooks.filter((w) => w.id !== whId),
    }))
  },

  fetchDeliveries: async (eventApiId, whId) => {
    set({ loading: true })
    try {
      const res = await api.listWebhookDeliveries(eventApiId, whId)
      set({ deliveries: res.data || [] })
    } finally {
      set({ loading: false })
    }
  },
}))
