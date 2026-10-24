'use server'

import { revalidatePath } from 'next/cache'
import { requireContext } from '@/shared/server/auth-context'
import { fail, ok, type ActionResult } from '@/shared/server/errors'
import { parseInput } from '@/shared/server/action-utils'
import { z } from 'zod'
import { markNotificationsRead } from './server/service'

const markSchema = z.object({ ids: z.array(z.string()).max(200).optional() })

export async function markNotificationsReadAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  try {
    const ctx = await requireContext()
    const { ids } = parseInput(markSchema, input ?? {})
    const count = await markNotificationsRead(ctx, ids)
    revalidatePath('/dashboard/notifications')
    revalidatePath('/dashboard')
    return ok({ count })
  } catch (error) {
    return fail(error)
  }
}
