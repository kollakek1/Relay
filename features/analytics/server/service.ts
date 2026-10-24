import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'

export interface RangeFilter {
  /** Only include instances/tasks created on/after this date. */
  since?: Date
  workflowId?: string
}

export interface OverviewMetrics {
  instances: {
    total: number
    running: number
    completed: number
    cancelled: number
    /** completed / total, in [0, 1]; 0 when there are no instances. */
    completionRate: number
  }
  tasks: {
    total: number
    open: number
    done: number
    /** Tasks whose due date has passed and are not DONE/CANCELLED. */
    overdue: number
    /** overdue / total, in [0, 1]; 0 when there are no tasks. */
    overdueRate: number
  }
  /** Wall-clock time from instance start to completion (ms). */
  cycleTimeMs: { avg: number | null; median: number | null }
}

export interface WorkflowMetric {
  workflowId: string
  workflowName: string
  instances: number
  completed: number
  avgCycleTimeMs: number | null
  /** Overdue share of *this workflow's* tasks only. */
  overdueRate: number
}

export interface StepBottleneck {
  workflowId: string
  workflowName: string
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

const OVERDUE_STATUSES = new Set(['BLOCKED', 'PENDING', 'CLAIMED', 'IN_PROGRESS'])
const COMPLETED_STATUSES = new Set(['DONE', 'CANCELLED'])

/**
 * Computes process analytics for the active organization.
 *
 * Correctness notes (these were real defects, see
 * `docs/PRODUCTION_HARDENING.md` §P0-7):
 *  - every metric is scoped to the organization **and**, when supplied, the
 *    workflow;
 *  - a workflow's overdue rate uses only that workflow's tasks — never the whole
 *    organization's;
 *  - step bottlenecks are keyed by `(workflowId, stepOrder)` so two unrelated
 *    processes that happen to share step numbers are never merged.
 *
 * Aggregations are bounded (`MAX_SAMPLES`) and computed in JS over indexed,
 * tenant-scoped rows. If a tenant outgrows the sample budget the fix is a
 * materialised rollup table, not a heavier hot path.
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
        instance: { select: { workflowId: true, workflow: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_SAMPLES,
    }),
  ])

  const completedInstances = instances.filter((i) => i.status === 'COMPLETED' && i.completedAt)
  const cycleTimes = completedInstances.map((i) => i.completedAt!.getTime() - i.startedAt.getTime())

  const isOverdue = (task: { dueAt: Date | null; status: string }) =>
    Boolean(task.dueAt && task.dueAt < now && OVERDUE_STATUSES.has(task.status))

  const overdueTasks = tasks.filter(isOverdue)

  const overview: OverviewMetrics = {
    instances: {
      total: instances.length,
      running: instances.filter((i) => i.status === 'RUNNING').length,
      completed: completedInstances.length,
      cancelled: instances.filter((i) => i.status === 'CANCELLED').length,
      completionRate: instances.length ? completedInstances.length / instances.length : 0,
    },
    tasks: {
      total: tasks.length,
      open: tasks.filter((t) => OVERDUE_STATUSES.has(t.status)).length,
      done: tasks.filter((t) => t.status === 'DONE').length,
      overdue: overdueTasks.length,
      overdueRate: tasks.length ? overdueTasks.length / tasks.length : 0,
    },
    cycleTimeMs: { avg: avg(cycleTimes), median: median(cycleTimes) },
  }

  // Per-workflow breakdown — the workflow set is the union of the workflows that
  // appear in the sampled instances and tasks, so a workflow with tasks but no
  // sampled instance is still represented (with 0 instances).
  interface WorkflowBucket {
    name: string
    instances: typeof instances
    tasks: typeof tasks
  }
  const byWorkflow = new Map<string, WorkflowBucket>()
  const bucketFor = (workflowId: string, name: string): WorkflowBucket => {
    const existing = byWorkflow.get(workflowId)
    if (existing) return existing
    const created: WorkflowBucket = { name, instances: [], tasks: [] }
    byWorkflow.set(workflowId, created)
    return created
  }

  for (const instance of instances) {
    bucketFor(instance.workflow.id, instance.workflow.name).instances.push(instance)
  }
  for (const task of tasks) {
    bucketFor(task.instance.workflowId, task.instance.workflow.name).tasks.push(task)
  }

  const workflows: WorkflowMetric[] = [...byWorkflow.entries()].map(([workflowId, bucket]) => {
    const done = bucket.instances.filter((i) => i.status === 'COMPLETED' && i.completedAt)
    const durations = done.map((i) => i.completedAt!.getTime() - i.startedAt.getTime())
    const overdue = bucket.tasks.filter(isOverdue).length
    return {
      workflowId,
      workflowName: bucket.name,
      instances: bucket.instances.length,
      completed: done.length,
      avgCycleTimeMs: avg(durations),
      overdueRate: bucket.tasks.length ? overdue / bucket.tasks.length : 0,
    }
  })

  // Step bottlenecks, keyed by (workflowId, stepOrder) so unrelated processes
  // with the same step number are never conflated.
  interface StepBucket {
    workflowName: string
    stepOrder: number
    stepName: string
    durations: number[]
    overdue: number
    total: number
  }
  const byStep = new Map<string, StepBucket>()
  for (const task of tasks) {
    const workflowId = task.instance.workflowId
    const key = `${workflowId}::${task.stepOrder}`
    const bucket =
      byStep.get(key) ??
      ({
        workflowName: task.instance.workflow.name,
        stepOrder: task.stepOrder,
        stepName: task.name,
        durations: [],
        overdue: 0,
        total: 0,
      } satisfies StepBucket)

    bucket.total += 1
    if (isOverdue(task)) bucket.overdue += 1
    if (task.completedAt && COMPLETED_STATUSES.has(task.status)) {
      bucket.durations.push(task.completedAt.getTime() - task.createdAt.getTime())
    }
    byStep.set(key, bucket)
  }

  const bottlenecks: StepBottleneck[] = [...byStep.entries()]
    .map(([key, bucket]) => ({
      workflowId: key.slice(0, key.indexOf('::')),
      workflowName: bucket.workflowName,
      stepOrder: bucket.stepOrder,
      stepName: bucket.stepName,
      samples: bucket.durations.length,
      avgDurationMs: avg(bucket.durations) ?? 0,
      overdueRate: bucket.total ? bucket.overdue / bucket.total : 0,
    }))
    .sort((a, b) => b.avgDurationMs - a.avgDurationMs)

  return { overview, workflows, bottlenecks }
}