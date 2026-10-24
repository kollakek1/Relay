import type { Prisma } from '@/prisma/generated/prisma/client'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { forbidden, invalid, notFound } from '@/shared/server/errors'
import { logger } from '@/shared/server/logger'
import { canManageMembers } from '@/shared/server/permissions'
import { notify } from '@/features/notification/server/service'
import { rolesAtLeast } from '@/features/task/server/approvals'
import { recordAudit } from '@/features/organization/server/audit'

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

interface EventLike {
  id: string
  organizationId: string
  topic: string
  payload: unknown
}

async function executeAction(
  rule: { id: string; name: string; action: string; config: unknown; createdById: string },
  event: EventLike
) {
  const config = asRecord(rule.config)
  const payload = asRecord(event.payload)

  switch (rule.action) {
    case 'notify_role': {
      const role = (config.role as (typeof AUTOMATION_ROLES)[number]) ?? 'MEMBER'
      const members = await prisma.membership.findMany({
        where: { organizationId: event.organizationId, role: { in: rolesAtLeast(role) } },
        select: { userId: true },
      })
      const title = String(config.title ?? `Automation: ${rule.name}`)
      const link = payload.taskId ? `/dashboard/tasks/${String(payload.taskId)}` : '/dashboard'
      for (const member of members) {
        await notify(prisma, {
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
      const task = await prisma.task.findFirst({
        where: { id: taskId, organizationId: event.organizationId },
        select: { id: true, tags: true },
      })
      if (!task) return 'skipped: task not found'
      const tag = String(config.tag)
      if (task.tags.includes(tag)) return 'skipped: tag already present'
      await prisma.task.update({ where: { id: task.id }, data: { tags: [...task.tags, tag] } })
      return `tagged "${tag}"`
    }

    case 'set_priority': {
      const taskId = String(payload.taskId ?? '')
      if (!taskId) return 'skipped: event has no task'
      const task = await prisma.task.findFirst({
        where: { id: taskId, organizationId: event.organizationId },
        select: { id: true },
      })
      if (!task) return 'skipped: task not found'
      await prisma.task.update({
        where: { id: task.id },
        data: { priority: config.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' },
      })
      return `priority set to ${String(config.priority)}`
    }

    case 'create_task': {
      const instanceId = String(payload.instanceId ?? '')
      if (!instanceId) return 'skipped: event has no instance'
      const instance = await prisma.processInstance.findFirst({
        where: { id: instanceId, organizationId: event.organizationId },
        select: { id: true },
      })
      if (!instance) return 'skipped: instance not found'

      const last = await prisma.task.findFirst({
        where: { instanceId },
        orderBy: { stepOrder: 'desc' },
        select: { stepOrder: true },
      })
      await prisma.task.create({
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
 * Runs every enabled rule matching the event's topic. Idempotent per (rule,
 * event): the AutomationRun row uses a unique key, so a repeated drain of the
 * same event never re-runs an action.
 */
export async function runAutomationsForEvent(event: EventLike): Promise<AutomationResult> {
  const rules = await prisma.automationRule.findMany({
    where: { organizationId: event.organizationId, enabled: true, trigger: event.topic },
  })

  const result: AutomationResult = { rules: rules.length, succeeded: 0, failed: 0, skipped: 0 }

  for (const rule of rules) {
    try {
      await prisma.automationRun.create({
        data: { ruleId: rule.id, eventId: event.id, status: 'PENDING' },
      })
    } catch (error) {
      // Unique violation → already ran for this event.
      if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002') {
        result.skipped += 1
        continue
      }
      throw error
    }

    try {
      const detail = await executeAction(rule, event)
      await prisma.automationRun.update({
        where: { ruleId_eventId: { ruleId: rule.id, eventId: event.id } },
        data: { status: 'SUCCESS', detail },
      })
      await prisma.automationRule.update({
        where: { id: rule.id },
        data: { lastRunAt: new Date() },
      })
      result.succeeded += 1
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      await prisma.automationRun.update({
        where: { ruleId_eventId: { ruleId: rule.id, eventId: event.id } },
        data: { status: 'FAILED', detail },
      })
      result.failed += 1
      logger.warn('automation_failed', { ruleId: rule.id, detail })
    }
  }

  return result
}
