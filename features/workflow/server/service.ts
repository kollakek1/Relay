import type { Prisma } from '@/prisma/generated/prisma/client'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { conflict, invalid, notFound } from '@/shared/server/errors'
import { assertCan } from '@/shared/server/permissions'
import type {
  CreateWorkflowInput,
  SaveWorkflowInput,
} from '../schemas/workflowSchema'
import { buildStepSnapshot, validateForPublish } from './validation'
import {
  evaluateCondition,
  normalizeSnapshot,
  type ProcessSnapshotStep,
  type StepCondition,
  type WorkflowFormField,
} from './engine'
import { notifyApprovers } from '@/features/task/server/approvals'
import { enqueueEvent } from '@/features/webhooks/server/delivery'
import { recordAudit } from '@/features/organization/server/audit'

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

export async function listWorkflows(
  ctx: Context,
  search?: string,
  options: { includeArchived?: boolean } = {}
): Promise<WorkflowListItem[]> {
  const term = search?.trim()
  return prisma.workflow.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(options.includeArchived ? {} : { status: { not: 'ARCHIVED' } }),
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

/** Run counts used by the workflow detail danger zone. */
export async function getWorkflowRunStats(ctx: Context, workflowId: string) {
  const [total, running] = await Promise.all([
    prisma.processInstance.count({ where: { workflowId, organizationId: ctx.organizationId } }),
    prisma.processInstance.count({
      where: { workflowId, organizationId: ctx.organizationId, status: 'RUNNING' },
    }),
  ])
  return { total, running }
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
  assertCan(ctx, 'workflow.create', 'Creating workflows requires the Admin role or higher')
  return prisma.workflow.create({
    data: {
      organizationId: ctx.organizationId,
      name: input.name,
      description: input.description?.trim() || null,
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
  assertCan(ctx, 'workflow.edit', 'Editing workflows requires the Admin role or higher')

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
        kind: step.kind,
        approvalMode: step.approvalMode,
        fields: step.fields.length > 0 ? (step.fields as unknown as Prisma.InputJsonValue) : undefined,
        condition: step.condition ? (step.condition as unknown as Prisma.InputJsonValue) : undefined,
      })),
    })
    await tx.workflow.update({
      where: { id: workflow.id },
      data: { name: input.name, description: input.description?.trim() || null },
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
  assertCan(ctx, 'workflow.publish', 'Publishing workflows requires the Admin role or higher')

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
    kind: step.kind,
    approvalMode: step.approvalMode,
    fields: (step.fields as WorkflowFormField[] | null) ?? [],
    condition: (step.condition as StepCondition | null) ?? null,
  }))
  const snapshot: ProcessSnapshotStep[] = validateForPublish(steps)

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
        steps: { schemaVersion: 2, steps: snapshot } as unknown as Prisma.InputJsonValue,
        publishedById: ctx.userId,
      },
    })
    await tx.workflow.update({ where: { id: workflowId }, data: { status: 'PUBLISHED' } })
    await enqueueEvent(tx, {
      organizationId: ctx.organizationId,
      topic: 'workflow.published',
      payload: { workflowId, version },
    })
    return created
  })
}

/**
 * Archives a workflow: hides it from the active list without touching its runs
 * or history. Reversible via {@link restoreWorkflow}.
 */
export async function archiveWorkflow(ctx: Context, workflowId: string) {
  assertCan(ctx, 'workflow.edit', 'Managing workflows requires the Admin role or higher')

  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, organizationId: ctx.organizationId },
    select: { id: true, status: true },
  })
  if (!workflow) throw notFound('Workflow not found')
  if (workflow.status === 'ARCHIVED') throw conflict('This workflow is already archived')

  return prisma.$transaction(async (tx) => {
    const updated = await tx.workflow.update({ where: { id: workflow.id }, data: { status: 'ARCHIVED' } })
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'workflow.archived',
      targetType: 'workflow',
      targetId: workflow.id,
      metadata: { from: workflow.status },
    })
    return updated
  })
}

/**
 * Restores an archived workflow to the active list. It returns as `PUBLISHED`
 * when it already had a published version, otherwise as `DRAFT`.
 */
export async function restoreWorkflow(ctx: Context, workflowId: string) {
  assertCan(ctx, 'workflow.edit', 'Managing workflows requires the Admin role or higher')

  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, organizationId: ctx.organizationId },
    select: { id: true, status: true, _count: { select: { versions: true } } },
  })
  if (!workflow) throw notFound('Workflow not found')
  if (workflow.status !== 'ARCHIVED') throw conflict('This workflow is not archived')

  const target = workflow._count.versions > 0 ? 'PUBLISHED' : 'DRAFT'
  return prisma.$transaction(async (tx) => {
    const updated = await tx.workflow.update({ where: { id: workflow.id }, data: { status: target } })
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'workflow.restored',
      targetType: 'workflow',
      targetId: workflow.id,
      metadata: { to: target },
    })
    return updated
  })
}

export interface DeleteWorkflowOptions {
  /**
   * Confirm deletion of a workflow that already has runs. Without it, a
   * workflow with instances is refused (CONFLICT) so the caller can warn first.
   * A workflow with a *running* instance is always refused.
   */
  withRuns?: boolean
}

/**
 * Deletes a workflow. Running instances are never destroyed — the workflow is
 * refused while any instance is `RUNNING`. Finished runs are only cascaded when
 * `withRuns` is set, after an explicit confirmation. Pending outbox events and
 * webhook deliveries for the deleted runs are removed in the same transaction
 * so nothing is delivered for a process that no longer exists; already-delivered
 * history and the audit log are preserved.
 */
export async function deleteWorkflow(
  ctx: Context,
  workflowId: string,
  options: DeleteWorkflowOptions = {}
) {
  assertCan(ctx, 'workflow.delete', 'Deleting workflows requires the Admin role or higher')

  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, organizationId: ctx.organizationId },
    select: { id: true, name: true },
  })
  if (!workflow) throw notFound('Workflow not found')

  const [running, total] = await Promise.all([
    prisma.processInstance.count({
      where: { workflowId, organizationId: ctx.organizationId, status: 'RUNNING' },
    }),
    prisma.processInstance.count({ where: { workflowId, organizationId: ctx.organizationId } }),
  ])

  if (running > 0) {
    throw conflict('Cannot delete a workflow with running instances')
  }
  if (total > 0 && !options.withRuns) {
    throw conflict('This workflow has runs; confirm deleting them as well')
  }

  await prisma.$transaction(async (tx) => {
    if (total > 0) {
      const instances = await tx.processInstance.findMany({
        where: { workflowId, organizationId: ctx.organizationId },
        select: { id: true },
      })
      const instanceIds = instances.map((row) => row.id)
      const tasks = await tx.task.findMany({
        where: { instanceId: { in: instanceIds } },
        select: { id: true },
      })
      // Pending events reference either an instance id or a task id in their
      // JSON payload; drop both so nothing is delivered for a deleted entity.
      const references = [
        ...instanceIds.map((id) => ({ payload: { path: ['instanceId'], equals: id } })),
        ...tasks.map((task) => ({ payload: { path: ['taskId'], equals: task.id } })),
      ]
      if (references.length > 0) {
        const pendingEvents = await tx.outboxEvent.findMany({
          where: {
            organizationId: ctx.organizationId,
            status: { in: ['PENDING', 'PROCESSING'] },
            OR: references,
          },
          select: { id: true },
        })
        if (pendingEvents.length > 0) {
          const eventIds = pendingEvents.map((event) => event.id)
          await tx.webhookDelivery.deleteMany({
            where: { eventId: { in: eventIds }, status: { in: ['PENDING', 'PROCESSING'] } },
          })
          await tx.outboxEvent.deleteMany({ where: { id: { in: eventIds } } })
        }
      }
    }

    // Cascades to versions, steps, instances and their tasks/history.
    await tx.workflow.delete({ where: { id: workflow.id } })
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'workflow.deleted',
      targetType: 'workflow',
      targetId: workflow.id,
      metadata: { name: workflow.name, deletedRuns: total },
    })
  })
}

/**
 * Starts a process instance from the latest published version and generates one
 * task per step. Steps are created `BLOCKED`; the engine then activates the
 * first step whose condition holds (skipping/`CANCELLED` steps whose condition
 * is false). Later steps unblock as the pipeline advances.
 */
export async function runInstance(ctx: Context, workflowId: string) {
  assertCan(ctx, 'workflow.start', 'You do not have permission to start processes')
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId, organizationId: ctx.organizationId },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  })
  if (!workflow) throw notFound('Workflow not found')

  const version = workflow.versions[0]
  if (workflow.status !== 'PUBLISHED' || !version) {
    throw invalid('Publish the workflow before starting it')
  }

  const snapshot = normalizeSnapshot(version.steps)
  if (snapshot.steps.length === 0) throw invalid('The published version has no steps')

  const now = Date.now()
  const variables: Record<string, unknown> = {}

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

    const created: Array<{
      order: number
      taskId: string
      condition: StepCondition | null
      kind: ProcessSnapshotStep['kind']
      name: string
      requiredRole: ProcessSnapshotStep['assigneeRole']
    }> = []
    for (const step of snapshot.steps) {
      const task = await tx.task.create({
        data: {
          organizationId: ctx.organizationId,
          instanceId: instance.id,
          stepOrder: step.order,
          name: step.name,
          description: step.description,
          status: 'BLOCKED',
          kind: step.kind,
          requiredRole: step.assigneeRole,
          fields: step.fields.length > 0 ? (step.fields as unknown as Prisma.InputJsonValue) : undefined,
          createdById: ctx.userId,
          dueAt:
            step.dueInDays != null ? new Date(now + step.dueInDays * 24 * 60 * 60 * 1000) : null,
        },
        select: { id: true, stepOrder: true },
      })
      created.push({
        order: task.stepOrder,
        taskId: task.id,
        condition: step.condition,
        kind: step.kind,
        name: step.name,
        requiredRole: step.assigneeRole,
      })
    }

    // Activate the first step whose condition holds; skip the rest until one does.
    let activated = false
    for (const entry of created) {
      if (activated) break
      if (evaluateCondition(entry.condition, variables)) {
        await tx.task.update({ where: { id: entry.taskId }, data: { status: 'PENDING' } })
        await tx.taskActivity.create({
          data: { taskId: entry.taskId, actorId: ctx.userId, type: 'STATUS_CHANGED', fromValue: 'BLOCKED', toValue: 'PENDING' },
        })
        if (entry.kind === 'APPROVAL') {
          await notifyApprovers(tx, {
            organizationId: ctx.organizationId,
            taskId: entry.taskId,
            taskName: entry.name,
            requiredRole: entry.requiredRole,
            workflowName: workflow.name,
          })
        }
        activated = true
      } else {
        await tx.task.update({
          where: { id: entry.taskId },
          data: { status: 'CANCELLED', cancelReason: 'Skipped by condition' },
        })
        await tx.taskActivity.create({
          data: { taskId: entry.taskId, actorId: ctx.userId, type: 'STATUS_CHANGED', fromValue: 'BLOCKED', toValue: 'CANCELLED' },
        })
      }
    }

    if (!activated) {
      await tx.processInstance.update({
        where: { id: instance.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
    }

    await enqueueEvent(tx, {
      organizationId: ctx.organizationId,
      topic: 'instance.started',
      payload: { instanceId: instance.id, workflowId, versionId: version.id },
    })

    return instance
  })
}

const instanceListInclude = {
  workflow: { select: { id: true, name: true } },
  version: { select: { version: true } },
  startedBy: { select: { id: true, name: true } },
  _count: { select: { tasks: true } },
  tasks: { where: { status: 'DONE' }, select: { id: true } },
} satisfies Prisma.ProcessInstanceInclude

export async function listInstances(ctx: Context) {
  return prisma.processInstance.findMany({
    where: { organizationId: ctx.organizationId, archivedAt: null },
    orderBy: { startedAt: 'desc' },
    take: 50,
    include: instanceListInclude,
  })
}

/**
 * Lists archived (soft-deleted) instances for the workspace. Hidden from the
 * active list; visible here within the caller's permissions.
 */
export async function listArchivedInstances(
  ctx: Context,
  options: { search?: string; status?: 'COMPLETED' | 'CANCELLED' } = {}
) {
  const term = options.search?.trim()
  return prisma.processInstance.findMany({
    where: {
      organizationId: ctx.organizationId,
      archivedAt: { not: null },
      ...(options.status ? { status: options.status } : {}),
      ...(term ? { workflow: { name: { contains: term, mode: 'insensitive' } } } : {}),
    },
    orderBy: { archivedAt: 'desc' },
    take: 100,
    include: {
      ...instanceListInclude,
      archivedBy: { select: { id: true, name: true } },
    },
  })
}

/** Task statuses that mean "work is still outstanding" on an instance. */
const ACTIVE_TASK_STATUSES = ['BLOCKED', 'PENDING', 'CLAIMED', 'IN_PROGRESS'] as const

/** Instance states that may be archived: both are terminal. */
const ARCHIVABLE_INSTANCE_STATUSES = ['COMPLETED', 'CANCELLED'] as const

/**
 * Archives a *finished* process instance (a reversible soft delete). Refuses
 * while any task is still outstanding and never touches the running engine.
 *
 * Concurrency: the archive is a single conditional `updateMany` guarded by
 * `archivedAt: null`, so two simultaneous requests cannot both succeed and no
 * partially archived row can exist.
 */
export async function archiveInstance(ctx: Context, instanceId: string) {
  assertCan(ctx, 'workflow.delete', 'You do not have permission to archive processes')

  const instance = await prisma.processInstance.findFirst({
    where: { id: instanceId, organizationId: ctx.organizationId },
    select: {
      id: true,
      status: true,
      archivedAt: true,
      _count: { select: { tasks: { where: { status: { in: [...ACTIVE_TASK_STATUSES] } } } } },
    },
  })
  if (!instance) throw notFound('Process instance not found')
  if (instance.archivedAt) throw conflict('This process is already archived')
  if (!ARCHIVABLE_INSTANCE_STATUSES.includes(instance.status as 'COMPLETED' | 'CANCELLED')) {
    throw conflict('Only finished processes can be archived')
  }
  if (instance._count.tasks > 0) {
    throw conflict('Finish or cancel every task before archiving this process')
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.processInstance.updateMany({
      where: {
        id: instance.id,
        organizationId: ctx.organizationId,
        archivedAt: null,
        status: { in: [...ARCHIVABLE_INSTANCE_STATUSES] },
      },
      data: { archivedAt: new Date(), archivedById: ctx.userId },
    })
    if (updated.count === 0) {
      throw conflict('The process was modified by someone else; reload and try again')
    }
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'instance.archived',
      targetType: 'process_instance',
      targetId: instance.id,
      metadata: { status: instance.status },
    })
    await enqueueEvent(tx, {
      organizationId: ctx.organizationId,
      topic: 'instance.archived',
      payload: { instanceId: instance.id },
    })
    return tx.processInstance.findUniqueOrThrow({ where: { id: instance.id } })
  })
}

/**
 * Restores an archived instance to the active list. The instance stays in the
 * terminal state it was archived in — restoring is not a re-run.
 */
export async function restoreInstance(ctx: Context, instanceId: string) {
  assertCan(ctx, 'workflow.delete', 'You do not have permission to restore processes')

  const instance = await prisma.processInstance.findFirst({
    where: { id: instanceId, organizationId: ctx.organizationId },
    select: { id: true, archivedAt: true },
  })
  if (!instance) throw notFound('Process instance not found')
  if (!instance.archivedAt) throw conflict('This process is not archived')

  return prisma.$transaction(async (tx) => {
    const updated = await tx.processInstance.updateMany({
      where: { id: instance.id, organizationId: ctx.organizationId, archivedAt: { not: null } },
      data: { archivedAt: null, archivedById: null },
    })
    if (updated.count === 0) {
      throw conflict('The process was modified by someone else; reload and try again')
    }
    await recordAudit(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: 'instance.restored',
      targetType: 'process_instance',
      targetId: instance.id,
    })
    await enqueueEvent(tx, {
      organizationId: ctx.organizationId,
      topic: 'instance.restored',
      payload: { instanceId: instance.id },
    })
    return tx.processInstance.findUniqueOrThrow({ where: { id: instance.id } })
  })
}
