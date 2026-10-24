import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'

export interface RangeFilter {
  /** Only include instances/tasks created on/after this date. */
  since?: Date
  workflowId?: string
}

export interface OverviewMetrics {
  instances: { total: number; running: number; completed: number; cancelled: number }
  tasks: { total: number; open: number; done: number; overdue: number; overdueRate: number }
  cycleTimeMs: { avg: number | null; median: number | null }
}

export interface WorkflowMetric {
  workflowId: string
  workflowName: string
  instances: number
  completed: number
  avgCycleTimeMs: number | null
  overdueRate: number
}

export interface StepBottleneck {
  stepOrder: number
  stepName: string
  samples: number
  avgDurationMs: number
  overdueRate: number
}

export interface Analytics {
  overview: OverviewMetrics
  workflows: WorkflowMetric[]
  bottlenecks: StepBottleneck[]
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
}

const MAX_SAMPLES = 2000

/**
 * Computes process analytics for the active organization.
 *
 * Aggregations are bounded (`MAX_SAMPLES`) and computed in JS over indexed,
 * tenant-scoped rows. This keeps the query plan simple and portable; if a tenant
 * outgrows the sample budget, the fix is a materialised rollup table, not a
 * heavier hot path (documented in the roadmap).
 */
export async function getAnalytics(ctx: Context, range: RangeFilter = {}): Promise<Analytics> {
  const dateFilter = range.since ? { gte: range.since } : undefined
  const instanceWhere = {
    organizationId: ctx.organizationId,
    ...(range.workflowId ? { workflowId: range.workflowId } : {}),
    ...(dateFilter ? { startedAt: dateFilter } : {}),
  }
  const taskWhere = {
    organizationId: ctx.organizationId,
    ...(range.workflowId ? { instance: { workflowId: range.workflowId } } : {}),
    ...(dateFilter ? { createdAt: dateFilter } : {}),
  }

  const now = new Date()

  const [instances, tasks] = await Promise.all([
    prisma.processInstance.findMany({
      where: instanceWhere,
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        workflow: { select: { id: true, name: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: MAX_SAMPLES,
    }),
    prisma.task.findMany({
      where: taskWhere,
      select: {
        id: true,
        status: true,
        stepOrder: true,
        name: true,
        createdAt: true,
        completedAt: true,
        dueAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_SAMPLES,
    }),
  ])

  const completed = instances.filter((i) => i.status === 'COMPLETED' && i.completedAt)
  const cycleTimes = completed.map((i) => i.completedAt!.getTime() - i.startedAt.getTime())

  const overdueTasks = tasks.filter(
    (t) => t.dueAt && t.dueAt < now && t.status !== 'DONE' && t.status !== 'CANCELLED'
  )

  const overview: OverviewMetrics = {
    instances: {
      total: instances.length,
      running: instances.filter((i) => i.status === 'RUNNING').length,
      completed: completed.length,
      cancelled: instances.filter((i) => i.status === 'CANCELLED').length,
    },
    tasks: {
      total: tasks.length,
      open: tasks.filter((t) => ['BLOCKED', 'PENDING', 'CLAIMED', 'IN_PROGRESS'].includes(t.status)).length,
      done: tasks.filter((t) => t.status === 'DONE').length,
      overdue: overdueTasks.length,
      overdueRate: tasks.length ? overdueTasks.length / tasks.length : 0,
    },
    cycleTimeMs: { avg: avg(cycleTimes), median: median(cycleTimes) },
  }

  // Per-workflow breakdown.
  const byWorkflow = new Map<string, { name: string; instances: typeof instances }>()
  for (const instance of instances) {
    const key = instance.workflow.id
    const entry = byWorkflow.get(key) ?? { name: instance.workflow.name, instances: [] }
    entry.instances.push(instance)
    byWorkflow.set(key, entry)
  }

  const workflows: WorkflowMetric[] = [...byWorkflow.entries()].map(([workflowId, entry]) => {
    const done = entry.instances.filter((i) => i.status === 'COMPLETED' && i.completedAt)
    const durations = done.map((i) => i.completedAt!.getTime() - i.startedAt.getTime())
    const relevantTasks = tasks.filter((t) => t.stepOrder >= 0) // tasks already scoped to org
    const overdue = relevantTasks.filter(
      (t) => t.dueAt && t.dueAt < now && t.status !== 'DONE' && t.status !== 'CANCELLED'
    ).length
    return {
      workflowId,
      workflowName: entry.name,
      instances: entry.instances.length,
      completed: done.length,
      avgCycleTimeMs: avg(durations),
      overdueRate: relevantTasks.length ? overdue / relevantTasks.length : 0,
    }
  })

  // Step bottlenecks (average time a task spends from creation to completion).
  const byStep = new Map<number, { name: string; durations: number[]; overdue: number; total: number }>()
  for (const task of tasks) {
    const entry = byStep.get(task.stepOrder) ?? {
      name: task.name,
      durations: [],
      overdue: 0,
      total: 0,
    }
    entry.total += 1
    if (task.dueAt && task.dueAt < now && task.status !== 'DONE' && task.status !== 'CANCELLED') {
      entry.overdue += 1
    }
    if (task.completedAt) entry.durations.push(task.completedAt.getTime() - task.createdAt.getTime())
    byStep.set(task.stepOrder, entry)
  }

  const bottlenecks: StepBottleneck[] = [...byStep.entries()]
    .map(([stepOrder, entry]) => ({
      stepOrder,
      stepName: entry.name,
      samples: entry.durations.length,
      avgDurationMs: avg(entry.durations) ?? 0,
      overdueRate: entry.total ? entry.overdue / entry.total : 0,
    }))
    .sort((a, b) => b.avgDurationMs - a.avgDurationMs)

  return { overview, workflows, bottlenecks }
}
