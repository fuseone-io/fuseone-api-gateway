import { create } from "zustand"
import { api } from "@/lib/api-client"

const POLL_INTERVAL = 30_000

interface AlertState {
  firingCount: number
  polling: boolean
  startPolling: () => void
  stopPolling: () => void
  refresh: () => Promise<void>
}

let intervalId: ReturnType<typeof setInterval> | null = null

export const useAlertStore = create<AlertState>((set, get) => ({
  firingCount: 0,
  polling: false,

  refresh: async () => {
    try {
      const count = await api.alertFiringCount()
      set({ firingCount: count })
    } catch {
      // Silently ignore — polling will retry
    }
  },

  startPolling: () => {
    if (get().polling) return
    set({ polling: true })
    get().refresh()
    intervalId = setInterval(() => get().refresh(), POLL_INTERVAL)
  },

  stopPolling: () => {
    set({ polling: false })
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  },
}))
