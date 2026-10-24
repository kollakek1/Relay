import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/shared/lib/prisma'
import { checkOutboundUrl } from '@/shared/server/ssrf'
import {
  authenticateApiKey,
  createApiKey,
  hasScope,
  listApiKeys,
  revokeApiKey,
} from '@/features/api/server/keys'
import {
  createWebhookEndpoint,
  listWebhookEndpoints,
  listDeliveries,
  deleteWebhookEndpoint,
} from '@/features/webhooks/server/service'
import { drainOutbox, enqueueEvent, retryDelivery } from '@/features/webhooks/server/delivery'
import { GET as getTasksRoute } from '@/app/api/v1/tasks/route'
import { cleanupDatabase, createContext, createTestUser, disconnect } from './helpers/db'

describe('outbound URL safety (SSRF)', () => {
  it('accepts public https URLs and rejects unsafe targets', () => {
    expect(checkOutboundUrl('https://example.com/hooks')).toEqual({ ok: true })
    expect(checkOutboundUrl('http://example.com/hooks')).toEqual({ ok: true })

    expect(checkOutboundUrl('ftp://example.com')).toMatchObject({ ok: false })
    expect(checkOutboundUrl('http://localhost:3000')).toMatchObject({ ok: false })
    expect(checkOutboundUrl('http://127.0.0.1/x')).toMatchObject({ ok: false })
    expect(checkOutboundUrl('http://10.0.0.5/x')).toMatchObject({ ok: false })
    expect(checkOutboundUrl('http://192.168.1.10/x')).toMatchObject({ ok: false })
    expect(checkOutboundUrl('http://172.16.5.4/x')).toMatchObject({ ok: false })
    expect(checkOutboundUrl('http://169.254.169.254/latest/meta-data')).toMatchObject({ ok: false })
    expect(checkOutboundUrl('http://metadata.google.internal/computeMetadata/v1')).toMatchObject({
      ok: false,
    })
    expect(checkOutboundUrl('http://user:pass@example.com')).toMatchObject({ ok: false })
    expect(checkOutboundUrl('not-a-url')).toMatchObject({ ok: false })
  })
})

describe('API keys', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('creates a hashed key, authenticates it, and revokes it', async () => {
    const ctx = await createContext('OWNER')
    const { apiKey, token } = await createApiKey(ctx, {
      name: 'Reporting',
      scopes: ['tasks:read', 'workflows:read'],
    })
    expect(token.startsWith('rk_')).toBe(true)

    const stored = await prisma.apiKey.findUniqueOrThrow({ where: { id: apiKey.id } })
    expect(stored.keyHash).not.toContain(token) // only the hash is stored
    expect(stored.scopes).toEqual(['tasks:read', 'workflows:read'])

    const principal = await authenticateApiKey(token)
    expect(principal?.organizationId).toBe(ctx.organizationId)
    expect(principal && hasScope(principal, 'tasks:read')).toBe(true)
    expect(principal && hasScope(principal, 'instances:write')).toBe(false)

    await revokeApiKey(ctx, apiKey.id)
    expect(await authenticateApiKey(token)).toBeNull()

    const listed = await listApiKeys(ctx)
    expect(listed.some((key) => key.id === apiKey.id && key.revokedAt)).toBe(true)
  })

  it('stops authenticating once the creator loses membership', async () => {
    const ctx = await createContext('OWNER')
    const creator = await createTestUser('Key Creator')
    await prisma.membership.create({
      data: { organizationId: ctx.organizationId, userId: creator.id, role: 'ADMIN' },
    })
    const creatorCtx = { userId: creator.id, organizationId: ctx.organizationId, role: 'ADMIN' as const }
    const { token } = await createApiKey(creatorCtx, { name: 'Temp', scopes: ['tasks:read'] })

    expect(await authenticateApiKey(token)).not.toBeNull()

    await prisma.membership.deleteMany({
      where: { organizationId: ctx.organizationId, userId: creator.id },
    })
    expect(await authenticateApiKey(token)).toBeNull()
  })

  it('rejects unknown tokens and enforces scopes on the public API', async () => {
    const ctx = await createContext('OWNER')
    const { token } = await createApiKey(ctx, { name: 'Read only', scopes: ['workflows:read'] })

    const anonymous = await getTasksRoute(new Request('http://localhost/api/v1/tasks'))
    expect(anonymous.status).toBe(401)

    const wrongScope = await getTasksRoute(
      new Request('http://localhost/api/v1/tasks', { headers: { authorization: `Bearer ${token}` } })
    )
    expect(wrongScope.status).toBe(403)

    const { token: badToken } = await createApiKey(ctx, { name: 'Tasks reader', scopes: ['tasks:read'] })
    const ok = await getTasksRoute(
      new Request('http://localhost/api/v1/tasks', { headers: { authorization: `Bearer ${badToken}` } })
    )
    expect(ok.status).toBe(200)
    const body = (await ok.json()) as { data: unknown[]; meta: { total: number } }
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.meta.total).toBeGreaterThanOrEqual(0)

    const unknown = await getTasksRoute(
      new Request('http://localhost/api/v1/tasks', { headers: { authorization: 'Bearer rk_nope' } })
    )
    expect(unknown.status).toBe(401)
  })
})

describe('webhooks and the transactional outbox', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('rejects unsafe webhook URLs at creation', async () => {
    const ctx = await createContext('OWNER')
    await expect(
      createWebhookEndpoint(ctx, { url: 'http://127.0.0.1:3000/hook', events: ['task.completed'] })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      createWebhookEndpoint(ctx, { url: 'https://example.com/hook', events: [] })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('fans out events and delivers them signed', async () => {
    const ctx = await createContext('OWNER')
    const { endpoint, secret } = await createWebhookEndpoint(ctx, {
      url: 'https://example.com/hook',
      events: ['task.completed'],
    })
    expect(secret.startsWith('whsec_')).toBe(true)

    await enqueueEvent(prisma, {
      organizationId: ctx.organizationId,
      topic: 'task.completed',
      payload: { taskId: 't1' },
    })
    // An event no endpoint subscribes to must not create deliveries.
    await enqueueEvent(prisma, {
      organizationId: ctx.organizationId,
      topic: 'workflow.published',
      payload: { workflowId: 'w1' },
    })

    let capturedHeaders: Record<string, string> = {}
    let capturedBody = ''
    const result = await drainOutbox({
      fetchImpl: async (_url, init) => {
        capturedHeaders = (init.headers ?? {}) as Record<string, string>
        capturedBody = String(init.body ?? '')
        return new Response('', { status: 200 })
      },
    })

    expect(result.fannedOut).toBe(1)
    expect(result.delivered).toBe(1)
    expect(capturedHeaders['x-relay-event']).toBe('task.completed')
    expect(capturedHeaders['x-relay-signature']).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/)
    expect(capturedBody).toContain('taskId')

    const delivery = await prisma.webhookDelivery.findFirstOrThrow({
      where: { endpointId: endpoint.id },
    })
    expect(delivery.status).toBe('DELIVERED')
    expect(delivery.attempts).toBe(1)

    // Outbox events are marked processed so re-running does not duplicate.
    const second = await drainOutbox({ fetchImpl: async () => new Response('', { status: 200 }) })
    expect(second.fannedOut).toBe(0)
  })

  it('retries with backoff and eventually fails a delivery', async () => {
    const ctx = await createContext('OWNER')
    const { endpoint } = await createWebhookEndpoint(ctx, {
      url: 'https://example.com/failing',
      events: ['instance.started'],
    })
    await enqueueEvent(prisma, {
      organizationId: ctx.organizationId,
      topic: 'instance.started',
      payload: { instanceId: 'i1' },
    })

    const failing = async () => new Response('boom', { status: 500 })

    // Fan-out + first failing attempt.
    const first = await drainOutbox({ fetchImpl: failing })
    expect(first.fannedOut).toBe(1)
    expect(first.retried).toBe(1)

    let delivery = await prisma.webhookDelivery.findFirstOrThrow({ where: { endpointId: endpoint.id } })
    expect(delivery.status).toBe('PENDING')
    expect(delivery.attempts).toBe(1)
    expect(delivery.nextAttemptAt).not.toBeNull()

    // Drive it to exhaustion by advancing past the backoff each time.
    for (let i = 0; i < 6; i += 1) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { nextAttemptAt: new Date(Date.now() - 1000) },
      })
      await drainOutbox({ fetchImpl: failing })
      delivery = await prisma.webhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } })
    }

    expect(delivery.status).toBe('FAILED')
    const updatedEndpoint = await prisma.webhookEndpoint.findUniqueOrThrow({ where: { id: endpoint.id } })
    expect(updatedEndpoint.failureCount).toBeGreaterThanOrEqual(1)

    // Manual retry re-queues it.
    await retryDelivery(delivery.id, ctx.organizationId)
    const requeued = await prisma.webhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } })
    expect(requeued.status).toBe('PENDING')
    expect(requeued.attempts).toBe(0)
  })

  it('disables an endpoint after too many consecutive failures', async () => {
    const ctx = await createContext('OWNER')
    const { endpoint } = await createWebhookEndpoint(ctx, {
      url: 'https://example.com/dead',
      events: ['task.claimed'],
    })
    // Pretend it already failed 9 times, then one more exhausted delivery disables it.
    await prisma.webhookEndpoint.update({ where: { id: endpoint.id }, data: { failureCount: 9 } })
    await enqueueEvent(prisma, {
      organizationId: ctx.organizationId,
      topic: 'task.claimed',
      payload: { taskId: 't2' },
    })
    await drainOutbox({ fetchImpl: async () => new Response('nope', { status: 503 }) })

    const delivery = await prisma.webhookDelivery.findFirstOrThrow({ where: { endpointId: endpoint.id } })
    for (let i = 0; i < 6; i += 1) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { nextAttemptAt: new Date(Date.now() - 1000) },
      })
      await drainOutbox({ fetchImpl: async () => new Response('nope', { status: 503 }) })
    }

    const updated = await prisma.webhookEndpoint.findUniqueOrThrow({ where: { id: endpoint.id } })
    expect(updated.active).toBe(false)
    expect(updated.disabledAt).not.toBeNull()
  })

  it('lists endpoints and deliveries, and deletes an endpoint', async () => {
    const ctx = await createContext('OWNER')
    const { endpoint } = await createWebhookEndpoint(ctx, {
      url: 'https://example.com/list',
      events: ['task.completed'],
    })
    await enqueueEvent(prisma, {
      organizationId: ctx.organizationId,
      topic: 'task.completed',
      payload: { taskId: 't3' },
    })
    await drainOutbox({ fetchImpl: async () => new Response('', { status: 200 }) })

    const endpoints = await listWebhookEndpoints(ctx)
    expect(endpoints.some((row) => row.id === endpoint.id)).toBe(true)

    const deliveries = await listDeliveries(ctx)
    expect(deliveries.some((row) => row.endpoint.id === endpoint.id)).toBe(true)

    await deleteWebhookEndpoint(ctx, endpoint.id)
    expect(
      (await listWebhookEndpoints(ctx)).some((row) => row.id === endpoint.id)
    ).toBe(false)
  })
})
