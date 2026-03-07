import { create } from "zustand"
import { api } from "@/lib/api-client"
import type {
  EventApi,
  CreateEventApiRequest,
  UpdateEventApiRequest,
} from "@/types/event-api"

interface EventApiState {
  eventApis: EventApi[]
  currentEventApi: EventApi | null
  loading: boolean
  deploying: boolean

  fetchEventApis: () => Promise<void>
  fetchEventApi: (id: string) => Promise<void>
  createEventApi: (data: CreateEventApiRequest) => Promise<EventApi>
  updateEventApi: (id: string, data: UpdateEventApiRequest) => Promise<EventApi>
  deleteEventApi: (id: string) => Promise<void>
  deployEventApi: (id: string) => Promise<EventApi>
  undeployEventApi: (id: string) => Promise<EventApi>
}

export const useEventApiStore = create<EventApiState>((set) => ({
  eventApis: [],
  currentEventApi: null,
  loading: false,
  deploying: false,

  fetchEventApis: async () => {
    set({ loading: true })
    try {
      const res = await api.listEventApis()
      set({ eventApis: res.data || [] })
    } finally {
      set({ loading: false })
    }
  },

  fetchEventApi: async (id) => {
    set({ loading: true })
    try {
      const res = await api.getEventApi(id)
      set({ currentEventApi: res.data })
    } finally {
      set({ loading: false })
    }
  },

  createEventApi: async (data) => {
    const res = await api.createEventApi(data)
    const ea = res.data
    set((s) => ({ eventApis: [...s.eventApis, ea] }))
    return ea
  },

  updateEventApi: async (id, data) => {
    const res = await api.updateEventApi(id, data)
    const updated = res.data
    set((s) => ({
      eventApis: s.eventApis.map((e) => (e.id === id ? updated : e)),
      currentEventApi: s.currentEventApi?.id === id ? updated : s.currentEventApi,
    }))
    return updated
  },

  deleteEventApi: async (id) => {
    await api.deleteEventApi(id)
    set((s) => ({
      eventApis: s.eventApis.filter((e) => e.id !== id),
      currentEventApi: s.currentEventApi?.id === id ? null : s.currentEventApi,
    }))
  },

  deployEventApi: async (id) => {
    set({ deploying: true })
    try {
      const res = await api.deployEventApi(id)
      const deployed = res.data
      set((s) => ({
        eventApis: s.eventApis.map((e) => (e.id === id ? deployed : e)),
        currentEventApi: s.currentEventApi?.id === id ? deployed : s.currentEventApi,
      }))
      return deployed
    } finally {
      set({ deploying: false })
    }
  },

  undeployEventApi: async (id) => {
    set({ deploying: true })
    try {
      const res = await api.undeployEventApi(id)
      const undeployed = res.data
      set((s) => ({
        eventApis: s.eventApis.map((e) => (e.id === id ? undeployed : e)),
        currentEventApi: s.currentEventApi?.id === id ? undeployed : s.currentEventApi,
      }))
      return undeployed
    } finally {
      set({ deploying: false })
    }
  },
}))
