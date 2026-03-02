import { create } from "zustand"

interface DebugFilters {
  statusFilter: string
  methodFilter: string
  searchQuery: string
  clientIpFilter: string
  latencyFilter: string
  consumerFilter: string
  autoRefresh: boolean
  showAdvancedFilters: boolean
}

interface DebugState extends DebugFilters {
  setStatusFilter: (v: string) => void
  setMethodFilter: (v: string) => void
  setSearchQuery: (v: string) => void
  setClientIpFilter: (v: string) => void
  setLatencyFilter: (v: string) => void
  setConsumerFilter: (v: string) => void
  setAutoRefresh: (v: boolean) => void
  setShowAdvancedFilters: (v: boolean) => void
  clearFilters: () => void
}

const defaultFilters: DebugFilters = {
  statusFilter: "all",
  methodFilter: "all",
  searchQuery: "",
  clientIpFilter: "",
  latencyFilter: "all",
  consumerFilter: "",
  autoRefresh: true,
  showAdvancedFilters: false,
}

export const useDebugStore = create<DebugState>((set) => ({
  ...defaultFilters,
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setMethodFilter: (methodFilter) => set({ methodFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setClientIpFilter: (clientIpFilter) => set({ clientIpFilter }),
  setLatencyFilter: (latencyFilter) => set({ latencyFilter }),
  setConsumerFilter: (consumerFilter) => set({ consumerFilter }),
  setAutoRefresh: (autoRefresh) => set({ autoRefresh }),
  setShowAdvancedFilters: (showAdvancedFilters) => set({ showAdvancedFilters }),
  clearFilters: () => set(defaultFilters),
}))
