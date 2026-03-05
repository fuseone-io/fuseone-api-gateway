"use client"

import {
  Activity,
  AppWindow,
  ArrowRightLeft,
  BookOpen,
  Bot,
  ChevronRight,
  CreditCard,
  FileBarChart,
  FileJson,
  FlaskConical,
  KeyRound,
  LayoutDashboard,
  Lock,
  Network,
  PenTool,
  Puzzle,
  Radio,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Wifi,
  Workflow,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect } from "react"
import { useAlertStore } from "@/stores/alert-store"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  useSidebar,
} from "@/components/ui/sidebar"
import { NavUser } from "@/components/nav-user"
import type { User } from "@/types/auth"

type NavItem = {
  path: string
  label: string
  icon: LucideIcon
  badge?: "firing"
}

type NavGroup = {
  label: string
  collapsible?: boolean
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: "API Management",
    items: [
      { path: "/design", label: "Design Studio", icon: PenTool },
      { path: "/apis", label: "APIs", icon: Workflow },
      { path: "/promotions", label: "Promotions", icon: ArrowRightLeft },
      { path: "/applications", label: "Applications", icon: AppWindow },
      { path: "/plans", label: "Plans", icon: CreditCard },
    ],
  },
  {
    label: "Configuration",
    collapsible: true,
    items: [
      { path: "/plugins", label: "Policy Catalog", icon: Puzzle },
      { path: "/plugin-configs", label: "Policy Templates", icon: FileJson },
      { path: "/global-rules", label: "Global Policies", icon: ShieldCheck },
      { path: "/ssl", label: "SSL / Certificates", icon: Lock },
      { path: "/stream-routes", label: "Stream Proxy", icon: Wifi },
      { path: "/secrets", label: "Secrets", icon: KeyRound },
    ],
  },
  {
    label: "Integrations",
    collapsible: true,
    items: [
      { path: "/ai", label: "AI Dashboard", icon: Bot },
      { path: "/ai/settings", label: "AI Cost Models", icon: SlidersHorizontal },
      { path: "/kafka", label: "Kafka", icon: Radio },
      { path: "/mesh", label: "Service Mesh", icon: Network },
    ],
  },
  {
    label: "Observability",
    collapsible: true,
    items: [
      { path: "/testing", label: "Testing", icon: FlaskConical },
      { path: "/monitoring", label: "Monitoring", icon: Activity, badge: "firing" },
      { path: "/reports", label: "Reports", icon: FileBarChart },
    ],
  },
  {
    label: "Administration",
    items: [
      { path: "/audit", label: "Audit Log", icon: ScrollText },
      { path: "/settings", label: "Settings", icon: Settings },
    ],
  },
]

export function AppSidebar({ user }: { user: User | null }) {
  const pathname = usePathname()
  const firingCount = useAlertStore((s) => s.firingCount)
  const startPolling = useAlertStore((s) => s.startPolling)

  useEffect(() => {
    startPolling()
  }, [startPolling])

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
        {navGroups.map((group) =>
          group.collapsible ? (
            <CollapsibleNavGroup
              key={group.label}
              group={group}
              pathname={pathname}
              firingCount={firingCount}
            />
          ) : (
            <FlatNavGroup
              key={group.label}
              group={group}
              pathname={pathname}
              firingCount={firingCount}
            />
          )
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith("/docs")}>
              <Link href="/docs">
                <BookOpen />
                <span>Documentacao</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}

/** Flat group — items rendered directly under the label */
function FlatNavGroup({
  group,
  pathname,
  firingCount,
}: {
  group: NavGroup
  pathname: string
  firingCount: number
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="uppercase">{group.label}</SidebarGroupLabel>
      <SidebarMenu>
        {group.items.map((item) => (
          <NavItemButton key={item.path} item={item} pathname={pathname} firingCount={firingCount} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

/** Collapsible group — auto-opens when any child route is active.
 *  When sidebar is collapsed (icon mode), renders a dropdown menu instead. */
function CollapsibleNavGroup({
  group,
  pathname,
  firingCount,
}: {
  group: NavGroup
  pathname: string
  firingCount: number
}) {
  const { state } = useSidebar()
  const isActive = group.items.some((item) => pathname.startsWith(item.path))

  // Collapsed sidebar: show first item icon as trigger with floating dropdown
  if (state === "collapsed") {
    const firstItem = group.items[0]
    return (
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  isActive={isActive}
                  tooltip={group.label}
                >
                  <firstItem.icon />
                  <span>{group.label}</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="min-w-48">
                <DropdownMenuLabel className="text-xs text-muted-foreground">{group.label}</DropdownMenuLabel>
                {group.items.map((item) => (
                  <DropdownMenuItem key={item.path} asChild className={pathname.startsWith(item.path) ? "bg-accent" : ""}>
                    <Link href={item.path} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                      {item.badge === "firing" && firingCount > 0 && (
                        <Badge variant="destructive" className="ml-auto h-5 min-w-[20px] px-1.5 text-[10px]">
                          {firingCount}
                        </Badge>
                      )}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    )
  }

  // Expanded sidebar: normal collapsible
  return (
    <Collapsible defaultOpen={isActive} className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="flex w-full items-center uppercase">
            {group.label}
            <ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarMenu>
            {group.items.map((item) => (
              <NavItemButton key={item.path} item={item} pathname={pathname} firingCount={firingCount} />
            ))}
          </SidebarMenu>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}

/** Single nav item button (shared between flat and collapsible) */
function NavItemButton({
  item,
  pathname,
  firingCount,
}: {
  item: NavItem
  pathname: string
  firingCount: number
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={pathname.startsWith(item.path)}>
        <Link href={item.path}>
          <item.icon />
          <span>{item.label}</span>
          {item.badge === "firing" && firingCount > 0 && (
            <Badge variant="destructive" className="ml-auto h-5 min-w-[20px] px-1.5 text-[10px]">
              {firingCount}
            </Badge>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
