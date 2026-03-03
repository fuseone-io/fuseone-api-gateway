"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useDocsStore } from "@/stores/docs-store"

export function DocSearchInput() {
  const searchQuery = useDocsStore((s) => s.searchQuery)
  const setSearchQuery = useDocsStore((s) => s.setSearchQuery)

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Buscar na documentacao..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="pl-9 h-9"
      />
    </div>
  )
}
