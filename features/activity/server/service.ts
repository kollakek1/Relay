import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { forbidden, notFound } from '@/shared/server/errors'
import { canWorkOnTasks } from '@/shared/server/permissions'
import { notify } from '@/features/notification/server/service'
import type { CreateCommentInput } from '../schemas/activitySchema'

export async function listComments(ctx: Context, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: ctx.organizationId },
    select: { id: true },
  })
  if (!task) throw notFound('Task not found')

  return prisma.comment.findMany({
    where: { taskId },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { id: true, name: true, image: true } } },
  })
}

/**
 * Adds a comment to a task. Writes the comment, an activity entry and (when the
 * task has an assignee other than the author) a notification in one transaction.
 */
export async function addComment(ctx: Context, input: CreateCommentInput) {
  if (!canWorkOnTasks(ctx.role)) throw forbidden('You cannot comment in this workspace')

  const task = await prisma.task.findFirst({
    where: { id: input.taskId, organizationId: ctx.organizationId },
    select: { id: true, name: true, assigneeId: true },
  })
  if (!task) throw notFound('Task not found')

  return prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: { taskId: task.id, authorId: ctx.userId, body: input.body },
      include: { author: { select: { id: true, name: true, image: true } } },
    })
    await tx.taskActivity.create({
      data: { taskId: task.id, actorId: ctx.userId, type: 'COMMENTED' },
    })

    if (task.assigneeId && task.assigneeId !== ctx.userId) {
      await notify(tx, {
        organizationId: ctx.organizationId,
        userId: task.assigneeId,
        type: 'TASK_COMMENTED',
        title: `New comment on "${task.name}"`,
        body: input.body.slice(0, 120),
        link: `/dashboard/tasks/${task.id}`,
      })
    }

    return comment
  })
}
