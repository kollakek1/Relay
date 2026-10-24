import type { Prisma } from '@/prisma/generated/prisma/client'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { forbidden, invalid, notFound } from '@/shared/server/errors'
import { logger, newRequestId } from '@/shared/server/logger'
import { canManageMembers } from '@/shared/server/permissions'
import { DEFAULT_LEASE_MS, DEFAULT_MAX_ATTEMPTS, nextAttemptAt } from '@/shared/server/retry'
import { notify } from '@/features/notification/server/service'
import { rolesAtLeast } from '@/features/task/server/approvals'
import { recordAudit } from '@/features/organization/server/audit'

type Db = Prisma.TransactionClient | typeof prisma

export const AUTOMATION_TRIGGERS = [
  'task.created',
  'task.claimed',
  'task.completed',
  'task.decided',
  'instance.started',
  'instance.completed',
  'workflow.published',
] as const

export const AUTOMATION_ACTIONS = ['notify_role', 'add_tag', 'set_priority', 'create_task'] as const
export const AUTOMATION_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const
export const AUTOMATION_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number]
export type AutomationAction = (typeof AUTOMATION_ACTIONS)[number]

export function isTrigger(value: string): value is AutomationTrigger {
  return (AUTOMATION_TRIGGERS as readonly string[]).includes(value)
}
export function isAction(value: string): value is AutomationAction {
  return (AUTOMATION_ACTIONS as readonly string[]).includes(value)
}

const DETAIL_MAX = 300

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/** Validates an action's configuration; throws on anything unsupported. */
export function validateAutomationConfig(action: AutomationAction, config: unknown) {
  const c = asRecord(config)
  switch (action) {
    case 'notify_role': {
      const role = String(c.role ?? 'MEMBER')
      if (!(AUTOMATION_ROLES as readonly string[]).includes(role)) {
        throw invalid('notify_role requires role = OWNER | ADMIN | MEMBER')
      }
      return { role, title: c.title ? String(c.title).slice(0, 200) : null }
    }
    case 'add_tag': {
      const tag = String(c.tag ?? '').trim()
      if (!tag) throw invalid('add_tag requires a tag')
      return { tag: tag.slice(0, 40) }
    }
    case 'set_priority': {
      const priority = String(c.priority ?? '')
      if (!(AUTOMATION_PRIORITIES as readonly string[]).includes(priority)) {
        throw invalid('set_priority requires priority = LOW | MEDIUM | HIGH | URGENT')
      }
      return { priority }
    }
    case 'create_task': {
      const name = String(c.name ?? '').trim()
      if (!name) throw invalid('create_task requires a name')
      const assigneeRole = c.assigneeRole ? String(c.assigneeRole) : null
      if (assigneeRole && !(AUTOMATION_ROLES as readonly string[]).includes(assigneeRole)) {
        throw invalid('create_task assigneeRole must be OWNER | ADMIN | MEMBER')
      }
      return { name: name.slice(0, 120), assigneeRole }
    }
    default:
      throw invalid('Unsupported action')
  }
}

function assertManage(ctx: Context) {
  if (!canManageMembers(ctx.role)) {
    throw forbidden('Managing automations requires the Admin role or higher')
  }
}

export interface CreateAutomationInput {
  name: string
  trigger: string
  action: string
  config: unknown
}

export async function createAutomationRule(ctx: Context, input: CreateAutomationInput) {
  assertManage(ctx)
  if (!isTrigger(input.trigger)) throw invalid('Unknown trigger')
  if (!isAction(input.action)) throw invalid('Unknown action')

  const config = validateAutomationConfig(input.action, input.config)

  return prisma.$transaction(async (tx) => {
    const rule = await tx.automationRule.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        trigger: input.trigger,
        action: input.action,
        config: config as Prisma.InputJsonValue,
        createdById: ctx.userId,
      },
    })
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'automation.created',
      targetType: 'automation_rule',
      targetId: rule.id,
      metadata: { trigger: input.trigger, action: input.action },
    })
    return rule
  })
}

export async function listAutomationRules(ctx: Context) {
  assertManage(ctx)
  return prisma.automationRule.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { runs: true } } },
  })
}

export async function listAutomationRuns(ctx: Context, limit = 30) {
  assertManage(ctx)
  return prisma.automationRun.findMany({
    where: { rule: { organizationId: ctx.organizationId } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { rule: { select: { id: true, name: true } } },
  })
}

export interface AutomationHealth {
  pending: number
  processing: number
  succeeded: number
  failed: number
  deadLettered: number
}

/** Tenant-scoped automation diagnostics for the admin UI. */
export async function getAutomationHealth(ctx: Context): Promise<AutomationHealth> {
  assertManage(ctx)
  const grouped = await prisma.automationRun.groupBy({
    by: ['status'],
    where: { rule: { organizationId: ctx.organizationId } },
    _count: { _all: true },
  })
  const deadLettered = await prisma.automationRun.count({
    where: {
      rule: { organizationId: ctx.organizationId },
      status: 'FAILED',
      attempts: { gte: DEFAULT_MAX_ATTEMPTS },
    },
  })
  const count = (status: string) => grouped.find((row) => row.status === status)?._count._all ?? 0
  return {
    pending: count('PENDING'),
    processing: count('PROCESSING'),
    succeeded: count('SUCCESS'),
    failed: count('FAILED'),
    deadLettered,
  }
}

export async function setAutomationRuleEnabled(ctx: Context, id: string, enabled: boolean) {
  assertManage(ctx)
  const rule = await prisma.automationRule.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { id: true },
  })
  if (!rule) throw notFound('Automation rule not found')
  return prisma.automationRule.update({ where: { id: rule.id }, data: { enabled } })
}

export async function deleteAutomationRule(ctx: Context, id: string) {
  assertManage(ctx)
  const rule = await prisma.automationRule.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { id: true },
  })
  if (!rule) throw notFound('Automation rule not found')

  await prisma.$transaction(async (tx) => {
    await tx.automationRule.delete({ where: { id: rule.id } })
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'automation.deleted',
      targetType: 'automation_rule',
      targetId: rule.id,
    })
  })
}

/** Re-queues every dead-lettered / failed automation run in the workspace. */
export async function requeueFailedAutomationRuns(ctx: Context): Promise<number> {
  assertManage(ctx)
  const result = await prisma.automationRun.updateMany({
    where: { rule: { organizationId: ctx.organizationId }, status: 'FAILED' },
    data: {
      status: 'PENDING',
      attempts: 0,
      nextAttemptAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    },
  })
  return result.count
}

interface EventLike {
  id: string
  organizationId: string
  topic: string
  payload: unknown
}

async function executeAction(
  db: Db,
  rule: { id: string; name: string; action: string; config: unknown; createdById: string },
  event: EventLike
) {
  const config = asRecord(rule.config)
  const payload = asRecord(event.payload)

  switch (rule.action) {
    case 'notify_role': {
      const role = (config.role as (typeof AUTOMATION_ROLES)[number]) ?? 'MEMBER'
      const members = await db.membership.findMany({
        where: { organizationId: event.organizationId, role: { in: rolesAtLeast(role) } },
        select: { userId: true },
      })
      const title = String(config.title ?? `Automation: ${rule.name}`)
      const link = payload.taskId ? `/dashboard/tasks/${String(payload.taskId)}` : '/dashboard'
      for (const member of members) {
        await notify(db, {
          organizationId: event.organizationId,
          userId: member.userId,
          type: 'AUTOMATION_NOTIFICATION',
          title,
          body: `Triggered by ${event.topic}`,
          link,
        })
      }
      return `notified ${members.length} member(s)`
    }

    case 'add_tag': {
      const taskId = String(payload.taskId ?? '')
      if (!taskId) return 'skipped: event has no task'
      const task = await db.task.findFirst({
        where: { id: taskId, organizationId: event.organizationId },
        select: { id: true, tags: true },
      })
      if (!task) return 'skipped: task not found'
      const tag = String(config.tag)
      if (task.tags.includes(tag)) return 'skipped: tag already present'
      await db.task.update({ where: { id: task.id }, data: { tags: [...task.tags, tag] } })
      return `tagged "${tag}"`
    }

    case 'set_priority': {
      const taskId = String(payload.taskId ?? '')
      if (!taskId) return 'skipped: event has no task'
      const task = await db.task.findFirst({
        where: { id: taskId, organizationId: event.organizationId },
        select: { id: true },
      })
      if (!task) return 'skipped: task not found'
      await db.task.update({
        where: { id: task.id },
        data: { priority: config.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' },
      })
      return `priority set to ${String(config.priority)}`
    }

    case 'create_task': {
      const instanceId = String(payload.instanceId ?? '')
      if (!instanceId) return 'skipped: event has no instance'
      const instance = await db.processInstance.findFirst({
        where: { id: instanceId, organizationId: event.organizationId },
        select: { id: true },
      })
      if (!instance) return 'skipped: instance not found'

      // Idempotency: the follow-up task is keyed by (instance, name, creator) so
      // a retried attempt never creates a duplicate.
      const existing = await db.task.findFirst({
        where: {
          instanceId,
          name: String(config.name),
          createdById: rule.createdById,
          organizationId: event.organizationId,
        },
        select: { id: true },
      })
      if (existing) return 'task already exists'

      const last = await db.task.findFirst({
        where: { instanceId },
        orderBy: { stepOrder: 'desc' },
        select: { stepOrder: true },
      })
      await db.task.create({
        data: {
          organizationId: event.organizationId,
          instanceId,
          stepOrder: (last?.stepOrder ?? 0) + 1,
          name: String(config.name),
          status: 'PENDING',
          requiredRole: (config.assigneeRole as 'OWNER' | 'ADMIN' | 'MEMBER' | null) ?? null,
          createdById: rule.createdById,
        },
      })
      return 'task created'
    }

    default:
      return 'skipped: unsupported action'
  }
}

export interface AutomationResult {
  rules: number
  succeeded: number
  failed: number
  skipped: number
}

/**
 * Atomically claims a `(rule, event)` unit of work with a lease. Returns `true`
 * when this caller owns it; `false` when it already succeeded, is still being
 * processed by another worker, is not yet due, or is exhausted (dead-letter).
 * This is what makes concurrent drains safe.
 */
async function claimAutomationRun(
  ruleId: string,
  eventId: string,
  runId: string
): Promise<boolean> {
  try {
    await prisma.automationRun.create({
      data: {
        ruleId,
        eventId,
        status: 'PROCESSING',
        attempts: 1,
        lockedAt: new Date(),
        lockedBy: runId,
      },
    })
    return true
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
  }

  const leaseCutoff = new Date(Date.now() - DEFAULT_LEASE_MS)
  const claimed = await prisma.automationRun.updateMany({
    where: {
      ruleId,
      eventId,
      OR: [
        { status: 'PENDING' },
        { status: 'FAILED', attempts: { lt: DEFAULT_MAX_ATTEMPTS } },
        { status: 'PROCESSING', lockedAt: { lt: leaseCutoff } },
      ],
    },
    data: {
      status: 'PROCESSING',
      attempts: { increment: 1 },
      lockedAt: new Date(),
      lockedBy: runId,
    },
  })
  return claimed.count > 0
}

/** Runs one claimed automation inside a transaction so the action and its
 * status update commit atomically (a crash rolls both back and the lease
 * reclaims the run — no partially-applied side effect survives). */
async function runClaimedAutomation(
  rule: {
    id: string
    name: string
    action: string
    config: unknown
    createdById: string
  },
  event: EventLike
): Promise<{ ok: true } | { ok: false; attempts: number; message: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      const detail = await executeAction(tx, rule, event)
      await tx.automationRun.update({
        where: { ruleId_eventId: { ruleId: rule.id, eventId: event.id } },
        data: {
          status: 'SUCCESS',
          detail: detail.slice(0, DETAIL_MAX),
          nextAttemptAt: null,
          lockedAt: null,
          lockedBy: null,
        },
      })
      await tx.automationRule.update({
        where: { id: rule.id },
        data: { lastRunAt: new Date() },
      })
    })
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const run = await prisma.automationRun.findUnique({
      where: { ruleId_eventId: { ruleId: rule.id, eventId: event.id } },
      select: { attempts: true },
    })
    const attempts = run?.attempts ?? 1
    const exhausted = attempts >= DEFAULT_MAX_ATTEMPTS
    await prisma.automationRun.update({
      where: { ruleId_eventId: { ruleId: rule.id, eventId: event.id } },
      data: {
        status: 'FAILED',
        detail: message.slice(0, DETAIL_MAX),
        nextAttemptAt: exhausted ? null : nextAttemptAt(attempts),
        lockedAt: null,
        lockedBy: null,
      },
    })
    return { ok: false, attempts, message }
  }
}

/**
 * Runs every enabled rule matching the event's topic. Idempotent per
 * `(rule, event)`: the unique key plus the claim lease mean a repeated drain of
 * the same event never re-runs a completed action, while a *failed* action is
 * retried on a later drain (bounded by `DEFAULT_MAX_ATTEMPTS`).
 */
export async function dispatchAutomationsForEvent(
  event: EventLike,
  options: { runId?: string } = {}
): Promise<AutomationResult> {
  const runId = options.runId ?? newRequestId()

  const rules = await prisma.automationRule.findMany({
    where: { organizationId: event.organizationId, enabled: true, trigger: event.topic },
  })

  const result: AutomationResult = { rules: rules.length, succeeded: 0, failed: 0, skipped: 0 }

  for (const rule of rules) {
    const claimed = await claimAutomationRun(rule.id, event.id, runId)
    if (!claimed) {
      result.skipped += 1
      continue
    }

    const outcome = await runClaimedAutomation(rule, event)
    if (outcome.ok) {
      result.succeeded += 1
    } else {
      result.failed += 1
      logger.warn('automation_failed', {
        ruleId: rule.id,
        attempts: outcome.attempts,
        exhausted: outcome.attempts >= DEFAULT_MAX_ATTEMPTS,
        detail: outcome.message,
      })
    }
  }

  return result
}

/** Backwards-compatible alias for {@link dispatchAutomationsForEvent}. */
export function runAutomationsForEvent(event: EventLike): Promise<AutomationResult> {
  return dispatchAutomationsForEvent(event)
}

export interface AutomationRetryResult {
  retried: number
  recovered: number
  discarded: number
}

/**
 * Retries automation runs that failed or were abandoned by a crashed worker.
 * Called by the drain job after fan-out. Loads the originating outbox event so
 * the action can be replayed against the same payload.
 */
export async function runAutomationsForPendingEvents(
  options: { runId?: string; limit?: number } = {}
): Promise<AutomationRetryResult> {
  const runId = options.runId ?? newRequestId()
  const limit = options.limit ?? 100
  const now = new Date()
  const leaseCutoff = new Date(now.getTime() - DEFAULT_LEASE_MS)

  const candidates = await prisma.automationRun.findMany({
    where: {
      attempts: { lt: DEFAULT_MAX_ATTEMPTS },
      OR: [
        { status: 'PENDING', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { status: 'FAILED', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { status: 'PROCESSING', lockedAt: { lt: leaseCutoff } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { ruleId: true, eventId: true },
  })

  const result: AutomationRetryResult = { retried: 0, recovered: 0, discarded: 0 }

  for (const candidate of candidates) {
    const [rule, event] = await Promise.all([
      prisma.automationRule.findUnique({
        where: { id: candidate.ruleId },
        select: { id: true, name: true, action: true, config: true, createdById: true, enabled: true },
      }),
      prisma.outboxEvent.findUnique({
        where: { id: candidate.eventId },
        select: { id: true, organizationId: true, topic: true, payload: true },
      }),
    ])

    if (!rule || !event) {
      await prisma.automationRun.update({
        where: { ruleId_eventId: { ruleId: candidate.ruleId, eventId: candidate.eventId } },
        data: {
          status: 'FAILED',
          detail: !event ? 'Originating event no longer exists' : 'Automation rule was deleted',
          nextAttemptAt: null,
          lockedAt: null,
          lockedBy: null,
        },
      })
      result.discarded += 1
      continue
    }

    if (!rule.enabled) {
      await prisma.automationRun.update({
        where: { ruleId_eventId: { ruleId: candidate.ruleId, eventId: candidate.eventId } },
        data: { status: 'FAILED', detail: 'Rule disabled', nextAttemptAt: null, lockedAt: null, lockedBy: null },
      })
      result.discarded += 1
      continue
    }

    const claimed = await claimAutomationRun(rule.id, event.id, runId)
    if (!claimed) continue

    const outcome = await runClaimedAutomation(rule, event)
    result.retried += 1
    if (outcome.ok) result.recovered += 1
  }

  return result
}
