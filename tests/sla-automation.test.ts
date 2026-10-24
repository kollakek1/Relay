import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/shared/lib/prisma'
import { claimIdempotencyKey } from '@/shared/server/idempotency'
import { runSlaScan } from '@/features/sla/server/service'
import { createWorkflow, publishWorkflow, runInstance, saveWorkflowDraft } from '@/features/workflow/server/service'
import { assignTask } from '@/features/task/server/service'
import { POST } from '@/app/api/jobs/sla-scan/route'
import type { Context } from '@/shared/server/context'
import { cleanupDatabase, createContext, createTestUser, disconnect } from './helpers/db'

async function taskWithDueDate(ctx: Context, dueAt: Date, name: string) {
  const workflow = await createWorkflow(ctx, { name })
  await saveWorkflowDraft(ctx, { workflowId: workflow.id, name, steps: [{ name: `${name} step` }] })
  await publishWorkflow(ctx, workflow.id)
  const instance = await runInstance(ctx, workflow.id)
  const [task] = await prisma.task.findMany({ where: { instanceId: instance.id } })
  return prisma.task.update({ where: { id: task.id }, data: { dueAt } })
}

async function cleanupAutomation() {
  await prisma.idempotencyKey.deleteMany({ where: { scope: { in: ['sla', 'job'] } } })
  await prisma.jobRun.deleteMany({ where: { job: 'sla-scan' } })
}

describe('idempotency keys', () => {
  afterAll(async () => {
    await cleanupAutomation()
    await cleanupDatabase()
    await disconnect()
  })

  it('claims a key exactly once', async () => {
    const key = `test:${Math.random().toString(36).slice(2)}`
    expect(await claimIdempotencyKey(key, 'sla', 60_000)).toBe(true)
    expect(await claimIdempotencyKey(key, 'sla', 60_000)).toBe(false)
  })
})

describe('SLA scan job', () => {
  afterAll(async () => {
    await cleanupAutomation()
    await cleanupDatabase()
    await disconnect()
  })

  it('notifies overdue tasks once and is idempotent on re-run', async () => {
    const ctx = await createContext('OWNER')
    const assignee = await createTestUser('Overdue Assignee')
    await prisma.membership.create({
      data: { organizationId: ctx.organizationId, userId: assignee.id, role: 'MEMBER' },
    })

    const task = await taskWithDueDate(ctx, new Date(Date.now() - 60_000), 'Overdue flow')
    await assignTask(ctx, { taskId: task.id, assigneeId: assignee.id })

    const first = await runSlaScan()
    expect(first.overdueNotified).toBeGreaterThanOrEqual(1)

    const afterFirst = await prisma.notification.count({
      where: { userId: assignee.id, type: 'TASK_OVERDUE' },
    })
    expect(afterFirst).toBeGreaterThanOrEqual(1)

    // Re-running the same day does not double-notify.
    const second = await runSlaScan()
    expect(second.overdueNotified).toBe(0)
    const afterSecond = await prisma.notification.count({
      where: { userId: assignee.id, type: 'TASK_OVERDUE' },
    })
    expect(afterSecond).toBe(afterFirst)
  })

  it('notifies due-soon tasks and admins for unassigned tasks', async () => {
    const ctx = await createContext('OWNER') // ctx.userId is an admin/owner
    const task = await taskWithDueDate(ctx, new Date(Date.now() + 60 * 60 * 1000), 'Due soon flow')
    // left unassigned → admins are notified

    const result = await runSlaScan()
    expect(result.dueSoonNotified).toBeGreaterThanOrEqual(1)

    const adminNotification = await prisma.notification.findFirst({
      where: { userId: ctx.userId, type: 'TASK_DUE_SOON', link: `/dashboard/tasks/${task.id}` },
    })
    expect(adminNotification).not.toBeNull()
  })
})

describe('sla-scan HTTP endpoint', () => {
  const originalSecret = process.env.CRON_SECRET

  afterAll(async () => {
    process.env.CRON_SECRET = originalSecret
    await cleanupAutomation()
    await cleanupDatabase()
    await disconnect()
  })

  it('returns 503 when not configured and 401 when unauthorized', async () => {
    delete process.env.CRON_SECRET
    const notConfigured = await POST(new Request('http://localhost/api/jobs/sla-scan', { method: 'POST' }))
    expect(notConfigured.status).toBe(503)

    process.env.CRON_SECRET = 'test-cron-secret'
    const unauthorized = await POST(
      new Request('http://localhost/api/jobs/sla-scan', {
        method: 'POST',
        headers: { authorization: 'Bearer nope' },
      })
    )
    expect(unauthorized.status).toBe(401)

    // A secret in the query string is never accepted (would leak via logs).
    const querySecret = await POST(
      new Request('http://localhost/api/jobs/sla-scan?secret=test-cron-secret', { method: 'POST' })
    )
    expect(querySecret.status).toBe(401)
  })

  it('runs once per hour bucket and skips repeats', async () => {
    process.env.CRON_SECRET = 'test-cron-secret'
    const url = 'http://localhost/api/jobs/sla-scan'
    const headers = { authorization: 'Bearer test-cron-secret' }

    const first = await POST(new Request(url, { method: 'POST', headers }))
    expect(first.status).toBe(200)
    const firstBody = (await first.json()) as { ok: boolean; skipped?: boolean }
    expect(firstBody.ok).toBe(true)

    const second = await POST(new Request(url, { method: 'POST', headers }))
    expect(second.status).toBe(200)
    const secondBody = (await second.json()) as { skipped?: boolean }
    expect(secondBody.skipped).toBe(true)

    const runs = await prisma.jobRun.count({ where: { job: 'sla-scan', status: 'SUCCESS' } })
    expect(runs).toBeGreaterThanOrEqual(1)
  })
})
