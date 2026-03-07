"use client"

import React from "react"
import { Info, Lightbulb, AlertTriangle, Hash } from "lucide-react"
import { CodeHighlighter } from "@/components/docs/code-highlighter"

interface DocRendererProps {
  content: string
  className?: string
}

/** Lightweight markdown-subset renderer — no external deps */
export function DocRenderer({ content, className }: DocRendererProps) {
  const blocks = parseBlocks(content)
  return (
    <div className={className}>
      {blocks.map((block, i) => (
        <RenderBlock key={i} block={block} />
      ))}
    </div>
  )
}

// ─── Types ──────────────────────────────────────────────────────

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] }
  | { type: "code"; lang: string; code: string }
  | { type: "table"; headers: string[]; alignments: ("left" | "center" | "right")[]; rows: string[][] }
  | { type: "callout"; variant: "note" | "tip" | "warning"; children: InlineNode[] }

type InlineNode =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string }

// ─── Block Parser ───────────────────────────────────────────────

function parseBlocks(md: string): Block[] {
  const lines = md.split("\n")
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Empty line — skip
    if (!line.trim()) { i++; continue }

    // Code block
    if (line.trimStart().startsWith("```")) {
      const lang = line.trimStart().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push({ type: "code", lang, code: codeLines.join("\n") })
      i++ // skip closing ```
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1].length, text: headingMatch[2] })
      i++
      continue
    }

    // Callout (> **Nota:** ... or > **Dica:** ... or > **Atencao:** ...)
    if (line.startsWith("> ")) {
      const calloutLines: string[] = []
      while (i < lines.length && lines[i].startsWith("> ")) {
        calloutLines.push(lines[i].slice(2))
        i++
      }
      const joined = calloutLines.join(" ")
      let variant: "note" | "tip" | "warning" = "note"
      let text = joined
      if (joined.startsWith("**Nota:**") || joined.startsWith("**Note:**")) {
        variant = "note"
        text = joined.replace(/^\*\*(Nota|Note):\*\*\s*/, "")
      } else if (joined.startsWith("**Dica:**") || joined.startsWith("**Tip:**")) {
        variant = "tip"
        text = joined.replace(/^\*\*(Dica|Tip):\*\*\s*/, "")
      } else if (joined.startsWith("**Atenção:**") || joined.startsWith("**Atencao:**") || joined.startsWith("**Warning:**") || joined.startsWith("**Cuidado:**")) {
        variant = "warning"
        text = joined.replace(/^\*\*(Atenção|Atencao|Warning|Cuidado):\*\*\s*/, "")
      }
      blocks.push({ type: "callout", variant, children: parseInline(text) })
      continue
    }

    // Table (| col | col |)
    if (line.trimStart().startsWith("|") && line.trimEnd().endsWith("|")) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trimStart().startsWith("|") && lines[i].trimEnd().endsWith("|")) {
        tableLines.push(lines[i])
        i++
      }
      if (tableLines.length >= 2) {
        const parseCells = (row: string) =>
          row.split("|").slice(1, -1).map((c) => c.trim())
        const headers = parseCells(tableLines[0])
        // Parse alignment row (|---|:---:|---:|)
        const alignRow = parseCells(tableLines[1])
        const alignments = alignRow.map((cell): "left" | "center" | "right" => {
          const trimmed = cell.replace(/\s/g, "")
          if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center"
          if (trimmed.endsWith(":")) return "right"
          return "left"
        })
        const rows = tableLines.slice(2).map(parseCells)
        blocks.push({ type: "table", headers, alignments, rows })
      }
      continue
    }

    // List (unordered or ordered)
    if (line.match(/^[\s]*[-*]\s/) || line.match(/^[\s]*\d+\.\s/)) {
      const ordered = !!line.match(/^[\s]*\d+\.\s/)
      const items: InlineNode[][] = []
      while (i < lines.length && (lines[i].match(/^[\s]*[-*]\s/) || lines[i].match(/^[\s]*\d+\.\s/))) {
        const itemText = lines[i].replace(/^[\s]*[-*]\s/, "").replace(/^[\s]*\d+\.\s/, "")
        items.push(parseInline(itemText))
        i++
      }
      blocks.push({ type: "list", ordered, items })
      continue
    }

    // Paragraph — collect consecutive non-special lines
    const paraLines: string[] = []
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith("#") && !lines[i].startsWith("```") && !lines[i].startsWith("> ") && !(lines[i].trimStart().startsWith("|") && lines[i].trimEnd().endsWith("|")) && !lines[i].match(/^[\s]*[-*]\s/) && !lines[i].match(/^[\s]*\d+\.\s/)) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", children: parseInline(paraLines.join(" ")) })
    }
  }

  return blocks
}

// ─── Inline Parser ──────────────────────────────────────────────

function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = []
  // Pattern: **bold**, *italic*, `code`, [text](url)
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: text.slice(lastIndex, match.index) })
    }
    if (match[1]) {
      nodes.push({ type: "bold", text: match[2] })
    } else if (match[3]) {
      nodes.push({ type: "italic", text: match[4] })
    } else if (match[5]) {
      nodes.push({ type: "code", text: match[6] })
    } else if (match[7]) {
      nodes.push({ type: "link", text: match[8], href: match[9] })
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIndex) })
  }

  return nodes
}

// ─── Render Helpers ─────────────────────────────────────────────

function RenderBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "heading": {
      const slug = slugify(block.text)
      const Tag = `h${block.level}` as keyof React.JSX.IntrinsicElements
      const baseClass = block.level === 1
        ? "text-2xl font-bold mt-8 mb-4 first:mt-0"
        : block.level === 2
        ? "text-xl font-semibold mt-6 mb-3"
        : block.level === 3
        ? "text-lg font-medium mt-4 mb-2"
        : "text-base font-medium mt-3 mb-1"

      return (
        <div className="group flex items-center gap-2">
          {React.createElement(
            Tag,
            { id: slug, className: `${baseClass} scroll-mt-20` },
            block.text,
          )}
          <a
            href={`#${slug}`}
            className="opacity-0 transition-opacity group-hover:opacity-100"
            aria-label={`Link para ${block.text}`}
          >
            <Hash className="h-4 w-4 text-muted-foreground" />
          </a>
        </div>
      )
    }

    case "paragraph":
      return (
        <p className="mb-4 leading-relaxed text-muted-foreground">
          <RenderInline nodes={block.children} />
        </p>
      )

    case "list": {
      const Tag = block.ordered ? "ol" : "ul"
      return (
        <Tag className={`mb-4 space-y-1 pl-6 ${block.ordered ? "list-decimal" : "list-disc"} text-muted-foreground marker:text-primary`}>
          {block.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              <RenderInline nodes={item} />
            </li>
          ))}
        </Tag>
      )
    }

    case "code":
      return <CodeHighlighter code={block.code} lang={block.lang || "text"} />

    case "table":
      return (
        <div className="mb-4 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {block.headers.map((h, j) => (
                  <th
                    key={j}
                    className="px-4 py-2.5 text-left font-semibold text-foreground"
                    style={{ textAlign: block.alignments[j] || "left" }}
                  >
                    <RenderInline nodes={parseInline(h)} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-b last:border-0 hover:bg-muted/30">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="px-4 py-2 text-muted-foreground"
                      style={{ textAlign: block.alignments[ci] || "left" }}
                    >
                      <RenderInline nodes={parseInline(cell)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    case "callout": {
      const config = {
        note: {
          icon: Info,
          border: "border-blue-500",
          bg: "bg-blue-500/5",
          iconColor: "text-blue-500",
          label: "Nota",
        },
        tip: {
          icon: Lightbulb,
          border: "border-emerald-500",
          bg: "bg-emerald-500/5",
          iconColor: "text-emerald-500",
          label: "Dica",
        },
        warning: {
          icon: AlertTriangle,
          border: "border-amber-500",
          bg: "bg-amber-500/5",
          iconColor: "text-amber-500",
          label: "Atenção",
        },
      }
      const c = config[block.variant]
      const Icon = c.icon
      return (
        <div className={`mb-4 flex gap-3 rounded-lg border-l-4 ${c.border} ${c.bg} p-4`}>
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${c.iconColor}`} />
          <div className="text-sm leading-relaxed">
            <span className={`font-semibold ${c.iconColor}`}>{c.label}: </span>
            <RenderInline nodes={block.children} />
          </div>
        </div>
      )
    }
  }
}

function RenderInline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.type) {
          case "text":
            return <React.Fragment key={i}>{node.text}</React.Fragment>
          case "bold":
            return <strong key={i} className="font-semibold text-foreground">{node.text}</strong>
          case "italic":
            return <em key={i}>{node.text}</em>
          case "code":
            return (
              <code key={i} className="rounded border border-border/50 bg-muted px-1.5 py-0.5 text-sm font-mono">
                {node.text}
              </code>
            )
          case "link":
            return (
              <a key={i} href={node.href} className="text-primary underline hover:no-underline" target={node.href.startsWith("http") ? "_blank" : undefined} rel={node.href.startsWith("http") ? "noopener noreferrer" : undefined}>
                {node.text}
              </a>
            )
        }
      })}
    </>
  )
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}
