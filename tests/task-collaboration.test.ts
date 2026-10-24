import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import {
  createWorkflow,
  publishWorkflow,
  runInstance,
  saveWorkflowDraft,
} from '@/features/workflow/server/service'
import {
  claimTask,
  getTask,
  reopenTask,
  transitionTask,
  updateTask,
} from '@/features/task/server/service'
import { addComment } from '@/features/activity/server/service'
import { cleanupDatabase, createContext, createTestUser, disconnect } from './helpers/db'

async function instanceWithSteps(ctx: Context, stepNames: string[]) {
  const workflow = await createWorkflow(ctx, { name: 'Collaboration' })
  await saveWorkflowDraft(ctx, {
    workflowId: workflow.id,
    name: 'Collaboration',
    steps: stepNames.map((name) => ({ name })),
  })
  await publishWorkflow(ctx, workflow.id)
  const instance = await runInstance(ctx, workflow.id)
  const tasks = await prisma.task.findMany({
    where: { instanceId: instance.id },
    orderBy: { stepOrder: 'asc' },
  })
  return { workflow, instance, tasks }
}

async function complete(ctx: Context, taskId: string) {
  await claimTask(ctx, taskId)
  await transitionTask(ctx, { taskId, to: 'IN_PROGRESS' })
  await transitionTask(ctx, { taskId, to: 'DONE' })
}

describe('task tags and observers', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('stores tags and observers, and notifies observers of new comments', async () => {
    const ctx = await createContext('OWNER')
    const observer = await createTestUser('Watcher')
    await prisma.membership.create({
      data: { organizationId: ctx.organizationId, userId: observer.id, role: 'MEMBER' },
    })

    const { tasks } = await instanceWithSteps(ctx, ['Only step'])
    const task = tasks[0]

    await updateTask(ctx, {
      taskId: task.id,
      tags: ['urgent', 'finance'],
      observerIds: [observer.id],
    })

    const updated = await getTask(ctx, task.id)
    expect(updated.tags).toEqual(['urgent', 'finance'])
    expect(updated.observerIds).toEqual([observer.id])

    await addComment(ctx, { taskId: task.id, body: 'Please review the numbers' })
    const observerNotifications = await prisma.notification.count({
      where: { userId: observer.id, type: 'TASK_COMMENTED' },
    })
    expect(observerNotifications).toBeGreaterThanOrEqual(1)
  })

  it('validates the blocking task', async () => {
    const ctx = await createContext('OWNER')
    const { tasks } = await instanceWithSteps(ctx, ['A', 'B'])
    await expect(
      updateTask(ctx, { taskId: tasks[0].id, blockedByTaskId: tasks[0].id })
    ).rejects.toMatchObject({ code: 'VALIDATION' })

    const other = await instanceWithSteps(ctx, ['C'])
    await expect(
      updateTask(ctx, { taskId: tasks[0].id, blockedByTaskId: other.tasks[0].id })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

describe('task dependencies', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('prevents claiming a task whose blocker is not done', async () => {
    const ctx = await createContext('OWNER')
    const { tasks } = await instanceWithSteps(ctx, ['First', 'Second', 'Third'])

    await complete(ctx, tasks[0].id)
    const second = (await prisma.task.findUniqueOrThrow({ where: { id: tasks[1].id } }))
    expect(second.status).toBe('PENDING')

    // Third is still BLOCKED, so it can never satisfy the dependency.
    await updateTask(ctx, { taskId: tasks[1].id, blockedByTaskId: tasks[2].id })
    await expect(claimTask(ctx, tasks[1].id)).rejects.toMatchObject({ code: 'CONFLICT' })

    // Clearing the dependency makes it claimable again.
    await updateTask(ctx, { taskId: tasks[1].id, blockedByTaskId: null })
    await claimTask(ctx, tasks[1].id)
    const claimed = await prisma.task.findUniqueOrThrow({ where: { id: tasks[1].id } })
    expect(claimed.status).toBe('CLAIMED')
  })
})

describe('reopening a task', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('reopens a completed task and returns the instance to running', async () => {
    const ctx = await createContext('OWNER')
    const { instance, tasks } = await instanceWithSteps(ctx, ['Only'])

    await complete(ctx, tasks[0].id)
    expect(
      (await prisma.processInstance.findUniqueOrThrow({ where: { id: instance.id } })).status
    ).toBe('COMPLETED')

    await reopenTask(ctx, { taskId: tasks[0].id, reason: 'Numbers were wrong' })

    const reopened = await prisma.task.findUniqueOrThrow({ where: { id: tasks[0].id } })
    expect(reopened.status).toBe('IN_PROGRESS')
    expect(reopened.completedAt).toBeNull()

    const instanceRow = await prisma.processInstance.findUniqueOrThrow({ where: { id: instance.id } })
    expect(instanceRow.status).toBe('RUNNING')
    expect(instanceRow.completedAt).toBeNull()

    const activity = await prisma.taskActivity.findFirst({
      where: { taskId: tasks[0].id, type: 'REOPENED' },
    })
    expect(activity).not.toBeNull()
  })

  it('refuses to reopen a task that is not done, or by an unrelated member', async () => {
    const ctx = await createContext('OWNER')
    const { tasks } = await instanceWithSteps(ctx, ['Only'])

    await expect(reopenTask(ctx, { taskId: tasks[0].id })).rejects.toMatchObject({
      code: 'VALIDATION',
    })

    const member = await createTestUser('Outsider')
    await prisma.membership.create({
      data: { organizationId: ctx.organizationId, userId: member.id, role: 'MEMBER' },
    })
    const memberCtx: Context = {
      userId: member.id,
      organizationId: ctx.organizationId,
      role: 'MEMBER',
    }

    await complete(ctx, tasks[0].id)
    await expect(reopenTask(memberCtx, { taskId: tasks[0].id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})
