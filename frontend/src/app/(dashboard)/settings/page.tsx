"use client"

import Link from "next/link"
import { Sliders, Users, ShieldCheck, Globe, KeyRound } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"

const settingsSections = [
  {
    title: "Users",
    description: "Manage user accounts, invitations, and access",
    icon: Users,
    href: "/settings/users",
    ready: false,
  },
  {
    title: "Roles",
    description: "Configure roles and permissions for RBAC",
    icon: ShieldCheck,
    href: "/settings/roles",
    ready: false,
  },
  {
    title: "OAuth Providers",
    description: "Configure Google, GitHub, and other OAuth2 providers",
    icon: Globe,
    href: "/settings/oauth",
    ready: false,
  },
  {
    title: "Gateway Connection",
    description: "Configure the connection to your API Gateway",
    icon: KeyRound,
    href: "/settings/connection",
    ready: false,
  },
  {
    title: "General",
    description: "Gateway configuration, environment variables, and system preferences",
    icon: Sliders,
    href: "/settings/general",
    ready: false,
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your API Gateway configuration and access control"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingsSections.map((section) => {
          const Inner = (
            <Card className={`h-full transition-all ${section.ready ? "hover:border-primary/40 hover:shadow-md cursor-pointer" : "border-dashed"}`}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{section.title}</CardTitle>
                      {!section.ready && (
                        <Badge variant="secondary" className="text-[10px]">Soon</Badge>
                      )}
                    </div>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )

          if (section.ready) {
            return (
              <Link key={section.href} href={section.href}>
                {Inner}
              </Link>
            )
          }

          return <div key={section.href}>{Inner}</div>
        })}
      </div>
    </div>
  )
}
