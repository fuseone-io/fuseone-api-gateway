import { create } from "zustand"
import { api } from "@/lib/api-client"
import type { ChatMessage, AIStatus } from "@/types/llm"

interface DisplayMessage {
  id: string
  role: "user" | "assistant"
  content: string
  tokensIn?: number
  tokensOut?: number
}

interface AIChatState {
  messages: DisplayMessage[]
  isOpen: boolean
  status: AIStatus | null
  isLoading: boolean
  isSending: boolean

  open: () => void
  close: () => void
  toggle: () => void
  clearMessages: () => void
  checkAvailability: () => Promise<void>
  sendMessage: (content: string, context?: string) => Promise<void>
  openWithPrompt: (prompt: string) => void
}

export const useAIChatStore = create<AIChatState>((set, get) => ({
  messages: [],
  isOpen: false,
  status: null,
  isLoading: false,
  isSending: false,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  clearMessages: () => set({ messages: [] }),

  openWithPrompt: (prompt: string) => {
    set({ isOpen: true })
    // Defer sendMessage so panel renders first
    setTimeout(() => {
      get().sendMessage(prompt)
    }, 100)
  },

  checkAvailability: async () => {
    set({ isLoading: true })
    try {
      const status = await api.checkAIStatus()
      set({ status })
    } catch {
      set({ status: { available: false } })
    } finally {
      set({ isLoading: false })
    }
  },

  sendMessage: async (content: string, context?: string) => {
    const { messages } = get()

    const userMsg: DisplayMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    }

    // Create empty assistant message immediately — tokens stream into it
    const assistantId = crypto.randomUUID()
    set({ messages: [...messages, userMsg, { id: assistantId, role: "assistant", content: "" }], isSending: true })

    const apiMessages: ChatMessage[] = messages
      .map((m) => ({ role: m.role, content: m.content }))
      .concat({ role: "user", content })

    try {
      const tokenData = await api.sendChatStream(
        { messages: apiMessages, context },
        (chunk: string) => {
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m
            ),
          }))
        },
      )
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantId
            ? { ...m, tokensIn: tokenData.tokens_in, tokensOut: tokenData.tokens_out }
            : m
        ),
      }))
    } catch (err) {
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantId
            ? { ...m, content: err instanceof Error ? err.message : "An error occurred." }
            : m
        ),
      }))
    } finally {
      set({ isSending: false })
    }
  },
}))
