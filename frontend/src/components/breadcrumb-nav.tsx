"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Fragment } from "react"

// Maps URL segments to breadcrumb translation keys
const SEGMENT_KEY_MAP: Record<string, string> = {
  dashboard: "dashboard",
  apis: "apis",
  applications: "applications",
  plans: "plans",
  plugins: "plugins",
  "plugin-configs": "pluginConfigs",
  "global-rules": "globalRules",
  ssl: "ssl",
  "stream-routes": "streamRoutes",
  secrets: "secrets",
  monitoring: "monitoring",
  audit: "audit",
  settings: "settings",
  users: "users",
  roles: "roles",
  new: "new",
  debug: "debug",
  analytics: "analytics",
  health: "health",
  testing: "testing",
  suites: "suites",
  monitors: "monitors",
  sla: "sla",
  traces: "traces",
  design: "design",
  tracing: "tracing",
}

export function BreadcrumbNav() {
  const pathname = usePathname()
  const t = useTranslations("breadcrumb")
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) return null

  // Build breadcrumb items
  const items = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/")
    const isLast = index === segments.length - 1
    // Check if segment is a dynamic ID (not in our label map)
    // Try sessionStorage for dynamic names (e.g., API name instead of UUID)
    const storedName = typeof window !== "undefined" ? sessionStorage.getItem(`breadcrumb:${segment}`) : null
    const key = SEGMENT_KEY_MAP[segment]
    const label = key ? t(key) : storedName || (segment.length > 8 ? `#${segment.slice(0, 6)}...` : segment)

    return { href, label, isLast }
  })

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => (
          <Fragment key={item.href}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {item.isLast ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
