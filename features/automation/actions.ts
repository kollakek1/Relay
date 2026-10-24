'use server'

import { revalidatePath } from 'next/cache'
import { requireContext } from '@/shared/server/auth-context'
import { fail, ok, type ActionResult } from '@/shared/server/errors'
import { parseInput } from '@/shared/server/action-utils'
import { rateLimit, RATE_LIMITS } from '@/shared/server/rate-limit'
import {
  automationIdSchema,
  createAutomationSchema,
  toggleAutomationSchema,
} from './schemas/automationSchema'
import {
  createAutomationRule,
  deleteAutomationRule,
  requeueFailedAutomationRuns,
  setAutomationRuleEnabled,
} from './server/service'

export async function createAutomationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireContext()
    const data = parseInput(createAutomationSchema, input)
    await rateLimit('automation:create', ctx.userId, RATE_LIMITS.orgMutate)
    const rule = await createAutomationRule(ctx, data)
    revalidatePath('/dashboard/settings')
    return ok({ id: rule.id })
  } catch (error) {
    return fail(error)
  }
}

export async function toggleAutomationAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const data = parseInput(toggleAutomationSchema, input)
    await rateLimit('automation:toggle', ctx.userId, RATE_LIMITS.orgMutate)
    await setAutomationRuleEnabled(ctx, data.id, data.enabled)
    revalidatePath('/dashboard/settings')
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteAutomationAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const { id } = parseInput(automationIdSchema, input)
    await rateLimit('automation:delete', ctx.userId, RATE_LIMITS.orgMutate)
    await deleteAutomationRule(ctx, id)
    revalidatePath('/dashboard/settings')
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

/** Admin recovery: re-queue every failed automation run in the workspace. */
export async function requeueFailedAutomationsAction(): Promise<ActionResult<{ count: number }>> {
  try {
    const ctx = await requireContext()
    await rateLimit('automation:requeue', ctx.userId, RATE_LIMITS.orgMutate)
    const count = await requeueFailedAutomationRuns(ctx)
    revalidatePath('/dashboard/settings')
    return ok({ count })
  } catch (error) {
    return fail(error)
  }
}
