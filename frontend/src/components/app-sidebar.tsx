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
  Zap,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect } from "react"
import { useTranslations } from "next-intl"
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
  labelKey: string
  icon: LucideIcon
  badge?: "firing"
}

type NavGroup = {
  labelKey: string
  collapsible?: boolean
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    labelKey: "apiManagement",
    items: [
      { path: "/design", labelKey: "designStudio", icon: PenTool },
      { path: "/apis", labelKey: "apis", icon: Workflow },
      { path: "/promotions", labelKey: "promotions", icon: ArrowRightLeft },
      { path: "/applications", labelKey: "applications", icon: AppWindow },
      { path: "/plans", labelKey: "plans", icon: CreditCard },
    ],
  },
  {
    labelKey: "configuration",
    collapsible: true,
    items: [
      { path: "/plugins", labelKey: "policyCatalog", icon: Puzzle },
      { path: "/plugin-configs", labelKey: "policyTemplates", icon: FileJson },
      { path: "/global-rules", labelKey: "globalPolicies", icon: ShieldCheck },
      { path: "/ssl", labelKey: "sslCertificates", icon: Lock },
      { path: "/stream-routes", labelKey: "streamProxy", icon: Wifi },
      { path: "/secrets", labelKey: "secrets", icon: KeyRound },
    ],
  },
  {
    labelKey: "integrations",
    collapsible: true,
    items: [
      { path: "/ai", labelKey: "aiDashboard", icon: Bot },
      { path: "/ai/settings", labelKey: "aiCostModels", icon: SlidersHorizontal },
      { path: "/kafka", labelKey: "kafka", icon: Radio },
      { path: "/kafka/event-apis", labelKey: "eventApis", icon: Zap },
      { path: "/mesh", labelKey: "serviceMesh", icon: Network },
    ],
  },
  {
    labelKey: "observability",
    collapsible: true,
    items: [
      { path: "/testing", labelKey: "testing", icon: FlaskConical },
      { path: "/monitoring", labelKey: "monitoring", icon: Activity, badge: "firing" },
      { path: "/reports", labelKey: "reports", icon: FileBarChart },
    ],
  },
  {
    labelKey: "administration",
    items: [
      { path: "/audit", labelKey: "auditLog", icon: ScrollText },
      { path: "/settings", labelKey: "settings", icon: Settings },
    ],
  },
]

export function AppSidebar({ user }: { user: User | null }) {
  const pathname = usePathname()
  const firingCount = useAlertStore((s) => s.firingCount)
  const startPolling = useAlertStore((s) => s.startPolling)
  const t = useTranslations("sidebar")

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
                  <span className="truncate text-xs">{t("apiGateway")}</span>
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
                  <span>{t("dashboard")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Grouped items */}
        {navGroups.map((group) =>
          group.collapsible ? (
            <CollapsibleNavGroup
              key={group.labelKey}
              group={group}
              pathname={pathname}
              firingCount={firingCount}
              t={t}
            />
          ) : (
            <FlatNavGroup
              key={group.labelKey}
              group={group}
              pathname={pathname}
              firingCount={firingCount}
              t={t}
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
                <span>{t("documentation")}</span>
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
  t,
}: {
  group: NavGroup
  pathname: string
  firingCount: number
  t: (key: string) => string
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="uppercase">{t(group.labelKey)}</SidebarGroupLabel>
      <SidebarMenu>
        {group.items.map((item) => (
          <NavItemButton key={item.path} item={item} pathname={pathname} firingCount={firingCount} allPaths={group.items.map(i => i.path)} t={t} />
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
  t,
}: {
  group: NavGroup
  pathname: string
  firingCount: number
  t: (key: string) => string
}) {
  const { state } = useSidebar()
  const isActive = group.items.some((item) => pathname === item.path || pathname.startsWith(item.path + "/"))
  const groupLabel = t(group.labelKey)

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
                  tooltip={groupLabel}
                >
                  <firstItem.icon />
                  <span>{groupLabel}</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="min-w-48">
                <DropdownMenuLabel className="text-xs text-muted-foreground">{groupLabel}</DropdownMenuLabel>
                {group.items.map((item) => (
                  <DropdownMenuItem key={item.path} asChild className={isNavItemActive(item.path, pathname, group.items.map(i => i.path)) ? "bg-accent" : ""}>
                    <Link href={item.path} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{t(item.labelKey)}</span>
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
            {groupLabel}
            <ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarMenu>
            {group.items.map((item) => (
              <NavItemButton key={item.path} item={item} pathname={pathname} firingCount={firingCount} allPaths={group.items.map(i => i.path)} t={t} />
            ))}
          </SidebarMenu>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}

/** Check if a nav item is the best (most specific) match for the current pathname */
function isNavItemActive(itemPath: string, pathname: string, allPaths: string[]): boolean {
  const matches = pathname === itemPath || pathname.startsWith(itemPath + "/")
  if (!matches) return false
  // If another sibling path is a longer/more specific match, this one is not active
  return !allPaths.some(
    (other) => other !== itemPath && other.length > itemPath.length &&
      (pathname === other || pathname.startsWith(other + "/"))
  )
}

/** Single nav item button (shared between flat and collapsible) */
function NavItemButton({
  item,
  pathname,
  firingCount,
  allPaths,
  t,
}: {
  item: NavItem
  pathname: string
  firingCount: number
  allPaths: string[]
  t: (key: string) => string
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isNavItemActive(item.path, pathname, allPaths)}>
        <Link href={item.path}>
          <item.icon />
          <span>{t(item.labelKey)}</span>
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
