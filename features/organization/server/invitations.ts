import { createHash, randomBytes } from 'node:crypto'
import type { OrgRole } from '@/prisma/generated/prisma/client'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { conflict, forbidden, invalid, notFound } from '@/shared/server/errors'
import { sendEmail } from '@/shared/server/email'
import { assertCan, isOwner } from '@/shared/server/permissions'
import { notify } from '@/features/notification/server/service'
import { recordAudit } from './audit'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

function baseUrl(): string {
  return (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

export function buildInviteLink(token: string): string {
  return `${baseUrl()}/invitations/${token}`
}

export interface CreateInvitationInput {
  email: string
  role: OrgRole
}

/**
 * Creates (or refreshes) a pending invitation. A pending invitation for the same
 * email is reused with a rotated token instead of creating duplicates, which
 * also implements "resend" semantics.
 */
export async function createInvitation(ctx: Context, input: CreateInvitationInput) {
  assertCan(ctx, 'member.manage', 'Inviting members requires the Admin role or higher')
  if (input.role === 'OWNER' && !isOwner(ctx.role)) {
    throw forbidden('Only an owner can invite another owner')
  }

  const email = input.email.trim().toLowerCase()
  const user = await prisma.user.findFirst({ where: { email }, select: { id: true } })

  if (user) {
    const existing = await prisma.membership.findFirst({
      where: { userId: user.id, organizationId: ctx.organizationId },
      select: { id: true },
    })
    if (existing) throw conflict('That person is already a member of this workspace')
  }

  const token = generateToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
    select: { name: true },
  })

  const invitation = await prisma.$transaction(async (tx) => {
    const pending = await tx.invitation.findFirst({
      where: { organizationId: ctx.organizationId, email, status: 'PENDING' },
      select: { id: true },
    })

    const saved = pending
      ? await tx.invitation.update({
          where: { id: pending.id },
          data: { role: input.role, tokenHash, expiresAt, invitedById: ctx.userId },
        })
      : await tx.invitation.create({
          data: {
            organizationId: ctx.organizationId,
            email,
            role: input.role,
            tokenHash,
            invitedById: ctx.userId,
            expiresAt,
          },
        })

    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: pending ? 'invitation.resent' : 'invitation.created',
      targetType: 'invitation',
      targetId: saved.id,
      metadata: { email, role: input.role },
    })

    return saved
  })

  const link = buildInviteLink(token)
  const sent = await sendEmail({
    to: email,
    subject: `You're invited to ${organization.name} on Relay`,
    text: `You have been invited to join the "${organization.name}" workspace.\n\nAccept the invitation: ${link}\n\nThis link expires on ${expiresAt.toISOString()}.`,
  })

  if (user) {
    await notify(prisma, {
      organizationId: ctx.organizationId,
      userId: user.id,
      type: 'ORG_INVITATION',
      title: `You're invited to ${organization.name}`,
      body: 'Open the invitation to join the workspace.',
      link: `/invitations/${token}`,
    })
  }

  return {
    id: invitation.id,
    email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
    delivered: sent.delivered,
    provider: sent.provider,
    link,
  }
}

export async function listInvitations(ctx: Context) {
  assertCan(ctx, 'member.manage', 'Viewing invitations requires the Admin role or higher')
  return prisma.invitation.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { invitedBy: { select: { id: true, name: true } } },
  })
}

export async function revokeInvitation(ctx: Context, invitationId: string) {
  assertCan(ctx, 'member.manage', 'Revoking invitations requires the Admin role or higher')
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, organizationId: ctx.organizationId },
    select: { id: true, status: true, email: true },
  })
  if (!invitation) throw notFound('Invitation not found')
  if (invitation.status !== 'PENDING') throw invalid('Only pending invitations can be revoked')

  await prisma.$transaction(async (tx) => {
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    })
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'invitation.revoked',
      targetType: 'invitation',
      targetId: invitation.id,
      metadata: { email: invitation.email },
    })
  })
}

export async function resendInvitation(ctx: Context, invitationId: string) {
  assertCan(ctx, 'member.manage', 'Resending invitations requires the Admin role or higher')
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, organizationId: ctx.organizationId },
  })
  if (!invitation) throw notFound('Invitation not found')
  if (invitation.status !== 'PENDING') throw invalid('Only pending invitations can be resent')

  const token = generateToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
    select: { name: true },
  })

  await prisma.$transaction(async (tx) => {
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { tokenHash, expiresAt, invitedById: ctx.userId },
    })
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'invitation.resent',
      targetType: 'invitation',
      targetId: invitation.id,
      metadata: { email: invitation.email },
    })
  })

  const link = buildInviteLink(token)
  const sent = await sendEmail({
    to: invitation.email,
    subject: `Reminder: you're invited to ${organization.name} on Relay`,
    text: `Accept the invitation: ${link}`,
  })

  return { link, delivered: sent.delivered, provider: sent.provider }
}

/** Minimal, non-sensitive preview used by the public accept page. */
export async function getInvitationPreview(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organization: { select: { name: true } } },
  })
  if (!invitation) return null
  return {
    organizationName: invitation.organization.name,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expired: invitation.expiresAt.getTime() < Date.now(),
  }
}

/**
 * Accepts an invitation on behalf of the authenticated user. The invitation
 * email must match the user's account email, and the token is single-use
 * (idempotent only for the same user who already accepted it).
 */
export async function acceptInvitation(userId: string, userEmail: string, token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organization: { select: { id: true, name: true } } },
  })
  if (!invitation) throw notFound('Invitation not found')

  if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw forbidden('This invitation was issued to a different email address')
  }

  if (invitation.status === 'ACCEPTED') {
    if (invitation.acceptedById === userId) {
      return { organizationId: invitation.organizationId, organizationName: invitation.organization.name }
    }
    throw invalid('This invitation has already been used')
  }
  if (invitation.status !== 'PENDING') throw invalid('This invitation is no longer valid')

  if (invitation.expiresAt.getTime() < Date.now()) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } })
    throw invalid('This invitation has expired')
  }

  return prisma.$transaction(async (tx) => {
    // Atomically flip PENDING → ACCEPTED. Two concurrent accepts: exactly one
    // wins the update; the loser either re-reads the winner's result
    // (idempotent, same user) or is rejected. The onboarding membership upsert
    // therefore happens at most once per invitation lifecycle.
    const claimed = await tx.invitation.updateMany({
      where: { id: invitation.id, status: 'PENDING', expiresAt: { gt: new Date() } },
      data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedById: userId },
    })

    if (claimed.count === 0) {
      const current = await tx.invitation.findUniqueOrThrow({
        where: { id: invitation.id },
        select: { status: true, acceptedById: true, organizationId: true },
      })
      if (current.status === 'ACCEPTED' && current.acceptedById === userId) {
        return {
          organizationId: current.organizationId,
          organizationName: invitation.organization.name,
        }
      }
      throw invalid('This invitation has already been used')
    }

    await tx.membership.upsert({
      where: {
        organizationId_userId: { organizationId: invitation.organizationId, userId },
      },
      create: { organizationId: invitation.organizationId, userId, role: invitation.role },
      update: {},
    })
    await recordAudit(tx, {
      organizationId: invitation.organizationId,
      actorId: userId,
      action: 'invitation.accepted',
      targetType: 'invitation',
      targetId: invitation.id,
      metadata: { email: invitation.email, role: invitation.role },
    })
    return { organizationId: invitation.organizationId, organizationName: invitation.organization.name }
  })
}
