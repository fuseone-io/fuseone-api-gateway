import { describe, it, expect, beforeEach } from "vitest"
import { useUIStore } from "@/stores/ui-store"

describe("useUIStore", () => {
  beforeEach(() => {
    // Reset store state between tests
    useUIStore.setState({ sidebarOpen: true })
    // Clear cookies
    document.cookie = "sidebar_state=; max-age=0"
  })

  it("defaults to sidebar open", () => {
    const state = useUIStore.getState()
    expect(state.sidebarOpen).toBe(true)
  })

  it("setSidebarOpen(false) closes the sidebar", () => {
    useUIStore.getState().setSidebarOpen(false)
    expect(useUIStore.getState().sidebarOpen).toBe(false)
  })

  it("setSidebarOpen(true) opens the sidebar", () => {
    useUIStore.getState().setSidebarOpen(false)
    useUIStore.getState().setSidebarOpen(true)
    expect(useUIStore.getState().sidebarOpen).toBe(true)
  })

  it("toggleSidebar flips the state", () => {
    expect(useUIStore.getState().sidebarOpen).toBe(true)
    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarOpen).toBe(false)
    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarOpen).toBe(true)
  })

  it("persists state to cookie", () => {
    useUIStore.getState().setSidebarOpen(false)
    expect(document.cookie).toContain("sidebar_state=false")
  })

  it("persists toggle to cookie", () => {
    useUIStore.getState().toggleSidebar()
    expect(document.cookie).toContain("sidebar_state=false")
  })
})
