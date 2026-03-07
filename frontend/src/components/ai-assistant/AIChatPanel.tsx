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
import { DOC_CATEGORIES } from "@/lib/docs"
import type { DocSection, DocArticle, DocCategory } from "@/lib/docs"

const MAX_CONTEXT_CHARS = 6000

/** Tokenize a string into lowercase words (min 2 chars). */
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\d]{2,}/gu) ?? []
}

/**
 * Search documentation and return the most relevant sections as context.
 * Scores every section (and subsection) against user query tokens,
 * returns the highest-scoring content up to MAX_CONTEXT_CHARS.
 */
function buildContext(message: string): string {
  const queryTokens = tokenize(message)
  if (queryTokens.length === 0) return ""

  type Scored = { cat: string; article: string; section: string; body: string; score: number }
  const scored: Scored[] = []

  for (const cat of DOC_CATEGORIES) {
    for (const article of cat.articles) {
      // Score at article level (title, description, tags)
      const articleHaystack = [article.title, article.description, ...article.tags].join(" ").toLowerCase()
      const articleBonus = queryTokens.filter((t) => articleHaystack.includes(t)).length

      for (const section of article.content) {
        const sectionText = [section.title, section.body].join(" ").toLowerCase()
        let sectionScore = queryTokens.filter((t) => sectionText.includes(t)).length
        sectionScore += articleBonus * 0.5 // boost sections from relevant articles

        if (sectionScore > 0) {
          scored.push({
            cat: cat.title,
            article: article.title,
            section: section.title,
            body: section.body,
            score: sectionScore,
          })
        }

        // Also score subsections
        for (const sub of section.subsections ?? []) {
          const subText = [sub.title, sub.body].join(" ").toLowerCase()
          let subScore = queryTokens.filter((t) => subText.includes(t)).length
          subScore += articleBonus * 0.3
          if (subScore > 0) {
            scored.push({
              cat: cat.title,
              article: article.title,
              section: `${section.title} > ${sub.title}`,
              body: sub.body,
              score: subScore,
            })
          }
        }
      }
    }
  }

  if (scored.length === 0) return ""

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Build context string up to limit
  const parts: string[] = []
  let totalLen = 0
  for (const item of scored) {
    const entry = `## ${item.cat} > ${item.article} > ${item.section}\n${item.body}`
    if (totalLen + entry.length > MAX_CONTEXT_CHARS) {
      // Try to fit a truncated version
      const remaining = MAX_CONTEXT_CHARS - totalLen
      if (remaining > 200) {
        parts.push(entry.slice(0, remaining) + "\n[...]")
      }
      break
    }
    parts.push(entry)
    totalLen += entry.length
  }

  return parts.join("\n\n")
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
