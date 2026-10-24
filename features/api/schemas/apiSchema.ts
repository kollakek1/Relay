import { z } from 'zod'

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
