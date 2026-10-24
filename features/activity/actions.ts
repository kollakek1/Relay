'use server'

import { revalidatePath } from 'next/cache'
import { requireContext } from '@/shared/server/auth-context'
import { fail, ok, type ActionResult } from '@/shared/server/errors'
import { parseInput } from '@/shared/server/action-utils'
import { createCommentSchema } from './schemas/activitySchema'
import { addComment } from './server/service'

export async function addCommentAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const data = parseInput(createCommentSchema, input)
    await addComment(ctx, data)
    revalidatePath(`/dashboard/tasks/${data.taskId}`)
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}
