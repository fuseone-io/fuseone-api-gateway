"use client"

import { DocsSidebar } from "@/components/docs/docs-sidebar"

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100vh-4rem)] -m-8">
      <DocsSidebar />
      <div className="flex-1 overflow-auto p-8">
        {children}
      </div>
    </div>
  )
}
