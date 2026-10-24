import { z } from 'zod'

export const createCommentSchema = z.object({
  taskId: z.string().min(1),
  body: z.string().trim().min(1, 'Comment cannot be empty').max(5000),
})

export const runInstanceSchema = z.object({
  workflowId: z.string().min(1),
})

export const markNotificationsSchema = z.object({
  ids: z.array(z.string().min(1)).max(200).optional(),
})

export type CreateCommentInput = z.infer<typeof createCommentSchema>
