import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/shared/lib/prisma'
import { resolveContext } from '@/shared/server/auth-context'
import type { Context } from '@/shared/server/context'
import {
  listOrganizationsForUser,
  updateOrganization,
  transferOwnership,
} from '@/features/organization/server/service'
import {
  acceptInvitation,
  createInvitation,
  getInvitationPreview,
  listInvitations,
  resendInvitation,
  revokeInvitation,
} from '@/features/organization/server/invitations'
import { createWorkflow } from '@/features/workflow/server/service'
import { listAuditLog } from '@/features/organization/server/audit'
import {
  addMember,
  cleanupDatabase,
  createContext,
  createTestOrganization,
  createTestUser,
  disconnect,
} from './helpers/db'

function tokenFromLink(link: string): string {
  return link.split('/invitations/')[1]
}

async function ctxAs(organizationId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER'): Promise<Context> {
  const user = await createTestUser(`Role ${role}`)
  await prisma.membership.create({ data: { organizationId, userId: user.id, role } })
  return { userId: user.id, organizationId, role }
}

describe('invitations', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('creates, lists and accepts an invitation for a registered user', async () => {
    const owner = await createContext('OWNER')
    const invitee = await createTestUser('Invitee')

    const invitation = await createInvitation(owner, { email: invitee.email, role: 'MEMBER' })
    expect(invitation.link).toContain('/invitations/')
    expect(invitation.delivered).toBe(false) // dev provider, no real email

    const listed = await listInvitations(owner)
    expect(listed).toHaveLength(1)
    expect(listed[0].status).toBe('PENDING')

    const token = tokenFromLink(invitation.link)
    const preview = await getInvitationPreview(token)
    expect(preview).toMatchObject({ email: invitee.email, status: 'PENDING', expired: false })

    const accepted = await acceptInvitation(invitee.id, invitee.email, token)
    expect(accepted.organizationId).toBe(owner.organizationId)

    const membership = await prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: owner.organizationId, userId: invitee.id } },
    })
    expect(membership?.role).toBe('MEMBER')

    // Audit trail recorded.
    const audit = await listAuditLog(owner.organizationId)
    expect(audit.some((entry) => entry.action === 'invitation.created')).toBe(true)
    expect(audit.some((entry) => entry.action === 'invitation.accepted')).toBe(true)

    // Idempotent for the same user.
    const again = await acceptInvitation(invitee.id, invitee.email, token)
    expect(again.organizationId).toBe(owner.organizationId)
  })

  it('rejects acceptance by a different email and a second user', async () => {
    const owner = await createContext('OWNER')
    const invitee = await createTestUser('Right')
    const other = await createTestUser('Wrong')

    const invitation = await createInvitation(owner, { email: invitee.email, role: 'MEMBER' })
    const token = tokenFromLink(invitation.link)

    await expect(acceptInvitation(other.id, other.email, token)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('protects against duplicate membership, revoke and expiry', async () => {
    const owner = await createContext('OWNER')

    // Already a member.
    const existing = await createTestUser('Existing')
    await addMember(owner.organizationId, existing.id, 'MEMBER')
    await expect(
      createInvitation(owner, { email: existing.email, role: 'MEMBER' })
    ).rejects.toMatchObject({ code: 'CONFLICT' })

    // Revoke.
    const invitee = await createTestUser('Revoked')
    const invitation = await createInvitation(owner, { email: invitee.email, role: 'MEMBER' })
    const token = tokenFromLink(invitation.link)
    await revokeInvitation(owner, invitation.id)
    const revoked = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } })
    expect(revoked.status).toBe('REVOKED')
    await expect(acceptInvitation(invitee.id, invitee.email, token)).rejects.toMatchObject({
      code: 'VALIDATION',
    })

    // Expiry.
    const late = await createTestUser('Late')
    const expiring = await createInvitation(owner, { email: late.email, role: 'MEMBER' })
    await prisma.invitation.update({
      where: { id: expiring.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    const lateToken = tokenFromLink(expiring.link)
    await expect(acceptInvitation(late.id, late.email, lateToken)).rejects.toMatchObject({
      code: 'VALIDATION',
    })
    const expired = await prisma.invitation.findUniqueOrThrow({ where: { id: expiring.id } })
    expect(expired.status).toBe('EXPIRED')
  })

  it('rotates the token on resend and invalidates the old link', async () => {
    const owner = await createContext('OWNER')
    const invitee = await createTestUser('Resend')
    const invitation = await createInvitation(owner, { email: invitee.email, role: 'MEMBER' })
    const oldToken = tokenFromLink(invitation.link)

    const resent = await resendInvitation(owner, invitation.id)
    const newToken = tokenFromLink(resent.link)
    expect(newToken).not.toBe(oldToken)

    await expect(acceptInvitation(invitee.id, invitee.email, oldToken)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    const accepted = await acceptInvitation(invitee.id, invitee.email, newToken)
    expect(accepted.organizationId).toBe(owner.organizationId)
  })

  it('enforces who may invite and as which role', async () => {
    const owner = await createContext('OWNER')

    // A member cannot invite at all.
    const member = await ctxAs(owner.organizationId, 'MEMBER')
    await expect(
      createInvitation(member, { email: 'x@relay.test', role: 'MEMBER' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    // An admin cannot invite an owner.
    const admin = await ctxAs(owner.organizationId, 'ADMIN')
    await expect(
      createInvitation(admin, { email: 'y@relay.test', role: 'OWNER' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('multiple organizations', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('resolves the active workspace from a validated cookie value', async () => {
    const user = await createTestUser('Multi')
    const a = await createTestOrganization(user.id, 'Org A')
    const b = await createTestOrganization(user.id, 'Org B') // newest

    // No preference → oldest membership.
    const fallback = await resolveContext(user.id, null)
    expect(fallback?.organizationId).toBe(a.id)

    // Explicit, valid preference → that org.
    const chosen = await resolveContext(user.id, b.id)
    expect(chosen?.organizationId).toBe(b.id)

    // Forged / foreign preference → falls back, never grants access.
    const forged = await resolveContext(user.id, 'org_does_not_exist')
    expect(forged?.organizationId).toBe(a.id)

    const access = await resolveContext(user.id, null)
    expect(access?.userId).toBe(user.id)
  })

  it('lists all workspaces and keeps data isolated per workspace', async () => {
    const user = await createTestUser('Isolated')
    const a = await createTestOrganization(user.id, 'Iso A')
    const b = await createTestOrganization(user.id, 'Iso B')

    const orgs = await listOrganizationsForUser(user.id)
    expect(orgs.map((m) => m.organization.id).sort()).toEqual([a.id, b.id].sort())

    const ctxA = await resolveContext(user.id, a.id)
    await createWorkflow(ctxA!, { name: 'Only in A' })

    const ctxB = await resolveContext(user.id, b.id)
    const workflowsB = await prisma.workflow.findMany({ where: { organizationId: ctxB!.organizationId } })
    expect(workflowsB).toHaveLength(0)
  })

  it('updates organization settings with the right permissions', async () => {
    const owner = await createContext('OWNER')
    const updated = await updateOrganization(owner, {
      name: 'Renamed',
      description: 'New description',
      timezone: 'Europe/Berlin',
    })
    expect(updated.name).toBe('Renamed')
    expect(updated.timezone).toBe('Europe/Berlin')

    const member = await ctxAs(owner.organizationId, 'MEMBER')
    await expect(
      updateOrganization(member, { name: 'Nope', timezone: 'UTC' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('transfers ownership and keeps the org owned', async () => {
    const owner = await createContext('OWNER')
    const successor = await createTestUser('Successor')
    const membership = await prisma.membership.create({
      data: { organizationId: owner.organizationId, userId: successor.id, role: 'MEMBER' },
    })

    await transferOwnership(owner, membership.id)

    const [target, actor] = await Promise.all([
      prisma.membership.findUniqueOrThrow({ where: { id: membership.id } }),
      prisma.membership.findFirstOrThrow({
        where: { organizationId: owner.organizationId, userId: owner.userId },
      }),
    ])
    expect(target.role).toBe('OWNER')
    expect(actor.role).toBe('ADMIN')

    // A non-owner can no longer transfer.
    const actorCtx: Context = {
      userId: actor.userId,
      organizationId: actor.organizationId,
      role: actor.role,
    }
    await expect(transferOwnership(actorCtx, membership.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})
