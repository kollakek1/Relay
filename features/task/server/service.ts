import type { Prisma, TaskPriority } from '@/prisma/generated/prisma/client'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { conflict, forbidden, invalid, notFound } from '@/shared/server/errors'
import { canManageWorkflows, hasOrgRole } from '@/shared/server/permissions'
import { DEFAULT_PAGE_SIZE } from '@/shared/server/context'
import type {
  AssignTaskInput,
  TaskQuery,
  TransitionTaskInput,
  UpdateTaskInput,
} from '../schemas/taskSchema'
import { canTransition } from './state-machine'
import { notify } from '@/features/notification/server/service'

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

/** Unassigned, claimable tasks in the organization. */
export async function listTaskPool(ctx: Context, query: TaskQuery): Promise<TaskPage> {
  return listTasks(ctx, { ...query, assignee: 'unassigned', status: 'PENDING' })
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
          version: { select: { version: true } },
          startedBy: { select: { id: true, name: true } },
        },
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { id: true, name: true, image: true } } },
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
      select: { id: true, status: true, assigneeId: true, requiredRole: true, name: true },
    })
    if (!task) throw notFound('Task not found')

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

  return prisma.$transaction(async (tx) => {
    const data: Prisma.TaskUncheckedUpdateInput = { status: input.to }
    if (input.to === 'DONE') data.completedAt = now
    if (input.to === 'PENDING') {
      data.assigneeId = null
      data.claimedAt = null
    }

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
 * Unblocks the next step after one completes, and closes the instance when the
 * last step is done.
 */
async function advanceInstance(
  tx: Prisma.TransactionClient,
  ctx: Context,
  instanceId: string,
  completedStepOrder: number
) {
  const next = await tx.task.findFirst({
    where: { instanceId, stepOrder: { gt: completedStepOrder }, status: 'BLOCKED' },
    orderBy: { stepOrder: 'asc' },
    select: { id: true },
  })

  if (next) {
    await tx.task.update({
      where: { id: next.id },
      data: { status: 'PENDING' },
    })
    await tx.taskActivity.create({
      data: { taskId: next.id, actorId: ctx.userId, type: 'STATUS_CHANGED', fromValue: 'BLOCKED', toValue: 'PENDING' },
    })
    return
  }

  const remaining = await tx.task.count({
    where: { instanceId, status: { notIn: ['DONE', 'CANCELLED'] } },
  })
  if (remaining === 0) {
    await tx.processInstance.update({
      where: { id: instanceId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
  }
}
