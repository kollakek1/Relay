import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'

/** Hard cap on export size — exports are synchronous serverless responses. */
export const MAX_EXPORT_ROWS = 5000

export interface ExportResult {
  csv: string
  rows: number
  truncated: boolean
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = value instanceof Date ? value.toISOString() : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header.join(','), ...rows.map((row) => row.map(csvCell).join(','))]
  return lines.join('\r\n')
}

export interface TaskExportFilters {
  status?: string
  assigneeId?: string
  search?: string
}

/** Tenant-scoped, bounded CSV export of tasks. */
export async function exportTasksCsv(ctx: Context, filters: TaskExportFilters = {}): Promise<ExportResult> {
  const where = {
    organizationId: ctx.organizationId,
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    ...(filters.search
      ? { name: { contains: filters.search, mode: 'insensitive' as const } }
      : {}),
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: MAX_EXPORT_ROWS + 1,
    include: {
      assignee: { select: { name: true, email: true } },
      instance: { select: { workflow: { select: { name: true } } } },
    },
  })

  const truncated = tasks.length > MAX_EXPORT_ROWS
  const rows = tasks.slice(0, MAX_EXPORT_ROWS)

  const csv = toCsv(
    ['id', 'name', 'status', 'priority', 'workflow', 'assignee', 'assignee_email', 'due_at', 'created_at', 'completed_at'],
    rows.map((t) => [
      t.id,
      t.name,
      t.status,
      t.priority,
      t.instance.workflow.name,
      t.assignee?.name ?? '',
      t.assignee?.email ?? '',
      t.dueAt,
      t.createdAt,
      t.completedAt,
    ])
  )

  return { csv, rows: rows.length, truncated }
}

/** Tenant-scoped, bounded CSV export of process instances. */
export async function exportInstancesCsv(ctx: Context): Promise<ExportResult> {
  const instances = await prisma.processInstance.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { startedAt: 'desc' },
    take: MAX_EXPORT_ROWS + 1,
    include: {
      workflow: { select: { name: true } },
      version: { select: { version: true } },
      startedBy: { select: { name: true, email: true } },
      _count: { select: { tasks: true } },
    },
  })

  const truncated = instances.length > MAX_EXPORT_ROWS
  const rows = instances.slice(0, MAX_EXPORT_ROWS)

  const csv = toCsv(
    ['id', 'workflow', 'version', 'status', 'tasks', 'started_by', 'started_by_email', 'started_at', 'completed_at'],
    rows.map((i) => [
      i.id,
      i.workflow.name,
      i.version.version,
      i.status,
      i._count.tasks,
      i.startedBy.name,
      i.startedBy.email,
      i.startedAt,
      i.completedAt,
    ])
  )

  return { csv, rows: rows.length, truncated }
}
