import { createHmac } from 'node:crypto'
import type { Prisma } from '@/prisma/generated/prisma/client'
import { prisma } from '@/shared/lib/prisma'
import { logger } from '@/shared/server/logger'
import { checkOutboundUrl } from '@/shared/server/ssrf'

type Db = Prisma.TransactionClient | typeof prisma

export const WEBHOOK_EVENTS = [
  'task.created',
  'task.claimed',
  'task.completed',
  'task.decided',
  'instance.started',
  'instance.completed',
  'workflow.published',
] as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

const MAX_ATTEMPTS = 6
const REQUEST_TIMEOUT_MS = 8000
const DISABLE_AFTER_FAILURES = 10

export interface OutboxEventInput {
  organizationId: string
  topic: WebhookEvent
  payload: Prisma.InputJsonValue
}

/**
 * Writes a domain event to the transactional outbox. Call this inside the same
 * transaction as the mutation so an event can never be lost (or emitted for a
 * rolled-back change).
 */
export async function enqueueEvent(db: Db, input: OutboxEventInput) {
  return db.outboxEvent.create({
    data: { organizationId: input.organizationId, topic: input.topic, payload: input.payload },
  })
}

function backoffMs(attempts: number): number {
  return Math.min(2 ** attempts * 30_000, 60 * 60 * 1000)
}

export interface DeliveryAttemptResult {
  ok: boolean
  status?: number
  error?: string
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

/** Performs one signed HTTP delivery attempt. Exposed for testing. */
export async function attemptDelivery(
  delivery: { id: string; event: string; payload: unknown },
  endpoint: { url: string; secret: string },
  fetchImpl: FetchLike = fetch
): Promise<DeliveryAttemptResult> {
  const check = checkOutboundUrl(endpoint.url)
  if (!check.ok) return { ok: false, error: `Blocked: ${check.reason}` }

  const body = JSON.stringify({
    id: delivery.id,
    event: delivery.event,
    sentAt: new Date().toISOString(),
    data: delivery.payload,
  })
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = createHmac('sha256', endpoint.secret)
    .update(`${timestamp}.${body}`)
    .digest('hex')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetchImpl(endpoint.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-relay-event': delivery.event,
        'x-relay-delivery': delivery.id,
        'x-relay-timestamp': timestamp,
        'x-relay-signature': `t=${timestamp},v1=${signature}`,
      },
      body,
      signal: controller.signal,
      // Never follow redirects — prevents redirect-based SSRF.
      redirect: 'manual',
    })
    if (!response.ok) {
      return { ok: false, status: response.status, error: `HTTP ${response.status}` }
    }
    return { ok: true, status: response.status }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  } finally {
    clearTimeout(timeout)
  }
}

export interface DrainResult {
  fannedOut: number
  delivered: number
  retried: number
  failed: number
  disabledEndpoints: number
}

/**
 * Bounded, idempotent maintenance job:
 *  1. fans unprocessed outbox events out to subscribed webhook endpoints,
 *  2. attempts every due delivery with signed requests and exponential backoff.
 *
 * Safe to run repeatedly (fan-out is guarded by `processedAt`, deliveries carry
 * their own attempt state), so it tolerates missed or duplicated cron triggers.
 */
export async function drainOutbox(
  options: { fetchImpl?: FetchLike; now?: Date; limit?: number } = {}
): Promise<DrainResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? new Date()
  const limit = options.limit ?? 200

  const result: DrainResult = { fannedOut: 0, delivered: 0, retried: 0, failed: 0, disabledEndpoints: 0 }

  const events = await prisma.outboxEvent.findMany({
    where: { processedAt: null },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  for (const event of events) {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { organizationId: event.organizationId, active: true, events: { has: event.topic } },
      select: { id: true },
    })
    for (const endpoint of endpoints) {
      await prisma.webhookDelivery.create({
        data: {
          endpointId: endpoint.id,
          event: event.topic,
          payload: event.payload as Prisma.InputJsonValue,
          nextAttemptAt: now,
        },
      })
      result.fannedOut += 1
    }
    await prisma.outboxEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } })
  }

  const due = await prisma.webhookDelivery.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      nextAttemptAt: { lte: now },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: { endpoint: { select: { id: true, url: true, secret: true, failureCount: true, active: true } } },
  })

  for (const delivery of due) {
    if (!delivery.endpoint.active) continue

    const attempt = await attemptDelivery(
      { id: delivery.id, event: delivery.event, payload: delivery.payload },
      { url: delivery.endpoint.url, secret: delivery.endpoint.secret },
      fetchImpl
    )
    const attempts = delivery.attempts + 1

    if (attempt.ok) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'DELIVERED',
          attempts,
          responseCode: attempt.status ?? null,
          deliveredAt: new Date(),
          nextAttemptAt: null,
          error: null,
        },
      })
      if (delivery.endpoint.failureCount > 0) {
        await prisma.webhookEndpoint.update({
          where: { id: delivery.endpoint.id },
          data: { failureCount: 0 },
        })
      }
      result.delivered += 1
      continue
    }

    if (attempts >= MAX_ATTEMPTS) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'FAILED',
          attempts,
          responseCode: attempt.status ?? null,
          error: attempt.error ?? 'Delivery failed',
          nextAttemptAt: null,
        },
      })
      result.failed += 1

      const endpoint = await prisma.webhookEndpoint.update({
        where: { id: delivery.endpoint.id },
        data: { failureCount: { increment: 1 } },
        select: { failureCount: true },
      })
      if (endpoint.failureCount >= DISABLE_AFTER_FAILURES) {
        await prisma.webhookEndpoint.update({
          where: { id: delivery.endpoint.id },
          data: { active: false, disabledAt: new Date() },
        })
        result.disabledEndpoints += 1
        logger.warn('webhook_endpoint_disabled', { endpointId: delivery.endpoint.id })
      }
    } else {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'PENDING',
          attempts,
          responseCode: attempt.status ?? null,
          error: attempt.error ?? 'Delivery failed',
          nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
        },
      })
      result.retried += 1
    }
  }

  logger.info('outbox_drained', { ...result })
  return result
}

/** Immediately re-queues a failed delivery for the next drain. */
export async function retryDelivery(deliveryId: string, organizationId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findFirst({
    where: { id: deliveryId, endpoint: { organizationId } },
    select: { id: true },
  })
  if (!delivery) return
  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), error: null },
  })
}
