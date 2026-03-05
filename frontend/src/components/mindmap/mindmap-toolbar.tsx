"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  LayoutGrid,
  Save,
  FolderOpen,
  Trash2,
  Rocket,
  ArrowLeft,
  Network,
  FileJson,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useMindmapStore } from "@/stores/mindmap-store"
import { generateApiFromMindmap } from "@/lib/mindmap-generator"
import type { MindmapEntity, GenerationOptions } from "@/types/mindmap"

const DRAFT_KEY = "fuseone:new-api:draft"

interface MindmapToolbarProps {
  onAddEntity: () => void
  onAutoLayout: () => void
}

export function MindmapToolbar({ onAddEntity, onAutoLayout }: MindmapToolbarProps) {
  const router = useRouter()
  const doc = useMindmapStore((s) => s.currentDocument)
  const isDirty = useMindmapStore((s) => s.isDirty)
  const savedDocuments = useMindmapStore((s) => s.savedDocuments)
  const generationOptions = useMindmapStore((s) => s.generationOptions)
  const renameDocument = useMindmapStore((s) => s.renameDocument)
  const saveDocument = useMindmapStore((s) => s.saveDocument)
  const loadDocument = useMindmapStore((s) => s.loadDocument)
  const deleteDocument = useMindmapStore((s) => s.deleteDocument)
  const newDocument = useMindmapStore((s) => s.newDocument)
  const setGenerationOptions = useMindmapStore((s) => s.setGenerationOptions)

  const [generateOpen, setGenerateOpen] = useState(false)
  const [loadOpen, setLoadOpen] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [opts, setOpts] = useState<GenerationOptions>({
    ...generationOptions,
    apiName: doc?.name || "",
    contextPath: "",
  })

  const entityCount = doc?.entities.length || 0
  const relCount = doc?.relationships.length || 0

  const handleGenerate = () => {
    if (!doc || doc.entities.length === 0) return

    const finalOpts: GenerationOptions = {
      ...opts,
      apiName: opts.apiName || doc.name,
    }

    const apiDefinition = generateApiFromMindmap(doc, finalOpts)

    // Save to sessionStorage in the format the /apis/new page expects
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
      mode: "editor",
      apiDef: apiDefinition,
      ts: Date.now(),
    }))

    // Persist generation options
    setGenerationOptions(finalOpts)

    // Save the mindmap before navigating
    saveDocument()

    setGenerateOpen(false)
    router.push("/apis/new?mode=from-mindmap")
  }

  const handleClear = () => {
    newDocument(doc?.name || "Untitled Mindmap")
    setClearConfirm(false)
  }

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-card shrink-0">
        {/* Back */}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/design")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {/* Logo */}
        <Network className="h-5 w-5 text-primary shrink-0" />

        {/* Name */}
        <Input
          value={doc?.name || ""}
          onChange={(e) => renameDocument(e.target.value)}
          className="h-7 text-sm font-semibold border-none shadow-none bg-transparent focus-visible:ring-1 max-w-[240px]"
          placeholder="Mindmap name"
        />

        {isDirty && <div className="h-2 w-2 rounded-full bg-amber-500 shrink-0" title="Unsaved changes" />}

        {/* Stats */}
        <div className="flex items-center gap-1.5 ml-2">
          <Badge variant="outline" className="text-[10px] gap-1">
            {entityCount} entities
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1">
            {relCount} rels
          </Badge>
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onAddEntity}>
          <Plus className="h-3 w-3" /> Entity
        </Button>

        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onAutoLayout}>
          <LayoutGrid className="h-3 w-3" /> Layout
        </Button>

        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={saveDocument}>
          <Save className="h-3 w-3" /> Save
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
              <FolderOpen className="h-3 w-3" /> Load
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {savedDocuments.length === 0 ? (
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                No saved mindmaps
              </DropdownMenuItem>
            ) : (
              savedDocuments.map((d) => (
                <DropdownMenuItem key={d.id} onClick={() => loadDocument(d.id)} className="text-xs">
                  <FileJson className="h-3.5 w-3.5 mr-2" />
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-2">
                    {d.entities.length}e
                  </span>
                </DropdownMenuItem>
              ))
            )}
            {savedDocuments.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setClearConfirm(true)} className="text-xs text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> New Blank Mindmap
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Generate CTA */}
        <Button
          size="sm"
          className="h-7 text-xs gap-1.5"
          disabled={entityCount === 0}
          onClick={() => {
            setOpts({ ...generationOptions, apiName: doc?.name || "", contextPath: "" })
            setGenerateOpen(true)
          }}
        >
          <Rocket className="h-3 w-3" /> Generate API
        </Button>
      </div>

      {/* Generate Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Generate API from Mindmap
            </DialogTitle>
            <DialogDescription className="text-xs">
              {entityCount} entities with{" "}
              {doc?.entities.reduce((s, e) => s + e.crudOperations.length + e.customOperations.length, 0) || 0}{" "}
              operations will generate flows with contracts
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">API Name</Label>
              <Input
                value={opts.apiName || ""}
                onChange={(e) => setOpts({ ...opts, apiName: e.target.value })}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Context Path</Label>
              <Input
                value={opts.contextPath || ""}
                onChange={(e) => setOpts({ ...opts, contextPath: e.target.value })}
                placeholder={`Auto: /${doc?.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "api"}`}
                className="h-8 text-sm font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Options</Label>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={opts.generateContracts}
                  onCheckedChange={(c) => setOpts({ ...opts, generateContracts: !!c })}
                />
                Generate contracts (request/response schemas)
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={opts.generateMocks}
                  onCheckedChange={(c) => setOpts({ ...opts, generateMocks: !!c })}
                />
                Generate mock responses
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={opts.includeTimestamps}
                  onCheckedChange={(c) => setOpts({ ...opts, includeTimestamps: !!c })}
                />
                Include created_at / updated_at fields
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={opts.includePagination}
                  onCheckedChange={(c) => setOpts({ ...opts, includePagination: !!c })}
                />
                Paginated list responses
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleGenerate}>
              <Rocket className="h-3.5 w-3.5" />
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear confirmation */}
      <AlertDialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>New Blank Mindmap?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear the current canvas. Unsaved changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
