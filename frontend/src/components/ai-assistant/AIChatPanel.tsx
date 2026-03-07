"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Bot, Send, Trash2, X, Settings } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useAIChatStore } from "@/stores/ai-chat-store"
import { cn } from "@/lib/utils"

function buildContext(message: string): string {
  // Simple keyword matching against known doc topics — returns up to 2000 chars
  const keywords = message.toLowerCase()
  const contexts: string[] = []

  if (keywords.includes("rate limit") || keywords.includes("throttl")) {
    contexts.push("Rate limiting can be configured via the limit-req, limit-conn, or limit-count plugins. Set limits per route or globally.")
  }
  if (keywords.includes("auth") || keywords.includes("jwt") || keywords.includes("api key")) {
    contexts.push("Authentication plugins available: jwt-auth, key-auth, basic-auth, hmac-auth, openid-connect. Configure per route or globally.")
  }
  if (keywords.includes("upstream") || keywords.includes("load balanc")) {
    contexts.push("Upstreams support roundrobin, chash (consistent hash), ewma, and least_conn load balancing. Health checks can be active or passive.")
  }
  if (keywords.includes("plugin") || keywords.includes("policy")) {
    contexts.push("Plugins are applied to routes or globally. Each plugin has its own schema. Use plugin-configs (templates) to reuse common configurations.")
  }
  if (keywords.includes("ssl") || keywords.includes("tls") || keywords.includes("certificate")) {
    contexts.push("SSL certificates are managed in the SSL section. SNI matching routes HTTPS requests to the correct certificate.")
  }
  if (keywords.includes("monitor") || keywords.includes("metric") || keywords.includes("alert")) {
    contexts.push("Monitoring includes real-time metrics, traces, alerts, and SLA reports. Integrates with Prometheus, ClickHouse, and Elasticsearch.")
  }
  if (keywords.includes("kafka") || keywords.includes("stream")) {
    contexts.push("Kafka Gateway allows producing and consuming messages via API routes. Configure connections and topic-level stream routes.")
  }

  const joined = contexts.join("\n")
  return joined.length > 2000 ? joined.slice(0, 2000) : joined
}

export function AIChatPanel() {
  const t = useTranslations("ai.chat")
  const tc = useTranslations("common")
  const { messages, isOpen, status, isSending, close, clearMessages, sendMessage } = useAIChatStore()
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  const handleSend = async () => {
    const content = input.trim()
    if (!content || isSending) return
    setInput("")
    const context = buildContext(content)
    await sendMessage(content, context || undefined)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent side="right" showCloseButton={false} style={{ width: 640, maxWidth: 640 }} className="flex h-full flex-col p-0 shadow-xl">
        <SheetHeader className="flex shrink-0 flex-row items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4" style={{ color: "#950fb8" }} />
            <SheetTitle className="text-base">{t("title")}</SheetTitle>
            {status?.provider && (
              <span className="text-xs text-muted-foreground">({status.model})</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={clearMessages}
                title={t("clearMessages")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={close}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetHeader>

        {!status?.available ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <Bot className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium">{t("notConfigured")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("notConfiguredDescription")}</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/settings?tab=ai-providers" onClick={close}>
                <Settings className="mr-2 h-3.5 w-3.5" />
                {t("goToSettings")}
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="min-h-0 flex-1 px-4 py-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <Bot className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">{t("startConversation")}</p>
                </div>
              )}
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_pre]:overflow-x-auto [&_code]:text-[11px] [&_p]:leading-relaxed [&_blockquote]:border-l-0 [&_blockquote]:pl-0 [&_blockquote]:not-italic [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:bg-muted/50 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      )}
                      {msg.role === "assistant" && (msg.tokensIn || msg.tokensOut) && (
                        <p className="mt-1 text-xs opacity-50">
                          {msg.tokensIn}↑ {msg.tokensOut}↓ tokens
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                      <span className="animate-pulse">{t("thinking")}</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <div className="shrink-0 border-t p-3">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("inputPlaceholder")}
                  rows={2}
                  className="resize-none text-sm"
                  disabled={isSending}
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim() || isSending}
                  style={{ backgroundColor: input.trim() && !isSending ? "#950fb8" : undefined }}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{t("enterToSend")}</p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
