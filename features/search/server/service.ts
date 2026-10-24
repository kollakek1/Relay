import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'

export interface SearchResults {
  query: string
  workflows: Array<{ id: string; name: string; status: string }>
  tasks: Array<{ id: string; name: string; status: string; assignee: string | null }>
  instances: Array<{ id: string; workflowName: string; status: string }>
  members: Array<{ id: string; name: string; email: string }>
}

const PER_GROUP = 8

/**
 * Global, tenant-scoped search across the entities a member can see. Results are
 * capped per group and never leave the active organization.
 */
export async function searchAll(ctx: Context, rawQuery: string): Promise<SearchResults> {
  const query = rawQuery.trim()
  if (query.length < 2) {
    return { query, workflows: [], tasks: [], instances: [], members: [] }
  }

  const contains = { contains: query, mode: 'insensitive' as const }

  const [workflows, tasks, instances, members] = await Promise.all([
    prisma.workflow.findMany({
      where: {
        organizationId: ctx.organizationId,
        OR: [{ name: contains }, { description: contains }],
      },
      select: { id: true, name: true, status: true },
      orderBy: { updatedAt: 'desc' },
      take: PER_GROUP,
    }),
    prisma.task.findMany({
      where: {
        organizationId: ctx.organizationId,
        OR: [{ name: contains }, { description: contains }],
      },
      select: {
        id: true,
        name: true,
        status: true,
        assignee: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: PER_GROUP,
    }),
    prisma.processInstance.findMany({
      where: {
        organizationId: ctx.organizationId,
        workflow: { OR: [{ name: contains }, { description: contains }] },
      },
      select: {
        id: true,
        status: true,
        workflow: { select: { name: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: PER_GROUP,
    }),
    prisma.membership.findMany({
      where: {
        organizationId: ctx.organizationId,
        user: { OR: [{ name: contains }, { email: contains }] },
      },
      select: { id: true, user: { select: { id: true, name: true, email: true } } },
      take: PER_GROUP,
    }),
  ])

  return {
    query,
    workflows: workflows.map((w) => ({ id: w.id, name: w.name, status: w.status })),
    tasks: tasks.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      assignee: t.assignee?.name ?? null,
    })),
    instances: instances.map((i) => ({
      id: i.id,
      workflowName: i.workflow.name,
      status: i.status,
    })),
    members: members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email })),
  }
}
