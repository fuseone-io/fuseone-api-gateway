"use client"

import { useEffect, useRef } from "react"
import { DocsSidebar } from "@/components/docs/docs-sidebar"

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  // Prevent parent <main> from scrolling — docs manages its own scroll
  useEffect(() => {
    const main = ref.current?.closest("main")
    if (!main) return
    const prevOverflow = main.style.overflow
    const prevPadding = main.style.padding
    main.style.overflow = "hidden"
    main.style.padding = "0"
    return () => {
      main.style.overflow = prevOverflow
      main.style.padding = prevPadding
    }
  }, [])

  return (
    <div ref={ref} className="flex h-full overflow-hidden">
      <DocsSidebar />
      <div className="flex-1 overflow-y-auto p-8">
        {children}
      </div>
    </div>
  )
}
