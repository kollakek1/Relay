import type { Prisma } from '@/prisma/generated/prisma/client'
import { prisma } from '@/shared/lib/prisma'
import type { Context } from '@/shared/server/context'
import { invalid, notFound } from '@/shared/server/errors'
import { assertCan } from '@/shared/server/permissions'
import { buildStepSnapshot } from './validation'
import { normalizeSnapshot } from './engine'
import type { WorkflowStepInput } from '../schemas/workflowSchema'

export interface WorkflowTemplateDefinition {
  id: string
  name: string
  description: string
  category: string
  steps: WorkflowStepInput[]
}

/**
 * Built-in templates are plain code (no database dependency): they are always
 * available and are real, editable processes once used — not static cards.
 */
export const BUILT_IN_TEMPLATES: WorkflowTemplateDefinition[] = [
  {
    id: 'employee-onboarding',
    name: 'Employee onboarding',
    category: 'People',
    description: 'Collect new-hire details, get manager approval, then provision accounts.',
    steps: [
      {
        name: 'Collect new-hire details',
        fields: [
          { key: 'department', label: 'Department', type: 'select', required: true, options: ['Engineering', 'Sales', 'Support', 'Operations'] },
          { key: 'startDate', label: 'Start date', type: 'date', required: true },
          { key: 'needsHardware', label: 'Needs hardware', type: 'checkbox' },
          { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
      },
      { name: 'Manager approval', kind: 'APPROVAL', approvalMode: 'ANY', assigneeRole: 'ADMIN' },
      {
        name: 'Provision accounts',
        condition: { field: 'needsHardware', op: 'isTrue' },
      },
    ],
  },
  {
    id: 'purchase-approval',
    name: 'Purchase approval',
    category: 'Finance',
    description: 'Request a purchase; finance must sign off on larger amounts.',
    steps: [
      {
        name: 'Purchase request',
        fields: [
          { key: 'amount', label: 'Amount', type: 'number', required: true, min: 0 },
          { key: 'vendor', label: 'Vendor', type: 'text', required: true },
          { key: 'justification', label: 'Justification', type: 'textarea' },
        ],
      },
      { name: 'Manager approval', kind: 'APPROVAL', approvalMode: 'ANY', assigneeRole: 'ADMIN' },
      {
        name: 'Finance sign-off',
        kind: 'APPROVAL',
        approvalMode: 'ALL',
        assigneeRole: 'OWNER',
        condition: { field: 'amount', op: 'gt', value: 1000 },
      },
      { name: 'Place the order' },
    ],
  },
  {
    id: 'time-off-request',
    name: 'Time-off request',
    category: 'People',
    description: 'Submit dates, get line-manager approval.',
    steps: [
      {
        name: 'Request time off',
        fields: [
          { key: 'startDate', label: 'First day', type: 'date', required: true },
          { key: 'endDate', label: 'Last day', type: 'date', required: true },
          { key: 'reason', label: 'Reason', type: 'text' },
        ],
      },
      { name: 'Manager approval', kind: 'APPROVAL', approvalMode: 'ANY', assigneeRole: 'ADMIN' },
      { name: 'Update the calendar' },
    ],
  },
  {
    id: 'support-triage',
    name: 'Support ticket triage',
    category: 'Support',
    description: 'Triage an incoming ticket and escalate critical issues.',
    steps: [
      {
        name: 'Triage ticket',
        fields: [
          { key: 'severity', label: 'Severity', type: 'select', required: true, options: ['low', 'normal', 'high', 'critical'] },
          { key: 'summary', label: 'Summary', type: 'text', required: true },
        ],
      },
      {
        name: 'Escalate to on-call',
        condition: { field: 'severity', op: 'eq', value: 'critical' },
        dueInDays: 1,
      },
      { name: 'Close the ticket' },
    ],
  },
]

export async function listTemplates(ctx: Context) {
  const saved = await prisma.workflowTemplate.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, description: true, category: true, createdAt: true, steps: true },
  })
  return { builtIn: BUILT_IN_TEMPLATES, saved }
}

/**
 * Creates a new draft workflow from a template (built-in or workspace-saved).
 * The steps are copied once — afterwards the workflow is fully independent.
 */
export async function createWorkflowFromTemplate(
  ctx: Context,
  input: { templateId: string; name?: string }
) {
  assertCan(ctx, 'workflow.create', 'Creating workflows requires the Admin role or higher')

  let steps: WorkflowStepInput[]
  let name: string
  let description: string | null

  const builtIn = BUILT_IN_TEMPLATES.find((template) => template.id === input.templateId)
  if (builtIn) {
    steps = builtIn.steps
    name = input.name?.trim() || builtIn.name
    description = builtIn.description
  } else {
    const saved = await prisma.workflowTemplate.findFirst({
      where: { id: input.templateId, organizationId: ctx.organizationId },
    })
    if (!saved) throw notFound('Template not found')
    steps = normalizeSnapshot(saved.steps).steps.map((step) => ({
      name: step.name,
      description: step.description ?? undefined,
      assigneeRole: step.assigneeRole,
      dueInDays: step.dueInDays,
      kind: step.kind,
      approvalMode: step.approvalMode,
      fields: step.fields,
      condition: step.condition,
    }))
    name = input.name?.trim() || saved.name
    description = saved.description
  }

  const snapshot = buildStepSnapshot(steps)

  return prisma.$transaction(async (tx) => {
    const workflow = await tx.workflow.create({
      data: {
        organizationId: ctx.organizationId,
        name,
        description,
        createdById: ctx.userId,
        status: 'DRAFT',
      },
      select: { id: true },
    })

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

    return workflow
  })
}

/** Saves an existing workflow's current draft as a reusable workspace template. */
export async function saveWorkflowAsTemplate(
  ctx: Context,
  input: { workflowId: string; name: string; description?: string; category?: string }
) {
  assertCan(ctx, 'template.manage', 'Managing templates requires the Admin role or higher')

  const workflow = await prisma.workflow.findFirst({
    where: { id: input.workflowId, organizationId: ctx.organizationId },
    include: { steps: { orderBy: { order: 'asc' } } },
  })
  if (!workflow) throw notFound('Workflow not found')
  if (workflow.steps.length === 0) throw invalid('This workflow has no steps to save')

  const steps = buildStepSnapshot(
    workflow.steps.map((step) => ({
      name: step.name,
      description: step.description ?? undefined,
      assigneeRole: step.assigneeRole,
      dueInDays: step.dueInDays,
      kind: step.kind,
      approvalMode: step.approvalMode,
      fields: normalizeSnapshot({ steps: [{ fields: step.fields }] }).steps[0].fields,
      condition: normalizeSnapshot({ steps: [{ condition: step.condition }] }).steps[0].condition,
    }))
  )

  return prisma.workflowTemplate.create({
    data: {
      organizationId: ctx.organizationId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      category: input.category?.trim() || 'Custom',
      steps: steps as unknown as Prisma.InputJsonValue,
      createdById: ctx.userId,
    },
  })
}
