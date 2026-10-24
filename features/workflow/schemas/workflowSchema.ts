import { z } from 'zod'
import type { TFunction } from '@/shared/i18n/translate'

export const formFieldTypeSchema = z.enum([
  'text',
  'textarea',
  'number',
  'date',
  'select',
  'checkbox',
])

export const workflowFormFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, 'Field key is required')
    .max(40)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Key must start with a letter (letters, numbers, _)'),
  label: z.string().trim().min(1, 'Field label is required').max(120),
  type: formFieldTypeSchema,
  required: z.boolean().optional(),
  options: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
})

export const stepConditionSchema = z.object({
  field: z.string().trim().min(1).max(40),
  op: z.enum(['eq', 'neq', 'gt', 'lt', 'contains', 'isTrue', 'isFalse']),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
})

/**
 * A single editable step of a workflow draft. `fields` defines the form a
 * performer fills in; `condition` optionally skips the step based on variables
 * collected by earlier steps.
 */
export const workflowStepSchema = z.object({
  name: z.string().trim().min(1, 'Step name is required').max(120),
  description: z.string().trim().max(2000).optional(),
  assigneeRole: z.enum(['OWNER', 'ADMIN', 'MEMBER']).nullable().optional(),
  dueInDays: z.number().int().min(0).max(365).nullable().optional(),
  kind: z.enum(['TASK', 'APPROVAL']).default('TASK'),
  approvalMode: z.enum(['ANY', 'ALL']).nullable().optional(),
  fields: z.array(workflowFormFieldSchema).max(30).default([]),
  condition: stepConditionSchema.nullable().optional(),
})

export const createWorkflowSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  description: z.string().trim().max(2000).optional(),
})

/** Full draft replacement: metadata + ordered steps (at least one). */
export const saveWorkflowSchema = z.object({
  workflowId: z.string().min(1),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  description: z.string().trim().max(2000).optional(),
  steps: z.array(workflowStepSchema).min(1, 'A workflow needs at least one step').max(50),
})

export const workflowIdSchema = z.object({ workflowId: z.string().min(1) })

export const createFromTemplateSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().trim().min(2).max(120).optional(),
})

export const saveAsTemplateSchema = z.object({
  workflowId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).optional(),
  category: z.string().trim().max(60).optional(),
})

export const draftFromVersionSchema = z.object({
  workflowId: z.string().min(1),
  version: z.number().int().min(1),
})

/**
 * Localized variants for client forms. The exported schemas above stay in
 * English so server actions keep stable, English validation messages; client
 * components build these instead.
 */
export function createWorkflowFormFieldSchema(t: TFunction) {
  return z.object({
    key: z
      .string()
      .trim()
      .min(1, t('validation.fieldKeyRequired'))
      .max(40)
      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, t('validation.fieldKeyInvalid')),
    label: z.string().trim().min(1, t('validation.fieldLabelRequired')).max(120),
    type: formFieldTypeSchema,
    required: z.boolean().optional(),
    options: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  })
}

export function createWorkflowStepSchema(t: TFunction) {
  return z.object({
    name: z.string().trim().min(1, t('validation.stepNameRequired')).max(120),
    description: z.string().trim().max(2000).optional(),
    assigneeRole: z.enum(['OWNER', 'ADMIN', 'MEMBER']).nullable().optional(),
    dueInDays: z.number().int().min(0).max(365).nullable().optional(),
    kind: z.enum(['TASK', 'APPROVAL']).default('TASK'),
    approvalMode: z.enum(['ANY', 'ALL']).nullable().optional(),
    fields: z.array(createWorkflowFormFieldSchema(t)).max(30).default([]),
    condition: stepConditionSchema.nullable().optional(),
  })
}

export function createCreateWorkflowSchema(t: TFunction) {
  return z.object({
    name: z.string().trim().min(2, t('validation.workflowNameMin')).max(120),
    description: z.string().trim().max(2000).optional(),
  })
}

export function createSaveWorkflowSchema(t: TFunction) {
  return z.object({
    workflowId: z.string().min(1),
    name: z.string().trim().min(2, t('validation.workflowNameMin')).max(120),
    description: z.string().trim().max(2000).optional(),
    steps: z.array(createWorkflowStepSchema(t)).min(1, t('validation.stepsRequired')).max(50),
  })
}

// `z.input` keeps `kind`/`fields`/`condition` optional for callers (actions pass
// fully-parsed values; services/tests may supply partial steps).
export type WorkflowStepInput = z.input<typeof workflowStepSchema>
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>
export interface SaveWorkflowInput {
  workflowId: string
  name: string
  description?: string
  steps: WorkflowStepInput[]
}
export type WorkflowFormFieldInput = z.infer<typeof workflowFormFieldSchema>
export type StepConditionInput = z.infer<typeof stepConditionSchema>
