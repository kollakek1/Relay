'use server'

import { revalidatePath } from 'next/cache'
import { requireContext } from '@/shared/server/auth-context'
import { fail, ok, type ActionResult } from '@/shared/server/errors'
import { parseInput } from '@/shared/server/action-utils'
import { rateLimit, RATE_LIMITS } from '@/shared/server/rate-limit'
import {
  createFromTemplateSchema,
  createWorkflowSchema,
  deleteWorkflowSchema,
  draftFromVersionSchema,
  instanceIdSchema,
  saveAsTemplateSchema,
  saveWorkflowSchema,
  workflowIdSchema,
} from './schemas/workflowSchema'
import {
  archiveInstance,
  archiveWorkflow,
  createWorkflow,
  deleteWorkflow,
  publishWorkflow,
  restoreInstance,
  restoreWorkflow,
  runInstance,
  saveWorkflowDraft,
} from './server/service'
import {
  createWorkflowFromTemplate,
  saveWorkflowAsTemplate,
} from './server/templates'
import { createDraftFromVersion } from './server/versioning'

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

export async function archiveWorkflowAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const { workflowId } = parseInput(workflowIdSchema, input)
    await rateLimit('workflow:archive', ctx.userId, RATE_LIMITS.workflowMutate)
    await archiveWorkflow(ctx, workflowId)
    revalidatePath('/dashboard/workflows')
    revalidatePath(`/dashboard/workflows/${workflowId}`)
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

export async function restoreWorkflowAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const { workflowId } = parseInput(workflowIdSchema, input)
    await rateLimit('workflow:restore', ctx.userId, RATE_LIMITS.workflowMutate)
    await restoreWorkflow(ctx, workflowId)
    revalidatePath('/dashboard/workflows')
    revalidatePath(`/dashboard/workflows/${workflowId}`)
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteWorkflowAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const { workflowId, withRuns } = parseInput(deleteWorkflowSchema, input)
    await rateLimit('workflow:delete', ctx.userId, RATE_LIMITS.workflowMutate)
    await deleteWorkflow(ctx, workflowId, { withRuns })
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

export async function archiveInstanceAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const { instanceId } = parseInput(instanceIdSchema, input)
    await rateLimit('instance:archive', ctx.userId, RATE_LIMITS.workflowMutate)
    await archiveInstance(ctx, instanceId)
    revalidatePath('/dashboard/instances')
    revalidatePath('/dashboard/archive')
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

export async function restoreInstanceAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const { instanceId } = parseInput(instanceIdSchema, input)
    await rateLimit('instance:restore', ctx.userId, RATE_LIMITS.workflowMutate)
    await restoreInstance(ctx, instanceId)
    revalidatePath('/dashboard/instances')
    revalidatePath('/dashboard/archive')
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

export async function createFromTemplateAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireContext()
    const data = parseInput(createFromTemplateSchema, input)
    await rateLimit('workflow:template', ctx.userId, RATE_LIMITS.workflowMutate)
    const workflow = await createWorkflowFromTemplate(ctx, data)
    revalidatePath('/dashboard/workflows')
    revalidatePath('/dashboard/templates')
    return ok({ id: workflow.id })
  } catch (error) {
    return fail(error)
  }
}

export async function saveAsTemplateAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireContext()
    const data = parseInput(saveAsTemplateSchema, input)
    await rateLimit('workflow:save-template', ctx.userId, RATE_LIMITS.workflowMutate)
    const template = await saveWorkflowAsTemplate(ctx, data)
    revalidatePath('/dashboard/templates')
    return ok({ id: template.id })
  } catch (error) {
    return fail(error)
  }
}

export async function createDraftFromVersionAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireContext()
    const data = parseInput(draftFromVersionSchema, input)
    await rateLimit('workflow:from-version', ctx.userId, RATE_LIMITS.workflowMutate)
    const result = await createDraftFromVersion(ctx, data.workflowId, data.version)
    revalidatePath(`/dashboard/workflows/${data.workflowId}`)
    return ok(result)
  } catch (error) {
    return fail(error)
  }
}
