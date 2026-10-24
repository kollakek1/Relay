import { createHmac } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { DEFAULT_MAX_ATTEMPTS } from '@/shared/server/retry'
import {
  createWorkflow,
  publishWorkflow,
  runInstance,
  saveWorkflowDraft,
} from '@/features/workflow/server/service'
import { enqueueEvent, drainOutbox } from '@/features/webhooks/server/delivery'
import { createWebhookEndpoint } from '@/features/webhooks/server/service'
import {
  getAutomationHealth,
  requeueFailedAutomationRuns,
  runAutomationsForPendingEvents,
} from '@/features/automation/server/service'
import { cleanupDatabase, createContext, disconnect } from './helpers/db'

const okFetch = async () => new Response('', { status: 200 })

async function instanceWithTask(ctx: Context, name = 'Reliability flow') {
  const workflow = await createWorkflow(ctx, { name })
  await saveWorkflowDraft(ctx, {
    workflowId: workflow.id,
    name,
    steps: [{ name: 'Step' }],
  })
  await publishWorkflow(ctx, workflow.id)
  const instance = await runInstance(ctx, workflow.id)
  const [task] = await prisma.task.findMany({ where: { instanceId: instance.id } })
  return { workflow, instance, task }
}

describe('outbox concurrency and leases', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('processes an event exactly once under concurrent drains', async () => {
    const ctx = await createContext('OWNER')
    await createWebhookEndpoint(ctx, { url: 'https://example.com/hook', events: ['task.completed'] })
    await enqueueEvent(prisma, {
      organizationId: ctx.organizationId,
      topic: 'task.completed',
      payload: { taskId: 't1' },
    })

    let calls = 0
    const fetchImpl = async () => {
      calls += 1
      return new Response('', { status: 200 })
    }

    await Promise.all([drainOutbox({ fetchImpl }), drainOutbox({ fetchImpl })])

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { endpoint: { organizationId: ctx.organizationId } },
    })
    expect(deliveries).toHaveLength(1)
    expect(calls).toBe(1)

    const events = await prisma.outboxEvent.findMany({
      where: { organizationId: ctx.organizationId },
    })
    expect(events).toHaveLength(1)
    expect(events[0].status).toBe('PROCESSED')
    expect(events[0].attempts).toBe(1)
  })

  it('reclaims an event whose lease expired but skips a fresh lease', async () => {
    const ctx = await createContext('OWNER')

    const stale = await enqueueEvent(prisma, {
      organizationId: ctx.organizationId,
      topic: 'workflow.published',
      payload: {},
    })
    await prisma.outboxEvent.update({
      where: { id: stale.id },
      data: {
        status: 'PROCESSING',
        attempts: 1,
        lockedAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    })

    const held = await enqueueEvent(prisma, {
      organizationId: ctx.organizationId,
      topic: 'workflow.published',
      payload: {},
    })
    await prisma.outboxEvent.update({
      where: { id: held.id },
      data: { status: 'PROCESSING', attempts: 1, lockedAt: new Date() },
    })

    const result = await drainOutbox({})

    expect(result.processed).toBeGreaterThanOrEqual(1)
    const reclaimed = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: stale.id } })
    expect(reclaimed.status).toBe('PROCESSED')

    const stillHeld = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: held.id } })
    expect(stillHeld.status).toBe('PROCESSING')
  })

  it('isolates a blocked delivery from a healthy one in the same batch', async () => {
    const ctx = await createContext('OWNER')
    await createWebhookEndpoint(ctx, { url: 'https://example.com/ok', events: ['task.claimed'] })
    // Created directly to bypass the registration guard: the URL is blocked at
    // delivery time (localhost), not at creation time.
    await prisma.webhookEndpoint.create({
      data: {
        organizationId: ctx.organizationId,
        url: 'http://localhost/hook',
        secret: 'whsec_blocked_endpoint',
        events: ['task.claimed'],
        createdById: ctx.userId,
      },
    })

    await enqueueEvent(prisma, {
      organizationId: ctx.organizationId,
      topic: 'task.claimed',
      payload: { taskId: 't2' },
    })

    const fetched: string[] = []
    const fetchImpl = async (url: string) => {
      fetched.push(url)
      return new Response('', { status: 200 })
    }

    await drainOutbox({ fetchImpl })

    // Only the safe endpoint is dialed; the blocked one failed without a request.
    expect(fetched).toEqual(['https://example.com/ok'])

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { endpoint: { organizationId: ctx.organizationId } },
      include: { endpoint: { select: { url: true } } },
    })
    const good = deliveries.find((d) => d.endpoint.url === 'https://example.com/ok')!
    const blocked = deliveries.find((d) => d.endpoint.url === 'http://localhost/hook')!
    expect(good.status).toBe('DELIVERED')
    expect(blocked.status).toBe('PENDING')
    expect(blocked.error).toMatch(/Blocked/i)
  })

  it('signs deliveries so a receiver can verify them', async () => {
    const ctx = await createContext('OWNER')
    const { secret } = await createWebhookEndpoint(ctx, {
      url: 'https://example.com/sig',
      events: ['task.decided'],
    })
    await enqueueEvent(prisma, {
      organizationId: ctx.organizationId,
      topic: 'task.decided',
      payload: { taskId: 't3' },
    })

    let headers: Record<string, string> = {}
    let body = ''
    await drainOutbox({
      fetchImpl: async (_url, init) => {
        headers = (init.headers ?? {}) as Record<string, string>
        body = String(init.body ?? '')
        return new Response('', { status: 200 })
      },
    })

    const signature = headers['x-relay-signature']
    expect(signature).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/)
    const timestamp = signature.split(',')[0].slice(2)
    const v1 = signature.split('v1=')[1]
    const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
    expect(v1).toBe(expected)
  })
})

describe('automation retries and dead-letter', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('retries a failed action and succeeds once the transient fault clears', async () => {
    const ctx = await createContext('OWNER')
    const { task } = await instanceWithTask(ctx)

    // A rule whose stored config is invalid (simulating a transient fault).
    const rule = await prisma.automationRule.create({
      data: {
        organizationId: ctx.organizationId,
        name: 'Priority escalation',
        trigger: 'task.completed',
        action: 'set_priority',
        config: { priority: 'NOT_A_PRIORITY' },
        createdById: ctx.userId,
      },
    })

    await enqueueEvent(prisma, {
      organizationId: ctx.organizationId,
      topic: 'task.completed',
      payload: { taskId: task.id },
    })
    await drainOutbox({ fetchImpl: okFetch })

    const failed = await prisma.automationRun.findFirstOrThrow({ where: { ruleId: rule.id } })
    expect(failed.status).toBe('FAILED')
    expect(failed.attempts).toBe(1)
    expect(failed.nextAttemptAt).not.toBeNull()

    // Clear the fault and make the retry due.
    await prisma.automationRule.update({
      where: { id: rule.id },
      data: { config: { priority: 'URGENT' } },
    })
    await prisma.automationRun.update({
      where: { id: failed.id },
      data: { nextAttemptAt: new Date(Date.now() - 1000) },
    })

    const retry = await runAutomationsForPendingEvents({})
    expect(retry.recovered).toBe(1)

    const succeeded = await prisma.automationRun.findUniqueOrThrow({ where: { id: failed.id } })
    expect(succeeded.status).toBe('SUCCESS')
    const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id } })
    expect(updated.priority).toBe('URGENT')
  })

  it('dead-letters exhausted runs and can requeue them', async () => {
    const ctx = await createContext('OWNER')
    const { task } = await instanceWithTask(ctx)

    const rule = await prisma.automationRule.create({
      data: {
        organizationId: ctx.organizationId,
        name: 'Always broken',
        trigger: 'task.completed',
        action: 'set_priority',
        config: { priority: 'STILL_INVALID' },
        createdById: ctx.userId,
      },
    })
    await enqueueEvent(prisma, {
      organizationId: ctx.organizationId,
      topic: 'task.completed',
      payload: { taskId: task.id },
    })
    await drainOutbox({ fetchImpl: okFetch })

    const run = await prisma.automationRun.findFirstOrThrow({ where: { ruleId: rule.id } })
    // Pretend it is one attempt away from the cap.
    await prisma.automationRun.update({
      where: { id: run.id },
      data: { attempts: DEFAULT_MAX_ATTEMPTS - 1, nextAttemptAt: new Date(Date.now() - 1000) },
    })
    await runAutomationsForPendingEvents({})

    const exhausted = await prisma.automationRun.findUniqueOrThrow({ where: { id: run.id } })
    expect(exhausted.attempts).toBe(DEFAULT_MAX_ATTEMPTS)
    expect(exhausted.status).toBe('FAILED')
    expect(exhausted.nextAttemptAt).toBeNull()

    const health = await getAutomationHealth(ctx)
    expect(health.deadLettered).toBeGreaterThanOrEqual(1)

    const requeued = await requeueFailedAutomationRuns(ctx)
    expect(requeued).toBeGreaterThanOrEqual(1)
    const afterRequeue = await prisma.automationRun.findUniqueOrThrow({ where: { id: run.id } })
    expect(afterRequeue.status).toBe('PENDING')
    expect(afterRequeue.attempts).toBe(0)
  })
})