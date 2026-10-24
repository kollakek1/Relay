'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/shared/lib/prisma'
import {
  getContext,
  getSession,
  requireContext,
  setActiveOrganizationCookie,
} from '@/shared/server/auth-context'
import { fail, forbidden, ok, unauthorized, type ActionResult } from '@/shared/server/errors'
import { parseInput } from '@/shared/server/action-utils'
import { rateLimit, RATE_LIMITS } from '@/shared/server/rate-limit'
import {
  acceptInvitationSchema,
  createInvitationSchema,
  createOrganizationSchema,
  invitationIdSchema,
  removeMemberSchema,
  switchOrganizationSchema,
  transferOwnershipSchema,
  updateMemberRoleSchema,
  updateOrganizationSchema,
} from './schemas/organizationSchema'
import {
  createOrganizationForUser,
  ensureOrganization,
} from './server/bootstrap'
import {
  removeMember,
  transferOwnership,
  updateMemberRole,
  updateOrganization,
} from './server/service'
import {
  acceptInvitation,
  createInvitation,
  resendInvitation,
  revokeInvitation,
} from './server/invitations'

/** Creates a workspace for the signed-in user and switches to it. */
export async function bootstrapOrganizationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getSession()
    if (!session?.user) throw unauthorized()
    const data = parseInput(createOrganizationSchema, input)
    const org = await createOrganizationForUser(session.user.id, data.name)
    await setActiveOrganizationCookie(org.id)
    revalidatePath('/dashboard')
    return ok({ id: org.id })
  } catch (error) {
    return fail(error)
  }
}

/** Ensures the signed-in user has at least one workspace, and activates it. */
export async function ensureOrganizationAction(): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getSession()
    if (!session?.user) throw unauthorized()
    const id = await ensureOrganization(session.user.id)
    const ctx = await getContext()
    if (!ctx) await setActiveOrganizationCookie(id)
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

/**
 * Switches the active workspace. Validates membership server-side before storing
 * the preference, so a forged value cannot grant access to another tenant.
 */
export async function switchOrganizationAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getSession()
    if (!session?.user) throw unauthorized()
    const { organizationId } = parseInput(switchOrganizationSchema, input)
    const membership = await prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId: session.user.id } },
      select: { organizationId: true },
    })
    if (!membership) throw forbidden('You are not a member of that workspace')
    await setActiveOrganizationCookie(membership.organizationId)
    revalidatePath('/dashboard')
    return ok({ id: membership.organizationId })
  } catch (error) {
    return fail(error)
  }
}

export async function updateOrganizationAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const data = parseInput(updateOrganizationSchema, input)
    await rateLimit('org:update', ctx.userId, RATE_LIMITS.orgMutate)
    await updateOrganization(ctx, data)
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard')
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

export async function updateMemberRoleAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const data = parseInput(updateMemberRoleSchema, input)
    await rateLimit('org:role', ctx.userId, RATE_LIMITS.orgMutate)
    await updateMemberRole(ctx, data)
    revalidatePath('/dashboard/team')
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

export async function transferOwnershipAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const data = parseInput(transferOwnershipSchema, input)
    await rateLimit('org:transfer', ctx.userId, RATE_LIMITS.orgMutate)
    await transferOwnership(ctx, data.membershipId)
    revalidatePath('/dashboard/team')
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

export async function removeMemberAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const data = parseInput(removeMemberSchema, input)
    await rateLimit('org:remove', ctx.userId, RATE_LIMITS.orgMutate)
    await removeMember(ctx, data.membershipId)
    revalidatePath('/dashboard/team')
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

export interface InvitationActionResult {
  id: string
  email: string
  role: string
  delivered: boolean
  provider: string
  link: string
}

export async function createInvitationAction(
  input: unknown
): Promise<ActionResult<InvitationActionResult>> {
  try {
    const ctx = await requireContext()
    const data = parseInput(createInvitationSchema, input)
    await rateLimit('invite:create', ctx.userId, RATE_LIMITS.inviteCreate)
    const invitation = await createInvitation(ctx, data)
    revalidatePath('/dashboard/team')
    return ok({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      delivered: invitation.delivered,
      provider: invitation.provider,
      link: invitation.link,
    })
  } catch (error) {
    return fail(error)
  }
}

export async function revokeInvitationAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const { invitationId } = parseInput(invitationIdSchema, input)
    await rateLimit('invite:revoke', ctx.userId, RATE_LIMITS.inviteCreate)
    await revokeInvitation(ctx, invitationId)
    revalidatePath('/dashboard/team')
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

export async function resendInvitationAction(
  input: unknown
): Promise<ActionResult<{ link: string; delivered: boolean; provider: string }>> {
  try {
    const ctx = await requireContext()
    const { invitationId } = parseInput(invitationIdSchema, input)
    await rateLimit('invite:resend', ctx.userId, RATE_LIMITS.inviteCreate)
    const result = await resendInvitation(ctx, invitationId)
    revalidatePath('/dashboard/team')
    return ok(result)
  } catch (error) {
    return fail(error)
  }
}

/** Accepts an invitation for the signed-in user and switches to that workspace. */
export async function acceptInvitationAction(
  input: unknown
): Promise<ActionResult<{ organizationId: string; organizationName: string }>> {
  try {
    const session = await getSession()
    if (!session?.user) throw unauthorized()
    const { token } = parseInput(acceptInvitationSchema, input)
    await rateLimit('invite:accept', session.user.id, RATE_LIMITS.inviteAccept)
    const result = await acceptInvitation(session.user.id, session.user.email, token)
    await setActiveOrganizationCookie(result.organizationId)
    revalidatePath('/dashboard')
    return ok(result)
  } catch (error) {
    return fail(error)
  }
}

/** Whether the current session has an active workspace (client helper). */
export async function hasWorkspaceAction(): Promise<boolean> {
  return Boolean(await getContext())
}
