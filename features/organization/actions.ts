'use server'

import { revalidatePath } from 'next/cache'
import { getContext, getSession, requireContext } from '@/shared/server/auth-context'
import { fail, ok, unauthorized, type ActionResult } from '@/shared/server/errors'
import { parseInput } from '@/shared/server/action-utils'
import { rateLimit, RATE_LIMITS } from '@/shared/server/rate-limit'
import {
  createOrganizationSchema,
  removeMemberSchema,
  updateMemberRoleSchema,
} from './schemas/organizationSchema'
import { removeMember, updateMemberRole } from './server/service'
import { createOrganizationForUser, ensureOrganization } from './server/bootstrap'

/** Idempotently provisions the caller's workspace (used after registration). */
export async function bootstrapOrganizationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getSession()
    if (!session?.user) throw unauthorized()
    const data = parseInput(createOrganizationSchema, input)
    const org = await createOrganizationForUser(session.user.id, data.name)
    revalidatePath('/dashboard')
    return ok({ id: org.id })
  } catch (error) {
    return fail(error)
  }
}

/** Ensures the signed-in user has at least one workspace. */
export async function ensureOrganizationAction(): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getSession()
    if (!session?.user) throw unauthorized()
    const id = await ensureOrganization(session.user.id)
    return ok({ id })
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

/** Whether the current session has an active workspace (client helper). */
export async function hasWorkspaceAction(): Promise<boolean> {
  return Boolean(await getContext())
}
