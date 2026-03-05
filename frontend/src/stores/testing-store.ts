import { create } from "zustand"
import { api } from "@/lib/api-client"
import type {
  TestSuite,
  TestRun,
  TestStep,
  SyntheticMonitor,
  SLADefinition,
} from "@/types/testing"

interface TestingState {
  // Suites
  suites: TestSuite[]
  suitesLoading: boolean
  suitesError: string | null

  // Runs (for current suite)
  runs: TestRun[]
  runsLoading: boolean

  // Monitors
  monitors: SyntheticMonitor[]
  monitorsLoading: boolean

  // SLA
  slaDefinitions: SLADefinition[]
  slaLoading: boolean

  // Suite actions
  fetchSuites: () => Promise<void>
  createSuite: (data: {
    name: string
    description: string
    api_id?: string
    steps: TestStep[]
    tags: string[]
  }) => Promise<TestSuite>
  updateSuite: (
    id: string,
    data: {
      name: string
      description: string
      api_id?: string
      steps: TestStep[]
      tags: string[]
    }
  ) => Promise<TestSuite>
  deleteSuite: (id: string) => Promise<void>

  // Run actions
  fetchRuns: (suiteId: string) => Promise<void>
  runSuite: (suiteId: string) => Promise<TestRun>

  // Monitor actions
  fetchMonitors: () => Promise<void>
  createMonitor: (data: {
    name: string
    description: string
    suite_id: string
    interval_sec: number
    locations: string[]
    notify_contact_ids?: string[]
  }) => Promise<SyntheticMonitor>
  updateMonitor: (id: string, data: {
    name?: string
    description?: string
    suite_id?: string
    interval_sec?: number
    locations?: string[]
    notify_contact_ids?: string[]
    enabled?: boolean
  }) => Promise<SyntheticMonitor>
  toggleMonitor: (id: string, enabled: boolean) => Promise<void>
  deleteMonitor: (id: string) => Promise<void>

  // SLA actions
  fetchSLAs: () => Promise<void>
  createSLA: (data: {
    name: string
    description: string
    api_id?: string
    availability_pct: number
    latency_p99_ms: number
    error_rate_pct: number
    eval_window: "7d" | "30d" | "90d"
  }) => Promise<SLADefinition>
  deleteSLA: (id: string) => Promise<void>
}

export const useTestingStore = create<TestingState>((set, get) => ({
  suites: [],
  suitesLoading: false,
  suitesError: null,
  runs: [],
  runsLoading: false,
  monitors: [],
  monitorsLoading: false,
  slaDefinitions: [],
  slaLoading: false,

  // ---------- Suites ----------
  fetchSuites: async () => {
    set({ suitesLoading: true, suitesError: null })
    try {
      const suites = await api.listTestSuites()
      set({ suites: suites || [], suitesLoading: false })
    } catch (err) {
      set({
        suitesError: err instanceof Error ? err.message : "Erro ao carregar suites",
        suitesLoading: false,
      })
    }
  },

  createSuite: async (data) => {
    const suite = await api.createTestSuite(data)
    set({ suites: [...get().suites, suite] })
    return suite
  },

  updateSuite: async (id, data) => {
    const suite = await api.updateTestSuite(id, data)
    set({ suites: get().suites.map((s) => (s.id === id ? suite : s)) })
    return suite
  },

  deleteSuite: async (id) => {
    await api.deleteTestSuite(id)
    set({ suites: get().suites.filter((s) => s.id !== id) })
  },

  // ---------- Runs ----------
  fetchRuns: async (suiteId) => {
    set({ runsLoading: true })
    try {
      const runs = await api.listTestRuns(suiteId)
      set({ runs: runs || [], runsLoading: false })
    } catch {
      set({ runsLoading: false })
    }
  },

  runSuite: async (suiteId) => {
    const run = await api.runTestSuite(suiteId)
    set({ runs: [run, ...get().runs] })
    return run
  },

  // ---------- Monitors ----------
  fetchMonitors: async () => {
    set({ monitorsLoading: true })
    try {
      const monitors = await api.listSyntheticMonitors()
      set({ monitors: monitors || [], monitorsLoading: false })
    } catch {
      set({ monitorsLoading: false })
    }
  },

  createMonitor: async (data) => {
    const monitor = await api.createSyntheticMonitor(data)
    set({ monitors: [...get().monitors, monitor] })
    return monitor
  },

  updateMonitor: async (id, data) => {
    const monitor = await api.updateSyntheticMonitor(id, data)
    set({ monitors: get().monitors.map((m) => (m.id === id ? monitor : m)) })
    return monitor
  },

  toggleMonitor: async (id, enabled) => {
    await api.toggleSyntheticMonitor(id, enabled)
    set({
      monitors: get().monitors.map((m) => (m.id === id ? { ...m, enabled } : m)),
    })
  },

  deleteMonitor: async (id) => {
    await api.deleteSyntheticMonitor(id)
    set({ monitors: get().monitors.filter((m) => m.id !== id) })
  },

  // ---------- SLA ----------
  fetchSLAs: async () => {
    set({ slaLoading: true })
    try {
      const defs = await api.listSLADefinitions()
      set({ slaDefinitions: defs || [], slaLoading: false })
    } catch {
      set({ slaLoading: false })
    }
  },

  createSLA: async (data) => {
    const sla = await api.createSLADefinition(data)
    set({ slaDefinitions: [...get().slaDefinitions, sla] })
    return sla
  },

  deleteSLA: async (id) => {
    await api.deleteSLADefinition(id)
    set({ slaDefinitions: get().slaDefinitions.filter((s) => s.id !== id) })
  },
}))
