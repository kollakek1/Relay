import type { OrgRole } from '@/prisma/generated/prisma/enums'

/**
 * Organization roles are ordered: an OWNER outranks an ADMIN who outranks a
 * MEMBER. All server-side authorization flows through this module so the
 * hierarchy is defined in exactly one place.
 */
const RANK: Record<OrgRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
}

export const ORG_ROLES: OrgRole[] = ['OWNER', 'ADMIN', 'MEMBER']

export function roleRank(role: OrgRole): number {
  return RANK[role] ?? 0
}

/** True when `role` is at least `minimum` in the hierarchy. */
export function hasOrgRole(role: OrgRole, minimum: OrgRole): boolean {
  return roleRank(role) >= roleRank(minimum)
}

/** Workflows (create/edit/publish/delete) require ADMIN or OWNER. */
export function canManageWorkflows(role: OrgRole): boolean {
  return hasOrgRole(role, 'ADMIN')
}

/** Starting process instances and acting on tasks requires any membership. */
export function canWorkOnTasks(role: OrgRole): boolean {
  return hasOrgRole(role, 'MEMBER')
}

/** Managing members and organization settings requires ADMIN or OWNER. */
export function canManageMembers(role: OrgRole): boolean {
  return hasOrgRole(role, 'ADMIN')
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
