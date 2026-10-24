'use server'

import { revalidatePath } from 'next/cache'
import { requireContext } from '@/shared/server/auth-context'
import { fail, ok, type ActionResult } from '@/shared/server/errors'
import { parseInput } from '@/shared/server/action-utils'
import { rateLimit, RATE_LIMITS } from '@/shared/server/rate-limit'
import {
  createWebhookSchema,
  deliveryIdSchema,
  updateWebhookSchema,
  webhookIdSchema,
} from './schemas/webhookSchema'
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  requeueFailedDeliveries,
  retryDeliveryFor,
  updateWebhookEndpoint,
} from './server/service'

export async function createWebhookAction(
  input: unknown
): Promise<ActionResult<{ id: string; secret: string }>> {
  try {
    const ctx = await requireContext()
    const data = parseInput(createWebhookSchema, input)
    await rateLimit('webhook:create', ctx.userId, RATE_LIMITS.orgMutate)
    const { endpoint, secret } = await createWebhookEndpoint(ctx, data)
    revalidatePath('/dashboard/settings')
    return ok({ id: endpoint.id, secret })
  } catch (error) {
    return fail(error)
  }
}

export async function updateWebhookAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const data = parseInput(updateWebhookSchema, input)
    await rateLimit('webhook:update', ctx.userId, RATE_LIMITS.orgMutate)
    await updateWebhookEndpoint(ctx, data)
    revalidatePath('/dashboard/settings')
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteWebhookAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const { id } = parseInput(webhookIdSchema, input)
    await rateLimit('webhook:delete', ctx.userId, RATE_LIMITS.orgMutate)
    await deleteWebhookEndpoint(ctx, id)
    revalidatePath('/dashboard/settings')
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

export async function retryDeliveryAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const { id } = parseInput(deliveryIdSchema, input)
    await rateLimit('webhook:retry', ctx.userId, RATE_LIMITS.orgMutate)
    await retryDeliveryFor(ctx, id)
    revalidatePath('/dashboard/settings')
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

/** Admin recovery: re-queue every failed webhook delivery in the workspace. */
export async function requeueFailedDeliveriesAction(): Promise<ActionResult<{ count: number }>> {
  try {
    const ctx = await requireContext()
    await rateLimit('webhook:requeue', ctx.userId, RATE_LIMITS.orgMutate)
    const count = await requeueFailedDeliveries(ctx)
    revalidatePath('/dashboard/settings')
    return ok({ count })
  } catch (error) {
    return fail(error)
  }
}
