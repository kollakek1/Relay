import { z } from 'zod'

/**
 * A single editable step of a workflow draft. `assigneeRole` narrows who may
 * claim the generated task; `dueInDays` sets the task deadline relative to the
 * moment the instance starts.
 */
export const workflowStepSchema = z.object({
  name: z.string().trim().min(1, 'Step name is required').max(120),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  assigneeRole: z.enum(['OWNER', 'ADMIN', 'MEMBER']).nullable().optional(),
  dueInDays: z.number().int().min(0).max(365).nullable().optional(),
})

export const createWorkflowSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
})

/** Full draft replacement: metadata + ordered steps (at least one). */
export const saveWorkflowSchema = z.object({
  workflowId: z.string().min(1),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  steps: z.array(workflowStepSchema).min(1, 'A workflow needs at least one step').max(50),
})

export const workflowIdSchema = z.object({ workflowId: z.string().min(1) })

export type WorkflowStepInput = z.infer<typeof workflowStepSchema>
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>
export type SaveWorkflowInput = z.infer<typeof saveWorkflowSchema>
