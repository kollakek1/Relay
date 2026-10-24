import type { OrgRole } from '@/prisma/generated/prisma/client'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { forbidden, invalid, notFound } from '@/shared/server/errors'
import { canManageMembers, isOwner } from '@/shared/server/permissions'
import type { UpdateMemberRoleInput } from '../schemas/organizationSchema'

export async function getOrganization(ctx: Context) {
  const org = await prisma.organization.findUnique({
    where: { id: ctx.organizationId },
    include: { _count: { select: { memberships: true, workflows: true } } },
  })
  if (!org) throw notFound('Organization not found')
  return org
}

export async function listMembers(ctx: Context) {
  return prisma.membership.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  })
}

async function countOwners(organizationId: string, exclude?: string) {
  return prisma.membership.count({
    where: {
      organizationId,
      role: 'OWNER',
      ...(exclude ? { id: { not: exclude } } : {}),
    },
  })
}

/**
 * Changes a member's role. Guards:
 *  - only ADMIN+ may change roles;
 *  - only an OWNER can grant or revoke OWNER;
 *  - the last owner cannot be demoted.
 */
export async function updateMemberRole(ctx: Context, input: UpdateMemberRoleInput) {
  if (!canManageMembers(ctx.role)) {
    throw forbidden('Managing members requires the Admin role or higher')
  }

  const target = await prisma.membership.findFirst({
    where: { id: input.membershipId, organizationId: ctx.organizationId },
    select: { id: true, role: true, userId: true },
  })
  if (!target) throw notFound('Member not found')

  if (input.role === 'OWNER' || target.role === 'OWNER') {
    if (!isOwner(ctx.role)) throw forbidden('Only an owner can manage owner roles')
  }

  if (target.role === 'OWNER' && input.role !== 'OWNER') {
    const owners = await countOwners(ctx.organizationId, target.id)
    if (owners === 0) throw invalid('The organization must keep at least one owner')
  }

  return prisma.membership.update({
    where: { id: target.id },
    data: { role: input.role as OrgRole },
  })
}

/** Removes a member. The last owner cannot be removed; admins cannot remove owners. */
export async function removeMember(ctx: Context, membershipId: string) {
  if (!canManageMembers(ctx.role)) {
    throw forbidden('Managing members requires the Admin role or higher')
  }

  const target = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId: ctx.organizationId },
    select: { id: true, role: true, userId: true },
  })
  if (!target) throw notFound('Member not found')

  if (target.role === 'OWNER') {
    if (!isOwner(ctx.role)) throw forbidden('Only an owner can remove another owner')
    const owners = await countOwners(ctx.organizationId, target.id)
    if (owners === 0) throw invalid('The organization must keep at least one owner')
  }

  await prisma.membership.delete({ where: { id: target.id } })
}
