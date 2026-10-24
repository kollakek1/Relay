import type { Prisma } from '@/prisma/generated/prisma/client'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { conflict, forbidden, invalid, notFound } from '@/shared/server/errors'
import { canManageWorkflows } from '@/shared/server/permissions'
import type {
  CreateWorkflowInput,
  SaveWorkflowInput,
} from '../schemas/workflowSchema'
import { buildStepSnapshot, validateForPublish, type SnapshotStep } from './validation'

const workflowListSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { steps: true, versions: true, instances: true } },
} satisfies Prisma.WorkflowSelect

export type WorkflowListItem = Prisma.WorkflowGetPayload<{ select: typeof workflowListSelect }>

function assertManage(ctx: Context) {
  if (!canManageWorkflows(ctx.role)) {
    throw forbidden('Managing workflows requires the Admin role or higher')
  }
}

export async function listWorkflows(ctx: Context, search?: string): Promise<WorkflowListItem[]> {
  const term = search?.trim()
  return prisma.workflow.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { description: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    select: workflowListSelect,
  })
}

export async function getWorkflow(ctx: Context, workflowId: string) {
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, organizationId: ctx.organizationId },
    include: {
      steps: { orderBy: { order: 'asc' } },
      versions: { orderBy: { version: 'desc' } },
      _count: { select: { instances: true } },
    },
  })

  if (!workflow) throw notFound('Workflow not found')
  return workflow
}

export async function createWorkflow(ctx: Context, input: CreateWorkflowInput) {
  assertManage(ctx)
  return prisma.workflow.create({
    data: {
      organizationId: ctx.organizationId,
      name: input.name,
      description: input.description ?? null,
      createdById: ctx.userId,
      status: 'DRAFT',
      steps: {
        create: {
          order: 1,
          name: 'First step',
          description: null,
        },
      },
    },
    select: { id: true },
  })
}

/**
 * Replaces the draft metadata and steps. Instances already running reference an
 * immutable `WorkflowVersion`, so editing the draft never mutates a running
 * process. Archived workflows are read-only.
 */
export async function saveWorkflowDraft(ctx: Context, input: SaveWorkflowInput) {
  assertManage(ctx)

  const workflow = await prisma.workflow.findFirst({
    where: { id: input.workflowId, organizationId: ctx.organizationId },
    select: { id: true, status: true },
  })
  if (!workflow) throw notFound('Workflow not found')
  if (workflow.status === 'ARCHIVED') {
    throw invalid('Archived workflows cannot be edited')
  }

  const snapshot = buildStepSnapshot(input.steps)

  return prisma.$transaction(async (tx) => {
    await tx.workflowStep.deleteMany({ where: { workflowId: workflow.id } })
    await tx.workflowStep.createMany({
      data: snapshot.map((step) => ({
        workflowId: workflow.id,
        order: step.order,
        name: step.name,
        description: step.description,
        assigneeRole: step.assigneeRole,
        dueInDays: step.dueInDays,
      })),
    })
    await tx.workflow.update({
      where: { id: workflow.id },
      data: { name: input.name, description: input.description ?? null },
    })
    return tx.workflow.findUniqueOrThrow({
      where: { id: workflow.id },
      include: { steps: { orderBy: { order: 'asc' } } },
    })
  })
}

/**
 * Validates the draft and freezes a new immutable version. The workflow is
 * marked PUBLISHED (it stays published while new versions are added).
 */
export async function publishWorkflow(ctx: Context, workflowId: string) {
  assertManage(ctx)

  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, organizationId: ctx.organizationId },
    include: { steps: { orderBy: { order: 'asc' } } },
  })
  if (!workflow) throw notFound('Workflow not found')
  if (workflow.status === 'ARCHIVED') throw invalid('Archived workflows cannot be published')

  const steps = workflow.steps.map((step) => ({
    name: step.name,
    description: step.description ?? undefined,
    assigneeRole: step.assigneeRole,
    dueInDays: step.dueInDays,
  }))
  const snapshot: SnapshotStep[] = validateForPublish(steps)

  return prisma.$transaction(async (tx) => {
    const latest = await tx.workflowVersion.findFirst({
      where: { workflowId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const version = (latest?.version ?? 0) + 1

    const created = await tx.workflowVersion.create({
      data: {
        workflowId,
        version,
        steps: snapshot as unknown as Prisma.InputJsonValue,
        publishedById: ctx.userId,
      },
    })
    await tx.workflow.update({ where: { id: workflowId }, data: { status: 'PUBLISHED' } })
    return created
  })
}

/**
 * Deletes a workflow. Refuses while process instances are still running so an
 * active process is never destroyed accidentally.
 */
export async function deleteWorkflow(ctx: Context, workflowId: string) {
  assertManage(ctx)

  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, organizationId: ctx.organizationId },
    select: { id: true, _count: { select: { instances: { where: { status: 'RUNNING' } } } } },
  })
  if (!workflow) throw notFound('Workflow not found')
  if (workflow._count.instances > 0) {
    throw conflict('Cannot delete a workflow with running instances')
  }

  await prisma.workflow.delete({ where: { id: workflowId } })
}

/**
 * Starts a process instance from the latest published version and generates one
 * task per step. The first task is claimable (`PENDING`); later steps are
 * `BLOCKED` until the previous one completes.
 */
export async function runInstance(ctx: Context, workflowId: string) {
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, organizationId: ctx.organizationId },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  })
  if (!workflow) throw notFound('Workflow not found')

  const version = workflow.versions[0]
  if (workflow.status !== 'PUBLISHED' || !version) {
    throw invalid('Publish the workflow before starting it')
  }

  const steps = version.steps as unknown as SnapshotStep[]
  if (steps.length === 0) throw invalid('The published version has no steps')

  const now = Date.now()

  return prisma.$transaction(async (tx) => {
    const instance = await tx.processInstance.create({
      data: {
        organizationId: ctx.organizationId,
        workflowId,
        versionId: version.id,
        startedById: ctx.userId,
        status: 'RUNNING',
      },
    })

    await tx.task.createMany({
      data: steps.map((step, index) => ({
        organizationId: ctx.organizationId,
        instanceId: instance.id,
        stepOrder: step.order,
        name: step.name,
        description: step.description,
        status: index === 0 ? 'PENDING' : 'BLOCKED',
        requiredRole: step.assigneeRole,
        createdById: ctx.userId,
        dueAt:
          step.dueInDays != null ? new Date(now + step.dueInDays * 24 * 60 * 60 * 1000) : null,
      })),
    })

    return instance
  })
}

export async function listInstances(ctx: Context) {
  return prisma.processInstance.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { startedAt: 'desc' },
    take: 50,
    include: {
      workflow: { select: { id: true, name: true } },
      version: { select: { version: true } },
      startedBy: { select: { id: true, name: true } },
      _count: { select: { tasks: true } },
      tasks: { where: { status: 'DONE' }, select: { id: true } },
    },
  })
}
