import { z } from 'zod'

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
