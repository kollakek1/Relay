import { prisma } from '@/shared/lib/prisma'
import { claimIdempotencyKey } from '@/shared/server/idempotency'
import { logger } from '@/shared/server/logger'
import { pruneRateLimitBuckets } from '@/shared/server/rate-limit'
import { notify } from '@/features/notification/server/service'

const DUE_SOON_MS = 24 * 60 * 60 * 1000
const OVERDUE_TTL_MS = 24 * 60 * 60 * 1000
const DUE_SOON_TTL_MS = 36 * 60 * 60 * 1000
const MAX_SCAN = 500

export interface SlaScanResult {
  scanned: number
  overdueNotified: number
  dueSoonNotified: number
  prunedBuckets: number
}

/**
 * Scans for tasks that are overdue or due within 24h and notifies the right
 * people. Idempotent per (task, kind, day): re-running never double-notifies.
 *
 * Designed for a short, bounded serverless invocation — it processes at most
 * `MAX_SCAN` tasks and does no unbounded looping. Cross-tenant safe: every
 * notification carries the task's own `organizationId`.
 */
export async function runSlaScan(now = new Date()): Promise<SlaScanResult> {
  const dayKey = now.toISOString().slice(0, 10)
  const dueSoonUntil = new Date(now.getTime() + DUE_SOON_MS)

  const tasks = await prisma.task.findMany({
    where: {
      status: { notIn: ['DONE', 'CANCELLED'] },
      dueAt: { not: null, lte: dueSoonUntil },
    },
    select: {
      id: true,
      name: true,
      organizationId: true,
      assigneeId: true,
      dueAt: true,
      instance: { select: { workflow: { select: { name: true } } } },
    },
    orderBy: { dueAt: 'asc' },
    take: MAX_SCAN,
  })

  let overdueNotified = 0
  let dueSoonNotified = 0

  for (const task of tasks) {
    if (!task.dueAt) continue
    const overdue = task.dueAt.getTime() < now.getTime()
    const kind = overdue ? 'overdue' : 'duesoon'
    const ttl = overdue ? OVERDUE_TTL_MS : DUE_SOON_TTL_MS

    const claimed = await claimIdempotencyKey(`sla:${kind}:${task.id}:${dayKey}`, 'sla', ttl)
    if (!claimed) continue

    const recipients = await resolveRecipients(task.organizationId, task.assigneeId)
    for (const userId of recipients) {
      await notify(prisma, {
        organizationId: task.organizationId,
        userId,
        type: overdue ? 'TASK_OVERDUE' : 'TASK_DUE_SOON',
        title: overdue
          ? `Task "${task.name}" is overdue`
          : `Task "${task.name}" is due within 24 hours`,
        body: `Workflow: ${task.instance.workflow.name}`,
        link: `/dashboard/tasks/${task.id}`,
      })
    }

    if (overdue) overdueNotified += 1
    else dueSoonNotified += 1
  }

  const prunedBuckets = await pruneRateLimitBuckets()
  const result: SlaScanResult = {
    scanned: tasks.length,
    overdueNotified,
    dueSoonNotified,
    prunedBuckets,
  }
  logger.info('sla_scan_completed', {
    scanned: result.scanned,
    overdueNotified: result.overdueNotified,
    dueSoonNotified: result.dueSoonNotified,
    prunedBuckets: result.prunedBuckets,
  })
  return result
}

/** Unassigned tasks notify the workspace admins/owners instead of a person. */
async function resolveRecipients(organizationId: string, assigneeId: string | null) {
  if (assigneeId) return [assigneeId]
  const admins = await prisma.membership.findMany({
    where: { organizationId, role: { in: ['OWNER', 'ADMIN'] } },
    select: { userId: true },
  })
  return admins.map((membership) => membership.userId)
}
