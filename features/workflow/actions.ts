'use server'

import { revalidatePath } from 'next/cache'
import { requireContext } from '@/shared/server/auth-context'
import { fail, ok, type ActionResult } from '@/shared/server/errors'
import { parseInput } from '@/shared/server/action-utils'
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
    const instance = await runInstance(ctx, workflowId)
    revalidatePath('/dashboard/instances')
    revalidatePath('/dashboard/tasks')
    return ok({ id: instance.id })
  } catch (error) {
    return fail(error)
  }
}
