"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Activity,
  Bot,
  CircleUser,
  Sliders,
  Users,
  ShieldCheck,
  Globe,
  KeyRound,
  Bell,
  Database,
  Layers,
  Settings,
} from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/page-header"
import NotificationsContent from "./notifications/page"
import EnvironmentsContent from "./environments/page"
import UsersContent from "./users/page"
import RolesContent from "./roles/page"
import GeneralContent from "./general/page"
import ConnectionContent from "./connection/page"
import OAuthContent from "./oauth/page"
import TracingContent from "./tracing/page"
import BackupContent from "./backup/page"
import ProfileContent from "./profile/page"
import AIProvidersContent from "./ai-providers/page"

interface SettingsSection {
  id: string
  titleKey: string
  icon: React.ComponentType<{ className?: string }>
  ready: boolean
}

const settingsSections: SettingsSection[] = [
  { id: "general", titleKey: "general", icon: Sliders, ready: true },
  { id: "profile", titleKey: "profile", icon: CircleUser, ready: true },
  { id: "environments", titleKey: "environments", icon: Layers, ready: true },
  { id: "connection", titleKey: "connection", icon: KeyRound, ready: true },
  { id: "users", titleKey: "users", icon: Users, ready: true },
  { id: "roles", titleKey: "roles", icon: ShieldCheck, ready: true },
  { id: "oauth", titleKey: "oauth", icon: Globe, ready: true },
  { id: "notifications", titleKey: "notifications", icon: Bell, ready: true },
  { id: "tracing", titleKey: "tracing", icon: Activity, ready: true },
  { id: "backup", titleKey: "backup", icon: Database, ready: true },
  { id: "ai-providers", titleKey: "aiProviders", icon: Bot, ready: true },
]

const DEFAULT_TAB = "general"
const validTabs = new Set(settingsSections.map((s) => s.id))

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const t = useTranslations("settings")

  const tabParam = searchParams.get("tab")
  const activeTab = tabParam && validTabs.has(tabParam) ? tabParam : DEFAULT_TAB

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === DEFAULT_TAB) {
      params.delete("tab")
    } else {
      params.set("tab", value)
    }
    const qs = params.toString()
    router.replace(`/settings${qs ? `?${qs}` : ""}`, { scroll: false })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Settings className="h-5 w-5" />}
        title={t("title")}
        description={t("description")}
      />

      <Separator />

      <Tabs value={activeTab} onValueChange={handleTabChange} orientation="vertical" className="min-h-[600px] gap-8">
        <TabsList className="w-52 shrink-0 items-start sticky top-4 self-start">
          {settingsSections.map((section) => (
            <TabsTrigger
              key={section.id}
              value={section.id}
              className="w-full justify-start gap-2.5 px-3 py-2 text-sm"
            >
              <section.icon className="h-4 w-4 shrink-0" />
              <span className="truncate text-left">{t("tabs." + section.titleKey)}</span>
            </TabsTrigger>
          ))}

        </TabsList>

        <div className="flex-1 min-w-0">
          <TabsContent value="profile"><ProfileContent /></TabsContent>
          <TabsContent value="environments"><EnvironmentsContent /></TabsContent>
          <TabsContent value="general"><GeneralContent /></TabsContent>
          <TabsContent value="connection"><ConnectionContent /></TabsContent>
          <TabsContent value="users"><UsersContent /></TabsContent>
          <TabsContent value="roles"><RolesContent /></TabsContent>
          <TabsContent value="notifications"><NotificationsContent /></TabsContent>
          <TabsContent value="oauth"><OAuthContent /></TabsContent>
          <TabsContent value="tracing"><TracingContent /></TabsContent>
          <TabsContent value="backup"><BackupContent /></TabsContent>
          <TabsContent value="ai-providers"><AIProvidersContent /></TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
