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
  decideTask,
  listTaskPool,
  transitionTask,
} from '@/features/task/server/service'
import {
  cleanupDatabase,
  createContext,
  createTestUser,
  disconnect,
} from './helpers/db'

async function memberCtx(organizationId: string): Promise<Context> {
  const user = await createTestUser(`Approver ${Math.random().toString(36).slice(2)}`)
  await prisma.membership.create({ data: { organizationId, userId: user.id, role: 'MEMBER' } })
  return { userId: user.id, organizationId, role: 'MEMBER' }
}

async function tasksOf(instanceId: string) {
  return prisma.task.findMany({ where: { instanceId }, orderBy: { stepOrder: 'asc' } })
}

async function completeTask(ctx: Context, taskId: string) {
  await claimTask(ctx, taskId)
  await transitionTask(ctx, { taskId, to: 'IN_PROGRESS' })
  await transitionTask(ctx, { taskId, to: 'DONE' })
}

async function approvalWorkflow(ctx: Context, mode: 'ANY' | 'ALL', withPrep = true) {
  const workflow = await createWorkflow(ctx, { name: `Approval ${mode}` })
  await saveWorkflowDraft(ctx, {
    workflowId: workflow.id,
    name: `Approval ${mode}`,
    steps: [
      ...(withPrep ? [{ name: 'Prepare' }] : []),
      { name: 'Approve it', kind: 'APPROVAL' as const, approvalMode: mode },
    ],
  })
  await publishWorkflow(ctx, workflow.id)
  const instance = await runInstance(ctx, workflow.id)
  return { workflow, instance, tasks: await tasksOf(instance.id) }
}

describe('approval steps (ANY mode)', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('advances the pipeline when approved', async () => {
    const ctx = await createContext('OWNER')
    const { instance, tasks } = await approvalWorkflow(ctx, 'ANY')

    await completeTask(ctx, tasks[0].id)

    const afterPrep = await tasksOf(instance.id)
    expect(afterPrep[1].status).toBe('PENDING')
    expect(afterPrep[1].kind).toBe('APPROVAL')

    await decideTask(ctx, { taskId: afterPrep[1].id, decision: 'APPROVED' })

    const resolved = await prisma.task.findUniqueOrThrow({ where: { id: afterPrep[1].id } })
    expect(resolved.status).toBe('DONE')
    expect(resolved.decision).toBe('APPROVED')

    const instanceRow = await prisma.processInstance.findUniqueOrThrow({ where: { id: instance.id } })
    expect(instanceRow.status).toBe('COMPLETED')
  })

  it('cancels the whole instance when rejected', async () => {
    const ctx = await createContext('OWNER')
    const { instance, tasks } = await approvalWorkflow(ctx, 'ANY')
    await completeTask(ctx, tasks[0].id)

    const approvalTask = (await tasksOf(instance.id))[1]
    await decideTask(ctx, { taskId: approvalTask.id, decision: 'REJECTED' })

    const rejected = await prisma.task.findUniqueOrThrow({ where: { id: approvalTask.id } })
    expect(rejected.decision).toBe('REJECTED')

    const instanceRow = await prisma.processInstance.findUniqueOrThrow({ where: { id: instance.id } })
    expect(instanceRow.status).toBe('CANCELLED')
  })

  it('reopens the step when changes are requested', async () => {
    const ctx = await createContext('OWNER')
    const { instance, tasks } = await approvalWorkflow(ctx, 'ANY')
    await completeTask(ctx, tasks[0].id)
    const approvalTask = (await tasksOf(instance.id))[1]

    await decideTask(ctx, { taskId: approvalTask.id, decision: 'CHANGES_REQUESTED', note: 'Please revise' })

    const reopened = await prisma.task.findUniqueOrThrow({ where: { id: approvalTask.id } })
    expect(reopened.status).toBe('PENDING')
    expect(reopened.decision).toBeNull()

    // It can then be approved.
    await decideTask(ctx, { taskId: approvalTask.id, decision: 'APPROVED' })
    const instanceRow = await prisma.processInstance.findUniqueOrThrow({ where: { id: instance.id } })
    expect(instanceRow.status).toBe('COMPLETED')
  })

  it('notifies eligible approvers when the step is activated', async () => {
    const ctx = await createContext('OWNER')
    const { instance } = await approvalWorkflow(ctx, 'ANY', false)

    const notifications = await prisma.notification.count({
      where: { organizationId: ctx.organizationId, type: 'APPROVAL_REQUESTED' },
    })
    expect(notifications).toBeGreaterThanOrEqual(1)
    expect(instance).toBeTruthy()
  })
})

describe('approval steps (ALL mode)', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('requires every eligible approver to approve', async () => {
    const owner = await createContext('OWNER')
    const a = await memberCtx(owner.organizationId)
    const b = await memberCtx(owner.organizationId)

    const { instance, tasks } = await approvalWorkflow(owner, 'ALL', false)
    const task = tasks[0]

    await decideTask(owner, { taskId: task.id, decision: 'APPROVED' })
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe('PENDING')

    await decideTask(a, { taskId: task.id, decision: 'APPROVED' })
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe('PENDING')

    await decideTask(b, { taskId: task.id, decision: 'APPROVED' })
    const resolved = await prisma.task.findUniqueOrThrow({ where: { id: task.id } })
    expect(resolved.status).toBe('DONE')
    expect(resolved.decision).toBe('APPROVED')
    expect((await prisma.processInstance.findUniqueOrThrow({ where: { id: instance.id } })).status).toBe(
      'COMPLETED'
    )
  })

  it('short-circuits to rejected on any rejection', async () => {
    const owner = await createContext('OWNER')
    const a = await memberCtx(owner.organizationId)

    const { instance, tasks } = await approvalWorkflow(owner, 'ALL', false)
    const task = tasks[0]

    await decideTask(a, { taskId: task.id, decision: 'REJECTED' })

    const resolved = await prisma.task.findUniqueOrThrow({ where: { id: task.id } })
    expect(resolved.decision).toBe('REJECTED')
    expect((await prisma.processInstance.findUniqueOrThrow({ where: { id: instance.id } })).status).toBe(
      'CANCELLED'
    )
  })
})

describe('approval step guards', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('cannot be claimed or progressed as a regular task', async () => {
    const ctx = await createContext('OWNER')
    const { tasks } = await approvalWorkflow(ctx, 'ANY', false)
    const task = tasks[0]

    await expect(claimTask(ctx, task.id)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      transitionTask(ctx, { taskId: task.id, to: 'IN_PROGRESS' })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('is excluded from the task pool', async () => {
    const ctx = await createContext('OWNER')
    await approvalWorkflow(ctx, 'ANY', false)

    const pool = await listTaskPool(ctx, {})
    expect(pool.total).toBe(0)
  })
})
