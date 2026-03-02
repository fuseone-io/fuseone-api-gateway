import { describe, it, expect } from "vitest"
import {
  PLUGINS,
  PLUGIN_CATEGORIES,
  getPluginsByPhase,
  getPluginsByCategory,
  getPluginDef,
  getCategoryMeta,
  GLOBAL_POLICY_EXCLUDED_PLUGINS,
  AUTH_PLUGINS,
} from "@/lib/constants"

describe("PLUGINS registry", () => {
  it("has plugins defined", () => {
    expect(PLUGINS.length).toBeGreaterThan(0)
  })

  it("every plugin has required fields", () => {
    for (const p of PLUGINS) {
      expect(p.name).toBeTruthy()
      expect(p.label).toBeTruthy()
      expect(p.description).toBeTruthy()
      expect(p.category).toBeTruthy()
      expect(p.phase).toBeTruthy()
      expect(p.icon).toBeTruthy()
    }
  })

  it("has no duplicate plugin names", () => {
    const names = PLUGINS.map((p) => p.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it("every plugin category is valid", () => {
    const validCategories = PLUGIN_CATEGORIES.map((c) => c.value)
    for (const p of PLUGINS) {
      expect(validCategories).toContain(p.category)
    }
  })

  it("every plugin phase is valid", () => {
    const validPhases = ["request", "response", "observability"]
    for (const p of PLUGINS) {
      expect(validPhases).toContain(p.phase)
    }
  })
})

describe("getPluginsByPhase", () => {
  it("returns only request-phase plugins", () => {
    const plugins = getPluginsByPhase("request")
    expect(plugins.length).toBeGreaterThan(0)
    for (const p of plugins) {
      expect(p.phase).toBe("request")
    }
  })

  it("returns only response-phase plugins", () => {
    const plugins = getPluginsByPhase("response")
    expect(plugins.length).toBeGreaterThan(0)
    for (const p of plugins) {
      expect(p.phase).toBe("response")
    }
  })

  it("returns only observability-phase plugins", () => {
    const plugins = getPluginsByPhase("observability")
    expect(plugins.length).toBeGreaterThan(0)
    for (const p of plugins) {
      expect(p.phase).toBe("observability")
    }
  })
})

describe("getPluginsByCategory", () => {
  it("returns only authentication plugins", () => {
    const plugins = getPluginsByCategory("authentication")
    expect(plugins.length).toBeGreaterThan(0)
    for (const p of plugins) {
      expect(p.category).toBe("authentication")
    }
  })

  it("returns only AI plugins", () => {
    const plugins = getPluginsByCategory("ai")
    expect(plugins.length).toBeGreaterThan(0)
    for (const p of plugins) {
      expect(p.category).toBe("ai")
    }
  })
})

describe("getPluginDef", () => {
  it("finds key-auth plugin", () => {
    const def = getPluginDef("key-auth")
    expect(def).toBeDefined()
    expect(def!.name).toBe("key-auth")
    expect(def!.category).toBe("authentication")
  })

  it("finds prometheus plugin", () => {
    const def = getPluginDef("prometheus")
    expect(def).toBeDefined()
    expect(def!.category).toBe("observability")
  })

  it("returns undefined for unknown plugin", () => {
    const def = getPluginDef("nonexistent-plugin")
    expect(def).toBeUndefined()
  })
})

describe("getCategoryMeta", () => {
  it("finds authentication category", () => {
    const meta = getCategoryMeta("authentication")
    expect(meta).toBeDefined()
    expect(meta!.label).toBe("Authentication")
  })

  it("returns undefined for unknown category", () => {
    const meta = getCategoryMeta("nonexistent" as never)
    expect(meta).toBeUndefined()
  })
})

describe("GLOBAL_POLICY_EXCLUDED_PLUGINS", () => {
  it("excludes all auth plugins", () => {
    for (const auth of AUTH_PLUGINS) {
      expect(GLOBAL_POLICY_EXCLUDED_PLUGINS).toContain(auth)
    }
  })

  it("all excluded plugins exist in registry", () => {
    for (const name of GLOBAL_POLICY_EXCLUDED_PLUGINS) {
      const def = getPluginDef(name)
      expect(def).toBeDefined()
    }
  })
})

describe("AUTH_PLUGINS", () => {
  it("all auth plugins exist in registry", () => {
    for (const name of AUTH_PLUGINS) {
      const def = getPluginDef(name)
      expect(def).toBeDefined()
      expect(def!.category).toBe("authentication")
    }
  })
})
