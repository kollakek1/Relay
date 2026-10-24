import { randomBytes } from 'node:crypto'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { forbidden, invalid, notFound } from '@/shared/server/errors'
import { canManageMembers } from '@/shared/server/permissions'
import { checkOutboundUrl } from '@/shared/server/ssrf'
import { recordAudit } from '@/features/organization/server/audit'
import { WEBHOOK_EVENTS, retryDelivery, type WebhookEvent } from './delivery'

function assertManage(ctx: Context) {
  if (!canManageMembers(ctx.role)) {
    throw forbidden('Managing webhooks requires the Admin role or higher')
  }
}

export { WEBHOOK_EVENTS }

export function isValidEvent(event: string): event is WebhookEvent {
  return (WEBHOOK_EVENTS as readonly string[]).includes(event)
}

export async function listWebhookEndpoints(ctx: Context) {
  assertManage(ctx)
  return prisma.webhookEndpoint.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { deliveries: true } } },
  })
}

export interface CreateWebhookInput {
  url: string
  events: string[]
}

/** Creates an endpoint; the signing secret is returned exactly once. */
export async function createWebhookEndpoint(ctx: Context, input: CreateWebhookInput) {
  assertManage(ctx)

  const check = checkOutboundUrl(input.url)
  if (!check.ok) throw invalid(check.reason)

  const events = input.events.filter(isValidEvent)
  if (events.length === 0) throw invalid('Select at least one event')

  const secret = `whsec_${randomBytes(24).toString('hex')}`

  return prisma.$transaction(async (tx) => {
    const endpoint = await tx.webhookEndpoint.create({
      data: {
        organizationId: ctx.organizationId,
        url: input.url,
        secret,
        events,
        createdById: ctx.userId,
      },
    })
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'webhook.created',
      targetType: 'webhook',
      targetId: endpoint.id,
      metadata: { url: endpoint.url, events },
    })
    return { endpoint, secret }
  })
}

export async function updateWebhookEndpoint(
  ctx: Context,
  input: { id: string; events?: string[]; active?: boolean }
) {
  assertManage(ctx)
  const existing = await prisma.webhookEndpoint.findFirst({
    where: { id: input.id, organizationId: ctx.organizationId },
    select: { id: true },
  })
  if (!existing) throw notFound('Webhook not found')

  const events = input.events ? input.events.filter(isValidEvent) : undefined

  return prisma.webhookEndpoint.update({
    where: { id: existing.id },
    data: {
      ...(events ? { events } : {}),
      ...(input.active === undefined
        ? {}
        : { active: input.active, disabledAt: input.active ? null : new Date(), failureCount: input.active ? 0 : undefined }),
    },
  })
}

export async function deleteWebhookEndpoint(ctx: Context, id: string) {
  assertManage(ctx)
  const existing = await prisma.webhookEndpoint.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { id: true },
  })
  if (!existing) throw notFound('Webhook not found')

  await prisma.$transaction(async (tx) => {
    await tx.webhookEndpoint.delete({ where: { id: existing.id } })
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'webhook.deleted',
      targetType: 'webhook',
      targetId: existing.id,
    })
  })
}

export async function listDeliveries(ctx: Context, limit = 50) {
  assertManage(ctx)
  return prisma.webhookDelivery.findMany({
    where: { endpoint: { organizationId: ctx.organizationId } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { endpoint: { select: { id: true, url: true } } },
  })
}

export async function retryDeliveryFor(ctx: Context, deliveryId: string) {
  assertManage(ctx)
  await retryDelivery(deliveryId, ctx.organizationId)
}

/**
 * Re-queues every failed (dead-lettered) delivery in the workspace so the next
 * drain retries it. Returns the number of deliveries requeued.
 */
export async function requeueFailedDeliveries(ctx: Context): Promise<number> {
  assertManage(ctx)
  const result = await prisma.webhookDelivery.updateMany({
    where: { endpoint: { organizationId: ctx.organizationId }, status: 'FAILED' },
    data: {
      status: 'PENDING',
      attempts: 0,
      nextAttemptAt: new Date(),
      error: null,
      lockedAt: null,
      lockedBy: null,
    },
  })
  return result.count
}
