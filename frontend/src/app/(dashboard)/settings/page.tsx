"use client"

import { useState } from "react"
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
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/page-header"
import { cn } from "@/lib/utils"

interface SettingsSection {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  ready: boolean
  content?: React.ReactNode
}

const settingsSections: SettingsSection[] = [
  {
    id: "general",
    title: "General",
    description: "Gateway name, environment, and system preferences",
    icon: Sliders,
    ready: false,
  },
  {
    id: "connection",
    title: "Gateway Connection",
    description: "APISIX Admin API endpoint, keys, and health check",
    icon: KeyRound,
    ready: false,
  },
  {
    id: "users",
    title: "Users",
    description: "Manage user accounts, invitations, and access",
    icon: Users,
    ready: false,
  },
  {
    id: "roles",
    title: "Roles & Permissions",
    description: "Configure roles and RBAC permissions",
    icon: ShieldCheck,
    ready: false,
  },
  {
    id: "oauth",
    title: "Authentication Providers",
    description: "Google, GitHub, SAML, and OAuth2 SSO providers",
    icon: Globe,
    ready: false,
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Alerts, webhooks, and notification channels",
    icon: Bell,
    ready: false,
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

function PlannedContent({ section }: { section: SettingsSection }) {
  const features: Record<string, string[]> = {
    general: [
      "Gateway display name and description",
      "Default environment selection",
      "Time zone and locale preferences",
      "Session timeout configuration",
      "API pagination defaults",
    ],
    connection: [
      "APISIX Admin API URL and API key",
      "Connection health check and latency",
      "Control API (port 9090) configuration",
      "Prometheus endpoint configuration",
      "etcd connection status",
    ],
    users: [
      "User listing with search and filters",
      "Invite users via email",
      "Activate / deactivate accounts",
      "Reset passwords and manage 2FA",
      "User activity history",
    ],
    roles: [
      "Built-in roles: Admin, Editor, Viewer",
      "Custom role creation",
      "Granular permissions per resource",
      "Role assignment to users",
      "Permission audit log",
    ],
    oauth: [
      "Google OAuth2 integration",
      "GitHub OAuth2 integration",
      "SAML 2.0 SSO provider",
      "Generic OAuth2 / OIDC provider",
      "Auto-provisioning rules for SSO users",
    ],
    notifications: [
      "Email notification settings (SMTP)",
      "Webhook channels (Slack, Discord, Teams)",
      "Alert rules (error rate, latency, downtime)",
      "Notification history and delivery status",
      "Per-user notification preferences",
    ],
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

  const items = features[section.id] || []

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

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("general")
  const active = settingsSections.find((s) => s.id === activeSection) || settingsSections[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your API Gateway configuration and access control"
      />

      <div className="flex gap-6 min-h-[600px]">
        {/* Vertical nav */}
        <nav className="w-64 shrink-0 space-y-1">
          {settingsSections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                activeSection === section.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <section.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{section.title}</span>
              {!section.ready && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                  Planned
                </Badge>
              )}
            </button>
          ))}
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <Card className="h-full">
            <CardContent className="p-6">
              {active.ready && active.content ? (
                active.content
              ) : (
                <PlannedContent section={active} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
