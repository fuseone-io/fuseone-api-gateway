import { create } from "zustand"
import type { Environment } from "@/types/environment"
import { api } from "@/lib/api-client"

const ENV_COOKIE_NAME = "active_environment_id"
const ENV_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function readEnvCookie(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|;\s*)active_environment_id=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

function writeEnvCookie(id: string | null) {
  if (id) {
    document.cookie = `${ENV_COOKIE_NAME}=${encodeURIComponent(id)}; path=/; max-age=${ENV_COOKIE_MAX_AGE}`
  } else {
    document.cookie = `${ENV_COOKIE_NAME}=; path=/; max-age=0`
  }
}

interface EnvironmentState {
  environments: Environment[]
  activeEnvironmentId: string | null
  loading: boolean
  fetchEnvironments: () => Promise<void>
  setActiveEnvironment: (id: string) => void
  activeEnvironment: () => Environment | undefined
}

export const useEnvironmentStore = create<EnvironmentState>((set, get) => ({
  environments: [],
  activeEnvironmentId: readEnvCookie(),
  loading: false,

  fetchEnvironments: async () => {
    set({ loading: true })
    try {
      const envs = await api.listEnvironments()
      set({ environments: envs })

      // If no active env selected or the selected one no longer exists, use default
      const current = get().activeEnvironmentId
      const exists = envs.some((e) => e.id === current)
      if (!exists) {
        const defaultEnv = envs.find((e) => e.is_default)
        const newId = defaultEnv?.id ?? envs[0]?.id ?? null
        writeEnvCookie(newId)
        set({ activeEnvironmentId: newId })
      }
    } finally {
      set({ loading: false })
    }
  },

  setActiveEnvironment: (id: string) => {
    writeEnvCookie(id)
    set({ activeEnvironmentId: id })
  },

  activeEnvironment: () => {
    const { environments, activeEnvironmentId } = get()
    return environments.find((e) => e.id === activeEnvironmentId)
  },
}))
