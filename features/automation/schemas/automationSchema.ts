import { z } from 'zod'
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
