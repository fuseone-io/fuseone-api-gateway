"use client"

import { useTranslations } from "next-intl"
import { MindmapCanvas } from "@/components/mindmap/mindmap-canvas"

export default function MindmapPage() {
  const t = useTranslations("design")

  return (
    <div className="flex flex-col -m-8 h-[calc(100vh-4rem)]">
      <MindmapCanvas />
    </div>
  )
}
