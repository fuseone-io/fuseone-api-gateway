import { create } from "zustand"
import { api } from "@/lib/api-client"
import type {
  MeshOverview,
  MeshService,
  MeshTopology,
  DiscoveryStatus,
} from "@/types/mesh"

interface MeshState {
  // Overview
  overview: MeshOverview | null
  overviewLoading: boolean

  // Services
  services: MeshService[]
  servicesLoading: boolean

  // Topology
  topology: MeshTopology | null
  topologyLoading: boolean

  // Discovery status
  discoveryStatus: DiscoveryStatus[]
  discoveryLoading: boolean

  // Actions
  fetchOverview: () => Promise<void>
  fetchServices: () => Promise<void>
  fetchService: (id: string) => Promise<MeshService | null>
  fetchTopology: () => Promise<void>
  fetchDiscoveryStatus: () => Promise<void>
}

export const useMeshStore = create<MeshState>((set) => ({
  overview: null,
  overviewLoading: false,

  services: [],
  servicesLoading: false,

  topology: null,
  topologyLoading: false,

  discoveryStatus: [],
  discoveryLoading: false,

  fetchOverview: async () => {
    set({ overviewLoading: true })
    try {
      const data = await api.getMeshOverview()
      set({ overview: data })
    } catch {
      // Silently ignore — UI will show empty state
    } finally {
      set({ overviewLoading: false })
    }
  },

  fetchServices: async () => {
    set({ servicesLoading: true })
    try {
      const data = await api.listMeshServices()
      set({ services: Array.isArray(data) ? data : [] })
    } catch {
      set({ services: [] })
    } finally {
      set({ servicesLoading: false })
    }
  },

  fetchService: async (id: string) => {
    try {
      const data = await api.getMeshService(id)
      return data
    } catch {
      return null
    }
  },

  fetchTopology: async () => {
    set({ topologyLoading: true })
    try {
      const data = await api.getMeshTopology()
      set({ topology: data })
    } catch {
      set({ topology: null })
    } finally {
      set({ topologyLoading: false })
    }
  },

  fetchDiscoveryStatus: async () => {
    set({ discoveryLoading: true })
    try {
      const data = await api.getMeshDiscoveryStatus()
      set({ discoveryStatus: Array.isArray(data) ? data : [] })
    } catch {
      set({ discoveryStatus: [] })
    } finally {
      set({ discoveryLoading: false })
    }
  },
}))
