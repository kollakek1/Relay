'use server'

import { revalidatePath } from 'next/cache'
import { requireContext } from '@/shared/server/auth-context'
import { fail, ok, type ActionResult } from '@/shared/server/errors'
import { parseInput } from '@/shared/server/action-utils'
import { rateLimit, RATE_LIMITS } from '@/shared/server/rate-limit'
import { apiKeyIdSchema, createApiKeySchema } from './schemas/apiSchema'
import { createApiKey, revokeApiKey as revokeKey } from './server/keys'

export async function createApiKeyAction(
  input: unknown
): Promise<ActionResult<{ id: string; token: string; prefix: string }>> {
  try {
    const ctx = await requireContext()
    const data = parseInput(createApiKeySchema, input)
    await rateLimit('api-key:create', ctx.userId, RATE_LIMITS.orgMutate)
    const { apiKey, token } = await createApiKey(ctx, data)
    revalidatePath('/dashboard/settings')
    return ok({ id: apiKey.id, token, prefix: apiKey.prefix })
  } catch (error) {
    return fail(error)
  }
}

export async function revokeApiKeyAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const { id } = parseInput(apiKeyIdSchema, input)
    await rateLimit('api-key:revoke', ctx.userId, RATE_LIMITS.orgMutate)
    await revokeKey(ctx, id)
    revalidatePath('/dashboard/settings')
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}
