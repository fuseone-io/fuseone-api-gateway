"use client"

import { useEffect } from "react"
import { Bot } from "lucide-react"
import { useAIChatStore } from "@/stores/ai-chat-store"

export function AIChatButton() {
  const { status, isLoading, checkAvailability, toggle } = useAIChatStore()

  useEffect(() => {
    checkAvailability()
  }, [checkAvailability])

  if (isLoading || !status?.available) return null

  return (
    <button
      onClick={toggle}
      className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ backgroundColor: "#950fb8" }}
      aria-label="Open AI Assistant"
    >
      <Bot className="h-5 w-5 text-white" />
    </button>
  )
}
