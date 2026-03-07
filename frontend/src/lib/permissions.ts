/**
 * Permission groups for the Roles UI.
 *
 * Some FuseOne features map to multiple backend permission strings
 * (e.g. "APIs" bundles apis + routes + services + upstreams).
 * The `permissions` array holds the user-facing toggle keys (read / write),
 * and `bundled` lists extra backend permissions that are silently
 * included when the corresponding action is selected.
 */

export type PermissionGroup = {
  group: string
  permissions: readonly string[]
  /** Extra backend permissions auto-included per action (read/write). */
  bundled?: Readonly<Record<string, readonly string[]>>
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: "APIs",
    permissions: ["apis:read", "apis:write"],
    bundled: {
      "apis:read": ["routes:read", "services:read", "upstreams:read"],
      "apis:write": ["routes:write", "services:write", "upstreams:write"],
    },
  },
  { group: "Applications & Plans", permissions: ["consumers:read", "consumers:write"] },
  { group: "Policies", permissions: ["plugins:read", "plugins:write"] },
  { group: "Global Policies", permissions: ["global_rules:read", "global_rules:write"] },
  { group: "SSL Certificates", permissions: ["ssl:read", "ssl:write"] },
  { group: "Stream Proxy", permissions: ["stream_routes:read", "stream_routes:write"] },
  { group: "Secrets", permissions: ["secrets:read", "secrets:write"] },
  { group: "Event Gateway", permissions: ["kafka:read", "kafka:write"] },
  { group: "AI Gateway", permissions: ["ai_metrics:read"] },
  { group: "Dashboard", permissions: ["dashboard:read"] },
  { group: "Monitoring & Reports", permissions: ["monitoring:read", "monitoring:write"] },
  { group: "Testing", permissions: ["testing:read", "testing:write"] },
  { group: "Audit Log", permissions: ["audit:read"] },
  { group: "Environments", permissions: ["environments:write"] },
  { group: "Users & Roles", permissions: ["users:read", "users:write"] },
  { group: "Settings", permissions: ["settings:read", "settings:write"] },
] as const

/** Expand a set of UI permissions into the full set including bundled ones. */
export function expandPermissions(perms: string[]): string[] {
  const expanded = new Set(perms)
  for (const group of PERMISSION_GROUPS) {
    if (!group.bundled) continue
    for (const [trigger, extras] of Object.entries(group.bundled)) {
      if (expanded.has(trigger)) {
        for (const e of extras) expanded.add(e)
      }
    }
  }
  return Array.from(expanded)
}

/** Collapse backend permissions back to UI permissions (hide bundled ones). */
export function collapsePermissions(perms: string[]): string[] {
  const bundledSet = new Set<string>()
  for (const group of PERMISSION_GROUPS) {
    if (!group.bundled) continue
    for (const extras of Object.values(group.bundled)) {
      for (const e of extras) bundledSet.add(e)
    }
  }
  return perms.filter((p) => !bundledSet.has(p))
}
