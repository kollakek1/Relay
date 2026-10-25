import { can, type Permission, type PermissionSubject } from './permissions'

/**
 * Single source of truth for "can this subject use this area of the product?".
 *
 * A rule is a list of permissions; access is granted when the subject holds at
 * least one of them (`anyOf`). An empty list means the area is available to
 * every member. Both the dashboard navigation and the protected pages consult
 * these rules, so a hidden tab and a blocked URL can never disagree.
 *
 * The keys are stable identifiers reused by the sidebar.
 */
export const AREA_ACCESS = {
  dashboard: [],
  workflows: ['workflow.create', 'workflow.edit', 'workflow.publish', 'workflow.start'],
  templates: ['workflow.create', 'template.manage'],
  instances: ['workflow.view'],
  archive: ['workflow.view'],
  tasks: ['task.view'],
  pool: ['task.claim'],
  analytics: ['analytics.view'],
  team: ['member.manage'],
  access: [],
  notifications: [],
  settings: [],
} satisfies Record<string, readonly Permission[]>

export type AreaKey = keyof typeof AREA_ACCESS

/** True when `subject` may access `area` (empty rule → everyone). */
export function canAccess(subject: PermissionSubject, area: AreaKey): boolean {
  const rule = AREA_ACCESS[area]
  if (rule.length === 0) return true
  return rule.some((permission) => can(subject, permission))
}

/** True when the subject holds at least one of `rule`. */
export function canAny(subject: PermissionSubject, rule: readonly Permission[]): boolean {
  if (rule.length === 0) return true
  return rule.some((permission) => can(subject, permission))
}
