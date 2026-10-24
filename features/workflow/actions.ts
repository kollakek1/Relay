'use server'

import { revalidatePath } from 'next/cache'
import { requireContext } from '@/shared/server/auth-context'
import { fail, ok, type ActionResult } from '@/shared/server/errors'
import { parseInput } from '@/shared/server/action-utils'
import { rateLimit, RATE_LIMITS } from '@/shared/server/rate-limit'
import {
  createWorkflowSchema,
  saveWorkflowSchema,
  workflowIdSchema,
} from './schemas/workflowSchema'
import {
  createWorkflow,
  deleteWorkflow,
  publishWorkflow,
  runInstance,
  saveWorkflowDraft,
} from './server/service'

export async function createWorkflowAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireContext()
    const data = parseInput(createWorkflowSchema, input)
    await rateLimit('workflow:create', ctx.userId, RATE_LIMITS.workflowMutate)
    const workflow = await createWorkflow(ctx, data)
    revalidatePath('/dashboard/workflows')
    return ok({ id: workflow.id })
  } catch (error) {
    return fail(error)
  }
}

export async function saveWorkflowAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireContext()
    const data = parseInput(saveWorkflowSchema, input)
    await rateLimit('workflow:save', ctx.userId, RATE_LIMITS.workflowMutate)
    const workflow = await saveWorkflowDraft(ctx, data)
    revalidatePath('/dashboard/workflows')
    revalidatePath(`/dashboard/workflows/${workflow.id}`)
    return ok({ id: workflow.id })
  } catch (error) {
    return fail(error)
  }
}

export async function publishWorkflowAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  try {
    const ctx = await requireContext()
    const { workflowId } = parseInput(workflowIdSchema, input)
    await rateLimit('workflow:publish', ctx.userId, RATE_LIMITS.workflowMutate)
    const version = await publishWorkflow(ctx, workflowId)
    revalidatePath('/dashboard/workflows')
    revalidatePath(`/dashboard/workflows/${workflowId}`)
    return ok({ version: version.version })
  } catch (error) {
    return fail(error)
  }
}

export async function deleteWorkflowAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const { workflowId } = parseInput(workflowIdSchema, input)
    await rateLimit('workflow:delete', ctx.userId, RATE_LIMITS.workflowMutate)
    await deleteWorkflow(ctx, workflowId)
    revalidatePath('/dashboard/workflows')
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

export async function runInstanceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireContext()
    const { workflowId } = parseInput(workflowIdSchema, input)
    await rateLimit('instance:run', ctx.userId, RATE_LIMITS.instanceRun)
    const instance = await runInstance(ctx, workflowId)
    revalidatePath('/dashboard/instances')
    revalidatePath('/dashboard/tasks')
    return ok({ id: instance.id })
  } catch (error) {
    return fail(error)
  }
}
