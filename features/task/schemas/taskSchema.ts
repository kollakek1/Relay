import { z } from 'zod'

export const TASK_STATUSES = [
  'BLOCKED',
  'PENDING',
  'CLAIMED',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
] as const

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const

export const taskStatusSchema = z.enum(TASK_STATUSES)
export const taskPrioritySchema = z.enum(TASK_PRIORITIES)

export const taskIdSchema = z.object({ taskId: z.string().min(1) })

export const assignTaskSchema = z.object({
  taskId: z.string().min(1),
  assigneeId: z.string().min(1).nullable(),
})

export const updateTaskSchema = z.object({
  taskId: z.string().min(1),
  priority: taskPrioritySchema.optional(),
  dueAt: z.coerce.date().nullable().optional(),
})

export const transitionTaskSchema = z.object({
  taskId: z.string().min(1),
  to: taskStatusSchema,
})

/**
 * Query/filter parameters for task lists. All optional; unknown values fall
 * back to defaults in the service layer.
 */
export const taskQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: taskStatusSchema.optional(),
  assignee: z.enum(['me', 'unassigned', 'all']).optional(),
  priority: taskPrioritySchema.optional(),
  sort: z.enum(['createdAt', 'dueAt', 'priority']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
})

export type TaskQuery = z.infer<typeof taskQuerySchema>
export type AssignTaskInput = z.infer<typeof assignTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type TransitionTaskInput = z.infer<typeof transitionTaskSchema>
