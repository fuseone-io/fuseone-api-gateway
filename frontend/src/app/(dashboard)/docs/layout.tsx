"use client"

import { useEffect, useRef } from "react"
import { DocsSidebar } from "@/components/docs/docs-sidebar"

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  // Remove padding from parent <main> so docs fills the full area
  useEffect(() => {
    const main = ref.current?.closest("main")
    if (!main) return
    const prev = main.style.padding
    main.style.padding = "0"
    return () => { main.style.padding = prev }
  }, [])

  return (
    <div ref={ref} className="flex h-[calc(100dvh-4rem)] overflow-hidden">
      <DocsSidebar />
      <div className="flex-1 min-w-0 overflow-y-auto p-8">
        {children}
      </div>
    </div>
  )
}
