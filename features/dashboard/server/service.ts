import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'

export interface DashboardData {
  stats: {
    myTasks: number
    pendingPool: number
    completedToday: number
    activeInstances: number
    overdue: number
  }
  myOpenTasks: Awaited<ReturnType<typeof loadMyOpenTasks>>
  recentActivity: Awaited<ReturnType<typeof loadRecentActivity>>
}

function loadMyOpenTasks(organizationId: string, userId: string) {
  return prisma.task.findMany({
    where: {
      organizationId,
      assigneeId: userId,
      status: { in: ['CLAIMED', 'IN_PROGRESS'] },
    },
    orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: 6,
    select: {
      id: true,
      name: true,
      status: true,
      priority: true,
      dueAt: true,
      instance: { select: { workflow: { select: { name: true } } } },
    },
  })
}

function loadRecentActivity(organizationId: string) {
  return prisma.taskActivity.findMany({
    where: { task: { organizationId } },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      id: true,
      type: true,
      fromValue: true,
      toValue: true,
      createdAt: true,
      task: { select: { id: true, name: true } },
      actor: { select: { id: true, name: true } },
    },
  })
}

/** Aggregates real, tenant-scoped KPIs and feeds for the dashboard. */
export async function getDashboard(ctx: Context): Promise<DashboardData> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const now = new Date()

  const [myTasks, pendingPool, completedToday, activeInstances, overdue, myOpenTasks, recentActivity] =
    await prisma.$transaction([
      prisma.task.count({
        where: { organizationId: ctx.organizationId, assigneeId: ctx.userId, status: { in: ['CLAIMED', 'IN_PROGRESS'] } },
      }),
      prisma.task.count({
        where: { organizationId: ctx.organizationId, status: 'PENDING', assigneeId: null },
      }),
      prisma.task.count({
        where: {
          organizationId: ctx.organizationId,
          assigneeId: ctx.userId,
          status: 'DONE',
          completedAt: { gte: startOfDay },
        },
      }),
      prisma.processInstance.count({
        where: { organizationId: ctx.organizationId, status: 'RUNNING' },
      }),
      prisma.task.count({
        where: {
          organizationId: ctx.organizationId,
          assigneeId: ctx.userId,
          status: { notIn: ['DONE', 'CANCELLED'] },
          dueAt: { lt: now },
        },
      }),
      loadMyOpenTasks(ctx.organizationId, ctx.userId),
      loadRecentActivity(ctx.organizationId),
    ])

  return {
    stats: { myTasks, pendingPool, completedToday, activeInstances, overdue },
    myOpenTasks,
    recentActivity,
  }
}
