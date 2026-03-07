"use client"

import { useEffect, useRef, useState } from "react"
import { getSingletonHighlighter, type Highlighter } from "shiki"
import { Check, Copy } from "lucide-react"

// Somente IDs de linguagem válidos no Shiki
const LANGS = [
  "bash", "yaml", "json",
  "javascript", "typescript", "jsx", "tsx",
  "lua", "go", "python", "http", "text",
] as const

// Alias para nomes informais usados nas docs
const LANG_ALIASES: Record<string, string> = {
  shell: "bash",
  sh: "bash",
  curl: "bash",
  plaintext: "text",
  ts: "typescript",
  js: "javascript",
}

function resolveLang(lang: string): string {
  const normalized = lang.toLowerCase()
  const aliased = LANG_ALIASES[normalized] ?? normalized
  return LANGS.includes(aliased as typeof LANGS[number]) ? aliased : "text"
}

// Singleton — criado uma vez, reutilizado em todos os blocos
let _highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter() {
  if (!_highlighterPromise) {
    _highlighterPromise = getSingletonHighlighter({
      themes: ["github-dark"],
      langs: [...LANGS],
    }).catch((e) => {
      _highlighterPromise = null
      throw e
    })
  }
  return _highlighterPromise
}

interface Props {
  code: string
  lang: string
}

export function CodeHighlighter({ code, lang }: Props) {
  const [html, setHtml] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const resolvedLang = resolveLang(lang)
    getHighlighter()
      .then((hl) => {
        const result = hl.codeToHtml(code, {
          lang: resolvedLang,
          theme: "github-dark",
        })
        setHtml(result)
      })
      .catch(() => {
        // fallback: mantém texto simples
      })
  }, [code, lang])

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative mb-4 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-700/60 px-4 py-1.5">
        <span className="text-[11px] font-medium text-zinc-400 select-none">
          {lang || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-700/50 hover:text-zinc-200"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copiar
            </>
          )}
        </button>
      </div>

      {/* Highlighted code */}
      {html ? (
        <div
          dangerouslySetInnerHTML={{ __html: html }}
          className="overflow-x-auto [&_pre]:!bg-transparent [&_pre]:p-4 [&_pre]:text-sm [&_pre]:leading-relaxed"
        />
      ) : (
        <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-zinc-300">
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}
