import { createHmac } from 'node:crypto'
import type { Prisma } from '@/prisma/generated/prisma/client'
import { prisma } from '@/shared/lib/prisma'
import { logger, newRequestId } from '@/shared/server/logger'
import {
  DEFAULT_LEASE_MS,
  DEFAULT_MAX_ATTEMPTS,
  nextAttemptAt as computeNextAttempt,
} from '@/shared/server/retry'
import { checkOutboundUrl, safeFetch, type HostResolver } from '@/shared/server/ssrf'
import { dispatchAutomationsForEvent } from '@/features/automation/server/service'

type Db = Prisma.TransactionClient | typeof prisma

export const WEBHOOK_EVENTS = [
  'task.created',
  'task.claimed',
  'task.completed',
  'task.decided',
  'instance.started',
  'instance.completed',
  'instance.archived',
  'instance.restored',
  'workflow.published',
] as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

export const MAX_DELIVERY_ATTEMPTS = DEFAULT_MAX_ATTEMPTS

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
    data: {
      organizationId: input.organizationId,
      topic: input.topic,
      payload: input.payload,
      status: 'PENDING',
      nextAttemptAt: new Date(),
    },
  })
}

export interface DeliveryAttemptResult {
  ok: boolean
  status?: number
  error?: string
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export interface AttemptDeps {
  fetchImpl?: FetchLike
  resolver?: HostResolver
  timeoutMs?: number
}

/**
 * Performs one signed HTTP delivery attempt.
 *
 * The URL is always validated at the string level. When no custom `fetchImpl`
 * is supplied the request goes through {@link safeFetch}, which additionally
 * resolves the host and blocks private/reserved targets, never follows
 * redirects and bounds the response. Tests inject a `fetchImpl` to stay
 * hermetic (no network), which intentionally skips the resolve step.
 */
export async function attemptDelivery(
  delivery: { id: string; event: string; payload: unknown },
  endpoint: { url: string; secret: string },
  deps: AttemptDeps = {}
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

  const init: RequestInit = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-relay-event': delivery.event,
      'x-relay-delivery': delivery.id,
      'x-relay-timestamp': timestamp,
      'x-relay-signature': `t=${timestamp},v1=${signature}`,
    },
    body,
  }

  try {
    const response = deps.fetchImpl
      ? await deps.fetchImpl(endpoint.url, init)
      : await safeFetch(endpoint.url, init, {
          resolver: deps.resolver,
          timeoutMs: deps.timeoutMs ?? REQUEST_TIMEOUT_MS,
        })

    if (!response.ok) {
      return { ok: false, status: response.status, error: `HTTP ${response.status}` }
    }
    return { ok: true, status: response.status }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export interface DrainResult {
  fannedOut: number
  processed: number
  delivered: number
  retried: number
  failed: number
  deadLettered: number
  disabledEndpoints: number
  automationsRun: number
  automationsFailed: number
}

interface ClaimedEvent {
  id: string
  organizationId: string
  topic: string
  payload: unknown
  attempts: number
}

interface ClaimedDelivery {
  id: string
  endpointId: string
  eventId: string | null
  event: string
  payload: unknown
  attempts: number
}

/**
 * Atomically claims up to `limit` due outbox events with `FOR UPDATE SKIP
 * LOCKED` and a lease. Rows already `PROCESSING` whose lease expired are
 * reclaimed (crash recovery). Concurrency-safe by construction.
 */
async function claimOutboxEvents(runId: string, limit: number): Promise<ClaimedEvent[]> {
  return prisma.$queryRaw<ClaimedEvent[]>`
    UPDATE "outbox_event" AS e
    SET "status" = 'PROCESSING', "attempts" = e."attempts" + 1, "lockedAt" = now(), "lockedBy" = ${runId}
    WHERE e."id" IN (
      SELECT "id" FROM "outbox_event"
      WHERE (
        ("status" = 'PENDING' AND "attempts" < ${DEFAULT_MAX_ATTEMPTS}
          AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= now()))
        OR ("status" = 'PROCESSING' AND "lockedAt" < now() - (${DEFAULT_LEASE_MS}::int * interval '1 millisecond'))
      )
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING e."id", e."organizationId", e."topic", e."payload", e."attempts"
  `
}

async function claimDeliveries(runId: string, limit: number): Promise<ClaimedDelivery[]> {
  return prisma.$queryRaw<ClaimedDelivery[]>`
    UPDATE "webhook_delivery" AS d
    SET "status" = 'PROCESSING', "lockedAt" = now(), "lockedBy" = ${runId}
    WHERE d."id" IN (
      SELECT "id" FROM "webhook_delivery"
      WHERE (
        ("status" IN ('PENDING', 'FAILED') AND "attempts" < ${DEFAULT_MAX_ATTEMPTS}
          AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= now()))
        OR ("status" = 'PROCESSING' AND "lockedAt" < now() - (${DEFAULT_LEASE_MS}::int * interval '1 millisecond'))
      )
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING d."id", d."endpointId", d."eventId", d."event", d."payload", d."attempts"
  `
}

/** Marks exhausted `PENDING` events as dead-letter so they stop being retried. */
async function deadLetterExhaustedEvents(): Promise<number> {
  const result = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "outbox_event"
    SET "status" = 'FAILED',
        "lastError" = COALESCE("lastError", 'Exceeded the maximum number of attempts'),
        "nextAttemptAt" = NULL,
        "lockedAt" = NULL,
        "lockedBy" = NULL
    WHERE "status" = 'PENDING' AND "attempts" >= ${DEFAULT_MAX_ATTEMPTS}
    RETURNING "id"
  `
  return result.length
}

/**
 * Bounded, crash-safe maintenance job:
 *  1. claims and processes unprocessed outbox events (fan-out + automations),
 *  2. claims and attempts due webhook deliveries with signed requests.
 *
 * Safe to run concurrently: claiming uses `FOR UPDATE SKIP LOCKED` + leases, so
 * two overlapping drains never process the same row. Delivery is
 * **at-least-once**; fan-out idempotency comes from the unique
 * `(endpointId, eventId)` index.
 */
export async function drainOutbox(
  options: {
    fetchImpl?: FetchLike
    resolver?: HostResolver
    now?: Date
    limit?: number
    runId?: string
    maxEvents?: number
  } = {}
): Promise<DrainResult> {
  const now = options.now ?? new Date()
  const limit = options.limit ?? 200
  const runId = options.runId ?? newRequestId()

  const result: DrainResult = {
    fannedOut: 0,
    processed: 0,
    delivered: 0,
    retried: 0,
    failed: 0,
    deadLettered: 0,
    disabledEndpoints: 0,
    automationsRun: 0,
    automationsFailed: 0,
  }

  result.deadLettered += await deadLetterExhaustedEvents()

  // --- 1. Outbox fan-out + automation dispatch -------------------------------
  const events = await claimOutboxEvents(runId, options.maxEvents ?? limit)

  for (const event of events) {
    try {
      const endpoints = await prisma.webhookEndpoint.findMany({
        where: {
          organizationId: event.organizationId,
          active: true,
          events: { has: event.topic },
        },
        select: { id: true },
      })
      if (endpoints.length > 0) {
        const created = await prisma.webhookDelivery.createMany({
          data: endpoints.map((endpoint) => ({
            endpointId: endpoint.id,
            eventId: event.id,
            event: event.topic,
            payload: event.payload as Prisma.InputJsonValue,
            nextAttemptAt: now,
          })),
          skipDuplicates: true,
        })
        result.fannedOut += created.count
      }

      const automation = await dispatchAutomationsForEvent(
        {
          id: event.id,
          organizationId: event.organizationId,
          topic: event.topic,
          payload: event.payload,
        },
        { runId }
      )
      result.automationsRun += automation.succeeded
      result.automationsFailed += automation.failed

      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'PROCESSED',
          processedAt: now,
          nextAttemptAt: null,
          lockedAt: null,
          lockedBy: null,
          lastError: null,
        },
      })
      result.processed += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const exhausted = event.attempts >= DEFAULT_MAX_ATTEMPTS
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          lastError: message,
          nextAttemptAt: exhausted ? null : computeNextAttempt(event.attempts, now),
          lockedAt: null,
          lockedBy: null,
        },
      })
      if (exhausted) result.deadLettered += 1
      else result.retried += 1
      logger.warn('outbox_event_failed', {
        eventId: event.id,
        attempts: event.attempts,
        exhausted,
        message,
      })
    }
  }

  // --- 2. Webhook delivery attempts ------------------------------------------
  const deliveries = await claimDeliveries(runId, limit)

  for (const delivery of deliveries) {
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { id: delivery.endpointId },
      select: { id: true, url: true, secret: true, failureCount: true, active: true },
    })

    if (!endpoint || !endpoint.active) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'FAILED',
          error: endpoint ? 'Endpoint is disabled' : 'Endpoint no longer exists',
          nextAttemptAt: null,
          lockedAt: null,
          lockedBy: null,
        },
      })
      result.failed += 1
      continue
    }

    const attempt = await attemptDelivery(
      { id: delivery.id, event: delivery.event, payload: delivery.payload },
      { url: endpoint.url, secret: endpoint.secret },
      { fetchImpl: options.fetchImpl, resolver: options.resolver }
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
          lockedAt: null,
          lockedBy: null,
          error: null,
        },
      })
      if (endpoint.failureCount > 0) {
        await prisma.webhookEndpoint.update({
          where: { id: endpoint.id },
          data: { failureCount: 0 },
        })
      }
      result.delivered += 1
      continue
    }

    if (attempts >= DEFAULT_MAX_ATTEMPTS) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'FAILED',
          attempts,
          responseCode: attempt.status ?? null,
          error: attempt.error ?? 'Delivery failed',
          nextAttemptAt: null,
          lockedAt: null,
          lockedBy: null,
        },
      })
      result.failed += 1

      const endpointAfter = await prisma.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: { failureCount: { increment: 1 } },
        select: { failureCount: true },
      })
      if (endpointAfter.failureCount >= DISABLE_AFTER_FAILURES) {
        await prisma.webhookEndpoint.update({
          where: { id: endpoint.id },
          data: { active: false, disabledAt: new Date() },
        })
        result.disabledEndpoints += 1
        logger.warn('webhook_endpoint_disabled', { endpointId: endpoint.id })
      }
    } else {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'PENDING',
          attempts,
          responseCode: attempt.status ?? null,
          error: attempt.error ?? 'Delivery failed',
          nextAttemptAt: computeNextAttempt(attempts, now),
          lockedAt: null,
          lockedBy: null,
        },
      })
      result.retried += 1
    }
  }

  logger.info('outbox_drained', { runId, ...result })
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
    data: {
      status: 'PENDING',
      attempts: 0,
      nextAttemptAt: new Date(),
      error: null,
      lockedAt: null,
      lockedBy: null,
    },
  })
}

export interface OutboxHealth {
  pending: number
  processing: number
  processed: number
  failed: number
  oldestPendingAt: Date | null
}

/** Tenant-scoped outbox diagnostics for the admin UI. */
export async function getOutboxHealth(organizationId: string): Promise<OutboxHealth> {
  const [grouped, oldest] = await Promise.all([
    prisma.outboxEvent.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.outboxEvent.findFirst({
      where: { organizationId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ])

  const count = (status: string) =>
    grouped.find((row) => row.status === status)?._count._all ?? 0

  return {
    pending: count('PENDING'),
    processing: count('PROCESSING'),
    processed: count('PROCESSED'),
    failed: count('FAILED'),
    oldestPendingAt: oldest?.createdAt ?? null,
  }
}

/** Re-queues a dead-lettered outbox event so its side effects run again. */
export async function requeueOutboxEvent(eventId: string, organizationId: string): Promise<boolean> {
  const updated = await prisma.outboxEvent.updateMany({
    where: { id: eventId, organizationId, status: 'FAILED' },
    data: {
      status: 'PENDING',
      attempts: 0,
      nextAttemptAt: new Date(),
      lastError: null,
      lockedAt: null,
      lockedBy: null,
    },
  })
  return updated.count > 0
}
