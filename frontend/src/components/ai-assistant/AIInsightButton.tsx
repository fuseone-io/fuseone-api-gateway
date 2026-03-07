"use client"

import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAIChatStore } from "@/stores/ai-chat-store"

interface AIInsightButtonProps {
  buildPrompt: () => string
  label?: string
  size?: "sm" | "default"
  variant?: "outline" | "ghost"
}

export function AIInsightButton({
  buildPrompt,
  label = "AI Insights",
  size = "sm",
  variant = "outline",
}: AIInsightButtonProps) {
  const { status, openWithPrompt } = useAIChatStore()

  if (!status?.available) return null

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => openWithPrompt(buildPrompt())}
      className="gap-1.5"
      style={{ borderColor: "#950fb8", color: "#950fb8" }}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {label}
    </Button>
  )
}
