import type { Prisma } from '@/prisma/generated/prisma/client'
import type { OrgRole } from '@/prisma/generated/prisma/enums'
import { prisma } from '@/shared/lib/prisma'
import { ORG_ROLES, hasOrgRole } from '@/shared/server/permissions'
import { notify } from '@/features/notification/server/service'

type Db = Prisma.TransactionClient | typeof prisma

/** Roles that satisfy a minimum requirement (null = every member). */
export function rolesAtLeast(minimum: OrgRole | null): OrgRole[] {
  if (!minimum) return [...ORG_ROLES]
  return ORG_ROLES.filter((role) => hasOrgRole(role, minimum))
}

/** Everyone who is allowed to decide this approval step. */
export async function eligibleApproverIds(
  db: Db,
  organizationId: string,
  minimumRole: OrgRole | null
): Promise<string[]> {
  const memberships = await db.membership.findMany({
    where: { organizationId, role: { in: rolesAtLeast(minimumRole) } },
    select: { userId: true },
  })
  return memberships.map((membership) => membership.userId)
}

/**
 * Notifies every eligible approver that a decision is required. Used when an
 * APPROVAL step is activated.
 */
export async function notifyApprovers(
  db: Db,
  input: {
    organizationId: string
    taskId: string
    taskName: string
    requiredRole: OrgRole | null
    workflowName?: string
  }
): Promise<void> {
  const ids = await eligibleApproverIds(db, input.organizationId, input.requiredRole)
  for (const userId of ids) {
    await notify(db, {
      organizationId: input.organizationId,
      userId,
      type: 'APPROVAL_REQUESTED',
      title: `Approval needed: ${input.taskName}`,
      body: input.workflowName ? `Workflow: ${input.workflowName}` : null,
      link: `/dashboard/tasks/${input.taskId}`,
    })
  }
}
