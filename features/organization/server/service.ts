import type { OrgRole } from '@/prisma/generated/prisma/client'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { forbidden, invalid, notFound } from '@/shared/server/errors'
import { canManageMembers, isOwner } from '@/shared/server/permissions'
import type { UpdateMemberRoleInput } from '../schemas/organizationSchema'
import { recordAudit } from './audit'

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

/** All workspaces a user belongs to (for the workspace switcher). */
export async function listOrganizationsForUser(userId: string) {
  return prisma.membership.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: {
      role: true,
      organization: { select: { id: true, name: true, slug: true } },
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

  return prisma.$transaction(async (tx) => {
    const updated = await tx.membership.update({
      where: { id: target.id },
      data: { role: input.role as OrgRole },
    })
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'member.role_changed',
      targetType: 'membership',
      targetId: target.id,
      metadata: { from: target.role, to: input.role },
    })
    return updated
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

  await prisma.$transaction(async (tx) => {
    await tx.membership.delete({ where: { id: target.id } })
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'member.removed',
      targetType: 'membership',
      targetId: target.id,
      metadata: { role: target.role },
    })
  })
}

/**
 * Transfers ownership: the target becomes OWNER and the acting owner is demoted
 * to ADMIN. Only an existing OWNER may do this; the org keeps ≥1 owner.
 */
export async function transferOwnership(ctx: Context, membershipId: string) {
  if (!isOwner(ctx.role)) throw forbidden('Only an owner can transfer ownership')

  const [target, current] = await Promise.all([
    prisma.membership.findFirst({
      where: { id: membershipId, organizationId: ctx.organizationId },
      select: { id: true, role: true, userId: true },
    }),
    prisma.membership.findFirst({
      where: { organizationId: ctx.organizationId, userId: ctx.userId },
      select: { id: true },
    }),
  ])
  if (!target) throw notFound('Member not found')
  if (!current) throw notFound('Your membership was not found')
  if (target.role === 'OWNER') throw invalid('That member is already an owner')

  await prisma.$transaction(async (tx) => {
    await tx.membership.update({ where: { id: target.id }, data: { role: 'OWNER' } })
    await tx.membership.update({ where: { id: current.id }, data: { role: 'ADMIN' } })
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'member.ownership_transferred',
      targetType: 'membership',
      targetId: target.id,
    })
  })
}

export interface UpdateOrganizationInput {
  name: string
  description?: string
  timezone: string
}

export async function updateOrganization(ctx: Context, input: UpdateOrganizationInput) {
  if (!canManageMembers(ctx.role)) {
    throw forbidden('Updating the workspace requires the Admin role or higher')
  }

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.update({
      where: { id: ctx.organizationId },
      data: {
        name: input.name,
        description: input.description?.trim() || null,
        timezone: input.timezone,
      },
    })
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'organization.updated',
      targetType: 'organization',
      targetId: org.id,
      metadata: { name: org.name, timezone: org.timezone },
    })
    return org
  })
}
