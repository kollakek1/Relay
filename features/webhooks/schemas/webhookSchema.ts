import { z } from 'zod'

export const createWebhookSchema = z.object({
  url: z.url('Enter a valid URL'),
  events: z.array(z.string().min(1)).min(1, 'Select at least one event'),
})

export const updateWebhookSchema = z.object({
  id: z.string().min(1),
  events: z.array(z.string().min(1)).optional(),
  active: z.boolean().optional(),
})

export const webhookIdSchema = z.object({ id: z.string().min(1) })
export const deliveryIdSchema = z.object({ id: z.string().min(1) })
