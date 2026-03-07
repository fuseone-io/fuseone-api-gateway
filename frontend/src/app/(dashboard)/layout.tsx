"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { AppSidebar } from "@/components/app-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { EnvironmentSwitcher } from "@/components/environment-switcher"
import { api } from "@/lib/api-client"
import { useUIStore } from "@/stores/ui-store"
import { AIChatButton } from "@/components/ai-assistant/AIChatButton"
import { AIChatPanel } from "@/components/ai-assistant/AIChatPanel"
import type { User } from "@/types/auth"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { sidebarOpen, setSidebarOpen } = useUIStore()

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      router.push("/login")
      return
    }

    api.me()
      .then(setUser)
      .catch(() => {
        router.push("/login")
      })
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4 !self-auto" />
          <BreadcrumbNav />
          <EnvironmentSwitcher />
          <div className="flex-1" />
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-auto p-8">
          {children}
        </main>
      </SidebarInset>
      <AIChatButton />
      <AIChatPanel />
    </SidebarProvider>
  )
}
