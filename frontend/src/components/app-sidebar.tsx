"use client"

import {
  Activity,
  ArrowUpDown,
  FileJson,
  KeyRound,
  LayoutDashboard,
  Lock,
  Puzzle,
  Route,
  ScrollText,
  Server,
  ShieldCheck,
  Sliders,
  UserCog,
  Users,
  Wifi,
  Workflow,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { NavUser } from "@/components/nav-user"
import type { User } from "@/types/auth"

type NavItem = {
  path: string
  label: string
  icon: LucideIcon
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: "API Management",
    items: [
      { path: "/apis", label: "APIs", icon: Workflow },
      { path: "/routes", label: "Routes", icon: Route },
      { path: "/services", label: "Services", icon: Server },
      { path: "/upstreams", label: "Upstreams", icon: ArrowUpDown },
      { path: "/consumers", label: "Consumers", icon: Users },
      { path: "/consumer-groups", label: "Consumer Groups", icon: UserCog },
    ],
  },
  {
    label: "Configuration",
    items: [
      { path: "/plugins", label: "Plugins", icon: Puzzle },
      { path: "/plugin-configs", label: "Plugin Configs", icon: FileJson },
      { path: "/global-rules", label: "Global Rules", icon: ShieldCheck },
      { path: "/ssl", label: "SSL / Certificates", icon: Lock },
      { path: "/stream-routes", label: "Stream Routes", icon: Wifi },
      { path: "/secrets", label: "Secrets", icon: KeyRound },
    ],
  },
  {
    label: "System",
    items: [
      { path: "/monitoring", label: "Monitoring", icon: Activity },
      { path: "/audit", label: "Audit Log", icon: ScrollText },
      { path: "/settings", label: "Settings", icon: Sliders },
    ],
  },
]

export function AppSidebar({ user }: { user: User | null }) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center shrink-0">
                  <img src="/logo-mark.svg" alt="FuseOne" className="size-8" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">FuseOne</span>
                  <span className="truncate text-xs">API Gateway</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* Dashboard (standalone) */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/dashboard"}>
                <Link href="/dashboard">
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Grouped items */}
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.path)}>
                    <Link href={item.path}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
