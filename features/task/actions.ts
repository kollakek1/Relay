'use server'

import { revalidatePath } from 'next/cache'
import { requireContext } from '@/shared/server/auth-context'
import { fail, ok, type ActionResult } from '@/shared/server/errors'
import { parseInput } from '@/shared/server/action-utils'
import { rateLimit, RATE_LIMITS } from '@/shared/server/rate-limit'
import {
  assignTaskSchema,
  decideTaskSchema,
  taskIdSchema,
  transitionTaskSchema,
  updateTaskSchema,
} from './schemas/taskSchema'
import { assignTask, claimTask, decideTask, transitionTask, updateTask } from './server/service'

function revalidateTask(taskId: string) {
  revalidatePath('/dashboard/tasks')
  revalidatePath('/dashboard/pool')
  revalidatePath(`/dashboard/tasks/${taskId}`)
  revalidatePath('/dashboard')
}

export async function claimTaskAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const { taskId } = parseInput(taskIdSchema, input)
    await rateLimit('task:claim', ctx.userId, RATE_LIMITS.taskClaim)
    await claimTask(ctx, taskId)
    revalidateTask(taskId)
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

export async function assignTaskAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const data = parseInput(assignTaskSchema, input)
    await rateLimit('task:assign', ctx.userId, RATE_LIMITS.taskMutate)
    await assignTask(ctx, data)
    revalidateTask(data.taskId)
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

export async function updateTaskAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const data = parseInput(updateTaskSchema, input)
    await rateLimit('task:update', ctx.userId, RATE_LIMITS.taskMutate)
    await updateTask(ctx, data)
    revalidateTask(data.taskId)
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

export async function transitionTaskAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const data = parseInput(transitionTaskSchema, input)
    await rateLimit('task:transition', ctx.userId, RATE_LIMITS.taskMutate)
    await transitionTask(ctx, data)
    revalidateTask(data.taskId)
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}

export async function decideTaskAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireContext()
    const data = parseInput(decideTaskSchema, input)
    await rateLimit('task:decide', ctx.userId, RATE_LIMITS.taskMutate)
    await decideTask(ctx, data)
    revalidateTask(data.taskId)
    return ok(undefined)
  } catch (error) {
    return fail(error)
  }
}
