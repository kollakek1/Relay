import type { Prisma } from '@/prisma/generated/prisma/client'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { invalid, notFound } from '@/shared/server/errors'
import { assertCan } from '@/shared/server/permissions'
import { normalizeSnapshot, type ProcessSnapshot } from './engine'

export type StepChangeStatus = 'added' | 'removed' | 'changed' | 'same'

export interface StepDiff {
  order: number
  name: string
  status: StepChangeStatus
  changes: string[]
}

function describeChange(label: string, from: unknown, to: unknown): string | null {
  const a = typeof from === 'object' ? JSON.stringify(from) : String(from ?? '—')
  const b = typeof to === 'object' ? JSON.stringify(to) : String(to ?? '—')
  return a === b ? null : `${label}: ${a} → ${b}`
}

/** Pure structural diff of two published snapshots, keyed by step order. */
export function diffSnapshots(from: ProcessSnapshot, to: ProcessSnapshot): StepDiff[] {
  const maxOrder = Math.max(0, ...from.steps.map((step) => step.order), ...to.steps.map((step) => step.order))
  const diffs: StepDiff[] = []

  for (let order = 1; order <= maxOrder; order += 1) {
    const a = from.steps.find((step) => step.order === order)
    const b = to.steps.find((step) => step.order === order)

    if (!a && b) {
      diffs.push({ order, name: b.name, status: 'added', changes: ['New step'] })
      continue
    }
    if (a && !b) {
      diffs.push({ order, name: a.name, status: 'removed', changes: ['Step removed'] })
      continue
    }
    if (!a || !b) continue

    const changes = [
      describeChange('Name', a.name, b.name),
      describeChange('Description', a.description, b.description),
      describeChange('Assignee role', a.assigneeRole, b.assigneeRole),
      describeChange('Due (days)', a.dueInDays, b.dueInDays),
      describeChange('Type', a.kind, b.kind),
      describeChange('Approval rule', a.approvalMode, b.approvalMode),
      describeChange('Form fields', a.fields, b.fields),
      describeChange('Condition', a.condition, b.condition),
    ].filter((change): change is string => change !== null)

    diffs.push({ order, name: b.name, status: changes.length > 0 ? 'changed' : 'same', changes })
  }

  return diffs
}

export async function listVersions(ctx: Context, workflowId: string) {
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, organizationId: ctx.organizationId },
    select: { id: true },
  })
  if (!workflow) throw notFound('Workflow not found')

  return prisma.workflowVersion.findMany({
    where: { workflowId },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      publishedAt: true,
      publishedBy: { select: { name: true } },
      _count: { select: { instances: true } },
    },
  })
}

export async function compareVersions(
  ctx: Context,
  workflowId: string,
  fromVersion: number,
  toVersion: number
) {
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, organizationId: ctx.organizationId },
    select: { id: true },
  })
  if (!workflow) throw notFound('Workflow not found')

  const versions = await prisma.workflowVersion.findMany({
    where: { workflowId, version: { in: [fromVersion, toVersion] } },
  })
  const from = versions.find((version) => version.version === fromVersion)
  const to = versions.find((version) => version.version === toVersion)
  if (!from || !to) throw notFound('One of the versions was not found')

  return {
    from: fromVersion,
    to: toVersion,
    diffs: diffSnapshots(normalizeSnapshot(from.steps), normalizeSnapshot(to.steps)),
  }
}

/**
 * Replaces the draft with the frozen steps of a published version, so a team can
 * iterate on an earlier definition without losing history.
 */
export async function createDraftFromVersion(ctx: Context, workflowId: string, version: number) {
  assertCan(ctx, 'workflow.edit', 'Editing workflows requires the Admin role or higher')

  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, organizationId: ctx.organizationId },
    select: { id: true, status: true },
  })
  if (!workflow) throw notFound('Workflow not found')
  if (workflow.status === 'ARCHIVED') throw invalid('Archived workflows cannot be edited')

  const source = await prisma.workflowVersion.findUnique({
    where: { workflowId_version: { workflowId, version } },
  })
  if (!source) throw notFound('Version not found')

  const snapshot = normalizeSnapshot(source.steps).steps

  return prisma.$transaction(async (tx) => {
    await tx.workflowStep.deleteMany({ where: { workflowId } })
    await tx.workflowStep.createMany({
      data: snapshot.map((step) => ({
        workflowId,
        order: step.order,
        name: step.name,
        description: step.description,
        assigneeRole: step.assigneeRole,
        dueInDays: step.dueInDays,
        kind: step.kind,
        approvalMode: step.approvalMode,
        fields: step.fields.length > 0 ? (step.fields as unknown as Prisma.InputJsonValue) : undefined,
        condition: step.condition ? (step.condition as unknown as Prisma.InputJsonValue) : undefined,
      })),
    })
    return { id: workflowId }
  })
}
