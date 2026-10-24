import type { Prisma, NotificationType } from '@/prisma/generated/prisma/client'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'

type Db = Prisma.TransactionClient | typeof prisma

export interface NotifyInput {
  organizationId: string
  userId: string
  type: NotificationType
  title: string
  body?: string | null
  link?: string | null
}

/**
 * Creates an in-app notification. Accepts a transaction client so callers can
 * persist the notification atomically with the mutation that triggered it.
 * Never notifies the acting user about their own action.
 */
export async function notify(db: Db, input: NotifyInput) {
  return db.notification.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    },
  })
}

export async function listNotifications(ctx: Context, limit = 30) {
  return prisma.notification.findMany({
    where: { userId: ctx.userId, organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function getUnreadCount(ctx: Context): Promise<number> {
  return prisma.notification.count({
    where: { userId: ctx.userId, organizationId: ctx.organizationId, readAt: null },
  })
}

/** Marks the given notifications (or every unread one) as read, tenant-scoped. */
export async function markNotificationsRead(ctx: Context, ids?: string[]) {
  const result = await prisma.notification.updateMany({
    where: {
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      readAt: null,
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  })
  return result.count
}
