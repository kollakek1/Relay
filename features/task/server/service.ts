import type { Prisma, TaskPriority } from '@/prisma/generated/prisma/client'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { conflict, forbidden, invalid, notFound } from '@/shared/server/errors'
import { canManageWorkflows, canWorkOnTasks, hasOrgRole } from '@/shared/server/permissions'
import { DEFAULT_PAGE_SIZE } from '@/shared/server/context'
import type {
  AssignTaskInput,
  TaskQuery,
  TransitionTaskInput,
  UpdateTaskInput,
} from '../schemas/taskSchema'
import { canTransition, isTerminal } from './state-machine'
import { notify } from '@/features/notification/server/service'
import { collectVariables, evaluateCondition, normalizeFields, normalizeSnapshot, validateFormValues } from '@/features/workflow/server/engine'
import { eligibleApproverIds, notifyApprovers } from './approvals'
import { enqueueEvent } from '@/features/webhooks/server/delivery'
import type { ApprovalDecision } from '@/prisma/generated/prisma/client'

const listInclude = {
  assignee: { select: { id: true, name: true, image: true } },
  instance: {
    select: {
      id: true,
      status: true,
      workflow: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.TaskInclude

export type TaskListItem = Prisma.TaskGetPayload<{ include: typeof listInclude }>

export interface TaskPage {
  items: TaskListItem[]
  total: number
  page: number
  pageSize: number
}

function buildWhere(ctx: Context, query: TaskQuery): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = { organizationId: ctx.organizationId }
  const term = query.search?.trim()

  if (term) {
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } },
    ]
  }
  if (query.status) where.status = query.status
  if (query.kind) where.kind = query.kind
  if (query.priority) where.priority = query.priority

  if (query.assignee === 'me') {
    where.assigneeId = ctx.userId
  } else if (query.assignee === 'unassigned') {
    where.assigneeId = null
  }

  return where
}

export async function listTasks(ctx: Context, query: TaskQuery): Promise<TaskPage> {
  const page = query.page ?? 1
  const pageSize = DEFAULT_PAGE_SIZE
  const direction: Prisma.SortOrder = query.direction === 'asc' ? 'asc' : 'desc'

  const where = buildWhere(ctx, query)
  const orderBy: Prisma.TaskOrderByWithRelationInput[] =
    query.sort === 'dueAt'
      ? [{ dueAt: { sort: direction, nulls: 'last' } }]
      : query.sort === 'priority'
        ? [{ priority: direction }, { createdAt: 'desc' }]
        : [{ createdAt: direction }]

  const [items, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: listInclude,
    }),
    prisma.task.count({ where }),
  ])

  return { items, total, page, pageSize }
}

/** Unassigned, claimable tasks in the organization (approvals are decided, not claimed). */
export async function listTaskPool(ctx: Context, query: TaskQuery): Promise<TaskPage> {
  return listTasks(ctx, { ...query, assignee: 'unassigned', status: 'PENDING', kind: 'TASK' })
}

export async function getTask(ctx: Context, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: ctx.organizationId },
    include: {
      assignee: { select: { id: true, name: true, image: true } },
      createdBy: { select: { id: true, name: true } },
      instance: {
        include: {
          workflow: { select: { id: true, name: true } },
          version: { select: { version: true, steps: true } },
          startedBy: { select: { id: true, name: true } },
        },
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { id: true, name: true, image: true } } },
      },
      decisions: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true } } },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, name: true } } },
      },
    },
  })

  if (!task) throw notFound('Task not found')
  return task
}

/** Loads a task scoped to the tenant or throws NOT_FOUND (no cross-tenant leak). */
async function loadTask(ctx: Context, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: ctx.organizationId },
  })
  if (!task) throw notFound('Task not found')
  return task
}

function assertCanAct(ctx: Context, assigneeId: string | null) {
  const isAssignee = assigneeId === ctx.userId
  if (!isAssignee && !canManageWorkflows(ctx.role)) {
    throw forbidden('Only the assignee or an administrator can do this')
  }
}

/**
 * Atomically claims a free task from the pool.
 *
 * The claim is a single conditional `UPDATE ... WHERE status = 'PENDING' AND
 * assigneeId IS NULL`. Postgres serializes the row write, so when N requests
 * race exactly one update matches and the rest observe `count === 0` and get a
 * CONFLICT — no distributed lock required.
 */
export async function claimTask(ctx: Context, taskId: string) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.findFirst({
      where: { id: taskId, organizationId: ctx.organizationId },
      select: { id: true, status: true, assigneeId: true, requiredRole: true, name: true, kind: true },
    })
    if (!task) throw notFound('Task not found')

    if (task.kind === 'APPROVAL') {
      throw invalid('Approval steps are decided, not claimed')
    }

    if (task.requiredRole && !hasOrgRole(ctx.role, task.requiredRole)) {
      throw forbidden(`This task requires the ${task.requiredRole} role or higher`)
    }

    const updated = await tx.task.updateMany({
      where: { id: taskId, organizationId: ctx.organizationId, status: 'PENDING', assigneeId: null },
      data: {
        status: 'CLAIMED',
        assigneeId: ctx.userId,
        claimedAt: new Date(),
        claimVersion: { increment: 1 },
      },
    })

    if (updated.count === 0) {
      throw conflict('This task has already been taken')
    }

    await tx.taskActivity.create({
      data: { taskId, actorId: ctx.userId, type: 'CLAIMED', toValue: ctx.userId },
    })

    await enqueueEvent(tx, {
      organizationId: ctx.organizationId,
      topic: 'task.claimed',
      payload: { taskId, name: task.name, assigneeId: ctx.userId },
    })

    return tx.task.findUniqueOrThrow({ where: { id: taskId }, include: listInclude })
  })
}

/** Assigns (or unassigns) a task. Requires the Admin role. */
export async function assignTask(ctx: Context, input: AssignTaskInput) {
  if (!canManageWorkflows(ctx.role)) {
    throw forbidden('Assigning tasks requires the Admin role or higher')
  }

  const task = await loadTask(ctx, input.taskId)

  if (input.assigneeId === null) {
    await prisma.$transaction([
      prisma.task.update({
        where: { id: task.id },
        data: { assigneeId: null, status: 'PENDING', claimedAt: null },
      }),
      prisma.taskActivity.create({
        data: {
          taskId: task.id,
          actorId: ctx.userId,
          type: 'UNASSIGNED',
          fromValue: task.assigneeId,
        },
      }),
    ])
    return
  }

  const membership = await prisma.membership.findFirst({
    where: { organizationId: ctx.organizationId, userId: input.assigneeId },
    select: { userId: true },
  })
  if (!membership) throw invalid('The selected user is not a member of this organization')

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: { assigneeId: input.assigneeId, status: 'CLAIMED', claimedAt: new Date() },
    })
    await tx.taskActivity.create({
      data: {
        taskId: task.id,
        actorId: ctx.userId,
        type: 'ASSIGNED',
        fromValue: task.assigneeId,
        toValue: input.assigneeId,
      },
    })
    await notify(tx, {
      organizationId: ctx.organizationId,
      userId: input.assigneeId!,
      type: 'TASK_ASSIGNED',
      title: `You were assigned "${task.name}"`,
      body: 'A task was assigned to you.',
      link: `/dashboard/tasks/${task.id}`,
    })
  })
}

/** Updates mutable task attributes (priority, due date). */
export async function updateTask(ctx: Context, input: UpdateTaskInput) {
  const task = await loadTask(ctx, input.taskId)
  assertCanAct(ctx, task.assigneeId)

  const data: Prisma.TaskUncheckedUpdateInput = {}
  if (input.priority !== undefined) data.priority = input.priority as TaskPriority
  if (input.dueAt !== undefined) data.dueAt = input.dueAt

  await prisma.$transaction(async (tx) => {
    await tx.task.update({ where: { id: task.id }, data })
    if (input.dueAt !== undefined) {
      await tx.taskActivity.create({
        data: {
          taskId: task.id,
          actorId: ctx.userId,
          type: 'DUE_CHANGED',
          fromValue: task.dueAt?.toISOString() ?? null,
          toValue: input.dueAt?.toISOString() ?? null,
        },
      })
    }
  })
}

/**
 * Moves a task through the state machine, enforcing transitions and ownership.
 * Completing the final step of an instance closes the instance and unblocks the
 * next step otherwise.
 */
export async function transitionTask(ctx: Context, input: TransitionTaskInput) {
  const task = await loadTask(ctx, input.taskId)

  if (task.kind === 'APPROVAL' && input.to !== 'CANCELLED') {
    throw invalid('This is an approval step — record a decision instead')
  }

  if (!canTransition(task.status, input.to)) {
    throw invalid(`Cannot move a task from ${task.status} to ${input.to}`)
  }

  // Cancelling is an administrative action; every other transition belongs to
  // the assignee (or an admin).
  if (input.to === 'CANCELLED') {
    if (!canManageWorkflows(ctx.role)) {
      throw forbidden('Only an administrator can cancel a task')
    }
  } else {
    assertCanAct(ctx, task.assigneeId)
  }

  const now = new Date()

  const fields = normalizeFields(task.fields)
  let formValues: Prisma.InputJsonValue | undefined
  if (input.to === 'DONE' && fields.length > 0) {
    const validation = validateFormValues(fields, input.formValues)
    if (!validation.ok) {
      throw invalid(validation.errors[0] ?? 'Invalid form values')
    }
    formValues = validation.values as unknown as Prisma.InputJsonValue
  }

  return prisma.$transaction(async (tx) => {
    const data: Prisma.TaskUncheckedUpdateInput = { status: input.to }
    if (input.to === 'DONE') data.completedAt = now
    if (input.to === 'PENDING') {
      data.assigneeId = null
      data.claimedAt = null
    }
    if (input.to === 'CANCELLED') data.cancelReason = 'Cancelled by user'
    if (formValues) data.formValues = formValues

    await tx.task.update({ where: { id: task.id }, data })
    await tx.taskActivity.create({
      data: {
        taskId: task.id,
        actorId: ctx.userId,
        type: 'STATUS_CHANGED',
        fromValue: task.status,
        toValue: input.to,
      },
    })

    if (input.to === 'DONE') {
      await enqueueEvent(tx, {
        organizationId: ctx.organizationId,
        topic: 'task.completed',
        payload: { taskId: task.id, name: task.name, instanceId: task.instanceId },
      })
      await advanceInstance(tx, ctx, task.instanceId, task.stepOrder)

      const instance = await tx.processInstance.findUnique({
        where: { id: task.instanceId },
        select: { startedById: true },
      })
      if (instance && instance.startedById !== ctx.userId) {
        await notify(tx, {
          organizationId: ctx.organizationId,
          userId: instance.startedById,
          type: 'TASK_COMPLETED',
          title: `Task "${task.name}" was completed`,
          link: `/dashboard/tasks/${task.id}`,
        })
      }
    }

    return tx.task.findUniqueOrThrow({ where: { id: task.id }, include: listInclude })
  })
}

/**
 * Advances the pipeline after a step completes: collects process variables from
 * completed tasks, then activates the next step whose condition holds. Steps
 * whose condition is false are `CANCELLED` (skipped). Closes the instance when
 * no active step remains.
 */
async function advanceInstance(
  tx: Prisma.TransactionClient,
  ctx: Context,
  instanceId: string,
  completedStepOrder: number
) {
  const instance = await tx.processInstance.findUnique({
    where: { id: instanceId },
    select: { organizationId: true, version: { select: { steps: true } } },
  })
  const snapshot = normalizeSnapshot(instance?.version.steps)

  const doneTasks = await tx.task.findMany({
    where: { instanceId, status: 'DONE' },
    select: { formValues: true },
  })
  const variables = collectVariables(doneTasks)

  const remainingSteps = snapshot.steps
    .filter((step) => step.order > completedStepOrder)
    .sort((a, b) => a.order - b.order)

  for (const step of remainingSteps) {
    const task = await tx.task.findFirst({
      where: { instanceId, stepOrder: step.order },
      select: { id: true, status: true },
    })
    if (!task || task.status !== 'BLOCKED') continue

    if (evaluateCondition(step.condition, variables)) {
      await tx.task.update({ where: { id: task.id }, data: { status: 'PENDING' } })
      await tx.taskActivity.create({
        data: { taskId: task.id, actorId: ctx.userId, type: 'STATUS_CHANGED', fromValue: 'BLOCKED', toValue: 'PENDING' },
      })
      if (step.kind === 'APPROVAL') {
        await notifyApprovers(tx, {
          organizationId: ctx.organizationId,
          taskId: task.id,
          taskName: step.name,
          requiredRole: step.assigneeRole,
        })
      }
      return
    }

    await tx.task.update({
      where: { id: task.id },
      data: { status: 'CANCELLED', cancelReason: 'Skipped by condition' },
    })
    await tx.taskActivity.create({
      data: { taskId: task.id, actorId: ctx.userId, type: 'STATUS_CHANGED', fromValue: 'BLOCKED', toValue: 'CANCELLED' },
    })
  }

  const remaining = await tx.task.count({
    where: { instanceId, status: { notIn: ['DONE', 'CANCELLED'] } },
  })
  if (remaining === 0) {
    await tx.processInstance.update({
      where: { id: instanceId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
    await enqueueEvent(tx, {
      organizationId: instance?.organizationId ?? ctx.organizationId,
      topic: 'instance.completed',
      payload: { instanceId },
    })
  }
}

/** Cancels an instance and every still-open task on it. */
async function cancelInstance(
  tx: Prisma.TransactionClient,
  ctx: Context,
  instanceId: string,
  reason: string
) {
  const open = await tx.task.findMany({
    where: { instanceId, status: { notIn: ['DONE', 'CANCELLED'] } },
    select: { id: true, status: true },
  })
  for (const openTask of open) {
    await tx.task.update({
      where: { id: openTask.id },
      data: { status: 'CANCELLED', cancelReason: reason },
    })
    await tx.taskActivity.create({
      data: {
        taskId: openTask.id,
        actorId: ctx.userId,
        type: 'STATUS_CHANGED',
        fromValue: openTask.status,
        toValue: 'CANCELLED',
      },
    })
  }
  await tx.processInstance.update({
    where: { id: instanceId },
    data: { status: 'CANCELLED', completedAt: new Date() },
  })
}

export interface DecideTaskInput {
  taskId: string
  decision: ApprovalDecision
  note?: string
}

/**
 * Records an approval decision with explicit, documented resolution semantics:
 *
 * - `ANY` — a single decision resolves the step. `APPROVED` advances the
 *   pipeline; `REJECTED` cancels the instance; `CHANGES_REQUESTED` reopens the
 *   step for rework.
 * - `ALL` — every eligible approver must decide. Any `REJECTED` cancels the
 *   instance; the step is approved only when all eligible approvers approved;
 *   `CHANGES_REQUESTED` keeps the step open for a revised decision.
 */
export async function decideTask(ctx: Context, input: DecideTaskInput) {
  if (!canWorkOnTasks(ctx.role)) throw forbidden('You cannot decide in this workspace')

  return prisma.$transaction(async (tx) => {
    const task = await tx.task.findFirst({
      where: { id: input.taskId, organizationId: ctx.organizationId },
      include: {
        instance: {
          select: { id: true, startedById: true, version: { select: { steps: true } } },
        },
      },
    })
    if (!task) throw notFound('Task not found')
    if (task.kind !== 'APPROVAL') throw invalid('This task is not an approval step')
    if (isTerminal(task.status)) throw invalid('This approval has already been resolved')
    if (task.requiredRole && !hasOrgRole(ctx.role, task.requiredRole)) {
      throw forbidden(`This approval requires the ${task.requiredRole} role or higher`)
    }

    await tx.taskDecision.upsert({
      where: { taskId_userId: { taskId: task.id, userId: ctx.userId } },
      create: {
        taskId: task.id,
        userId: ctx.userId,
        decision: input.decision,
        note: input.note ?? null,
      },
      update: { decision: input.decision, note: input.note ?? null },
    })
    await tx.taskActivity.create({
      data: { taskId: task.id, actorId: ctx.userId, type: 'DECIDED', toValue: input.decision },
    })

    const snapshot = normalizeSnapshot(task.instance.version.steps)
    const step = snapshot.steps.find((candidate) => candidate.order === task.stepOrder)
    const mode = step?.approvalMode ?? 'ANY'

    // In ANY mode, a change request immediately reopens the step for rework.
    if (mode === 'ANY' && input.decision === 'CHANGES_REQUESTED') {
      await tx.task.update({
        where: { id: task.id },
        data: { status: 'PENDING', assigneeId: null, claimedAt: null },
      })
      await tx.taskActivity.create({
        data: {
          taskId: task.id,
          actorId: ctx.userId,
          type: 'STATUS_CHANGED',
          fromValue: task.status,
          toValue: 'PENDING',
        },
      })
      return tx.task.findUniqueOrThrow({ where: { id: task.id }, include: listInclude })
    }

    const decisions = await tx.taskDecision.findMany({ where: { taskId: task.id } })

    let resolved: ApprovalDecision | null = null
    if (mode === 'ANY') {
      resolved = input.decision
    } else {
      const approvers = await eligibleApproverIds(tx, ctx.organizationId, task.requiredRole)
      const decided = new Set(decisions.map((decision) => decision.userId))
      const anyRejected = decisions.some((decision) => decision.decision === 'REJECTED')
      const allDecided = approvers.length > 0 && approvers.every((id) => decided.has(id))
      const allApproved = decisions.length > 0 && decisions.every((d) => d.decision === 'APPROVED')
      if (anyRejected) resolved = 'REJECTED'
      else if (allDecided && allApproved) resolved = 'APPROVED'
    }

    if (!resolved) {
      return tx.task.findUniqueOrThrow({ where: { id: task.id }, include: listInclude })
    }

    await tx.task.update({
      where: { id: task.id },
      data: {
        status: 'DONE',
        decision: resolved,
        decisionNote: input.note ?? null,
        completedAt: new Date(),
      },
    })
    await tx.taskActivity.create({
      data: {
        taskId: task.id,
        actorId: ctx.userId,
        type: 'STATUS_CHANGED',
        fromValue: task.status,
        toValue: 'DONE',
      },
    })

    if (resolved === 'APPROVED') {
      await advanceInstance(tx, ctx, task.instanceId, task.stepOrder)
    } else {
      await cancelInstance(tx, ctx, task.instanceId, 'Rejected by approver')
    }

    await enqueueEvent(tx, {
      organizationId: ctx.organizationId,
      topic: 'task.decided',
      payload: { taskId: task.id, name: task.name, decision: resolved, instanceId: task.instanceId },
    })

    if (task.instance.startedById !== ctx.userId) {
      await notify(tx, {
        organizationId: ctx.organizationId,
        userId: task.instance.startedById,
        type: 'APPROVAL_DECIDED',
        title: `"${task.name}" was ${resolved === 'APPROVED' ? 'approved' : 'rejected'}`,
        link: `/dashboard/tasks/${task.id}`,
      })
    }

    return tx.task.findUniqueOrThrow({ where: { id: task.id }, include: listInclude })
  })
}
