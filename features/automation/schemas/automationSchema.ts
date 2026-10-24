import { z } from 'zod'
import type { TFunction } from '@/shared/i18n/translate'
import { AUTOMATION_ACTIONS, AUTOMATION_TRIGGERS } from '../server/service'

export const createAutomationSchema = z.object({
  name: z.string().trim().min(2, 'Give the automation a name').max(80),
  trigger: z.enum(AUTOMATION_TRIGGERS),
  action: z.enum(AUTOMATION_ACTIONS),
  config: z.record(z.string(), z.unknown()).default({}),
})

export const automationIdSchema = z.object({ id: z.string().min(1) })

export const toggleAutomationSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
})

/**
 * Localized variant for client forms. The exported schema above stays in
 * English so server actions keep stable, English validation messages; client
 * components build this instead.
 */
export function createCreateAutomationSchema(t: TFunction) {
  return z.object({
    name: z.string().trim().min(2, t('validation.automationName')).max(80),
    trigger: z.enum(AUTOMATION_TRIGGERS),
    action: z.enum(AUTOMATION_ACTIONS),
    config: z.record(z.string(), z.unknown()).default({}),
  })
}
