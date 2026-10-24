import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import {
  createWorkflow,
  publishWorkflow,
  runInstance,
  saveWorkflowDraft,
} from '@/features/workflow/server/service'
import { claimTask, transitionTask } from '@/features/task/server/service'
import { drainOutbox } from '@/features/webhooks/server/delivery'
import {
  createAutomationRule,
  listAutomationRuns,
  runAutomationsForEvent,
  setAutomationRuleEnabled,
  deleteAutomationRule,
} from '@/features/automation/server/service'
import { cleanupDatabase, createContext, createTestUser, disconnect } from './helpers/db'

const okFetch = async () => new Response('', { status: 200 })

async function runAndCompleteFirstTask(ctx: Context) {
  const workflow = await createWorkflow(ctx, { name: 'Automation source' })
  await saveWorkflowDraft(ctx, {
    workflowId: workflow.id,
    name: 'Automation source',
    steps: [{ name: 'Do the work' }],
  })
  await publishWorkflow(ctx, workflow.id)
  const instance = await runInstance(ctx, workflow.id)
  const [task] = await prisma.task.findMany({ where: { instanceId: instance.id } })

  await claimTask(ctx, task.id)
  await transitionTask(ctx, { taskId: task.id, to: 'IN_PROGRESS' })
  await transitionTask(ctx, { taskId: task.id, to: 'DONE' })
  return { instance, task }
}

describe('automation rules', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('rejects malformed configurations', async () => {
    const ctx = await createContext('OWNER')
    await expect(
      createAutomationRule(ctx, { name: 'Bad', trigger: 'nope', action: 'notify_role', config: {} })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      createAutomationRule(ctx, { name: 'Bad', trigger: 'task.completed', action: 'set_priority', config: { priority: 'HUGE' } })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      createAutomationRule(ctx, { name: 'Bad', trigger: 'task.completed', action: 'add_tag', config: {} })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('notifies a role when a task completes, exactly once', async () => {
    const ctx = await createContext('OWNER')
    const member = await createTestUser('Notify me')
    await prisma.membership.create({
      data: { organizationId: ctx.organizationId, userId: member.id, role: 'MEMBER' },
    })

    await createAutomationRule(ctx, {
      name: 'Tell the team',
      trigger: 'task.completed',
      action: 'notify_role',
      config: { role: 'MEMBER', title: 'A task was completed' },
    })

    const { task } = await runAndCompleteFirstTask(ctx)
    await drainOutbox({ fetchImpl: okFetch })

    const notifications = await prisma.notification.findMany({
      where: { userId: member.id, type: 'AUTOMATION_NOTIFICATION' },
    })
    expect(notifications).toHaveLength(1)
    expect(notifications[0].title).toBe('A task was completed')
    expect(notifications[0].link).toBe(`/dashboard/tasks/${task.id}`)

    const runs = await listAutomationRuns(ctx)
    expect(runs.filter((run) => run.status === 'SUCCESS')).toHaveLength(1)

    // Draining again must not re-notify (idempotent per rule+event).
    await drainOutbox({ fetchImpl: okFetch })
    expect(
      await prisma.notification.count({
        where: { userId: member.id, type: 'AUTOMATION_NOTIFICATION' },
      })
    ).toBe(1)
  })

  it('applies tag and priority actions to the triggering task', async () => {
    const ctx = await createContext('OWNER')

    await createAutomationRule(ctx, {
      name: 'Tag claims',
      trigger: 'task.claimed',
      action: 'add_tag',
      config: { tag: 'in-flight' },
    })
    await createAutomationRule(ctx, {
      name: 'Escalate completions',
      trigger: 'task.completed',
      action: 'set_priority',
      config: { priority: 'URGENT' },
    })

    const workflow = await createWorkflow(ctx, { name: 'Tagged' })
    await saveWorkflowDraft(ctx, {
      workflowId: workflow.id,
      name: 'Tagged',
      steps: [{ name: 'Step' }],
    })
    await publishWorkflow(ctx, workflow.id)
    const instance = await runInstance(ctx, workflow.id)
    const [task] = await prisma.task.findMany({ where: { instanceId: instance.id } })

    await claimTask(ctx, task.id)
    await drainOutbox({ fetchImpl: okFetch })
    let updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id } })
    expect(updated.tags).toContain('in-flight')

    await transitionTask(ctx, { taskId: task.id, to: 'IN_PROGRESS' })
    await transitionTask(ctx, { taskId: task.id, to: 'DONE' })
    await drainOutbox({ fetchImpl: okFetch })
    updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id } })
    expect(updated.priority).toBe('URGENT')
  })

  it('adds a follow-up task and skips disabled rules', async () => {
    const ctx = await createContext('OWNER')

    const rule = await createAutomationRule(ctx, {
      name: 'Follow-up',
      trigger: 'task.completed',
      action: 'create_task',
      config: { name: 'Send a summary', assigneeRole: 'ADMIN' },
    })

    const { instance } = await runAndCompleteFirstTask(ctx)
    await drainOutbox({ fetchImpl: okFetch })

    const followUp = await prisma.task.findFirst({
      where: { instanceId: instance.id, name: 'Send a summary' },
    })
    expect(followUp).not.toBeNull()
    expect(followUp?.requiredRole).toBe('ADMIN')

    // Disable and verify the rule no longer runs for new events.
    await setAutomationRuleEnabled(ctx, rule.id, false)
    const result = await runAutomationsForEvent({
      id: 'manual-event-1',
      organizationId: ctx.organizationId,
      topic: 'task.completed',
      payload: { instanceId: instance.id },
    })
    expect(result.rules).toBe(0)

    // Cleanup path works too.
    await deleteAutomationRule(ctx, rule.id)
    expect(
      await prisma.automationRule.count({ where: { id: rule.id } })
    ).toBe(0)
  })

  it("does not run another workspace's rules", async () => {
    const a = await createContext('OWNER')
    const b = await createContext('OWNER')
    await createAutomationRule(a, {
      name: 'Org A only',
      trigger: 'task.completed',
      action: 'notify_role',
      config: { role: 'MEMBER' },
    })

    const result = await runAutomationsForEvent({
      id: 'manual-event-2',
      organizationId: b.organizationId,
      topic: 'task.completed',
      payload: {},
    })
    expect(result.rules).toBe(0)
  })
})
