"use client"

import { useSearchParams, useRouter } from "next/navigation"
import {
  Sliders,
  Users,
  ShieldCheck,
  Globe,
  KeyRound,
  Bell,
  Palette,
  Database,
  Clock,
  Construction,
  Layers,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
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

interface SettingsSection {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  ready: boolean
}

const settingsSections: SettingsSection[] = [
  {
    id: "environments",
    title: "Environments",
    description: "Manage multiple API Gateway environments",
    icon: Layers,
    ready: true,
  },
  {
    id: "general",
    title: "General",
    description: "Gateway name, environment, and system preferences",
    icon: Sliders,
    ready: true,
  },
  {
    id: "connection",
    title: "Gateway Connection",
    description: "API Gateway endpoint, health check, and latency",
    icon: KeyRound,
    ready: true,
  },
  {
    id: "users",
    title: "Users",
    description: "Manage user accounts, invitations, and access",
    icon: Users,
    ready: true,
  },
  {
    id: "roles",
    title: "Roles & Permissions",
    description: "Configure roles and RBAC permissions",
    icon: ShieldCheck,
    ready: true,
  },
  {
    id: "oauth",
    title: "Authentication Providers",
    description: "Google, GitHub, Microsoft, Okta, and OIDC providers",
    icon: Globe,
    ready: true,
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Slack, Teams, webhook, and email notification channels",
    icon: Bell,
    ready: true,
  },
  {
    id: "appearance",
    title: "Appearance",
    description: "Theme, branding, and UI customization",
    icon: Palette,
    ready: false,
  },
  {
    id: "backup",
    title: "Backup & Restore",
    description: "Export and import gateway configurations",
    icon: Database,
    ready: false,
  },
]

const plannedFeatures: Record<string, string[]> = {
  appearance: [
    "Light / dark theme toggle",
    "Custom logo and favicon upload",
    "Primary and accent color overrides",
    "Developer portal branding",
    "Custom CSS injection",
  ],
  backup: [
    "Export all API definitions as JSON/YAML",
    "Export APISIX configuration snapshot",
    "Scheduled automatic backups",
    "Import and restore from backup",
    "Configuration diff before restore",
  ],
}

function PlannedContent({ section }: { section: SettingsSection }) {
  const items = plannedFeatures[section.id] || []

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{section.title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
      </div>

      <div className="rounded-lg border border-dashed bg-muted/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Construction className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">Planned Feature</p>
            <p className="text-xs text-muted-foreground">This section is part of the roadmap</p>
          </div>
        </div>

        <Separator className="my-4" />

        <p className="text-sm font-medium mb-3">What will be available:</p>
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const DEFAULT_TAB = "environments"
const validTabs = new Set(settingsSections.map((s) => s.id))

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

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
        title="Settings"
        description="Manage your API Gateway configuration and access control"
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} orientation="vertical" className="min-h-[600px] gap-6">
        <TabsList variant="line" className="w-56 shrink-0 items-start">
          {settingsSections.map((section) => (
            <TabsTrigger
              key={section.id}
              value={section.id}
              className="w-full justify-start gap-2.5 px-3 py-2"
            >
              <section.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate text-left">{section.title}</span>
              {section.ready ? (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600">
                  Ready
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                  Planned
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="environments">
          <EnvironmentsContent />
        </TabsContent>

        <TabsContent value="general">
          <GeneralContent />
        </TabsContent>

        <TabsContent value="connection">
          <ConnectionContent />
        </TabsContent>

        <TabsContent value="users">
          <UsersContent />
        </TabsContent>

        <TabsContent value="roles">
          <RolesContent />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsContent />
        </TabsContent>

        <TabsContent value="oauth">
          <OAuthContent />
        </TabsContent>

        {settingsSections
          .filter((s) => !s.ready)
          .map((section) => (
            <TabsContent key={section.id} value={section.id}>
              <PlannedContent section={section} />
            </TabsContent>
          ))}
      </Tabs>
    </div>
  )
}
