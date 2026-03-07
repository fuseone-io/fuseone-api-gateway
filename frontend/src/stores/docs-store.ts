import { create } from "zustand"

interface DocsState {
  searchQuery: string
  setSearchQuery: (q: string) => void
  expandedCategories: Record<string, boolean>
  toggleCategory: (slug: string) => void
  expandOnly: (slug: string) => void
}

export const useDocsStore = create<DocsState>((set, get) => ({
  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),
  expandedCategories: {},
  toggleCategory: (slug) => {
    const current = get().expandedCategories
    const isOpen = !!current[slug]
    // Accordion: close all, then toggle target
    const next: Record<string, boolean> = {}
    if (!isOpen) {
      next[slug] = true
    }
    set({ expandedCategories: next })
  },
  expandOnly: (slug) => {
    set({ expandedCategories: { [slug]: true } })
  },
}))
