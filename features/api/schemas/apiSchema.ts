import { z } from 'zod'
import type { TFunction } from '@/shared/i18n/translate'

export const apiScopeSchema = z.enum([
  'workflows:read',
  'tasks:read',
  'tasks:write',
  'instances:read',
  'instances:write',
])

export const createApiKeySchema = z.object({
  name: z.string().trim().min(2, 'Give the key a name').max(60),
  scopes: z.array(apiScopeSchema).min(1, 'Select at least one scope'),
})

export const apiKeyIdSchema = z.object({ id: z.string().min(1) })

/**
 * Localized variant for client forms. The exported schema above stays in
 * English so server actions keep stable, English validation messages; client
 * components build this instead.
 */
export function createCreateApiKeySchema(t: TFunction) {
  return z.object({
    name: z.string().trim().min(2, t('validation.apiKeyName')).max(60),
    scopes: z.array(apiScopeSchema).min(1, t('validation.scopeRequired')),
  })
}
