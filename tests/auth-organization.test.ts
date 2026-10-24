import { afterAll, describe, expect, it } from 'vitest'
import { auth } from '@/shared/lib/auth'
import { prisma } from '@/shared/lib/prisma'
import { AppError } from '@/shared/server/errors'
import { ensureOrganization } from '@/features/organization/server/bootstrap'
import { listMembers, updateMemberRole, removeMember } from '@/features/organization/server/service'
import {
  cleanupDatabase,
  createContext,
  createTestOrganization,
  createTestUser,
  disconnect,
  trackOrganization,
  trackUser,
} from './helpers/db'

const uniqueEmail = () => `signup_${Math.random().toString(36).slice(2)}@relay.test`

describe('registration and login', () => {
  const email = uniqueEmail()
  const password = 'password123'

  it('registers a user with Better Auth and can sign in again', async () => {
    const signUp = await auth.api.signUpEmail({ body: { name: 'Reg User', email, password } })
    expect(signUp.user.email).toBe(email)
    trackUser(signUp.user.id)

    const signIn = await auth.api.signInEmail({ body: { email, password } })
    expect(signIn.user.id).toBe(signUp.user.id)
    expect(signIn.token).toBeTruthy()
  })

  it('provisions a workspace and makes the registrant its OWNER', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } })

    const organizationId = await ensureOrganization(user.id)
    trackOrganization(organizationId)

    const membership = await prisma.membership.findFirstOrThrow({
      where: { userId: user.id, organizationId },
    })
    expect(membership.role).toBe('OWNER')

    // Idempotent: calling again returns the same workspace, not a duplicate.
    const again = await ensureOrganization(user.id)
    expect(again).toBe(organizationId)
  })
})

describe('organization isolation and role enforcement', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('never exposes another tenant\'s members, roles or data', async () => {
    const ctxA = await createContext('OWNER')
    const ctxB = await createContext('OWNER')

    const membersA = await listMembers(ctxA)
    expect(membersA.every((m) => m.organizationId === ctxA.organizationId)).toBe(true)

    // ctxB cannot see ctxA's membership.
    const target = membersA[0]
    await expect(updateMemberRole(ctxB, { membershipId: target.id, role: 'ADMIN' })).rejects.toMatchObject(
      { code: 'NOT_FOUND' }
    )
    await expect(removeMember(ctxB, target.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('enforces the role hierarchy for member management', async () => {
    const ownerCtx = await createContext('OWNER')
    const memberUser = await createTestUser('Member')
    await prisma.membership.create({
      data: { organizationId: ownerCtx.organizationId, userId: memberUser.id, role: 'MEMBER' },
    })
    const memberCtx = {
      userId: memberUser.id,
      organizationId: ownerCtx.organizationId,
      role: 'MEMBER' as const,
    }

    const members = await listMembers(ownerCtx)
    const memberMembership = members.find((m) => m.userId === memberUser.id)!

    // A MEMBER cannot change roles.
    await expect(
      updateMemberRole(memberCtx, { membershipId: memberMembership.id, role: 'ADMIN' })
    ).rejects.toBeInstanceOf(AppError)

    // An OWNER can promote a member.
    await updateMemberRole(ownerCtx, { membershipId: memberMembership.id, role: 'ADMIN' })
    const promoted = await prisma.membership.findUniqueOrThrow({ where: { id: memberMembership.id } })
    expect(promoted.role).toBe('ADMIN')
  })

  it('refuses to demote the last owner', async () => {
    const ownerCtx = await createContext('OWNER')
    const ownerMembership = await prisma.membership.findFirstOrThrow({
      where: { userId: ownerCtx.userId, organizationId: ownerCtx.organizationId },
    })

    await expect(
      updateMemberRole(ownerCtx, { membershipId: ownerMembership.id, role: 'MEMBER' })
    ).rejects.toMatchObject({ code: 'VALIDATION' })

    // Still the owner.
    const after = await prisma.membership.findUniqueOrThrow({ where: { id: ownerMembership.id } })
    expect(after.role).toBe('OWNER')
  })

  it('prevents an ADMIN from removing an OWNER', async () => {
    const ownerUser = await createTestUser('Owner')
    const organization = await createTestOrganization(ownerUser.id)
    trackOrganization(organization.id)

    const adminUser = await createTestUser('Admin')
    await prisma.membership.create({
      data: { organizationId: organization.id, userId: adminUser.id, role: 'ADMIN' },
    })
    const adminCtx = { userId: adminUser.id, organizationId: organization.id, role: 'ADMIN' as const }

    const ownerMembership = await prisma.membership.findFirstOrThrow({
      where: { organizationId: organization.id, userId: ownerUser.id },
    })

    await expect(removeMember(adminCtx, ownerMembership.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})
