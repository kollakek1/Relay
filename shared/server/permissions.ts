import type { OrgRole } from '@/prisma/generated/prisma/enums'
import { forbidden } from './errors'

/**
 * Central authorization model.
 *
 * Relay uses three fixed organization roles (`OWNER > ADMIN > MEMBER`) plus an
 * optional, additive set of per-membership **permission grants**. Effective
 * permissions are always the union of a role's baseline permissions and the
 * grants recorded on the membership row. This module is the single source of
 * truth: every server-side check flows through {@link can} / {@link assertCan},
 * and the UI derives what to show from the same list.
 *
 * The model is deliberately *deny by default*: an unlisted permission is
 * denied. A plain `MEMBER` cannot start process instances unless an
 * administrator explicitly grants `workflow.start`.
 */

/** Roles from the strongest to the weakest (used for the admin UI ordering). */
export const ORG_ROLES: OrgRole[] = ['OWNER', 'ADMIN', 'MEMBER']

const RANK: Record<OrgRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
}

export function roleRank(role: OrgRole): number {
  return RANK[role] ?? 0
}

/** True when `role` is at least `minimum` in the hierarchy. */
export function hasOrgRole(role: OrgRole, minimum: OrgRole): boolean {
  return roleRank(role) >= roleRank(minimum)
}

/**
 * The full permission catalogue. Names use `resource.action` and are the stable
 * identifiers shared by the server, the navigation, and the public API.
 */
export const PERMISSIONS = [
  'workflow.view',
  'workflow.create',
  'workflow.edit',
  'workflow.publish',
  'workflow.delete',
  'workflow.start',
  'workflow.cancel',
  'template.manage',
  'task.view',
  'task.claim',
  'task.execute',
  'task.assign',
  'approval.decide',
  'member.manage',
  'organization.manage',
  'analytics.view',
  'automation.manage',
  'webhook.manage',
  'apikey.manage',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const PERMISSION_SET: ReadonlySet<string> = new Set(PERMISSIONS)

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && PERMISSION_SET.has(value)
}

/**
 * Baseline permissions per role. `MEMBER` is intentionally unable to start
 * instances, create/edit/publish/delete workflows or manage the organization —
 * an administrator can grant individual permissions on top of this baseline.
 */
const MEMBER_PERMISSIONS: readonly Permission[] = [
  'workflow.view',
  'task.view',
  'task.claim',
  'task.execute',
  'approval.decide',
]

const ADMIN_PERMISSIONS: readonly Permission[] = [
  ...MEMBER_PERMISSIONS,
  'workflow.create',
  'workflow.edit',
  'workflow.publish',
  'workflow.delete',
  'workflow.start',
  'workflow.cancel',
  'template.manage',
  'task.assign',
  'member.manage',
  'organization.manage',
  'analytics.view',
  'automation.manage',
  'webhook.manage',
  'apikey.manage',
]

/** OWNER ⊇ ADMIN: ownership adds no extra capability today, but may in future. */
const OWNER_PERMISSIONS: readonly Permission[] = [...ADMIN_PERMISSIONS]

export const ROLE_PERMISSIONS: Record<OrgRole, readonly Permission[]> = {
  MEMBER: MEMBER_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  OWNER: OWNER_PERMISSIONS,
}

/**
 * Effective permissions for a role plus its explicit grants. Unknown grant
 * values are ignored, and duplicates are removed.
 */
export function permissionsFor(role: OrgRole, granted: readonly string[] = []): Permission[] {
  const set = new Set<Permission>(ROLE_PERMISSIONS[role] ?? [])
  for (const value of granted) if (isPermission(value)) set.add(value)
  return [...set]
}

/** Minimal shape needed for a permission check (a full `Context` satisfies it). */
export interface PermissionSubject {
  role: OrgRole
  permissions?: readonly Permission[]
}

/** Human-readable, stable labels for the permission catalogue (UI). */
export const PERMISSION_LABEL: Record<Permission, string> = {
  'workflow.view': 'View processes and runs',
  'workflow.create': 'Create process templates',
  'workflow.edit': 'Edit process templates',
  'workflow.publish': 'Publish process templates',
  'workflow.delete': 'Delete or archive processes',
  'workflow.start': 'Start process instances',
  'workflow.cancel': 'Cancel running processes',
  'template.manage': 'Manage shared templates',
  'task.view': 'View tasks',
  'task.claim': 'Claim tasks from the pool',
  'task.execute': 'Work on and complete tasks',
  'task.assign': 'Assign tasks to others',
  'approval.decide': 'Decide on approval steps',
  'member.manage': 'Manage members and roles',
  'organization.manage': 'Change organization settings',
  'analytics.view': 'View analytics',
  'automation.manage': 'Manage automation rules',
  'webhook.manage': 'Manage webhooks',
  'apikey.manage': 'Manage API keys',
}

/** True when `subject` holds `permission`. Falls back to the role baseline. */
export function can(subject: PermissionSubject, permission: Permission): boolean {
  const effective = subject.permissions ?? ROLE_PERMISSIONS[subject.role] ?? []
  return effective.includes(permission)
}

/** True when the role's *baseline* includes `permission` (ignores grants). */
export function roleCan(role: OrgRole, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission)
}

/**
 * Permissions an actor is allowed to grant to another member. An actor may only
 * grant what they themselves hold, which prevents privilege escalation.
 */
export function grantablePermissions(subject: PermissionSubject): Permission[] {
  return PERMISSIONS.filter((permission) => can(subject, permission))
}

// ---------------------------------------------------------------------------
// Backwards-compatible role helpers.
//
// These are expressed in terms of permissions so the hierarchy stays defined in
// exactly one place. New code should prefer `can(ctx, permission)` so that
// per-member grants are honoured; these remain for the UI's read-only checks.
// ---------------------------------------------------------------------------

/** Workflows (create/edit/publish/delete) require ADMIN or OWNER. */
export function canManageWorkflows(role: OrgRole): boolean {
  return roleCan(role, 'workflow.create')
}

/** Starting process instances and acting on tasks requires any membership. */
export function canWorkOnTasks(role: OrgRole): boolean {
  return roleCan(role, 'task.execute')
}

/** Managing members and organization settings requires ADMIN or OWNER. */
export function canManageMembers(role: OrgRole): boolean {
  return roleCan(role, 'member.manage')
}

/** Only the OWNER may transfer/delete the organization or manage owners. */
export function isOwner(role: OrgRole): boolean {
  return role === 'OWNER'
}

export const ROLE_LABEL: Record<OrgRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
}

/** Throws a `FORBIDDEN` AppError unless `subject` holds `permission`. */
export function assertCan(
  subject: PermissionSubject,
  permission: Permission,
  message = 'You do not have permission to perform this action'
): void {
  if (!can(subject, permission)) {
    throw forbidden(message)
  }
}
