import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import {
  createWorkflow,
  getWorkflow,
  listWorkflows,
  publishWorkflow,
  runInstance,
  saveWorkflowDraft,
} from '@/features/workflow/server/service'
import {
  assignTask,
  claimTask,
  getTask,
  listTaskPool,
  listTasks,
  transitionTask,
} from '@/features/task/server/service'
import { addComment } from '@/features/activity/server/service'
import { normalizeSnapshot } from '@/features/workflow/server/engine'
import {
  getUnreadCount,
  listNotifications,
  markNotificationsRead,
} from '@/features/notification/server/service'
import { cleanupDatabase, createContext, createTestUser, disconnect } from './helpers/db'

async function memberCtx(
  organizationId: string,
  role: 'ADMIN' | 'MEMBER' = 'MEMBER'
): Promise<Context & { membershipId: string }> {
  const user = await createTestUser(`Member ${Math.random().toString(36).slice(2)}`)
  const membership = await prisma.membership.create({
    data: { organizationId, userId: user.id, role },
  })
  return { userId: user.id, organizationId, role, membershipId: membership.id }
}

async function publishedWorkflowWithTasks(ctx: Context, stepNames: string[], name = 'Workflow') {
  const workflow = await createWorkflow(ctx, { name })
  await saveWorkflowDraft(ctx, {
    workflowId: workflow.id,
    name,
    steps: stepNames.map((stepName) => ({ name: stepName })),
  })
  await publishWorkflow(ctx, workflow.id)
  const instance = await runInstance(ctx, workflow.id)
  const tasks = await prisma.task.findMany({
    where: { instanceId: instance.id },
    orderBy: { stepOrder: 'asc' },
  })
  return { workflow, instance, tasks }
}

describe('workflow engine', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('creates, publishes and versions a workflow', async () => {
    const ctx = await createContext('ADMIN')
    const workflow = await createWorkflow(ctx, { name: 'Content', description: 'desc' })

    await saveWorkflowDraft(ctx, {
      workflowId: workflow.id,
      name: 'Content',
      description: 'desc',
      steps: [{ name: 'Draft' }, { name: 'Review', assigneeRole: 'ADMIN' }],
    })

    const v1 = await publishWorkflow(ctx, workflow.id)
    expect(v1.version).toBe(1)

    const published = await prisma.workflow.findUniqueOrThrow({ where: { id: workflow.id } })
    expect(published.status).toBe('PUBLISHED')

    const v2 = await publishWorkflow(ctx, workflow.id)
    expect(v2.version).toBe(2)

    const results = await listWorkflows(ctx, 'Cont')
    expect(results.some((w) => w.id === workflow.id)).toBe(true)
  })

  it('forbids MEMBERs from managing workflows', async () => {
    const ctx = await createContext('MEMBER')
    await expect(createWorkflow(ctx, { name: 'Nope' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(publishWorkflow(ctx, 'some-id')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('runs an instance, generates sequential tasks and advances the pipeline', async () => {
    const ctx = await createContext('OWNER')
    const { instance, tasks } = await publishedWorkflowWithTasks(ctx, ['One', 'Two', 'Three'], 'Pipeline')

    expect(tasks.map((t) => t.status)).toEqual(['PENDING', 'BLOCKED', 'BLOCKED'])

    await claimTask(ctx, tasks[0].id)
    await transitionTask(ctx, { taskId: tasks[0].id, to: 'IN_PROGRESS' })
    await transitionTask(ctx, { taskId: tasks[0].id, to: 'DONE' })

    const second = await prisma.task.findUniqueOrThrow({ where: { id: tasks[1].id } })
    expect(second.status).toBe('PENDING')

    for (const task of [tasks[1], tasks[2]]) {
      await claimTask(ctx, task.id)
      await transitionTask(ctx, { taskId: task.id, to: 'IN_PROGRESS' })
      await transitionTask(ctx, { taskId: task.id, to: 'DONE' })
    }

    const finished = await prisma.processInstance.findUniqueOrThrow({ where: { id: instance.id } })
    expect(finished.status).toBe('COMPLETED')
    expect(finished.completedAt).not.toBeNull()
  })

  it('protects running instances from draft edits (immutable versions)', async () => {
    const ctx = await createContext('OWNER')
    const workflow = await createWorkflow(ctx, { name: 'Immutable' })
    await saveWorkflowDraft(ctx, {
      workflowId: workflow.id,
      name: 'Immutable',
      steps: [{ name: 'Only' }],
    })
    const version = await publishWorkflow(ctx, workflow.id)
    const instance = await runInstance(ctx, workflow.id)

    // Edit the draft after the instance has started.
    await saveWorkflowDraft(ctx, {
      workflowId: workflow.id,
      name: 'Immutable',
      steps: [{ name: 'Changed' }, { name: 'Extra' }],
    })

    const frozen = await prisma.workflowVersion.findUniqueOrThrow({ where: { id: version.id } })
    const snapshot = normalizeSnapshot(frozen.steps)
    expect(snapshot.steps.map((s) => s.name)).toEqual(['Only'])

    const tasks = await prisma.task.findMany({ where: { instanceId: instance.id } })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].name).toBe('Only')
  })

  it('enforces transition authorization and blocks foreign-tenant access', async () => {
    const ctxA = await createContext('OWNER')
    const ctxB = await createContext('OWNER')
    const other = await memberCtx(ctxA.organizationId)
    const { tasks } = await publishedWorkflowWithTasks(ctxA, ['T'], 'Authz')
    const task = tasks[0]

    await expect(getTask(ctxB, task.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(claimTask(ctxB, task.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(transitionTask(ctxB, { taskId: task.id, to: 'CLAIMED' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })

    await claimTask(ctxA, task.id)
    await expect(
      transitionTask(other, { taskId: task.id, to: 'IN_PROGRESS' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    // Skipping a state is rejected by the state machine.
    await expect(transitionTask(ctxA, { taskId: task.id, to: 'DONE' })).rejects.toMatchObject({
      code: 'VALIDATION',
    })

    // Only an administrator may cancel.
    await expect(transitionTask(other, { taskId: task.id, to: 'CANCELLED' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('records comments, activity and notifications with tenant scoping', async () => {
    const ctx = await createContext('OWNER')
    const assignee = await memberCtx(ctx.organizationId)
    const { tasks } = await publishedWorkflowWithTasks(ctx, ['T'], 'Comments')
    const task = tasks[0]

    await assignTask(ctx, { taskId: task.id, assigneeId: assignee.userId })
    expect(await getUnreadCount(assignee)).toBeGreaterThanOrEqual(1)

    await addComment(ctx, { taskId: task.id, body: 'Please look at this' })

    const detail = await getTask(ctx, task.id)
    expect(detail.comments).toHaveLength(1)
    expect(detail.activities.some((a) => a.type === 'ASSIGNED')).toBe(true)
    expect(detail.activities.some((a) => a.type === 'COMMENTED')).toBe(true)

    const notifications = await listNotifications(assignee)
    expect(notifications.some((n) => n.type === 'TASK_COMMENTED')).toBe(true)

    // The actor (owner) was not notified about their own actions.
    expect(await listNotifications(ctx)).toHaveLength(0)

    await markNotificationsRead(assignee)
    expect(await getUnreadCount(assignee)).toBe(0)
  })

  it('supports search, filtering and the task pool', async () => {
    const ctx = await createContext('OWNER')
    await publishedWorkflowWithTasks(ctx, ['Alpha task', 'Beta task'], 'Filterable')

    const byName = await listTasks(ctx, { search: 'Alpha' })
    expect(byName.total).toBe(1)
    expect(byName.items[0].name).toBe('Alpha task')

    const pending = await listTasks(ctx, { status: 'PENDING' })
    expect(pending.items.every((t) => t.status === 'PENDING')).toBe(true)

    const pool = await listTaskPool(ctx, {})
    expect(pool.items.every((t) => t.assigneeId === null && t.status === 'PENDING')).toBe(true)
  })

  it('validates input at the service boundary', async () => {
    const ctx = await createContext('OWNER')
    const workflow = await createWorkflow(ctx, { name: 'Empty' })
    await prisma.workflowStep.deleteMany({ where: { workflowId: workflow.id } })

    await expect(publishWorkflow(ctx, workflow.id)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(runInstance(ctx, workflow.id)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(getWorkflow(ctx, 'missing-id')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
