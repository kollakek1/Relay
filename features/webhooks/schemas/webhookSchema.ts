import { z } from 'zod'
import type { TFunction } from '@/shared/i18n/translate'

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

/**
 * Localized variant for client forms. The exported schema above stays in
 * English so server actions keep stable, English validation messages; client
 * components build this instead.
 */
export function createCreateWebhookSchema(t: TFunction) {
  return z.object({
    url: z.url(t('validation.url')),
    events: z.array(z.string().min(1)).min(1, t('validation.eventRequired')),
  })
}
