"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Fragment } from "react"

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  apis: "APIs",
  routes: "Routes",
  services: "Services",
  upstreams: "Upstreams",
  consumers: "Consumers",
  "consumer-groups": "Consumer Groups",
  plugins: "Plugins",
  "plugin-configs": "Plugin Configs",
  "global-rules": "Global Rules",
  ssl: "SSL / Certificates",
  "stream-routes": "Stream Routes",
  secrets: "Secrets",
  monitoring: "Monitoring",
  audit: "Audit Log",
  settings: "Settings",
  users: "Users",
  roles: "Roles",
  new: "New",
}

export function BreadcrumbNav() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) return null

  // Build breadcrumb items
  const items = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/")
    const isLast = index === segments.length - 1
    // Check if segment is a dynamic ID (not in our label map)
    const label = LABELS[segment] || (segment.length > 8 ? `#${segment.slice(0, 6)}...` : segment)

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
