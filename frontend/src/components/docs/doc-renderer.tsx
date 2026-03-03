"use client"

import React from "react"

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
      } else if (joined.startsWith("**Atencao:**") || joined.startsWith("**Warning:**") || joined.startsWith("**Cuidado:**")) {
        variant = "warning"
        text = joined.replace(/^\*\*(Atencao|Warning|Cuidado):\*\*\s*/, "")
      }
      blocks.push({ type: "callout", variant, children: parseInline(text) })
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
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith("#") && !lines[i].startsWith("```") && !lines[i].startsWith("> ") && !lines[i].match(/^[\s]*[-*]\s/) && !lines[i].match(/^[\s]*\d+\.\s/)) {
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
    case "heading":
      return React.createElement(
        `h${block.level}` as keyof React.JSX.IntrinsicElements,
        {
          id: slugify(block.text),
          className: block.level === 1
            ? "text-2xl font-bold mt-8 mb-4 first:mt-0"
            : block.level === 2
            ? "text-xl font-semibold mt-6 mb-3"
            : block.level === 3
            ? "text-lg font-medium mt-4 mb-2"
            : "text-base font-medium mt-3 mb-1",
        },
        block.text,
      )

    case "paragraph":
      return (
        <p className="mb-4 leading-relaxed text-muted-foreground">
          <RenderInline nodes={block.children} />
        </p>
      )

    case "list":
      const Tag = block.ordered ? "ol" : "ul"
      return (
        <Tag className={`mb-4 space-y-1 pl-6 ${block.ordered ? "list-decimal" : "list-disc"} text-muted-foreground`}>
          {block.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              <RenderInline nodes={item} />
            </li>
          ))}
        </Tag>
      )

    case "code":
      return (
        <pre className="mb-4 overflow-x-auto rounded-lg border bg-muted/50 p-4">
          <code className="text-sm">{block.code}</code>
        </pre>
      )

    case "callout": {
      const styles = {
        note: "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300",
        tip: "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-300",
        warning: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
      }
      const labels = { note: "Nota", tip: "Dica", warning: "Atencao" }
      return (
        <div className={`mb-4 rounded-lg border-l-4 p-4 ${styles[block.variant]}`}>
          <span className="font-semibold">{labels[block.variant]}: </span>
          <RenderInline nodes={block.children} />
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
              <code key={i} className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">
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
