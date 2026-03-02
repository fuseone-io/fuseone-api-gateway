import { create } from "zustand"

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const MONITORING_TAB_COOKIE_NAME = "monitoring_tab"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function readSidebarCookie(): boolean {
  if (typeof document === "undefined") return true
  const match = document.cookie.match(/(?:^|;\s*)sidebar_state=([^;]*)/)
  return match ? match[1] !== "false" : true
}

function writeSidebarCookie(open: boolean) {
  document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
}

function readMonitoringTabCookie(): string {
  if (typeof document === "undefined") return "upstream-health"
  const match = document.cookie.match(/(?:^|;\s*)monitoring_tab=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : "upstream-health"
}

function writeMonitoringTabCookie(tab: string) {
  document.cookie = `${MONITORING_TAB_COOKIE_NAME}=${encodeURIComponent(tab)}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
}

interface UIState {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  monitoringTab: string
  setMonitoringTab: (tab: string) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: readSidebarCookie(),
  setSidebarOpen: (open) => {
    writeSidebarCookie(open)
    set({ sidebarOpen: open })
  },
  toggleSidebar: () => {
    const next = !get().sidebarOpen
    writeSidebarCookie(next)
    set({ sidebarOpen: next })
  },
  monitoringTab: readMonitoringTabCookie(),
  setMonitoringTab: (tab) => {
    writeMonitoringTabCookie(tab)
    set({ monitoringTab: tab })
  },
}))
