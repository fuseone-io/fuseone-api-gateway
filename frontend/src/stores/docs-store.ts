import { create } from "zustand"

interface DocsState {
  searchQuery: string
  setSearchQuery: (q: string) => void
  expandedCategories: Record<string, boolean>
  toggleCategory: (slug: string) => void
  setExpandedCategory: (slug: string, expanded: boolean) => void
}

export const useDocsStore = create<DocsState>((set, get) => ({
  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),
  expandedCategories: {},
  toggleCategory: (slug) => {
    const current = get().expandedCategories
    set({ expandedCategories: { ...current, [slug]: !current[slug] } })
  },
  setExpandedCategory: (slug, expanded) => {
    const current = get().expandedCategories
    set({ expandedCategories: { ...current, [slug]: expanded } })
  },
}))
