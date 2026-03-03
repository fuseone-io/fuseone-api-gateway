"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { EditorView, keymap, placeholder as editorPlaceholder } from "@codemirror/view"
import { EditorState, Compartment } from "@codemirror/state"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, StreamLanguage } from "@codemirror/language"
import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete"
import { searchKeymap } from "@codemirror/search"
import { lineNumbers, highlightActiveLineGutter } from "@codemirror/view"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { BookOpen, ChevronRight, Play, Code2, FileCode } from "lucide-react"
import { LUA_COMPLETIONS } from "@/lib/lua-completions"
import { SCRIPT_LIBRARY, SCRIPT_CATEGORIES, type ScriptSnippet } from "@/lib/script-library"
import type { CustomEditorProps } from "../flow/plugin-config-panel"

const PHASES = [
  { value: "rewrite", label: "Rewrite" },
  { value: "access", label: "Access" },
  { value: "header_filter", label: "Header Filter" },
  { value: "body_filter", label: "Body Filter" },
  { value: "log", label: "Log" },
  { value: "before_proxy", label: "Before Proxy" },
]

const luaCompletion = (context: CompletionContext): CompletionResult | null => {
  const word = context.matchBefore(/[\w.]*/)
  if (!word || (word.from === word.to && !context.explicit)) return null

  const options = LUA_COMPLETIONS.filter((c) =>
    c.label.toLowerCase().includes(word.text.toLowerCase())
  ).map((c) => ({
    label: c.label,
    type: c.type,
    detail: c.detail,
    info: c.info,
  }))

  if (options.length === 0) return null

  return {
    from: word.from,
    options,
    validFor: /^[\w.]*$/,
  }
}

// Simple Lua-like mode using StreamLanguage
const luaMode = StreamLanguage.define({
  token(stream) {
    if (stream.match(/--\[\[/)) { stream.skipToEnd(); return "comment" }
    if (stream.match(/--/)) { stream.skipToEnd(); return "comment" }
    if (stream.match(/"(?:[^"\\]|\\.)*"/) || stream.match(/'(?:[^'\\]|\\.)*'/)) return "string"
    if (stream.match(/\[\[/)) { stream.skipToEnd(); return "string" }
    if (stream.match(/\b(and|break|do|else|elseif|end|false|for|function|goto|if|in|local|nil|not|or|repeat|return|then|true|until|while)\b/))
      return "keyword"
    if (stream.match(/\b(ngx|core|require|pcall|xpcall|pairs|ipairs|tostring|tonumber|type|error|string|table|math|select|unpack)\b/))
      return "variableName.special"
    if (stream.match(/\b\d+(\.\d+)?\b/)) return "number"
    if (stream.match(/[+\-*/%^#=~<>]=?|\.\.\.?/)) return "operator"
    if (stream.match(/[{}()\[\];,:.]/)) return "punctuation"
    if (stream.match(/[a-zA-Z_]\w*/)) return "variableName"
    stream.next()
    return null
  },
  languageData: { commentTokens: { line: "--", block: { open: "--[[", close: "]]" } } },
})

const darkTheme = EditorView.theme({
  "&": { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--foreground))", fontSize: "13px", height: "100%" },
  ".cm-content": { fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace", padding: "8px 0" },
  ".cm-gutters": { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", border: "none", minWidth: "40px" },
  ".cm-activeLineGutter": { backgroundColor: "hsl(var(--accent))" },
  ".cm-activeLine": { backgroundColor: "hsl(var(--accent) / 0.3)" },
  ".cm-selectionBackground": { backgroundColor: "hsl(var(--primary) / 0.2) !important" },
  "&.cm-focused .cm-selectionBackground": { backgroundColor: "hsl(var(--primary) / 0.3) !important" },
  ".cm-cursor": { borderLeftColor: "hsl(var(--foreground))" },
  ".cm-tooltip": { backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "6px" },
  ".cm-tooltip-autocomplete ul li": { padding: "2px 8px" },
  ".cm-tooltip-autocomplete ul li[aria-selected]": { backgroundColor: "hsl(var(--accent))" },
}, { dark: false })

function extractCode(config: Record<string, unknown>): string {
  const functions = config.functions as string[] | undefined
  if (!functions || functions.length === 0) {
    return `return function(conf, ctx)\n  -- Your code here\nend`
  }
  const raw = functions[0]
  return typeof raw === "string" ? raw : JSON.stringify(raw)
}

export default function ScriptingEditor({ config, onChange, readOnly, policyName }: CustomEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const readOnlyComp = useRef(new Compartment())
  const [showLibrary, setShowLibrary] = useState(false)
  const [phase, setPhase] = useState<string>((config.phase as string) || "access")
  const [libraryFilter, setLibraryFilter] = useState<string>("all")

  const code = extractCode(config)

  const handleCodeChange = useCallback(
    (newCode: string) => {
      onChange({ ...config, phase, functions: [newCode] })
    },
    [config, onChange, phase]
  )

  const handlePhaseChange = useCallback(
    (newPhase: string) => {
      setPhase(newPhase)
      const functions = config.functions as string[] | undefined
      onChange({ ...config, phase: newPhase, functions: functions || [] })
    },
    [config, onChange]
  )

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorRef.current || viewRef.current) return

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const doc = update.state.doc.toString()
        handleCodeChange(doc)
      }
    })

    const state = EditorState.create({
      doc: code,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        syntaxHighlighting(defaultHighlightStyle),
        luaMode,
        autocompletion({ override: [luaCompletion], activateOnTyping: true }),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        editorPlaceholder("return function(conf, ctx)\n  -- Your Lua code here\nend"),
        darkTheme,
        readOnlyComp.current.of(EditorView.editable.of(!readOnly)),
        updateListener,
        EditorView.lineWrapping,
      ],
    })

    viewRef.current = new EditorView({ state, parent: editorRef.current })

    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update readOnly
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: readOnlyComp.current.reconfigure(EditorView.editable.of(!readOnly)),
      })
    }
  }, [readOnly])

  const insertSnippet = (snippet: ScriptSnippet) => {
    if (viewRef.current) {
      const tr = viewRef.current.state.update({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: snippet.code },
      })
      viewRef.current.dispatch(tr)
    }
    setShowLibrary(false)
  }

  const filteredSnippets =
    libraryFilter === "all"
      ? SCRIPT_LIBRARY
      : SCRIPT_LIBRARY.filter((s) => s.category === libraryFilter)

  const isPost = policyName === "serverless-post-function"

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <Code2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium">
          {isPost ? "Post-Function" : "Pre-Function"} Script
        </span>
        <div className="flex-1" />
        <Select value={phase} onValueChange={handlePhaseChange}>
          <SelectTrigger className="h-7 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PHASES.map((p) => (
              <SelectItem key={p.value} value={p.value} className="text-xs">
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showLibrary ? "secondary" : "outline"}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setShowLibrary(!showLibrary)}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Library
        </Button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Code editor */}
        <div className="flex-1 min-w-0">
          <div ref={editorRef} className="h-full overflow-auto rounded-none border-0" />
        </div>

        {/* Script library sidebar */}
        {showLibrary && (
          <div className="w-64 border-l flex flex-col shrink-0">
            <div className="px-3 py-2 border-b">
              <h4 className="text-xs font-semibold mb-2">Script Library</h4>
              <div className="flex flex-wrap gap-1">
                <Badge
                  variant={libraryFilter === "all" ? "default" : "outline"}
                  className="text-[10px] cursor-pointer"
                  onClick={() => setLibraryFilter("all")}
                >
                  All
                </Badge>
                {Object.entries(SCRIPT_CATEGORIES).map(([key, cat]) => (
                  <Badge
                    key={key}
                    variant={libraryFilter === key ? "default" : "outline"}
                    className="text-[10px] cursor-pointer"
                    onClick={() => setLibraryFilter(key)}
                  >
                    {cat.label}
                  </Badge>
                ))}
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {filteredSnippets.map((snippet) => (
                  <button
                    key={snippet.id}
                    className="w-full text-left rounded-md p-2 hover:bg-accent transition-colors group"
                    onClick={() => insertSnippet(snippet)}
                    disabled={readOnly}
                  >
                    <div className="flex items-center gap-1.5">
                      <FileCode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium truncate">{snippet.title}</span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100" />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                      {snippet.description}
                    </p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  )
}
